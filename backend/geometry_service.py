"""
UNITNAVE - Servicio de Geometría Exacta
Usa Shapely/GEOS para operaciones booleanas precisas

Características:
- Cálculo exacto de espacios libres (diferencia booleana)
- Soporte para rotaciones arbitrarias
- Clasificación inteligente de zonas (pasillos, circulación, etc.)
- Métricas precisas de área

@version 1.0
"""

import math
import logging
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

from shapely.geometry import Polygon, MultiPolygon, box, Point
from shapely.ops import unary_union
from shapely.affinity import rotate, translate
from shapely.validation import make_valid

logger = logging.getLogger(__name__)


class ZoneType(str, Enum):
    """Tipos de zonas detectadas"""
    MAIN_AISLE = "main_aisle"           # Pasillo principal (>= 4m ancho)
    CROSS_AISLE = "cross_aisle"         # Pasillo transversal (>= 3m)
    AISLE = "aisle"                     # Pasillo operativo (< 3m)
    CIRCULATION = "circulation"          # Zona de circulación amplia
    FREE_ZONE = "free_zone"             # Zona libre genérica
    MANEUVER = "dock_maneuver"          # Zona de maniobra de muelle


@dataclass
class GeometryMetrics:
    """Métricas calculadas exactas"""
    total_area: float
    occupied_area: float
    free_area: float
    aisle_area: float
    circulation_area: float
    efficiency: float  # % de espacio útil


@dataclass
class DetectedZone:
    """Zona detectada con geometría exacta"""
    id: str
    type: ZoneType
    polygon: Polygon
    area: float
    centroid: Tuple[float, float]
    bounds: Tuple[float, float, float, float]  # minx, miny, maxx, maxy
    width: float   # Ancho aproximado
    height: float  # Alto aproximado
    label: str


