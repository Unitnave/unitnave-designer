"""
UNITNAVE - Optimizador de Layout con OR-Tools v3
Motor de optimización combinatoria de Google

CAMBIOS EN v3 (CRÍTICOS):
─────────────────────────────────────────────────────────────
✅ CORRECCIÓN 1: Solo fija elemento movido + muelles + oficinas
   - Las demás estanterías PUEDEN moverse para hacer hueco
   - Esto resuelve el INFEASIBLE constante

✅ CORRECCIÓN 2: Eliminadas restricciones de pasillo problemáticas
   - `_add_aisle_constraints` causaba INFEASIBLE cuando las 
     estanterías no podían mantener el orden original
   - Ahora solo usamos no-solapamiento (más flexible)

✅ CORRECCIÓN 3: Nuevo objetivo - minimizar movimiento total
   - Las estanterías se mueven lo mínimo necesario
   - Evita reorganizar todo el almacén innecesariamente

✅ CORRECCIÓN 4: Mejor logging para diagnóstico
─────────────────────────────────────────────────────────────

Características:
- Recolocación automática al mover una pieza
- Restricciones de no-solapamiento
- Respeta zonas prohibidas (muelles, oficinas, maniobra)
- Optimización de distancias de picking (opcional)

@version 3.0
"""

import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

from ortools.sat.python import cp_model

logger = logging.getLogger(__name__)


# ============================================================
# CONSTANTES
# ============================================================
SCALE = 1000  # Convertir metros a milímetros para precisión entera
MIN_AISLE_WIDTH_MM = 3500  # 3.5m en mm (pasillo principal)
MIN_OPERATIVE_AISLE_MM = 2500  # 2.5m en mm (pasillo operativo)
MIN_DOCK_DISTANCE_MM = 1500  # 1.5m en mm


# ============================================================
# MODELOS
# ============================================================
@dataclass
class OptimizedElement:
    """Elemento con posición optimizada"""
    id: str
    type: str
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0
    was_moved: bool = False
    
    def to_dict(self):
        return asdict(self)


@dataclass 
class OptimizationResult:
    """Resultado de la optimización"""
    success: bool
    elements: List[OptimizedElement]
    solver_status: str
    solve_time_ms: float
    objective_value: float
    messages: List[str]
    
    def to_dict(self):
        return {
            'success': self.success,
            'elements': [e.to_dict() for e in self.elements],
            'solver_status': self.solver_status,
            'solve_time_ms': self.solve_time_ms,
            'objective_value': self.objective_value,
            'messages': self.messages
        }


