"""
UNITNAVE - Servicio de Geometría Exacta (Profesional)
Operaciones booleanas precisas con Shapely/GEOS

Características:
- Cálculo exacto de espacios libres (diferencia booleana)
- Soporte completo para rotaciones arbitrarias
- Detección inteligente de pasillos (medial axis simplificado)
- Validación de normativa ERP
- Métricas precisas de área

@version 2.0 - Profesional
"""

import math
import logging
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum

from shapely.geometry import Polygon, MultiPolygon, box, Point, LineString
from shapely.ops import unary_union
from shapely.affinity import rotate, translate
from shapely.validation import make_valid

logger = logging.getLogger(__name__)


# ============================================================
# CONSTANTES DE NORMATIVA ERP
# ============================================================
class ERPConstants:
    """Normativa de seguridad para almacenes (España/EU)"""
    MAIN_AISLE_MIN_WIDTH = 3.5      # Pasillo principal mínimo (m)
    CROSS_AISLE_MIN_WIDTH = 3.0     # Pasillo transversal mínimo (m)
    OPERATIVE_AISLE_MIN_WIDTH = 2.5 # Pasillo operativo mínimo (m)
    DOCK_MANEUVER_MIN_DEPTH = 4.0   # Zona maniobra muelle (m)
    MIN_DOCK_DISTANCE = 1.5         # Distancia mínima a muelle (m)
    FIRE_AISLE_MIN_WIDTH = 1.2      # Pasillo evacuación (m)
    MAX_TRAVEL_DISTANCE = 50.0      # Distancia máxima a salida (m)


class ZoneType(str, Enum):
    """Tipos de zonas detectadas"""
    SHELF = "shelf"
    DOCK = "dock"
    OFFICE = "office"
    MAIN_AISLE = "main_aisle"
    CROSS_AISLE = "cross_aisle"
    AISLE = "aisle"
    CIRCULATION = "circulation"
    DOCK_MANEUVER = "dock_maneuver"
    FREE_ZONE = "free_zone"


# ============================================================
# MODELOS DE DATOS
# ============================================================
@dataclass
class GeometryMetrics:
    """Métricas calculadas exactas"""
    total_area: float
    occupied_area: float
    free_area: float
    aisle_area: float
    circulation_area: float
    storage_area: float
    efficiency: float
    aisle_percentage: float
    storage_percentage: float

    def to_dict(self):
        return asdict(self)


@dataclass
class ValidationWarning:
    """Warning de validación normativa"""
    code: str
    severity: str  # 'error', 'warning', 'info'
    message: str
    element_id: Optional[str] = None
    value: Optional[float] = None
    min_value: Optional[float] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class DetectedZone:
    """Zona detectada con geometría exacta"""
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
    polygon_points: Optional[List[List[float]]] = None  # [[x1,y1], [x2,y2], ...]
    is_auto_generated: bool = True

    def to_dict(self):
        return asdict(self)


