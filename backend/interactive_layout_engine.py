"""
UNITNAVE Designer - Motor de Edición Interactiva (V1.0)
Edición en tiempo real con recálculo incremental - TODO EN MEMORIA

Características:
- Spatial Index REAL con STRtree - O(log n)
- asyncio.Lock para operaciones thread-safe
- Dirty flags para recálculo parcial
- Historial undo/redo en memoria
"""

import time
import asyncio
import logging
from typing import List, Dict, Any, Tuple, Set, Optional
from dataclasses import dataclass, field
from enum import Enum
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.affinity import rotate

logger = logging.getLogger(__name__)


# ============================================================
# CONSTANTES
# ============================================================

class ERPConstants:
    MAIN_AISLE_MIN_WIDTH = 3.5
    CROSS_AISLE_MIN_WIDTH = 3.0
    OPERATIVE_AISLE_MIN_WIDTH = 2.5
    MIN_DOCK_DISTANCE = 1.5


class ZoneType(str, Enum):
    SHELF = "shelf"
    DOCK = "dock"
    OFFICE = "office"
    MAIN_AISLE = "main_aisle"
    CROSS_AISLE = "cross_aisle"
    OPERATIONAL = "operational"
    CIRCULATION_NORTH = "circulation_north"
    CIRCULATION_SOUTH = "circulation_south"
    CIRCULATION_EAST = "circulation_east"
    CIRCULATION_WEST = "circulation_west"
    CIRCULATION_CENTER = "circulation"
    FREE_ZONE = "free_zone"


ZONE_COLORS = {
    'shelf': {'fill': '#3b82f6', 'stroke': '#1d4ed8', 'label': 'Estantería'},
    'dock': {'fill': '#22c55e', 'stroke': '#15803d', 'label': 'Muelle'},
    'office': {'fill': '#a855f7', 'stroke': '#7c3aed', 'label': 'Oficina'},
    'main_aisle': {'fill': 'rgba(254, 243, 199, 0.5)', 'stroke': '#f59e0b', 'label': 'Pasillo Principal'},
    'cross_aisle': {'fill': 'rgba(219, 234, 254, 0.5)', 'stroke': '#3b82f6', 'label': 'Pasillo Transversal'},
    'operational': {'fill': 'rgba(220, 252, 231, 0.5)', 'stroke': '#22c55e', 'label': 'Pasillo Operativo'},
    'circulation_north': {'fill': 'rgba(254, 226, 226, 0.4)', 'stroke': '#f87171', 'label': 'Zona Norte'},
    'circulation_south': {'fill': 'rgba(254, 226, 226, 0.4)', 'stroke': '#f87171', 'label': 'Zona Sur'},
    'circulation_east': {'fill': 'rgba(254, 226, 226, 0.4)', 'stroke': '#f87171', 'label': 'Zona Este'},
    'circulation_west': {'fill': 'rgba(254, 226, 226, 0.4)', 'stroke': '#f87171', 'label': 'Zona Oeste'},
    'free_zone': {'fill': 'rgba(241, 245, 249, 0.4)', 'stroke': '#cbd5e1', 'label': 'Zona Libre'}
}


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class DragOperation:
    element_id: str
    old_position: Tuple[float, float]
    new_position: Tuple[float, float]
    timestamp: float


@dataclass
class CollisionResult:
    has_collision: bool
    colliding_elements: List[str] = field(default_factory=list)


@dataclass
class DetectedZone:
    id: str
    type: str
    label: str
    x: float
    y: float
    width: float
    height: float
    area: float
    rotation: float = 0
    centroid_x: float = 0
    centroid_y: float = 0
    polygon_wkt: Optional[str] = None
    polygon_points: Optional[List[List[float]]] = None
    is_auto_generated: bool = True

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'label': self.label,
            'x': self.x,
            'y': self.y,
            'width': self.width,
            'height': self.height,
            'area': self.area,
            'centroid_x': self.centroid_x,
            'centroid_y': self.centroid_y,
            'polygon_points': self.polygon_points,
            'is_auto_generated': self.is_auto_generated
        }


# ============================================================
# SPATIAL INDEX - STRtree REAL O(log n)
# ============================================================