class GeometryService:
    """
    Servicio de geometría exacta usando Shapely/GEOS
    
    Uso:
        service = GeometryService(length=80, width=40)
        service.add_element(element_dict)
        result = service.analyze()
    """
    
    def __init__(self, length: float, width: float):
        """
        Inicializa el servicio con las dimensiones de la nave
        
        Args:
            length: Largo de la nave (eje X)
            width: Ancho de la nave (eje Y)
        """
        self.length = length
        self.width = width
        self.warehouse_polygon = box(0, 0, length, width)
        self.obstacles: List[Polygon] = []
        self.elements: List[Dict] = []
        self.maneuver_zones: List[Polygon] = []
        
    def add_element(self, element: Dict[str, Any]) -> None:
        """
        Añade un elemento como obstáculo
        
        Args:
            element: Diccionario con type, position, dimensions, rotation
        """
        polygon = self._element_to_polygon(element)
        if polygon and polygon.is_valid and not polygon.is_empty:
            self.obstacles.append(polygon)
            self.elements.append(element)
            
            # Si es un muelle, añadir zona de maniobra
            if element.get('type') == 'dock':
                maneuver = self._create_maneuver_zone(element)
                if maneuver and maneuver.is_valid:
                    self.maneuver_zones.append(maneuver)
    
    def _element_to_polygon(self, element: Dict[str, Any]) -> Optional[Polygon]:
        """
        Convierte un elemento a polígono Shapely con rotación real
        
        Args:
            element: Elemento con position, dimensions, rotation
            
        Returns:
            Polígono Shapely o None si inválido
        """
        try:
            el_type = element.get('type', 'unknown')
            pos = element.get('position', {})
            dims = element.get('dimensions', {})
            rotation = element.get('rotation', 0)
            
            x = pos.get('x', 0)
            y = pos.get('y', pos.get('z', 0))
            
            # Obtener dimensiones según tipo
            if el_type == 'shelf':
                w = dims.get('length', 2.7)
                h = dims.get('depth', 1.1)
            elif el_type == 'dock':
                w = dims.get('width', 3.5)
                h = dims.get('depth', 0.5)
            elif el_type == 'office':
                w = dims.get('length', dims.get('largo', 12))
                h = dims.get('width', dims.get('ancho', 8))
            elif el_type in ('operational_zone', 'zone'):
                w = dims.get('length', dims.get('largo', 10))
                h = dims.get('width', dims.get('ancho', 10))
            elif el_type in ('service_room', 'technical_room'):
                w = dims.get('length', dims.get('largo', 5))
                h = dims.get('width', dims.get('ancho', 4))
            else:
                w = dims.get('length', 3)
                h = dims.get('depth', dims.get('width', 3))
            
            # Crear rectángulo base
            rect = box(x, y, x + w, y + h)
            
            # Aplicar rotación si existe (alrededor del centro)
            if rotation != 0:
                center_x = x + w / 2
                center_y = y + h / 2
                rect = rotate(rect, rotation, origin=(center_x, center_y))
            
            return make_valid(rect)
            
        except Exception as e:
            logger.warning(f"Error convirtiendo elemento a polígono: {e}")
            return None
    
    def _create_maneuver_zone(self, dock_element: Dict[str, Any]) -> Optional[Polygon]:
        """
        Crea zona de maniobra para un muelle
        """
        try:
            pos = dock_element.get('position', {})
            dims = dock_element.get('dimensions', {})
            
            x = pos.get('x', 0)
            y = pos.get('y', 0)
            w = dims.get('width', 3.5)
            dock_depth = dims.get('depth', 0.5)
            maneuver_depth = dims.get('maneuver_zone', 4.0)
            
            # Zona de maniobra empieza después del muelle
            return box(x, y + dock_depth, x + w, y + dock_depth + maneuver_depth)
            
        except Exception as e:
            logger.warning(f"Error creando zona de maniobra: {e}")
            return None
    
    def calculate_free_space(self) -> MultiPolygon:
        """
        Calcula el espacio libre exacto usando operaciones booleanas
        
        Returns:
            MultiPolygon con todas las zonas libres
        """
        if not self.obstacles:
            return MultiPolygon([self.warehouse_polygon])
        
        try:
            # Unir todos los obstáculos
            all_obstacles = self.obstacles + self.maneuver_zones
            obstacles_union = unary_union(all_obstacles)
            
            # Diferencia: nave - obstáculos = espacio libre
            free_space = self.warehouse_polygon.difference(obstacles_union)
            
            # Asegurar que es válido
            free_space = make_valid(free_space)
            
            # Convertir a MultiPolygon si es necesario
            if isinstance(free_space, Polygon):
                return MultiPolygon([free_space])
            elif isinstance(free_space, MultiPolygon):
                return free_space
            else:
                # GeometryCollection u otro tipo
                polygons = [g for g in free_space.geoms if isinstance(g, Polygon)]
                return MultiPolygon(polygons) if polygons else MultiPolygon()
                
        except Exception as e:
            logger.error(f"Error calculando espacio libre: {e}")
            return MultiPolygon()
    
    def classify_zone(self, polygon: Polygon) -> Tuple[ZoneType, str]:
        """
        Clasifica una zona libre según su forma y posición
        
        Args:
            polygon: Polígono de la zona libre
            
        Returns:
            Tupla (tipo, etiqueta)
        """
        bounds = polygon.bounds  # minx, miny, maxx, maxy
        minx, miny, maxx, maxy = bounds
        
        width = maxx - minx
        height = maxy - miny
        area = polygon.area
        aspect_ratio = width / height if height > 0 else 999
        
        centroid = polygon.centroid
        cx, cy = centroid.x, centroid.y
        
        # Clasificación por forma
        is_narrow_vertical = width <= 4 and height > width * 1.5
        is_narrow_horizontal = height <= 4 and width > height * 1.5
        
        # Pasillo vertical (entre columnas de estanterías)
        if is_narrow_vertical:
            if width >= 3:
                return ZoneType.CROSS_AISLE, "Pasillo Transversal"
            else:
                return ZoneType.AISLE, "Pasillo Operativo"
        
        # Pasillo horizontal (entre filas)
        if is_narrow_horizontal:
            if height >= 4:
                return ZoneType.MAIN_AISLE, "Pasillo Principal"
            elif height >= 3:
                return ZoneType.CROSS_AISLE, "Pasillo Transversal"
            else:
                return ZoneType.AISLE, "Pasillo Operativo"
        
        # Zona grande de circulación
        if area > 50:
            # Determinar posición para etiqueta
            if cy < self.width * 0.25:
                return ZoneType.CIRCULATION, "Circulación Norte"
            elif cy > self.width * 0.75:
                return ZoneType.CIRCULATION, "Circulación Sur"
            elif cx < self.length * 0.2:
                return ZoneType.CIRCULATION, "Circulación Oeste"
            elif cx > self.length * 0.8:
                return ZoneType.CIRCULATION, "Circulación Este"
            else:
                return ZoneType.CIRCULATION, "Zona Circulación"
        
        # Zona libre pequeña
        return ZoneType.FREE_ZONE, "Zona Libre"
    
    def analyze(self) -> Dict[str, Any]:
        """
        Ejecuta análisis completo de la geometría
        
        Returns:
            Diccionario con zonas detectadas y métricas
        """
        logger.info(f"🔍 Analizando geometría: {self.length}x{self.width}m, {len(self.obstacles)} obstáculos")
        
        # Calcular espacio libre exacto
        free_space = self.calculate_free_space()
        
        # Procesar cada polígono libre
        zones: List[Dict] = []
        total_aisle_area = 0
        total_circulation_area = 0
        
        for idx, polygon in enumerate(free_space.geoms):
            if polygon.is_empty or polygon.area < 0.5:  # Ignorar áreas < 0.5 m²
                continue
            
            zone_type, label = self.classify_zone(polygon)
            bounds = polygon.bounds
            
            zone_data = {
                'id': f'zone-{idx}',
                'type': zone_type.value,
                'label': label,
                'area': round(polygon.area, 2),
                'x': round(bounds[0], 2),
                'y': round(bounds[1], 2),
                'width': round(bounds[2] - bounds[0], 2),
                'height': round(bounds[3] - bounds[1], 2),
                'centroid': {
                    'x': round(polygon.centroid.x, 2),
                    'y': round(polygon.centroid.y, 2)
                },
                'isAutoGenerated': True
            }
            zones.append(zone_data)
            
            # Acumular áreas por tipo
            if zone_type in (ZoneType.AISLE, ZoneType.MAIN_AISLE, ZoneType.CROSS_AISLE):
                total_aisle_area += polygon.area
            elif zone_type == ZoneType.CIRCULATION:
                total_circulation_area += polygon.area
        
        # Calcular métricas
        total_area = self.length * self.width
        occupied_area = sum(obs.area for obs in self.obstacles)
        # Añadir zonas de maniobra al área ocupada
        occupied_area += sum(mz.area for mz in self.maneuver_zones)
        free_area = total_area - occupied_area
        
        metrics = {
            'totalArea': round(total_area, 2),
            'occupiedArea': round(occupied_area, 2),
            'freeArea': round(free_area, 2),
            'aisleArea': round(total_aisle_area, 2),
            'circulationArea': round(total_circulation_area, 2),
            'efficiency': round((occupied_area / total_area) * 100, 1) if total_area > 0 else 0,
            'freePercentage': round((free_area / total_area) * 100, 1) if total_area > 0 else 0
        }
        
        logger.info(f"✅ Análisis completo: {len(zones)} zonas, {metrics['freeArea']}m² libres")
        
        return {
            'zones': zones,
            'metrics': metrics,
            'dimensions': {
                'length': self.length,
                'width': self.width
            }
        }


def analyze_layout(dimensions: Dict[str, float], elements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Función de conveniencia para analizar un layout completo
    
    Args:
        dimensions: {'length': float, 'width': float}
        elements: Lista de elementos con type, position, dimensions, rotation
        
    Returns:
        Resultado del análisis con zonas y métricas
    """
    service = GeometryService(
        length=dimensions.get('length', 80),
        width=dimensions.get('width', 40)
    )
    
    for element in elements:
        service.add_element(element)
    
    return service.analyze()