# ============================================================
# CLASE PRINCIPAL
# ============================================================
class LayoutOptimizer:
    """
    Optimizador de layout usando OR-Tools CP-SAT v3
    
    CAMBIO PRINCIPAL v3:
    ────────────────────
    Solo se fijan: elemento movido + muelles + oficinas.
    El resto de estanterías PUEDEN moverse para hacer hueco.
    
    Esto resuelve el problema de INFEASIBLE constante.
    
    Uso:
        optimizer = LayoutOptimizer(length=80, width=40)
        result = optimizer.optimize(
            elements=elements_list,
            moved_element_id='shelf-1',
            moved_position={'x': 10, 'y': 5},
            forbidden_zones=[...]
        )
    """
    
    def __init__(self, length: float, width: float):
        """
        Inicializa el optimizador
        
        Args:
            length: Largo de la nave (m)
            width: Ancho de la nave (m)
        """
        self.length = length
        self.width = width
        self.length_mm = int(length * SCALE)
        self.width_mm = int(width * SCALE)
        
    def optimize(
        self,
        elements: List[Dict[str, Any]],
        moved_element_id: Optional[str] = None,
        moved_position: Optional[Dict[str, float]] = None,
        fixed_elements: Optional[List[str]] = None,
        optimize_picking: bool = False,  # v3: desactivado por defecto
        max_time_seconds: float = 5.0,
        forbidden_zones: Optional[List[Dict[str, Any]]] = None
    ) -> OptimizationResult:
        """
        Optimiza el layout completo
        
        ╔════════════════════════════════════════════════════════════╗
        ║  LÓGICA DE FIJACIÓN v3 (CORREGIDA)                        ║
        ╠════════════════════════════════════════════════════════════╣
        ║  • moved_element_id  → FIJO en moved_position             ║
        ║  • type == 'dock'    → FIJO (muelles no se mueven)        ║
        ║  • type == 'office'  → FIJO (oficinas no se mueven)       ║
        ║  • fixed_elements    → FIJOS (lista explícita)            ║
        ║  • Todo lo demás     → LIBRE (puede moverse)              ║
        ╚════════════════════════════════════════════════════════════╝
        
        Args:
            elements: Lista de elementos
            moved_element_id: ID del elemento movido manualmente
            moved_position: Nueva posición {x, y} del elemento movido
            fixed_elements: IDs adicionales de elementos que no deben moverse
            optimize_picking: Si True, minimiza distancia de picking
            max_time_seconds: Tiempo máximo de optimización
            forbidden_zones: Zonas donde las estanterías libres no pueden estar
            
        Returns:
            OptimizationResult con posiciones optimizadas
        """
        logger.info("=" * 70)
        logger.info(f"🧮 [v3] OPTIMIZANDO LAYOUT")
        logger.info(f"    Elementos: {len(elements)}")
        logger.info(f"    Almacén: {self.length}m x {self.width}m")
        logger.info(f"    Elemento movido: {moved_element_id}")
        logger.info(f"    Nueva posición: {moved_position}")
        logger.info(f"    Zonas prohibidas: {len(forbidden_zones) if forbidden_zones else 0}")
        logger.info("=" * 70)
        
        # Crear modelo CP-SAT
        model = cp_model.CpModel()
        
        # Parsear elementos a formato interno
        parsed_elements = self._parse_elements(elements)
        
        # ════════════════════════════════════════════════════════════
        # ✅ v3: DETERMINAR QUÉ ELEMENTOS ESTÁN FIJOS
        # ════════════════════════════════════════════════════════════
        # Solo fijamos:
        # 1. El elemento que el usuario movió (en su nueva posición)
        # 2. Muelles (nunca se mueven)
        # 3. Oficinas (nunca se mueven)
        # 4. Elementos explícitamente en fixed_elements
        #
        # ⚠️  El RESTO de estanterías pueden moverse para hacer hueco
        # ════════════════════════════════════════════════════════════
        
        fixed_ids = set()
        
        # 1. Elemento movido por el usuario
        if moved_element_id:
            fixed_ids.add(moved_element_id)
        
        # 2. Muelles y oficinas (SIEMPRE fijos)
        for el in parsed_elements:
            if el['type'] in ('dock', 'office'):
                fixed_ids.add(el['id'])
        
        # 3. Elementos explícitamente fijos (si se proporcionan)
        if fixed_elements:
            fixed_ids.update(fixed_elements)
        
        # Contar elementos libres
        free_elements = [el for el in parsed_elements if el['id'] not in fixed_ids]
        free_shelves = [el for el in free_elements if el['type'] == 'shelf']
        
        logger.info(f"🔒 [v3] Elementos FIJOS: {len(fixed_ids)}")
        for fid in list(fixed_ids)[:8]:
            el_type = next((e['type'] for e in parsed_elements if e['id'] == fid), '?')
            logger.info(f"       • {fid} ({el_type})")
        if len(fixed_ids) > 8:
            logger.info(f"       ... y {len(fixed_ids) - 8} más")
        
        logger.info(f"🔓 [v3] Elementos LIBRES: {len(free_elements)} (de los cuales {len(free_shelves)} son estanterías)")
        
        # ════════════════════════════════════════════════════════════
        # CREAR VARIABLES DE POSICIÓN
        # ════════════════════════════════════════════════════════════
        positions = {}
        
        for el in parsed_elements:
            el_id = el['id']
            el_w = el['width_mm']
            el_h = el['height_mm']
            
            is_fixed = el_id in fixed_ids
            
            if is_fixed and el_id == moved_element_id and moved_position:
                # ✅ Elemento movido: fijar en NUEVA posición
                fixed_x = int(moved_position['x'] * SCALE)
                fixed_y = int(moved_position['y'] * SCALE)
                
                # Clamp a límites del almacén
                fixed_x = max(0, min(fixed_x, self.length_mm - el_w))
                fixed_y = max(0, min(fixed_y, self.width_mm - el_h))
                
                x = model.NewIntVar(fixed_x, fixed_x, f"{el_id}_x")
                y = model.NewIntVar(fixed_y, fixed_y, f"{el_id}_y")
                
                logger.info(f"   📍 {el_id} → FIJO en NUEVA posición: ({fixed_x/SCALE:.2f}, {fixed_y/SCALE:.2f})")
                
            elif is_fixed:
                # ✅ Elemento fijo (muelle/oficina): mantener posición actual
                fixed_x = el['x_mm']
                fixed_y = el['y_mm']
                
                x = model.NewIntVar(fixed_x, fixed_x, f"{el_id}_x")
                y = model.NewIntVar(fixed_y, fixed_y, f"{el_id}_y")
                
            else:
                # ✅ v3: Elemento LIBRE - puede moverse dentro del almacén
                max_x = max(0, self.length_mm - el_w)
                max_y = max(0, self.width_mm - el_h)
                
                x = model.NewIntVar(0, max_x, f"{el_id}_x")
                y = model.NewIntVar(0, max_y, f"{el_id}_y")
            
            positions[el_id] = {
                'x': x,
                'y': y,
                'w': el_w,
                'h': el_h,
                'type': el['type'],
                'is_fixed': is_fixed,
                'original_x': el['x_mm'],
                'original_y': el['y_mm']
            }
        
        # ════════════════════════════════════════════════════════════
        # RESTRICCIONES
        # ════════════════════════════════════════════════════════════
        
        # 1. No-solapamiento entre TODOS los elementos
        self._add_no_overlap_constraints(model, positions, parsed_elements)
        
        # 2. ❌ v3: ELIMINAMOS _add_aisle_constraints (causaba INFEASIBLE)
        # Las estanterías pueden estar donde quieran mientras no se solapen
        # Los pasillos se recalculan automáticamente por Shapely en el frontend
        
        # 3. Zonas prohibidas (muelles, oficinas, maniobra)
        if forbidden_zones:
            self._add_forbidden_zones_constraints(model, positions, moved_element_id, forbidden_zones)
        
        # ════════════════════════════════════════════════════════════
        # FUNCIÓN OBJETIVO
        # ════════════════════════════════════════════════════════════
        
        # ✅ v3: Objetivo PRINCIPAL - minimizar movimiento total
        # Esto hace que las estanterías se muevan lo mínimo necesario
        self._add_minimize_movement_objective(model, positions)
        
        # Opcional: también optimizar picking (más lento, desactivado por defecto)
        if optimize_picking:
            self._add_picking_objective(model, positions, parsed_elements)
        
        # ════════════════════════════════════════════════════════════
        # RESOLVER
        # ════════════════════════════════════════════════════════════
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max_time_seconds
        solver.parameters.num_search_workers = 4
        
        logger.info(f"⏱️  [v3] Iniciando solver (max {max_time_seconds}s)...")
        status = solver.Solve(model)
        
        # Procesar resultado
        status_name = solver.StatusName(status)
        
        logger.info(f"📊 [v3] Solver status: {status_name}")
        logger.info(f"📊 [v3] Tiempo: {solver.WallTime()*1000:.0f}ms")
        
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            # Extraer posiciones optimizadas
            optimized = []
            moved_count = 0
            messages = []
            
            for el in parsed_elements:
                el_id = el['id']
                pos = positions[el_id]
                
                new_x = solver.Value(pos['x']) / SCALE
                new_y = solver.Value(pos['y']) / SCALE
                
                was_moved = (
                    abs(new_x - el['x']) > 0.05 or 
                    abs(new_y - el['y']) > 0.05
                )
                
                if was_moved:
                    moved_count += 1
                    logger.info(f"   🔄 {el_id}: ({el['x']:.2f}, {el['y']:.2f}) → ({new_x:.2f}, {new_y:.2f})")
                    messages.append(f"{el_id} movido a ({new_x:.2f}, {new_y:.2f})")
                
                optimized.append(OptimizedElement(
                    id=el_id,
                    type=el['type'],
                    x=round(new_x, 3),
                    y=round(new_y, 3),
                    width=el['width'],
                    height=el['height'],
                    rotation=el.get('rotation', 0),
                    was_moved=was_moved
                ))
            
            logger.info(f"✅ [v3] Optimización completada: {status_name}")
            logger.info(f"✅ [v3] {moved_count} elementos movidos en {solver.WallTime()*1000:.0f}ms")
            
            return OptimizationResult(
                success=True,
                elements=optimized,
                solver_status=status_name,
                solve_time_ms=solver.WallTime() * 1000,
                objective_value=solver.ObjectiveValue() if status == cp_model.OPTIMAL else 0,
                messages=messages if messages else [f"{moved_count} elementos reubicados"]
            )
        else:
            # No se encontró solución
            logger.warning(f"⚠️  [v3] Optimización fallida: {status_name}")
            logger.warning(f"⚠️  [v3] Posibles causas:")
            logger.warning(f"       - No hay espacio suficiente para reorganizar")
            logger.warning(f"       - El elemento movido colisiona con un elemento fijo")
            logger.warning(f"       - Demasiadas zonas prohibidas")
            
            # Devolver elementos sin cambios
            return OptimizationResult(
                success=False,
                elements=[
                    OptimizedElement(
                        id=el['id'],
                        type=el['type'],
                        x=el['x'],
                        y=el['y'],
                        width=el['width'],
                        height=el['height'],
                        rotation=el.get('rotation', 0),
                        was_moved=False
                    )
                    for el in parsed_elements
                ],
                solver_status=status_name,
                solve_time_ms=solver.WallTime() * 1000,
                objective_value=0,
                messages=[f"No se encontró solución válida: {status_name}"]
            )
    
    def _parse_elements(self, elements: List[Dict]) -> List[Dict]:
        """Parsea elementos a formato interno"""
        parsed = []
        
        for el in elements:
            pos = el.get('position', {})
            dims = el.get('dimensions', {})
            el_type = el.get('type', 'unknown')
            
            # Extraer posición
            x = float(pos.get('x', el.get('x', 0)))
            y = float(pos.get('y', pos.get('z', el.get('y', 0))))
            
            # Extraer dimensiones según tipo
            if el_type == 'shelf':
                w = float(dims.get('length', el.get('width', 2.7)))
                h = float(dims.get('depth', el.get('height', 1.1)))
            elif el_type == 'dock':
                w = float(dims.get('width', el.get('width', 3.5)))
                h = float(dims.get('depth', el.get('height', 4.0)))
            elif el_type == 'office':
                w = float(dims.get('length', dims.get('largo', el.get('width', 12))))
                h = float(dims.get('width', dims.get('ancho', el.get('height', 8))))
            elif el_type in ('service_room', 'technical_room'):
                w = float(dims.get('length', dims.get('largo', el.get('width', 6))))
                h = float(dims.get('width', dims.get('ancho', el.get('height', 4))))
            else:
                w = float(dims.get('length', el.get('width', 5)))
                h = float(dims.get('depth', dims.get('width', el.get('height', 5))))
            
            parsed.append({
                'id': el.get('id', f"el-{len(parsed)}"),
                'type': el_type,
                'x': x,
                'y': y,
                'width': w,
                'height': h,
                'x_mm': int(x * SCALE),
                'y_mm': int(y * SCALE),
                'width_mm': int(w * SCALE),
                'height_mm': int(h * SCALE),
                'rotation': el.get('rotation', 0)
            })
        
        return parsed
    
    def _add_no_overlap_constraints(
        self, 
        model: cp_model.CpModel, 
        positions: Dict,
        elements: List[Dict]
    ):
        """
        Añade restricciones de no-solapamiento entre TODOS los elementos.
        
        Dos elementos no se solapan si al menos una de estas condiciones es verdadera:
        - A está completamente a la izquierda de B
        - A está completamente a la derecha de B  
        - A está completamente arriba de B
        - A está completamente abajo de B
        """
        element_ids = list(positions.keys())
        n_constraints = 0
        
        for i, id1 in enumerate(element_ids):
            for id2 in element_ids[i+1:]:
                p1 = positions[id1]
                p2 = positions[id2]
                
                # Crear variables booleanas para las 4 condiciones
                b1 = model.NewBoolVar(f"no_overlap_{id1}_{id2}_left")
                b2 = model.NewBoolVar(f"no_overlap_{id1}_{id2}_right")
                b3 = model.NewBoolVar(f"no_overlap_{id1}_{id2}_below")
                b4 = model.NewBoolVar(f"no_overlap_{id1}_{id2}_above")
                
                # x1 + w1 <= x2 (el1 está a la izquierda de el2)
                model.Add(p1['x'] + p1['w'] <= p2['x']).OnlyEnforceIf(b1)
                
                # x2 + w2 <= x1 (el2 está a la izquierda de el1)
                model.Add(p2['x'] + p2['w'] <= p1['x']).OnlyEnforceIf(b2)
                
                # y1 + h1 <= y2 (el1 está debajo de el2)
                model.Add(p1['y'] + p1['h'] <= p2['y']).OnlyEnforceIf(b3)
                
                # y2 + h2 <= y1 (el2 está debajo de el1)
                model.Add(p2['y'] + p2['h'] <= p1['y']).OnlyEnforceIf(b4)
                
                # Al menos una condición debe cumplirse
                model.AddBoolOr([b1, b2, b3, b4])
                n_constraints += 1
        
        logger.info(f"🔲 [v3] {n_constraints} restricciones de no-solapamiento añadidas")
    
    # ════════════════════════════════════════════════════════════════
    # ❌ v3: ELIMINADO _add_aisle_constraints
    # ════════════════════════════════════════════════════════════════
    # Este método causaba INFEASIBLE porque:
    # 1. Agrupaba estanterías por filas según posición ACTUAL
    # 2. Aplicaba restricciones de orden X fijas
    # 3. Si las estanterías necesitaban cambiar de orden → INFEASIBLE
    #
    # Los pasillos ahora se calculan automáticamente por Shapely
    # en el frontend después de que el solver posicione las estanterías.
    # ════════════════════════════════════════════════════════════════
    
    def _add_forbidden_zones_constraints(
        self,
        model: cp_model.CpModel,
        positions: Dict,
        moved_element_id: Optional[str],
        zones: List[Dict]
    ):
        """
        Añade restricciones para que las estanterías LIBRES no entren en zonas prohibidas.
        
        Las zonas prohibidas incluyen:
        - Muelles (enviados desde frontend)
        - Oficinas (enviados desde frontend)
        - Zonas de maniobra de muelles
        
        El elemento movido (moved_element_id) PUEDE pisar estas zonas,
        el resto de estanterías DEBE mantenerse fuera.
        
        Args:
            model: Modelo CP-SAT
            positions: Dict con variables de posición de cada elemento
            moved_element_id: ID del elemento que el usuario movió (puede pisar zonas)
            zones: Lista de zonas prohibidas [{id, x, y, width, height}] en metros
        """
        if not zones:
            return
            
        logger.info(f"🚫 [v3] Añadiendo {len(zones)} zonas prohibidas")
        n_constraints = 0
        
        for zone in zones:
            zone_id = zone.get('id', 'unknown')
            zone_type = zone.get('type', 'unknown')
            zone_x = float(zone.get('x', 0))
            zone_y = float(zone.get('y', 0))
            zone_w = float(zone.get('width', 0))
            zone_h = float(zone.get('height', 0))
            
            # Validar zona
            if zone_w <= 0 or zone_h <= 0:
                logger.warning(f"   ⚠️  Zona inválida ignorada: {zone_id}")
                continue
            
            # Convertir a milímetros
            zx1 = int(zone_x * SCALE)
            zy1 = int(zone_y * SCALE)
            zx2 = int((zone_x + zone_w) * SCALE)
            zy2 = int((zone_y + zone_h) * SCALE)
            
            for el_id, pos in positions.items():
                # Solo aplicar a estanterías
                if pos['type'] != 'shelf':
                    continue
                
                # El elemento movido PUEDE pisar la zona
                if el_id == moved_element_id:
                    continue
                
                # El resto DEBE estar FUERA de la zona prohibida
                b_left = model.NewBoolVar(f'{el_id}_left_of_{zone_id}')
                b_right = model.NewBoolVar(f'{el_id}_right_of_{zone_id}')
                b_above = model.NewBoolVar(f'{el_id}_above_{zone_id}')
                b_below = model.NewBoolVar(f'{el_id}_below_{zone_id}')
                
                # Elemento a la izquierda de la zona: x + w <= zone_x1
                model.Add(pos['x'] + pos['w'] <= zx1).OnlyEnforceIf(b_left)
                
                # Elemento a la derecha de la zona: x >= zone_x2
                model.Add(pos['x'] >= zx2).OnlyEnforceIf(b_right)
                
                # Elemento arriba de la zona: y + h <= zone_y1
                model.Add(pos['y'] + pos['h'] <= zy1).OnlyEnforceIf(b_above)
                
                # Elemento debajo de la zona: y >= zone_y2
                model.Add(pos['y'] >= zy2).OnlyEnforceIf(b_below)
                
                # Al menos UNA de las condiciones debe cumplirse (estar fuera)
                model.AddBoolOr([b_left, b_right, b_above, b_below])
                n_constraints += 1
        
        logger.info(f"🚫 [v3] {n_constraints} restricciones de zonas prohibidas añadidas")
    
    def _add_minimize_movement_objective(
        self,
        model: cp_model.CpModel,
        positions: Dict
    ):
        """
        ✅ v3: Objetivo PRINCIPAL - Minimizar el movimiento total.
        
        Esto hace que las estanterías se muevan lo mínimo posible para hacer hueco.
        Sin este objetivo, el solver podría reorganizar todo el almacén innecesariamente.
        
        Fórmula: Minimizar Σ |nueva_x - original_x| + |nueva_y - original_y|
        para todas las estanterías libres.
        """
        terms = []
        n_free = 0
        
        for el_id, pos in positions.items():
            # Solo para elementos libres (no fijos)
            if pos['is_fixed']:
                continue
            
            # Solo para estanterías
            if pos['type'] != 'shelf':
                continue
            
            n_free += 1
            
            # Diferencia absoluta en X respecto a posición original
            diff_x = model.NewIntVar(0, self.length_mm, f'{el_id}_diff_x')
            model.AddAbsEquality(diff_x, pos['x'] - pos['original_x'])
            
            # Diferencia absoluta en Y respecto a posición original
            diff_y = model.NewIntVar(0, self.width_mm, f'{el_id}_diff_y')
            model.AddAbsEquality(diff_y, pos['y'] - pos['original_y'])
            
            terms.append(diff_x)
            terms.append(diff_y)
        
        if terms:
            model.Minimize(sum(terms))
            logger.info(f"🎯 [v3] Objetivo: minimizar movimiento de {n_free} estanterías libres")
        else:
            logger.info(f"🎯 [v3] Sin estanterías libres - no hay objetivo de movimiento")
    
    def _add_picking_objective(
        self,
        model: cp_model.CpModel,
        positions: Dict,
        elements: List[Dict]
    ):
        """
        Función objetivo SECUNDARIA: minimizar distancia total de picking.
        
        Esto hace que las estanterías se coloquen lo más cerca posible de los muelles.
        
        NOTA: Solo se usa si optimize_picking=True (desactivado por defecto en v3)
        porque puede conflictuar con el objetivo de minimizar movimiento.
        """
        docks = [el for el in elements if el['type'] == 'dock']
        shelves = [el for el in elements if el['type'] == 'shelf']
        
        if not docks or not shelves:
            return
        
        # Usar el primer muelle como referencia
        dock = docks[0]
        dock_center_x = dock['x_mm'] + dock['width_mm'] // 2
        dock_center_y = dock['y_mm'] + dock['height_mm'] // 2
        
        total_distance = []
        
        for shelf in shelves:
            shelf_pos = positions[shelf['id']]
            
            # Variables auxiliares para distancia Manhattan
            dist_x = model.NewIntVar(0, self.length_mm, f"dist_x_{shelf['id']}")
            dist_y = model.NewIntVar(0, self.width_mm, f"dist_y_{shelf['id']}")
            
            # |shelf_center_x - dock_center_x|
            shelf_center_x = model.NewIntVar(0, self.length_mm, f"center_x_{shelf['id']}")
            model.Add(shelf_center_x == shelf_pos['x'] + shelf['width_mm'] // 2)
            
            model.AddAbsEquality(dist_x, shelf_center_x - dock_center_x)
            
            # |shelf_center_y - dock_center_y|
            shelf_center_y = model.NewIntVar(0, self.width_mm, f"center_y_{shelf['id']}")
            model.Add(shelf_center_y == shelf_pos['y'] + shelf['height_mm'] // 2)
            
            model.AddAbsEquality(dist_y, shelf_center_y - dock_center_y)
            
            # Distancia Manhattan
            dist = model.NewIntVar(0, self.length_mm + self.width_mm, f"dist_{shelf['id']}")
            model.Add(dist == dist_x + dist_y)
            
            total_distance.append(dist)
        
        # Minimizar suma de distancias
        model.Minimize(sum(total_distance))
        logger.info(f"📦 [v3] Objetivo picking añadido para {len(shelves)} estanterías")


# ============================================================
# FUNCIÓN DE CONVENIENCIA
# ============================================================
def optimize_layout(
    dimensions: Dict[str, float],
    elements: List[Dict[str, Any]],
    moved_element_id: Optional[str] = None,
    moved_position: Optional[Dict[str, float]] = None,
    fixed_elements: Optional[List[str]] = None,
    forbidden_zones: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Función de conveniencia para optimizar un layout
    
    Args:
        dimensions: {'length': float, 'width': float}
        elements: Lista de elementos
        moved_element_id: ID del elemento movido manualmente
        moved_position: Nueva posición {x, y}
        fixed_elements: Lista de IDs que no deben moverse
        forbidden_zones: Zonas prohibidas
        
    Returns:
        Dict con resultado de optimización
    """
    optimizer = LayoutOptimizer(
        length=dimensions.get('length', 80),
        width=dimensions.get('width', 40)
    )
    
    result = optimizer.optimize(
        elements=elements,
        moved_element_id=moved_element_id,
        moved_position=moved_position,
        fixed_elements=fixed_elements,
        forbidden_zones=forbidden_zones
    )
    
    return result.to_dict()