class SpatialIndex:
    """Índice espacial REAL con STRtree - O(log n)"""
    
    def __init__(self):
        self.polygons: List[Polygon] = []
        self.element_ids: List[str] = []
        self.tree: Optional[STRtree] = None
    
    def insert(self, element_id: str, polygon: Polygon):
        if element_id in self.element_ids:
            idx = self.element_ids.index(element_id)
            self.polygons[idx] = polygon
        else:
            self.polygons.append(polygon)
            self.element_ids.append(element_id)
        self._rebuild()
    
    def remove(self, element_id: str):
        if element_id in self.element_ids:
            idx = self.element_ids.index(element_id)
            del self.polygons[idx]
            del self.element_ids[idx]
            self._rebuild()
    
    def update(self, element_id: str, polygon: Polygon):
        self.insert(element_id, polygon)
    
    def query(self, bbox: Tuple[float, float, float, float]) -> Set[str]:
        if not self.tree:
            return set()
        query_box = box(*bbox)
        results = self.tree.query(query_box)
        return {self.element_ids[self.polygons.index(r)] for r in results}
    
    def _rebuild(self):
        if self.polygons:
            self.tree = STRtree(self.polygons)
        else:
            self.tree = None


# ============================================================
# MOTOR PRINCIPAL
# ============================================================

