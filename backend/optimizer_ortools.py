"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              UNITNAVE - OPTIMIZADOR INTELIGENTE DE LAYOUT                    ║
║                                                                              ║
║  Cuando el usuario mueve UNA estantería:                                     ║
║  1. Fija esa estantería en la nueva posición                                ║
║  2. Re-calcula el layout ÓPTIMO completo                                    ║
║  3. Puede añadir, mover o ELIMINAR estanterías según sea necesario          ║
║  4. Siempre maximiza capacidad respetando pasillos y zonas prohibidas       ║
║                                                                              ║
║  Resultado: Layout óptimo con la estantería donde el usuario la puso        ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from copy import deepcopy
import time
import math

logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ════════════════════════════════════════════════════════════════════════════

AISLE_WIDTHS = {
    'transpaleta': 1.8,
    'apilador': 2.4,
    'retractil': 2.8,
    'contrapesada': 3.6,
    'trilateral': 1.9,
    'bilateral': 1.6,
    'manual': 1.5,
    'electrica': 2.0,
}

DEFAULT_AISLE_WIDTH = 3.0
DEFAULT_SHELF_WIDTH = 2.7
DEFAULT_SHELF_DEPTH = 1.1
MIN_MARGIN = 0.5  # Margen mínimo a paredes
SHELF_GAP = 0.1   # Gap entre estanterías adyacentes


# ════════════════════════════════════════════════════════════════════════════
# MODELOS DE DATOS
# ════════════════════════════════════════════════════════════════════════════

@dataclass
class Shelf:
    """Representa una estantería"""
    id: str
    x: float
    y: float
    width: float
    depth: float
    original_data: Dict[str, Any]
    is_fixed: bool = False  # True si el usuario la posicionó manualmente
    
    @property
    def x2(self) -> float:
        return self.x + self.width
    
    @property
    def y2(self) -> float:
        return self.y + self.depth
    
    @property
    def center_x(self) -> float:
        return self.x + self.width / 2
    
    @property
    def center_y(self) -> float:
        return self.y + self.depth / 2


@dataclass
class ForbiddenZone:
    """Zona donde no se pueden poner estanterías"""
    id: str
    type: str  # dock, office, maneuver
    x: float
    y: float
    width: float
    height: float
    
    def contains_point(self, px: float, py: float) -> bool:
        return self.x <= px <= self.x + self.width and self.y <= py <= self.y + self.height
    
    def overlaps_rect(self, rx: float, ry: float, rw: float, rh: float) -> bool:
        return not (rx + rw <= self.x or self.x + self.width <= rx or
                    ry + rh <= self.y or self.y + self.height <= ry)


# ════════════════════════════════════════════════════════════════════════════
# OPTIMIZADOR INTELIGENTE
# ════════════════════════════════════════════════════════════════════════════

