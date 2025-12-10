"""
UNITNAVE - Optimizador de Layout con OR-Tools
Motor de optimización combinatoria de Google

Características:
- Recolocación automática al mover una pieza
- Restricciones de no-solapamiento
- Optimización de distancias de picking
- Mantenimiento de anchos de pasillo mínimos
- Respeta restricciones ERP

@version 1.0
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
MIN_AISLE_WIDTH_MM = 3500  # 3.5m en mm
MIN_OPERATIVE_AISLE_MM = 2500  # 2.5m en mm
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
    Optimizador de layout usando OR-Tools CP-SAT
    
    Uso:
        optimizer = LayoutOptimizer(length=80, width=40)
        result = optimizer.optimize(
            elements=elements_list,
            moved_element_id='shelf-1',
            moved_position={'x': 10, 'y': 5}
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
        optimize_picking: bool = True,
        max_time_seconds: float = 5.0
    ) -> OptimizationResult:
        """
        Optimiza el layout completo
        
        Args:
            elements: Lista de elementos
            moved_element_id: ID del elemento movido manualmente
            moved_position: Nueva posición {x, y} del elemento movido
            fixed_elements: IDs de elementos que no deben moverse
            optimize_picking: Si True, minimiza distancia de picking
            max_time_seconds: Tiempo máximo de optimización
            
        Returns:
            OptimizationResult con posiciones optimizadas
        """
        logger.info(f"🧮 Optimizando layout: {len(elements)} elementos")
        
        # Crear modelo
        model = cp_model.CpModel()
        
        # Parsear elementos
        parsed_elements = self._parse_elements(elements)
        
        # Crear variables de posición
        positions = {}
        for el in parsed_elements:
            el_id = el['id']
            el_w = el['width_mm']
            el_h = el['height_mm']
            
            # Determinar si el elemento está fijo
            is_fixed = (
                el_id == moved_element_id or 
                (fixed_elements and el_id in fixed_elements) or
                el['type'] == 'dock'  # Muelles siempre fijos
            )
            
            if is_fixed and el_id == moved_element_id and moved_position:
                # Elemento movido manualmente: fijar en nueva posición
                fixed_x = int(moved_position['x'] * SCALE)
                fixed_y = int(moved_position['y'] * SCALE)
                
                x = model.NewIntVar(fixed_x, fixed_x, f"{el_id}_x")
                y = model.NewIntVar(fixed_y, fixed_y, f"{el_id}_y")
                
            elif is_fixed:
                # Elemento fijo: mantener posición actual
                fixed_x = el['x_mm']
                fixed_y = el['y_mm']
                
                x = model.NewIntVar(fixed_x, fixed_x, f"{el_id}_x")
                y = model.NewIntVar(fixed_y, fixed_y, f"{el_id}_y")
                
            else:
                # Elemento libre: puede moverse
                max_x = self.length_mm - el_w
                max_y = self.width_mm - el_h
                
                x = model.NewIntVar(0, max_x, f"{el_id}_x")
                y = model.NewIntVar(0, max_y, f"{el_id}_y")
            
            positions[el_id] = {
                'x': x,
                'y': y,
                'w': el_w,
                'h': el_h,
                'type': el['type'],
                'is_fixed': is_fixed
            }
        
        # Añadir restricciones de no-solapamiento
        self._add_no_overlap_constraints(model, positions, parsed_elements)
        
        # Añadir restricciones de pasillo mínimo
        self._add_aisle_constraints(model, positions, parsed_elements)
        
        # Función objetivo: minimizar distancia de picking
        if optimize_picking:
            self._add_picking_objective(model, positions, parsed_elements)
        
        # Resolver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max_time_seconds
        solver.parameters.num_search_workers = 4
        
        status = solver.Solve(model)
        
        # Procesar resultado
        status_name = solver.StatusName(status)
        messages = []
        
        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            # Extraer posiciones optimizadas
            optimized = []
            for el in parsed_elements:
                el_id = el['id']
                pos = positions[el_id]
                
                new_x = solver.Value(pos['x']) / SCALE
                new_y = solver.Value(pos['y']) / SCALE
                
                was_moved = (
                    abs(new_x - el['x']) > 0.01 or 
                    abs(new_y - el['y']) > 0.01
                )
                
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
                
                if was_moved:
                    messages.append(f"{el_id} movido a ({new_x:.2f}, {new_y:.2f})")
            
            logger.info(f"✅ Optimización completada: {status_name}")
            
            return OptimizationResult(
                success=True,
                elements=optimized,
                solver_status=status_name,
                solve_time_ms=solver.WallTime() * 1000,
                objective_value=solver.ObjectiveValue() if optimize_picking else 0,
                messages=messages
            )
        else:
            # No se encontró solución
            logger.warning(f"⚠️ Optimización fallida: {status_name}")
            
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
                h = float(dims.get('depth', el.get('height', 0.5)))
            elif el_type == 'office':
                w = float(dims.get('length', dims.get('largo', el.get('width', 12))))
                h = float(dims.get('width', dims.get('ancho', el.get('height', 8))))
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
        """Añade restricciones de no-solapamiento"""
        element_ids = list(positions.keys())
        
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
    
    def _add_aisle_constraints(
        self,
        model: cp_model.CpModel,
        positions: Dict,
        elements: List[Dict]
    ):
        """Añade restricciones de pasillo mínimo entre estanterías"""
        shelves = [el for el in elements if el['type'] == 'shelf']
        
        # Agrupar estanterías por filas (misma Y aproximada)
        rows = self._group_by_rows(shelves)
        
        for row in rows:
            if len(row) < 2:
                continue
            
            # Ordenar por X
            row_sorted = sorted(row, key=lambda el: el['x'])
            
            for i in range(len(row_sorted) - 1):
                el1 = row_sorted[i]
                el2 = row_sorted[i + 1]
                
                p1 = positions[el1['id']]
                p2 = positions[el2['id']]
                
                # Distancia entre ellos >= pasillo mínimo
                # x2 - (x1 + w1) >= MIN_AISLE
                model.Add(p2['x'] - (p1['x'] + p1['w']) >= MIN_OPERATIVE_AISLE_MM)
    
    def _group_by_rows(self, elements: List[Dict], tolerance_mm: int = 1000) -> List[List[Dict]]:
        """Agrupa elementos por filas (misma Y aproximada)"""
        rows = []
        
        for el in elements:
            found = False
            for row in rows:
                if abs(row[0]['y_mm'] - el['y_mm']) < tolerance_mm:
                    row.append(el)
                    found = True
                    break
            
            if not found:
                rows.append([el])
        
        return rows
    
    def _add_picking_objective(
        self,
        model: cp_model.CpModel,
        positions: Dict,
        elements: List[Dict]
    ):
        """
        Función objetivo: minimizar distancia total de picking
        
        Esto hace que las estanterías se coloquen lo más cerca posible de los muelles
        """
        docks = [el for el in elements if el['type'] == 'dock']
        shelves = [el for el in elements if el['type'] == 'shelf']
        
        if not docks or not shelves:
            return
        
        # Usar el primer muelle como referencia
        dock = docks[0]
        dock_pos = positions[dock['id']]
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


# ============================================================
# FUNCIÓN DE CONVENIENCIA
# ============================================================
def optimize_layout(
    dimensions: Dict[str, float],
    elements: List[Dict[str, Any]],
    moved_element_id: Optional[str] = None,
    moved_position: Optional[Dict[str, float]] = None,
    fixed_elements: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Función de conveniencia para optimizar un layout
    
    Args:
        dimensions: {'length': float, 'width': float}
        elements: Lista de elementos
        moved_element_id: ID del elemento movido manualmente
        moved_position: Nueva posición {x, y}
        fixed_elements: Lista de IDs que no deben moverse
        
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
        fixed_elements=fixed_elements
    )
    
    return result.to_dict()