class InteractiveLayoutEngine:
    """Motor de edición interactiva - TODA LA DATA EN MEMORIA"""
    
    def __init__(self, length: float, width: float):
        # Dimensiones de la nave
        self.length = length
        self.width = width
        self.warehouse_polygon = box(0, 0, length, width)
        
        # Elementos y polígonos
        self.elements: List[Dict] = []
        self.element_polygons: Dict[str, Polygon] = {}
        
        # Índice espacial
        self.spatial_index = SpatialIndex()
        
        # Dirty flags para recálculo incremental
        self.dirty_elements: Set[str] = set()
        self.dirty_zones: Set[str] = set()
        
        # Cache
        self._zones_cache: List[Dict] = []
        self._metrics_cache: Optional[Dict] = None
        
        # Historial undo/redo
        self.operation_history: List[DragOperation] = []
        self.redo_stack: List[DragOperation] = []
        
        # Lock para operaciones async
        self._operation_lock = asyncio.Lock()
        
        logger.info(f"🎮 Motor interactivo inicializado: {length}x{width}m")
    
    # ============================================================
    # CONVERSIÓN ELEMENTO → POLÍGONO
    # ============================================================
    
    def _element_to_polygon(self, element: Dict) -> Optional[Polygon]:
        try:
            pos = element.get('position', {})
            x = pos.get('x', 0)
            y = pos.get('y', 0)
            dims = element.get('dimensions', {})
            rotation = element.get('rotation', 0)
            
            el_type = element.get('type', 'unknown')
            if el_type == 'shelf':
                w = dims.get('length', 2.7)
                h = dims.get('depth', 1.1)
            elif el_type == 'dock':
                w = dims.get('width', 3.5)
                h = dims.get('depth', 0.3)
            else:
                w = dims.get('length', dims.get('width', 2))
                h = dims.get('width', dims.get('depth', 2))
            
            poly = box(x, y, x + w, y + h)
            if rotation != 0:
                center = poly.centroid
                poly = rotate(poly, rotation, origin=center)
            
            return poly
        except Exception as e:
            logger.warning(f"Error creando polígono: {e}")
            return None
    
    # ============================================================
    # INICIALIZACIÓN
    # ============================================================
    
    def initialize_from_elements(self, elements: List[Dict]) -> Dict[str, Any]:
        """Inicializa el motor con una lista de elementos"""
        self.elements = []
        self.element_polygons = {}
        self._zones_cache = []
        self.spatial_index = SpatialIndex()
        
        for element in elements:
            normalized = self._normalize_element(element)
            self.elements.append(normalized)
            
            polygon = self._element_to_polygon(normalized)
            if polygon:
                self.element_polygons[normalized['id']] = polygon
                self.spatial_index.insert(normalized['id'], polygon)
        
        return self._full_recalculate()
    
    def _normalize_element(self, element: Dict) -> Dict:
        """Normaliza estructura de un elemento"""
        return {
            'id': element.get('id', f"el-{len(self.elements)}"),
            'type': element.get('type', 'unknown'),
            'position': {
                'x': element.get('position', {}).get('x', 0),
                'y': element.get('position', {}).get('y', 0)
            },
            'dimensions': element.get('dimensions', {}),
            'rotation': element.get('rotation', 0),
            'properties': element.get('properties', {})
        }
    
    # ============================================================
    # OPERACIONES DE EDICIÓN
    # ============================================================
    
    async def move_element(self, element_id: str, new_x: float, new_y: float) -> Dict[str, Any]:
        """Mueve un elemento - thread-safe con asyncio.Lock"""
        async with self._operation_lock:
            return self._move_element_sync(element_id, new_x, new_y)
    
    def _move_element_sync(self, element_id: str, new_x: float, new_y: float) -> Dict[str, Any]:
        """Implementación síncrona del move"""
        element = self._find_element(element_id)
        if not element:
            return {'error': f'Elemento {element_id} no encontrado'}
        
        old_pos = (element['position']['x'], element['position']['y'])
        
        # Validar colisiones usando spatial index
        collision = self._check_collision(element_id, new_x, new_y)
        if collision.has_collision:
            return {'error': 'Colisión detectada', 'collision': collision.colliding_elements}
        
        # Snap to grid (0.5m)
        new_x = round(new_x / 0.5) * 0.5
        new_y = round(new_y / 0.5) * 0.5
        
        # Validar límites
        new_x = max(0, min(new_x, self.length))
        new_y = max(0, min(new_y, self.width))
        
        # Actualizar posición
        element['position']['x'] = new_x
        element['position']['y'] = new_y
        
        # Actualizar polígono e índice
        polygon = self._element_to_polygon(element)
        if polygon:
            self.element_polygons[element_id] = polygon
            self.spatial_index.update(element_id, polygon)
        
        # Marcar como dirty
        self.dirty_elements.add(element_id)
        
        # Recalcular zonas
        result = self._recalculate_incremental()
        
        # Guardar en historial
        self.operation_history.append(DragOperation(
            element_id=element_id,
            old_position=old_pos,
            new_position=(new_x, new_y),
            timestamp=time.time()
        ))
        self.redo_stack.clear()
        
        return result
    
    async def add_element(self, element: Dict) -> Dict[str, Any]:
        """Añade un nuevo elemento"""
        async with self._operation_lock:
            normalized = self._normalize_element(element)
            
            # Verificar ID único
            if self._find_element(normalized['id']):
                normalized['id'] = f"{normalized['id']}-{len(self.elements)}"
            
            self.elements.append(normalized)
            
            polygon = self._element_to_polygon(normalized)
            if polygon:
                self.element_polygons[normalized['id']] = polygon
                self.spatial_index.insert(normalized['id'], polygon)
            
            self.dirty_elements.add(normalized['id'])
            result = self._recalculate_incremental()
            result['added_element'] = normalized
            
            return result
    
    async def delete_element(self, element_id: str) -> Dict[str, Any]:
        """Elimina un elemento"""
        async with self._operation_lock:
            element = self._find_element(element_id)
            if not element:
                return {'error': f'Elemento {element_id} no encontrado'}
            
            # Eliminar de todas las estructuras
            self.elements = [e for e in self.elements if e['id'] != element_id]
            if element_id in self.element_polygons:
                del self.element_polygons[element_id]
            self.spatial_index.remove(element_id)
            
            # Marcar área como dirty
            self.dirty_elements.add('deleted')
            
            return self._recalculate_incremental()
    
    # ============================================================
    # DETECCIÓN DE COLISIONES
    # ============================================================
    
    def _check_collision(self, element_id: str, x: float, y: float) -> CollisionResult:
        """Verifica colisiones usando spatial index"""
        element = self._find_element(element_id)
        if not element:
            return CollisionResult(False)
        
        # Crear polígono temporal en nueva posición
        temp_element = {**element, 'position': {'x': x, 'y': y}}
        moved_poly = self._element_to_polygon(temp_element)
        
        if not moved_poly:
            return CollisionResult(False)
        
        # Query con spatial index - O(log n)
        candidates = self.spatial_index.query(moved_poly.bounds)
        
        # Verificar intersección real
        colliding = []
        for cid in candidates:
            if cid != element_id:
                other_poly = self.element_polygons.get(cid)
                if other_poly and moved_poly.intersects(other_poly):
                    colliding.append(cid)
        
        return CollisionResult(
            has_collision=len(colliding) > 0, 
            colliding_elements=colliding
        )
    
    def check_collision_realtime(self, element_id: str, x: float, y: float) -> Dict[str, Any]:
        """Endpoint para validar colisiones durante drag"""
        result = self._check_collision(element_id, x, y)
        return {
            'has_collision': result.has_collision,
            'colliding_elements': result.colliding_elements
        }
    
    # ============================================================
    # RECÁLCULO INCREMENTAL
    # ============================================================
    
    def _recalculate_incremental(self) -> Dict[str, Any]:
        """Recalcula SOLO las zonas afectadas"""
        if not self.dirty_elements:
            return self._get_cached_result()
        
        dirty_bbox = self._get_dirty_bbox()
        local_zones = self._calculate_zones_in_bbox(dirty_bbox)
        
        # Preservar zonas fuera del área dirty
        preserved = [z for z in self._zones_cache if not self._zone_in_bbox(z, dirty_bbox)]
        all_zones = preserved + local_zones
        
        # Actualizar cache
        self._zones_cache = all_zones
        metrics = self._calculate_metrics(all_zones)
        self._metrics_cache = metrics
        
        # Limpiar dirty flags
        self.dirty_elements.clear()
        
        return {
            'zones': all_zones,
            'metrics': metrics,
            'preserved': len(preserved),
            'recalculated': len(local_zones),
            'can_undo': len(self.operation_history) > 0,
            'can_redo': len(self.redo_stack) > 0
        }
    
    def _get_dirty_bbox(self) -> Tuple[float, float, float, float]:
        """Calcula bounding box del área modificada"""
        if not self.dirty_elements or 'all' in self.dirty_elements or 'deleted' in self.dirty_elements:
            return (0, 0, self.length, self.width)
        
        min_x = min_y = float('inf')
        max_x = max_y = float('-inf')
        
        for el_id in self.dirty_elements:
            poly = self.element_polygons.get(el_id)
            if poly:
                bounds = poly.bounds
                min_x = min(min_x, bounds[0])
                min_y = min(min_y, bounds[1])
                max_x = max(max_x, bounds[2])
                max_y = max(max_y, bounds[3])
        
        # Expandir margen
        margin = 5.0
        return (
            max(0, min_x - margin),
            max(0, min_y - margin),
            min(self.length, max_x + margin),
            min(self.width, max_y + margin)
        )
    
    def _calculate_zones_in_bbox(self, bbox: Tuple[float, float, float, float]) -> List[Dict]:
        """Calcula zonas dentro de un bounding box"""
        candidate_ids = self.spatial_index.query(bbox)
        local_obstacles = [self.element_polygons[el_id] for el_id in candidate_ids 
                          if el_id in self.element_polygons]
        
        bbox_poly = box(*bbox)
        if local_obstacles:
            obstacles_union = unary_union(local_obstacles)
            free_space = bbox_poly.difference(obstacles_union)
        else:
            free_space = bbox_poly
        
        zones = []
        if not free_space.is_empty:
            geoms = [free_space] if free_space.geom_type == 'Polygon' else list(free_space.geoms)
            for i, geom in enumerate(geoms):
                if geom.is_empty or not geom.is_valid:
                    continue
                    
                bounds = geom.bounds
                area = (bounds[2] - bounds[0]) * (bounds[3] - bounds[1])
                
                if area > 0.5:  # Filtrar zonas muy pequeñas
                    zone_type = self._classify_zone(bounds)
                    zones.append({
                        'id': f'zone-{bounds[0]:.0f}-{bounds[1]:.0f}-{i}',
                        'type': zone_type.value,
                        'label': ZONE_COLORS.get(zone_type.value, {}).get('label', 'Zona'),
                        'x': bounds[0],
                        'y': bounds[1],
                        'width': bounds[2] - bounds[0],
                        'height': bounds[3] - bounds[1],
                        'area': area,
                        'centroid_x': (bounds[0] + bounds[2]) / 2,
                        'centroid_y': (bounds[1] + bounds[3]) / 2,
                        'polygon_points': list(geom.exterior.coords) if hasattr(geom, 'exterior') else None,
                        'is_auto_generated': True
                    })
        
        return zones
    
    def _classify_zone(self, bounds: Tuple) -> ZoneType:
        """Clasifica una zona según su geometría y posición"""
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        area = width * height
        
        # Pasillos: zonas alargadas y estrechas
        if height > width * 1.5 and width < 4:
            return ZoneType.MAIN_AISLE if width >= 3.5 else ZoneType.OPERATIONAL
        
        if width > height * 1.5 and height < 4:
            return ZoneType.CROSS_AISLE if height >= 3.0 else ZoneType.OPERATIONAL
        
        # Zonas de circulación: áreas grandes en los bordes
        if area > 50:
            center_y = (bounds[1] + bounds[3]) / 2
            center_x = (bounds[0] + bounds[2]) / 2
            
            if center_y < self.width * 0.25:
                return ZoneType.CIRCULATION_SOUTH
            elif center_y > self.width * 0.75:
                return ZoneType.CIRCULATION_NORTH
            elif center_x < self.length * 0.15:
                return ZoneType.CIRCULATION_WEST
            elif center_x > self.length * 0.85:
                return ZoneType.CIRCULATION_EAST
            
            return ZoneType.CIRCULATION_CENTER
        
        return ZoneType.FREE_ZONE
    
    def _zone_in_bbox(self, zone: Dict, bbox: Tuple) -> bool:
        """Verifica si una zona intersecta con un bbox"""
        zone_bbox = (zone['x'], zone['y'], zone['x'] + zone['width'], zone['y'] + zone['height'])
        return not (zone_bbox[2] < bbox[0] or zone_bbox[0] > bbox[2] or
                   zone_bbox[3] < bbox[1] or zone_bbox[1] > bbox[3])
    
    def _get_cached_result(self) -> Dict[str, Any]:
        """Devuelve resultado cacheado"""
        return {
            'zones': self._zones_cache,
            'metrics': self._metrics_cache,
            'cached': True,
            'can_undo': len(self.operation_history) > 0,
            'can_redo': len(self.redo_stack) > 0
        }
    
    def _full_recalculate(self) -> Dict[str, Any]:
        """Recálculo completo de todas las zonas"""
        self.dirty_elements.add('all')
        return self._recalculate_incremental()
    
    # ============================================================
    # MÉTRICAS
    # ============================================================
    
    def _calculate_metrics(self, zones: List[Dict]) -> Dict[str, Any]:
        """Calcula métricas del layout"""
        total = self.length * self.width
        occupied = sum(p.area for p in self.element_polygons.values())
        aisle_area = sum(z['area'] for z in zones if 'aisle' in z.get('type', ''))
        circulation_area = sum(z['area'] for z in zones if 'circulation' in z.get('type', ''))
        
        return {
            'total_area': round(total, 2),
            'occupied_area': round(occupied, 2),
            'free_area': round(total - occupied, 2),
            'aisle_area': round(aisle_area, 2),
            'circulation_area': round(circulation_area, 2),
            'efficiency': round((occupied / total) * 100, 1) if total > 0 else 0,
            'element_count': len(self.elements),
            'zone_count': len(zones)
        }
    
    # ============================================================
    # UNDO / REDO
    # ============================================================
    
    async def undo(self) -> Dict[str, Any]:
        """Deshace la última operación"""
        async with self._operation_lock:
            if not self.operation_history:
                return {'error': 'No hay operaciones para deshacer'}
            
            op = self.operation_history.pop()
            self.redo_stack.append(op)
            
            element = self._find_element(op.element_id)
            if element:
                element['position']['x'] = op.old_position[0]
                element['position']['y'] = op.old_position[1]
                
                polygon = self._element_to_polygon(element)
                if polygon:
                    self.element_polygons[op.element_id] = polygon
                    self.spatial_index.update(op.element_id, polygon)
                
                self.dirty_elements.add(op.element_id)
                result = self._recalculate_incremental()
                result['undone'] = {'element_id': op.element_id, 'to': op.old_position}
                return result
            
            return {'error': 'Elemento no encontrado'}
    
    async def redo(self) -> Dict[str, Any]:
        """Rehace la última operación deshecha"""
        async with self._operation_lock:
            if not self.redo_stack:
                return {'error': 'No hay operaciones para rehacer'}
            
            op = self.redo_stack.pop()
            self.operation_history.append(op)
            
            element = self._find_element(op.element_id)
            if element:
                element['position']['x'] = op.new_position[0]
                element['position']['y'] = op.new_position[1]
                
                polygon = self._element_to_polygon(element)
                if polygon:
                    self.element_polygons[op.element_id] = polygon
                    self.spatial_index.update(op.element_id, polygon)
                
                self.dirty_elements.add(op.element_id)
                result = self._recalculate_incremental()
                result['redone'] = {'element_id': op.element_id, 'to': op.new_position}
                return result
            
            return {'error': 'Elemento no encontrado'}
    
    # ============================================================
    # UTILIDADES
    # ============================================================
    
    def _find_element(self, element_id: str) -> Optional[Dict]:
        """Busca un elemento por ID"""
        return next((el for el in self.elements if el['id'] == element_id), None)
    
    def get_state(self) -> Dict[str, Any]:
        """Obtiene estado completo para sincronización"""
        return {
            'dimensions': {'length': self.length, 'width': self.width},
            'elements': self.elements,
            'zones': self._zones_cache,
            'metrics': self._metrics_cache,
            'can_undo': len(self.operation_history) > 0,
            'can_redo': len(self.redo_stack) > 0
        }
    
    def get_elements(self) -> List[Dict]:
        """Obtiene todos los elementos"""
        return self.elements.copy()


# ============================================================
# INSTANCIA GLOBAL EN MEMORIA (se pierde al reiniciar)
# ============================================================

layout_engines: Dict[str, InteractiveLayoutEngine] = {}