class LayoutOptimizer:
    """
    Optimizador Inteligente de Layout
    
    Cuando el usuario mueve una estantería:
    1. Fija esa estantería en la posición elegida
    2. Calcula las filas óptimas
    3. Distribuye las demás estanterías de forma óptima
    4. Elimina las que no caben
    5. Puede añadir nuevas si hay espacio
    """
    
    def __init__(self, length: float, width: float, **kwargs):
        self.length = length
        self.width = width
        
        # Configuración
        self.machinery = kwargs.get('machinery', 'retractil')
        self.aisle_width = AISLE_WIDTHS.get(self.machinery, DEFAULT_AISLE_WIDTH)
        self.shelf_width = kwargs.get('shelf_width', DEFAULT_SHELF_WIDTH)
        self.shelf_depth = kwargs.get('shelf_depth', DEFAULT_SHELF_DEPTH)
        self.is_double = kwargs.get('is_double', True)
        self.effective_depth = self.shelf_depth * 2 if self.is_double else self.shelf_depth
        
        # Estado
        self.shelves: Dict[str, Shelf] = {}
        self.forbidden_zones: List[ForbiddenZone] = []
        self.other_elements: List[Dict] = []
        
        logger.info("=" * 70)
        logger.info("🧠 OPTIMIZADOR INTELIGENTE INICIADO")
        logger.info(f"   Almacén: {self.length}m x {self.width}m")
        logger.info(f"   Maquinaria: {self.machinery}")
        logger.info(f"   Pasillo: {self.aisle_width}m")
        logger.info(f"   Estantería: {self.shelf_width}m x {self.effective_depth}m")
        logger.info("=" * 70)
    
    def optimize(
        self,
        elements: List[Dict[str, Any]],
        moved_element_id: Optional[str] = None,
        moved_position: Optional[Dict[str, float]] = None,
        deleted_element_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Optimiza el layout completo.
        
        Args:
            elements: Lista de elementos actuales
            moved_element_id: ID de la estantería que el usuario movió
            moved_position: Nueva posición {x, y} de la estantería movida
            deleted_element_id: ID de estantería a eliminar (opcional)
        
        Returns:
            Nuevo layout optimizado
        """
        start_time = time.time()
        
        logger.info("=" * 70)
        logger.info("🔄 OPTIMIZACIÓN INICIADA")
        logger.info(f"   Elementos: {len(elements)}")
        logger.info(f"   Movido: {moved_element_id} → {moved_position}")
        logger.info(f"   Eliminado: {deleted_element_id}")
        logger.info("=" * 70)
        
        # 1. Cargar elementos
        self._load_elements(elements)
        original_count = len(self.shelves)
        
        # 2. Si hay eliminación, quitar la estantería
        if deleted_element_id and deleted_element_id in self.shelves:
            logger.info(f"   🗑️ Eliminando estantería: {deleted_element_id}")
            del self.shelves[deleted_element_id]
        
        # 3. Si hay movimiento, fijar la posición
        fixed_shelf = None
        if moved_element_id and moved_position and moved_element_id in self.shelves:
            fixed_shelf = self.shelves[moved_element_id]
            fixed_shelf.x = moved_position.get('x', fixed_shelf.x)
            fixed_shelf.y = moved_position.get('y', fixed_shelf.y)
            fixed_shelf.is_fixed = True
            logger.info(f"   📌 Estantería fijada: {moved_element_id} en ({fixed_shelf.x:.1f}, {fixed_shelf.y:.1f})")
        
        # 4. Calcular filas óptimas
        optimal_rows = self._calculate_optimal_rows(fixed_shelf)
        logger.info(f"   📏 Filas óptimas calculadas: {len(optimal_rows)}")
        for i, row in enumerate(optimal_rows):
            logger.info(f"      Fila {i}: Y={row['y']:.1f}m, capacidad={row['capacity']} estanterías")
        
        # 5. Asignar estanterías a filas
        assignments = self._assign_shelves_to_rows(optimal_rows, fixed_shelf)
        
        # 6. Posicionar estanterías en cada fila
        result = self._position_shelves_in_rows(assignments, optimal_rows, fixed_shelf)
        
        # 7. Calcular cambios
        final_count = len(result['kept_shelves'])
        removed_count = len(result['removed_shelves'])
        moved_shelves = result['moved_shelves']
        
        solve_time = (time.time() - start_time) * 1000
        
        logger.info("=" * 70)
        logger.info("📊 RESULTADO DE OPTIMIZACIÓN:")
        logger.info(f"   Estanterías originales: {original_count}")
        logger.info(f"   Estanterías finales: {final_count}")
        logger.info(f"   Eliminadas: {removed_count}")
        logger.info(f"   Movidas: {len(moved_shelves)}")
        logger.info(f"   Tiempo: {solve_time:.1f}ms")
        logger.info("=" * 70)
        
        return self._build_result(result, solve_time)
    
    def _load_elements(self, elements: List[Dict[str, Any]]):
        """Carga elementos y separa estanterías de zonas prohibidas"""
        self.shelves = {}
        self.forbidden_zones = []
        self.other_elements = []
        
        for el in elements:
            el_type = el.get('type', '')
            
            if el_type == 'shelf':
                shelf = self._parse_shelf(el)
                self.shelves[shelf.id] = shelf
            elif el_type == 'dock':
                self._add_dock_zone(el)
                self.other_elements.append(el)
            elif el_type == 'office':
                self._add_office_zone(el)
                self.other_elements.append(el)
            elif el_type == 'maneuver':
                self._add_maneuver_zone(el)
                self.other_elements.append(el)
            else:
                self.other_elements.append(el)
        
        logger.info(f"   📦 Estanterías cargadas: {len(self.shelves)}")
        logger.info(f"   🚫 Zonas prohibidas: {len(self.forbidden_zones)}")
    
    def _parse_shelf(self, el: Dict) -> Shelf:
        """Parsea una estantería"""
        pos = el.get('position', {})
        dims = el.get('dimensions', {})
        
        return Shelf(
            id=el.get('id', ''),
            x=float(pos.get('x', 0)),
            y=float(pos.get('y', pos.get('z', 0))),
            width=float(dims.get('length', self.shelf_width)),
            depth=float(dims.get('depth', self.effective_depth)),
            original_data=el
        )
    
    def _add_dock_zone(self, el: Dict):
        """Añade zona de muelle + zona de maniobra"""
        pos = el.get('position', {})
        dims = el.get('dimensions', {})
        
        dock_x = float(pos.get('x', 0))
        dock_y = float(pos.get('y', 0))
        dock_w = float(dims.get('width', 3.5))
        dock_h = float(dims.get('depth', 4.0))
        
        # Zona del muelle
        self.forbidden_zones.append(ForbiddenZone(
            id=el.get('id', '') + '_dock',
            type='dock',
            x=dock_x,
            y=dock_y,
            width=dock_w,
            height=dock_h
        ))
        
        # Zona de maniobra (frente al muelle)
        maneuver_depth = 8.0  # 8 metros de maniobra
        self.forbidden_zones.append(ForbiddenZone(
            id=el.get('id', '') + '_maneuver',
            type='maneuver',
            x=dock_x - 2,  # Un poco más ancho
            y=dock_y + dock_h,
            width=dock_w + 4,
            height=maneuver_depth
        ))
    
    def _add_office_zone(self, el: Dict):
        """Añade zona de oficina"""
        pos = el.get('position', {})
        dims = el.get('dimensions', {})
        
        self.forbidden_zones.append(ForbiddenZone(
            id=el.get('id', ''),
            type='office',
            x=float(pos.get('x', 0)),
            y=float(pos.get('y', 0)),
            width=float(dims.get('length', dims.get('width', 12))),
            height=float(dims.get('width', dims.get('depth', 8)))
        ))
    
    def _add_maneuver_zone(self, el: Dict):
        """Añade zona de maniobra explícita"""
        pos = el.get('position', {})
        dims = el.get('dimensions', {})
        
        self.forbidden_zones.append(ForbiddenZone(
            id=el.get('id', ''),
            type='maneuver',
            x=float(pos.get('x', 0)),
            y=float(pos.get('y', 0)),
            width=float(dims.get('width', dims.get('length', 10))),
            height=float(dims.get('height', dims.get('depth', 10)))
        ))
    
    def _calculate_optimal_rows(self, fixed_shelf: Optional[Shelf]) -> List[Dict]:
        """
        Calcula las filas óptimas para el almacén.
        
        Si hay una estantería fijada, crea una fila en esa posición Y
        y calcula las demás filas óptimamente.
        """
        rows = []
        
        # Encontrar el área útil (evitando zonas prohibidas en Y)
        min_y = MIN_MARGIN
        max_y = self.width - MIN_MARGIN - self.effective_depth
        
        # Encontrar la Y máxima ocupada por zonas prohibidas
        for zone in self.forbidden_zones:
            if zone.type in ['dock', 'maneuver']:
                # Si la zona está en la parte inferior, empezar después
                if zone.y < self.width / 2:
                    min_y = max(min_y, zone.y + zone.height + self.aisle_width)
        
        logger.info(f"   📐 Área útil Y: {min_y:.1f}m - {max_y:.1f}m")
        
        # Espacio entre filas = profundidad estantería + pasillo
        row_spacing = self.effective_depth + self.aisle_width
        
        # Si hay estantería fijada, crear fila en su Y
        if fixed_shelf:
            fixed_y = fixed_shelf.y
            # Asegurar que está en área válida
            fixed_y = max(min_y, min(fixed_y, max_y))
            
            # Calcular filas antes y después de la fijada
            # Filas ANTES (hacia arriba, Y menor)
            y = fixed_y - row_spacing
            while y >= min_y:
                capacity = self._calculate_row_capacity(y)
                if capacity > 0:
                    rows.append({'y': y, 'capacity': capacity, 'is_fixed': False})
                y -= row_spacing
            
            # La fila fijada
            capacity = self._calculate_row_capacity(fixed_y)
            rows.append({'y': fixed_y, 'capacity': capacity, 'is_fixed': True})
            
            # Filas DESPUÉS (hacia abajo, Y mayor)
            y = fixed_y + row_spacing
            while y <= max_y:
                capacity = self._calculate_row_capacity(y)
                if capacity > 0:
                    rows.append({'y': y, 'capacity': capacity, 'is_fixed': False})
                y += row_spacing
        else:
            # Sin estantería fijada, distribuir filas uniformemente
            y = min_y
            while y <= max_y:
                capacity = self._calculate_row_capacity(y)
                if capacity > 0:
                    rows.append({'y': y, 'capacity': capacity, 'is_fixed': False})
                y += row_spacing
        
        # Ordenar por Y
        rows.sort(key=lambda r: r['y'])
        
        return rows
    
    def _calculate_row_capacity(self, y: float) -> int:
        """Calcula cuántas estanterías caben en una fila a la altura Y"""
        shelf_with_gap = self.shelf_width + SHELF_GAP
        
        # Encontrar segmentos válidos en X (evitando zonas prohibidas)
        valid_segments = [(MIN_MARGIN, self.length - MIN_MARGIN)]
        
        for zone in self.forbidden_zones:
            # Si la zona está en esta Y
            if zone.overlaps_rect(0, y, self.length, self.effective_depth):
                new_segments = []
                for seg_start, seg_end in valid_segments:
                    if zone.x + zone.width <= seg_start or zone.x >= seg_end:
                        # No hay overlap
                        new_segments.append((seg_start, seg_end))
                    else:
                        # Hay overlap, dividir segmento
                        if zone.x > seg_start:
                            new_segments.append((seg_start, zone.x - SHELF_GAP))
                        if zone.x + zone.width < seg_end:
                            new_segments.append((zone.x + zone.width + SHELF_GAP, seg_end))
                valid_segments = new_segments
        
        # Calcular capacidad total
        total_capacity = 0
        for seg_start, seg_end in valid_segments:
            segment_width = seg_end - seg_start
            if segment_width >= self.shelf_width:
                total_capacity += int(segment_width / shelf_with_gap)
        
        return total_capacity
    
    def _assign_shelves_to_rows(
        self, 
        optimal_rows: List[Dict], 
        fixed_shelf: Optional[Shelf]
    ) -> Dict[int, List[Shelf]]:
        """
        Asigna estanterías a filas óptimas.
        
        Prioriza:
        1. La estantería fijada va a su fila
        2. Las demás se distribuyen para maximizar capacidad
        """
        assignments: Dict[int, List[Shelf]] = {i: [] for i in range(len(optimal_rows))}
        
        # Encontrar la fila de la estantería fijada
        fixed_row_idx = None
        if fixed_shelf:
            for i, row in enumerate(optimal_rows):
                if row.get('is_fixed'):
                    fixed_row_idx = i
                    assignments[i].append(fixed_shelf)
                    break
        
        # Asignar las demás estanterías a las filas más cercanas
        other_shelves = [s for s in self.shelves.values() if not s.is_fixed]
        
        for shelf in other_shelves:
            # Encontrar la fila más cercana con capacidad
            best_row_idx = None
            best_distance = float('inf')
            
            for i, row in enumerate(optimal_rows):
                current_count = len(assignments[i])
                if current_count < row['capacity']:
                    distance = abs(shelf.y - row['y'])
                    if distance < best_distance:
                        best_distance = distance
                        best_row_idx = i
            
            if best_row_idx is not None:
                assignments[best_row_idx].append(shelf)
            else:
                # No hay espacio - esta estantería será eliminada
                logger.info(f"   ⚠️ Sin espacio para {shelf.id[:12]}... - será eliminada")
        
        return assignments
    
    def _position_shelves_in_rows(
        self,
        assignments: Dict[int, List[Shelf]],
        optimal_rows: List[Dict],
        fixed_shelf: Optional[Shelf]
    ) -> Dict[str, Any]:
        """
        Posiciona las estanterías dentro de cada fila.
        
        Returns:
            Dict con kept_shelves, removed_shelves, moved_shelves
        """
        kept_shelves: List[Shelf] = []
        removed_shelves: List[str] = []
        moved_shelves: List[Dict] = []
        
        all_assigned_ids: Set[str] = set()
        
        for row_idx, shelves in assignments.items():
            if not shelves:
                continue
            
            row = optimal_rows[row_idx]
            row_y = row['y']
            
            # Ordenar por X original
            shelves.sort(key=lambda s: s.x)
            
            # Posicionar secuencialmente
            current_x = MIN_MARGIN
            
            for shelf in shelves:
                all_assigned_ids.add(shelf.id)
                
                # Encontrar posición válida (evitando zonas prohibidas)
                valid_x = self._find_valid_x_position(current_x, row_y, shelf.width)
                
                if valid_x is None:
                    # No hay espacio válido
                    removed_shelves.append(shelf.id)
                    logger.info(f"   🗑️ Eliminada (sin espacio en X): {shelf.id[:12]}...")
                    continue
                
                # Si es la estantería fijada, mantener su X
                if shelf.is_fixed:
                    new_x = shelf.x
                    new_y = row_y
                else:
                    new_x = valid_x
                    new_y = row_y
                
                # Verificar si hubo movimiento
                old_x, old_y = self._get_original_position(shelf)
                if abs(new_x - old_x) > 0.1 or abs(new_y - old_y) > 0.1:
                    moved_shelves.append({
                        'id': shelf.id,
                        'old_x': old_x,
                        'old_y': old_y,
                        'new_x': new_x,
                        'new_y': new_y
                    })
                
                # Actualizar posición
                shelf.x = new_x
                shelf.y = new_y
                kept_shelves.append(shelf)
                
                current_x = new_x + shelf.width + SHELF_GAP
        
        # Encontrar estanterías que no fueron asignadas (eliminadas)
        for shelf_id in self.shelves:
            if shelf_id not in all_assigned_ids:
                removed_shelves.append(shelf_id)
        
        return {
            'kept_shelves': kept_shelves,
            'removed_shelves': removed_shelves,
            'moved_shelves': moved_shelves
        }
    
    def _find_valid_x_position(self, start_x: float, y: float, width: float) -> Optional[float]:
        """Encuentra una posición X válida para una estantería"""
        x = start_x
        max_x = self.length - MIN_MARGIN - width
        
        while x <= max_x:
            # Verificar si esta posición es válida
            is_valid = True
            for zone in self.forbidden_zones:
                if zone.overlaps_rect(x, y, width, self.effective_depth):
                    # Hay colisión, saltar después de la zona
                    x = zone.x + zone.width + SHELF_GAP
                    is_valid = False
                    break
            
            if is_valid:
                return x
            
        return None
    
    def _get_original_position(self, shelf: Shelf) -> Tuple[float, float]:
        """Obtiene la posición original de una estantería"""
        pos = shelf.original_data.get('position', {})
        return float(pos.get('x', 0)), float(pos.get('y', pos.get('z', 0)))
    
    def _build_result(self, result: Dict, solve_time: float) -> Dict[str, Any]:
        """Construye el resultado final"""
        elements = []
        
        # Añadir estanterías mantenidas
        for shelf in result['kept_shelves']:
            el = deepcopy(shelf.original_data)
            el['position'] = {
                'x': shelf.x,
                'y': shelf.y,
                'z': el.get('position', {}).get('z', 0)
            }
            el['was_moved'] = any(m['id'] == shelf.id for m in result['moved_shelves'])
            elements.append(el)
        
        # Añadir otros elementos (muelles, oficinas, etc.)
        elements.extend(self.other_elements)
        
        # Datos de animación
        animation_data = []
        for move in result['moved_shelves']:
            animation_data.append({
                'id': move['id'],
                'from': {'x': move['old_x'], 'y': move['old_y']},
                'to': {'x': move['new_x'], 'y': move['new_y']},
                'animation': 'slide',
                'duration': 300
            })
        
        # Añadir animaciones de eliminación
        for removed_id in result['removed_shelves']:
            animation_data.append({
                'id': removed_id,
                'animation': 'fade_out',
                'duration': 200
            })
        
        return {
            'success': True,
            'elements': elements,
            'solver_status': 'OPTIMAL',
            'solve_time_ms': solve_time,
            'messages': [
                f"Layout optimizado: {len(result['kept_shelves'])} estanterías",
                f"Movidas: {len(result['moved_shelves'])}",
                f"Eliminadas: {len(result['removed_shelves'])}"
            ],
            'affected_shelves': result['moved_shelves'],
            'removed_shelves': result['removed_shelves'],
            'animation_data': animation_data,
            'metrics': {
                'total_shelves': len(result['kept_shelves']),
                'shelves_moved': len(result['moved_shelves']),
                'shelves_removed': len(result['removed_shelves']),
                'capacity_ratio': len(result['kept_shelves']) * 4  # Estimación pallets
            },
            'config': {
                'machinery': self.machinery,
                'aisle_width': self.aisle_width,
                'shelf_dimensions': f"{self.shelf_width}m x {self.effective_depth}m"
            }
        }


# ════════════════════════════════════════════════════════════════════════════
# FUNCIÓN DE CONVENIENCIA
# ════════════════════════════════════════════════════════════════════════════

def optimize_layout(
    dimensions: Dict[str, float],
    elements: List[Dict[str, Any]],
    moved_element_id: Optional[str] = None,
    moved_position: Optional[Dict[str, float]] = None,
    deleted_element_id: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Función principal de optimización.
    
    Args:
        dimensions: {length, width} del almacén
        elements: Lista de elementos actuales
        moved_element_id: ID de estantería movida por el usuario
        moved_position: Nueva posición {x, y}
        deleted_element_id: ID de estantería a eliminar
        **kwargs: machinery, shelf_width, etc.
    
    Returns:
        Layout optimizado
    """
    optimizer = LayoutOptimizer(
        length=dimensions.get('length', 80),
        width=dimensions.get('width', 40),
        **kwargs
    )
    
    return optimizer.optimize(
        elements=elements,
        moved_element_id=moved_element_id,
        moved_position=moved_position,
        deleted_element_id=deleted_element_id
    )


# ════════════════════════════════════════════════════════════════════════════
# UTILIDADES EXPORTADAS
# ════════════════════════════════════════════════════════════════════════════

def get_aisle_widths() -> Dict[str, float]:
    """Retorna anchos de pasillo por maquinaria"""
    return AISLE_WIDTHS.copy()

def get_aisle_width_for_machinery(machinery: str) -> float:
    """Retorna ancho de pasillo para una maquinaria"""
    return AISLE_WIDTHS.get(machinery, DEFAULT_AISLE_WIDTH)