# ============================================================
# CLASE PRINCIPAL
# ============================================================
class GeometryEngine:
    """
    Motor de geometría exacta usando Shapely/GEOS
    
    Uso:
        engine = GeometryEngine(length=80, width=40)
        engine.add_elements(elements_list)
        result = engine.calculate_layout()
    """
    
    def __init__(self, length: float, width: float):
        """
        Inicializa el motor con las dimensiones de la nave
        
        Args:
            length: Largo de la nave (eje X) en metros
            width: Ancho de la nave (eje Y) en metros
        """
        self.length = length
        self.width = width
        self.warehouse_polygon = box(0, 0, length, width)
        self.elements: List[Dict] = []
        self.obstacles: List[Polygon] = []
        self.element_polygons: Dict[str, Polygon] = {}
        
    def add_elements(self, elements: List[Dict[str, Any]]) -> None:
        """Añade todos los elementos al motor"""
        self.elements = elements
        self.obstacles = []
        self.element_polygons = {}
        
        for element in elements:
            polygon = self._element_to_polygon(element)
            if polygon and polygon.is_valid and not polygon.is_empty:
                self.obstacles.append(polygon)
                self.element_polygons[element.get('id', 'unknown')] = polygon
    
    def _element_to_polygon(self, element: Dict[str, Any]) -> Optional[Polygon]:
        """
        Convierte un elemento a polígono Shapely con rotación REAL
        
        Soporta rotaciones de 0-360° correctamente
        """
        try:
            el_type = element.get('type', 'unknown')
            pos = element.get('position', {})
            dims = element.get('dimensions', {})
            rotation = element.get('rotation', 0)
            
            # Posición (soporta tanto 'y' como 'z' para compatibilidad)
            x = float(pos.get('x', 0))
            y = float(pos.get('y', pos.get('z', 0)))
            
            # Dimensiones según tipo de elemento
            if el_type == 'shelf':
                w = float(dims.get('length', 2.7))
                h = float(dims.get('depth', 1.1))
            elif el_type == 'dock':
                w = float(dims.get('width', 3.5))
                h = float(dims.get('depth', 0.5))
            elif el_type == 'office':
                w = float(dims.get('length', dims.get('largo', 12)))
                h = float(dims.get('width', dims.get('ancho', 8)))
            elif el_type in ('operational_zone', 'zone', 'dock_maneuver'):
                w = float(dims.get('length', dims.get('largo', 10)))
                h = float(dims.get('width', dims.get('ancho', 10)))
            else:
                w = float(dims.get('length', dims.get('width', 3)))
                h = float(dims.get('depth', dims.get('height', 3)))
            
            # Crear rectángulo base centrado en origen
            half_w = w / 2
            half_h = h / 2
            rect = Polygon([
                (-half_w, -half_h),
                (half_w, -half_h),
                (half_w, half_h),
                (-half_w, half_h)
            ])
            
            # Rotar si es necesario
            if rotation != 0:
                rect = rotate(rect, rotation, origin=(0, 0))
            
            # Trasladar a posición final (centro del elemento)
            center_x = x + w / 2
            center_y = y + h / 2
            rect = translate(rect, center_x, center_y)
            
            return make_valid(rect)
            
        except Exception as e:
            logger.warning(f"Error convirtiendo elemento a polígono: {e}")
            return None
    
    def calculate_free_space(self) -> MultiPolygon:
        """
        Calcula el espacio libre EXACTO usando operaciones booleanas
        
        Fórmula: FreeSpace = Warehouse - Union(AllObstacles)
        
        Returns:
            MultiPolygon con todas las zonas libres
        """
        if not self.obstacles:
            return MultiPolygon([self.warehouse_polygon])
        
        try:
            # Unir todos los obstáculos en un solo polígono
            obstacles_union = unary_union(self.obstacles)
            
            # Diferencia booleana exacta
            free_space = self.warehouse_polygon.difference(obstacles_union)
            
            # Asegurar validez
            free_space = make_valid(free_space)
            
            # Normalizar a MultiPolygon
            if isinstance(free_space, Polygon):
                return MultiPolygon([free_space])
            elif isinstance(free_space, MultiPolygon):
                return free_space
            else:
                # GeometryCollection u otro
                polygons = [g for g in free_space.geoms if isinstance(g, Polygon)]
                return MultiPolygon(polygons) if polygons else MultiPolygon()
                
        except Exception as e:
            logger.error(f"Error calculando espacio libre: {e}")
            return MultiPolygon()
    
    def classify_free_zone(self, polygon: Polygon) -> Tuple[ZoneType, str]:
        """
        Clasifica una zona libre según su geometría y posición
        
        Usa análisis de forma (aspect ratio, área) y posición relativa
        """
        bounds = polygon.bounds  # minx, miny, maxx, maxy
        minx, miny, maxx, maxy = bounds
        
        width = maxx - minx
        height = maxy - miny
        area = polygon.area
        
        centroid = polygon.centroid
        cx, cy = centroid.x, centroid.y
        
        # Análisis de forma
        is_narrow = min(width, height) < 5
        is_vertical = height > width * 1.5
        is_horizontal = width > height * 1.5
        
        # Clasificación jerárquica
        
        # 1. Pasillo vertical estrecho (entre columnas de estanterías)
        if is_narrow and is_vertical:
            if width >= ERPConstants.CROSS_AISLE_MIN_WIDTH:
                return ZoneType.CROSS_AISLE, "Pasillo Transversal"
            elif width >= ERPConstants.OPERATIVE_AISLE_MIN_WIDTH:
                return ZoneType.AISLE, "Pasillo Operativo"
            else:
                return ZoneType.AISLE, f"Pasillo Estrecho ({width:.1f}m)"
        
        # 2. Pasillo horizontal (entre filas)
        if is_narrow and is_horizontal:
            if height >= ERPConstants.MAIN_AISLE_MIN_WIDTH:
                return ZoneType.MAIN_AISLE, "Pasillo Principal"
            elif height >= ERPConstants.CROSS_AISLE_MIN_WIDTH:
                return ZoneType.CROSS_AISLE, "Pasillo Transversal"
            else:
                return ZoneType.AISLE, f"Pasillo ({height:.1f}m)"
        
        # 3. Zona de circulación amplia
        if area > 50:
            # Determinar posición para etiqueta descriptiva
            if cy < self.width * 0.25:
                return ZoneType.CIRCULATION, "Zona Muelles (Norte)"
            elif cy > self.width * 0.75:
                return ZoneType.CIRCULATION, "Circulación Sur"
            elif cx < self.length * 0.15:
                return ZoneType.CIRCULATION, "Circulación Oeste"
            elif cx > self.length * 0.85:
                return ZoneType.CIRCULATION, "Circulación Este"
            else:
                return ZoneType.CIRCULATION, "Zona Circulación Central"
        
        # 4. Zona libre pequeña
        return ZoneType.FREE_ZONE, "Zona Libre"
    
    def detect_overlaps(self) -> List[Tuple[str, str, float]]:
        """
        Detecta solapamientos entre elementos
        
        Returns:
            Lista de tuplas (id1, id2, area_solapada)
        """
        overlaps = []
        element_ids = list(self.element_polygons.keys())
        
        for i, id1 in enumerate(element_ids):
            for id2 in element_ids[i+1:]:
                poly1 = self.element_polygons[id1]
                poly2 = self.element_polygons[id2]
                
                if poly1.intersects(poly2):
                    intersection = poly1.intersection(poly2)
                    if intersection.area > 0.01:  # > 1cm²
                        overlaps.append((id1, id2, intersection.area))
        
        return overlaps
    
    def validate_erp(self) -> List[ValidationWarning]:
        """
        Valida el layout contra normativa ERP
        
        Comprueba:
        - Anchos mínimos de pasillo
        - Distancias de seguridad
        - Solapamientos
        """
        warnings = []
        
        # 1. Detectar solapamientos
        overlaps = self.detect_overlaps()
        for id1, id2, area in overlaps:
            warnings.append(ValidationWarning(
                code="OVERLAP",
                severity="error",
                message=f"Solapamiento entre {id1} y {id2}: {area:.2f}m²",
                element_id=f"{id1},{id2}",
                value=area
            ))
        
        # 2. Calcular espacio libre y verificar pasillos
        free_space = self.calculate_free_space()
        
        for polygon in free_space.geoms:
            if polygon.is_empty or polygon.area < 1:
                continue
            
            bounds = polygon.bounds
            width = bounds[2] - bounds[0]
            height = bounds[3] - bounds[1]
            min_dimension = min(width, height)
            
            zone_type, _ = self.classify_free_zone(polygon)
            
            # Verificar anchos mínimos según tipo
            if zone_type == ZoneType.MAIN_AISLE:
                if min_dimension < ERPConstants.MAIN_AISLE_MIN_WIDTH:
                    warnings.append(ValidationWarning(
                        code="AISLE_WIDTH",
                        severity="error",
                        message=f"Pasillo principal de {min_dimension:.2f}m < {ERPConstants.MAIN_AISLE_MIN_WIDTH}m mínimo",
                        value=min_dimension,
                        min_value=ERPConstants.MAIN_AISLE_MIN_WIDTH
                    ))
            
            elif zone_type in (ZoneType.CROSS_AISLE, ZoneType.AISLE):
                if min_dimension < ERPConstants.OPERATIVE_AISLE_MIN_WIDTH:
                    warnings.append(ValidationWarning(
                        code="AISLE_WIDTH",
                        severity="warning",
                        message=f"Pasillo de {min_dimension:.2f}m < {ERPConstants.OPERATIVE_AISLE_MIN_WIDTH}m recomendado",
                        value=min_dimension,
                        min_value=ERPConstants.OPERATIVE_AISLE_MIN_WIDTH
                    ))
        
        # 3. Verificar distancias a muelles
        docks = [e for e in self.elements if e.get('type') == 'dock']
        other_elements = [e for e in self.elements if e.get('type') not in ('dock', 'dock_maneuver')]
        
        for dock in docks:
            dock_poly = self.element_polygons.get(dock.get('id'))
            if not dock_poly:
                continue
            
            for el in other_elements:
                el_poly = self.element_polygons.get(el.get('id'))
                if not el_poly:
                    continue
                
                distance = dock_poly.distance(el_poly)
                if distance < ERPConstants.MIN_DOCK_DISTANCE:
                    warnings.append(ValidationWarning(
                        code="DOCK_DISTANCE",
                        severity="warning",
                        message=f"{el.get('id')} a {distance:.2f}m del muelle {dock.get('id')} (mín {ERPConstants.MIN_DOCK_DISTANCE}m)",
                        element_id=el.get('id'),
                        value=distance,
                        min_value=ERPConstants.MIN_DOCK_DISTANCE
                    ))
        
        return warnings
    
    def calculate_metrics(self) -> GeometryMetrics:
        """
        Calcula métricas exactas del layout
        """
        total_area = self.length * self.width
        
        # Área ocupada por obstáculos
        occupied_area = sum(poly.area for poly in self.obstacles)
        
        # Calcular áreas por tipo
        free_space = self.calculate_free_space()
        aisle_area = 0
        circulation_area = 0
        
        for polygon in free_space.geoms:
            if polygon.is_empty:
                continue
            zone_type, _ = self.classify_free_zone(polygon)
            if zone_type in (ZoneType.AISLE, ZoneType.MAIN_AISLE, ZoneType.CROSS_AISLE):
                aisle_area += polygon.area
            elif zone_type == ZoneType.CIRCULATION:
                circulation_area += polygon.area
        
        # Área de almacenamiento (estanterías)
        storage_area = sum(
            self.element_polygons[e.get('id')].area 
            for e in self.elements 
            if e.get('type') == 'shelf' and e.get('id') in self.element_polygons
        )
        
        free_area = total_area - occupied_area
        
        return GeometryMetrics(
            total_area=round(total_area, 2),
            occupied_area=round(occupied_area, 2),
            free_area=round(free_area, 2),
            aisle_area=round(aisle_area, 2),
            circulation_area=round(circulation_area, 2),
            storage_area=round(storage_area, 2),
            efficiency=round((occupied_area / total_area) * 100, 1) if total_area > 0 else 0,
            aisle_percentage=round((aisle_area / total_area) * 100, 1) if total_area > 0 else 0,
            storage_percentage=round((storage_area / total_area) * 100, 1) if total_area > 0 else 0
        )
    
    def calculate_layout(self) -> Dict[str, Any]:
        """
        Ejecuta análisis completo del layout
        
        Returns:
            Dict con zones, metrics, warnings
        """
        logger.info(f"🔍 Analizando layout: {self.length}x{self.width}m, {len(self.elements)} elementos")
        
        # 1. Calcular espacio libre exacto
        free_space = self.calculate_free_space()
        
        # 2. Clasificar zonas
        zones: List[DetectedZone] = []
        
        # Helper para extraer puntos del polígono
        def get_polygon_points(poly) -> List[List[float]]:
            """Extrae los puntos del polígono como [[x1,y1], [x2,y2], ...]"""
            try:
                if hasattr(poly, 'exterior'):
                    coords = list(poly.exterior.coords)
                    return [[round(x, 2), round(y, 2)] for x, y in coords]
                return []
            except Exception:
                return []
        
        # Añadir elementos como zonas (con sus polígonos reales)
        for el in self.elements:
            poly = self.element_polygons.get(el.get('id'))
            if not poly:
                continue
            
            bounds = poly.bounds
            polygon_points = get_polygon_points(poly)
            
            zones.append(DetectedZone(
                id=el.get('id'),
                type=el.get('type'),
                label=el.get('label', el.get('id')),
                x=round(bounds[0], 2),
                y=round(bounds[1], 2),
                width=round(bounds[2] - bounds[0], 2),
                height=round(bounds[3] - bounds[1], 2),
                area=round(poly.area, 2),
                rotation=el.get('rotation', 0),
                centroid_x=round(poly.centroid.x, 2),
                centroid_y=round(poly.centroid.y, 2),
                polygon_points=polygon_points if polygon_points else None,
                is_auto_generated=False
            ))
        
        # Añadir zonas libres auto-detectadas (con polígonos exactos)
        for idx, polygon in enumerate(free_space.geoms):
            if polygon.is_empty or polygon.area < 0.5:
                continue
            
            zone_type, label = self.classify_free_zone(polygon)
            bounds = polygon.bounds
            polygon_points = get_polygon_points(polygon)
            
            zones.append(DetectedZone(
                id=f"auto-{zone_type.value}-{idx}",
                type=zone_type.value,
                label=label,
                x=round(bounds[0], 2),
                y=round(bounds[1], 2),
                width=round(bounds[2] - bounds[0], 2),
                height=round(bounds[3] - bounds[1], 2),
                area=round(polygon.area, 2),
                centroid_x=round(polygon.centroid.x, 2),
                centroid_y=round(polygon.centroid.y, 2),
                polygon_wkt=polygon.wkt,
                polygon_points=polygon_points if polygon_points else None,
                is_auto_generated=True
            ))
        
        # 3. Calcular métricas
        metrics = self.calculate_metrics()
        
        # 4. Validar normativa
        warnings = self.validate_erp()
        
        logger.info(f"✅ Layout analizado: {len(zones)} zonas, {len(warnings)} warnings")
        
        return {
            'zones': [z.to_dict() for z in zones],
            'metrics': metrics.to_dict(),
            'warnings': [w.to_dict() for w in warnings],
            'dimensions': {
                'length': self.length,
                'width': self.width
            }
        }


# ============================================================
# FUNCIÓN DE CONVENIENCIA
# ============================================================
def analyze_layout(dimensions: Dict[str, float], elements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Función de conveniencia para analizar un layout completo
    
    Args:
        dimensions: {'length': float, 'width': float}
        elements: Lista de elementos
        
    Returns:
        Resultado del análisis con zones, metrics, warnings
    """
    engine = GeometryEngine(
        length=dimensions.get('length', 80),
        width=dimensions.get('width', 40)
    )
    engine.add_elements(elements)
    return engine.calculate_layout()


# Alias para compatibilidad con main.py
GeometryService = GeometryEngine
