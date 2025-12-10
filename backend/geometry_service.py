"""
UNITNAVE - Servicio de Geometría Exacta (Profesional)
Operaciones booleanas precisas con Shapely/GEOS + Clasificación Scanline

Solución híbrida:
- Shapely: Cálculos exactos (áreas, solapamientos, validación ERP)
- Scanline: Clasificación visual (pasillos, zonas de circulación)

@version 2.2 - Algoritmo híbrido optimizado
"""

import logging
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum

from shapely.geometry import Polygon, MultiPolygon, box
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
    polygon_points: Optional[List[List[float]]] = None
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
            x = float(pos.get('x', element.get('x', 0)))
            y = float(pos.get('y', pos.get('z', element.get('y', 0))))
            
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
            elif el_type in ('service_room', 'technical_room'):
                w = float(dims.get('length', dims.get('largo', 5)))
                h = float(dims.get('width', dims.get('ancho', 4)))
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
        Calcula el espacio libre EXACTO usando operaciones booleanas (Shapely)
        
        Fórmula: FreeSpace = Warehouse - Union(AllObstacles)
        """
        if not self.obstacles:
            return MultiPolygon([self.warehouse_polygon])
        
        try:
            obstacles_union = unary_union(self.obstacles)
            free_space = self.warehouse_polygon.difference(obstacles_union)
            free_space = make_valid(free_space)
            
            if isinstance(free_space, Polygon):
                return MultiPolygon([free_space])
            elif isinstance(free_space, MultiPolygon):
                return free_space
            else:
                polygons = [g for g in free_space.geoms if isinstance(g, Polygon)]
                return MultiPolygon(polygons) if polygons else MultiPolygon()
                
        except Exception as e:
            logger.error(f"Error calculando espacio libre: {e}")
            return MultiPolygon()
    
    def decompose_to_rectangles(self) -> List[Tuple[float, float, float, float]]:
        """
        Descompone el espacio libre en rectángulos usando algoritmo scanline
        (IDÉNTICO al algoritmo del frontend para consistencia visual)
        
        Returns:
            Lista de tuplas (x, y, width, height)
        """
        if not self.obstacles:
            return [(0, 0, self.length, self.width)]
        
        W = self.length
        H = self.width
        
        # Extraer rectángulos de obstáculos
        obstacle_rects = []
        for poly in self.obstacles:
            bounds = poly.bounds  # minx, miny, maxx, maxy
            obstacle_rects.append(bounds)
        
        # Crear líneas horizontales en cada borde de obstáculo
        y_positions = set([0, H])
        for (_, miny, _, maxy) in obstacle_rects:
            if 0 <= miny <= H:
                y_positions.add(miny)
            if 0 <= maxy <= H:
                y_positions.add(maxy)
        
        y_positions = sorted(list(y_positions))
        
        free_rectangles = []
        
        # Procesar cada franja horizontal
        for i in range(len(y_positions) - 1):
            y1 = y_positions[i]
            y2 = y_positions[i + 1]
            strip_height = y2 - y1
            
            if strip_height < 0.1:
                continue
            
            # Encontrar huecos en esta franja
            gaps = [(0, W)]
            
            for (ox1, oy1, ox2, oy2) in obstacle_rects:
                if oy1 < y2 and oy2 > y1:
                    new_gaps = []
                    for (gap_start, gap_end) in gaps:
                        if ox1 <= gap_start and ox2 >= gap_end:
                            continue
                        elif ox1 > gap_start and ox2 < gap_end:
                            new_gaps.append((gap_start, ox1))
                            new_gaps.append((ox2, gap_end))
                        elif ox1 > gap_start and ox1 < gap_end:
                            new_gaps.append((gap_start, ox1))
                        elif ox2 > gap_start and ox2 < gap_end:
                            new_gaps.append((ox2, gap_end))
                        else:
                            new_gaps.append((gap_start, gap_end))
                    gaps = new_gaps
            
            for (gap_start, gap_end) in gaps:
                gap_width = gap_end - gap_start
                if gap_width > 0.5:
                    free_rectangles.append((gap_start, y1, gap_width, strip_height))
        
        # Fusionar rectángulos adyacentes verticalmente
        merged = self._merge_rectangles_vertical(free_rectangles)
        
        # Fusionar rectángulos adyacentes horizontalmente
        merged = self._merge_rectangles_horizontal(merged)
        
        return merged
    
    def _merge_rectangles_vertical(self, rects: List[Tuple]) -> List[Tuple]:
        """Fusiona rectángulos con mismo x y ancho que son contiguos verticalmente"""
        if not rects:
            return []
        
        # Agrupar por (x, width)
        groups = {}
        for (x, y, w, h) in rects:
            key = (round(x, 1), round(w, 1))
            if key not in groups:
                groups[key] = []
            groups[key].append((x, y, w, h))
        
        merged = []
        for key, group in groups.items():
            group.sort(key=lambda r: r[1])  # Ordenar por y
            
            current = list(group[0])
            for i in range(1, len(group)):
                next_rect = group[i]
                # Si son contiguos verticalmente
                if abs(next_rect[1] - (current[1] + current[3])) < 0.2:
                    current[3] = (next_rect[1] + next_rect[3]) - current[1]
                else:
                    merged.append(tuple(current))
                    current = list(next_rect)
            merged.append(tuple(current))
        
        return merged
    
    def _merge_rectangles_horizontal(self, rects: List[Tuple]) -> List[Tuple]:
        """Fusiona rectángulos con mismo y y altura que son contiguos horizontalmente"""
        if not rects:
            return []
        
        # Agrupar por (y, height)
        groups = {}
        for (x, y, w, h) in rects:
            key = (round(y, 1), round(h, 1))
            if key not in groups:
                groups[key] = []
            groups[key].append((x, y, w, h))
        
        merged = []
        for key, group in groups.items():
            group.sort(key=lambda r: r[0])  # Ordenar por x
            
            current = list(group[0])
            for i in range(1, len(group)):
                next_rect = group[i]
                # Si son contiguos horizontalmente
                if abs(next_rect[0] - (current[0] + current[2])) < 0.2:
                    current[2] = (next_rect[0] + next_rect[2]) - current[0]
                else:
                    merged.append(tuple(current))
                    current = list(next_rect)
            merged.append(tuple(current))
        
        return merged
    
    def classify_free_zone(self, rect: Tuple[float, float, float, float]) -> Tuple[ZoneType, str]:
        """
        Clasifica un rectángulo según sus dimensiones y posición
        (MISMA LÓGICA QUE EL FRONTEND para consistencia)
        """
        x, y, width, height = rect
        area = width * height
        
        # Pasillos: estrechos y largos (igual que frontend)
        if width <= 4 and height > 6:
            # Pasillo vertical
            if width >= 3:
                return ZoneType.CROSS_AISLE, "Pasillo Transversal"
            else:
                return ZoneType.AISLE, "Pasillo Operativo"
        
        elif height <= 4 and width > 6:
            # Pasillo horizontal
            if height >= 3:
                return ZoneType.MAIN_AISLE, "Pasillo Principal"
            else:
                return ZoneType.AISLE, "Pasillo Operativo"
        
        elif width <= 5 or height <= 5:
            # Pasillo pequeño
            return ZoneType.AISLE, "Pasillo"
        
        elif area > 100:
            # Zona grande de circulación - clasificar por posición
            if y < 10:
                return ZoneType.CIRCULATION, "Zona Circulación Norte"
            elif y > self.width - 15:
                return ZoneType.CIRCULATION, "Zona Circulación Sur"
            elif x < 10:
                return ZoneType.CIRCULATION, "Recepción"
            elif x > self.length - 15:
                return ZoneType.CIRCULATION, "Expedición"
            else:
                return ZoneType.CIRCULATION, "Zona Circulación"
        
        else:
            return ZoneType.FREE_ZONE, "Zona Libre"
    
    def detect_overlaps(self) -> List[Tuple[str, str, float]]:
        """Detecta solapamientos entre elementos usando Shapely"""
        overlaps = []
        element_ids = list(self.element_polygons.keys())
        
        for i, id1 in enumerate(element_ids):
            for id2 in element_ids[i+1:]:
                poly1 = self.element_polygons[id1]
                poly2 = self.element_polygons[id2]
                
                if poly1.intersects(poly2):
                    intersection = poly1.intersection(poly2)
                    if intersection.area > 0.01:
                        overlaps.append((id1, id2, intersection.area))
        
        return overlaps
    
    def validate_erp(self) -> List[ValidationWarning]:
        """Valida el layout contra normativa ERP usando Shapely"""
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
        
        # 2. Verificar anchos de pasillo
        free_rects = self.decompose_to_rectangles()
        for rect in free_rects:
            x, y, w, h = rect
            zone_type, _ = self.classify_free_zone(rect)
            min_dim = min(w, h)
            
            if zone_type == ZoneType.MAIN_AISLE:
                if min_dim < ERPConstants.MAIN_AISLE_MIN_WIDTH:
                    warnings.append(ValidationWarning(
                        code="AISLE_WIDTH",
                        severity="error",
                        message=f"Pasillo principal de {min_dim:.2f}m < {ERPConstants.MAIN_AISLE_MIN_WIDTH}m mínimo",
                        value=min_dim,
                        min_value=ERPConstants.MAIN_AISLE_MIN_WIDTH
                    ))
            
            elif zone_type in (ZoneType.CROSS_AISLE, ZoneType.AISLE):
                if min_dim < ERPConstants.OPERATIVE_AISLE_MIN_WIDTH:
                    warnings.append(ValidationWarning(
                        code="AISLE_WIDTH",
                        severity="warning",
                        message=f"Pasillo de {min_dim:.2f}m < {ERPConstants.OPERATIVE_AISLE_MIN_WIDTH}m recomendado",
                        value=min_dim,
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
                        message=f"{el.get('id')} a {distance:.2f}m del muelle (mín {ERPConstants.MIN_DOCK_DISTANCE}m)",
                        element_id=el.get('id'),
                        value=distance,
                        min_value=ERPConstants.MIN_DOCK_DISTANCE
                    ))
        
        return warnings
    
    def calculate_metrics(self) -> GeometryMetrics:
        """Calcula métricas exactas usando Shapely"""
        total_area = self.length * self.width
        
        # Área ocupada (Shapely - exacto)
        occupied_area = sum(poly.area for poly in self.obstacles)
        
        # Clasificar áreas libres
        free_rects = self.decompose_to_rectangles()
        aisle_area = 0
        circulation_area = 0
        
        for rect in free_rects:
            x, y, w, h = rect
            area = w * h
            zone_type, _ = self.classify_free_zone(rect)
            
            if zone_type in (ZoneType.AISLE, ZoneType.MAIN_AISLE, ZoneType.CROSS_AISLE):
                aisle_area += area
            elif zone_type == ZoneType.CIRCULATION:
                circulation_area += area
        
        # Área de almacenamiento
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
        
        Combina:
        - Shapely para precisión matemática
        - Scanline para clasificación visual
        """
        logger.info(f"🔍 Analizando layout: {self.length}x{self.width}m, {len(self.elements)} elementos")
        
        zones: List[DetectedZone] = []
        
        # Helper para extraer puntos del polígono Shapely
        def get_polygon_points(poly) -> List[List[float]]:
            try:
                if hasattr(poly, 'exterior'):
                    coords = list(poly.exterior.coords)
                    return [[round(x, 2), round(y, 2)] for x, y in coords]
                return []
            except Exception:
                return []
        
        # 1. Añadir elementos como zonas (polígonos Shapely exactos)
        for el in self.elements:
            poly = self.element_polygons.get(el.get('id'))
            if not poly:
                continue
            
            bounds = poly.bounds
            polygon_points = get_polygon_points(poly)
            
            zones.append(DetectedZone(
                id=el.get('id'),
                type=el.get('type'),
                label=el.get('properties', {}).get('label', el.get('id')),
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
        
        # 2. Añadir zonas libres (algoritmo scanline para clasificación)
        free_rects = self.decompose_to_rectangles()
        
        for idx, rect in enumerate(free_rects):
            x, y, w, h = rect
            area = w * h
            
            if area < 1:
                continue
            
            zone_type, label = self.classify_free_zone(rect)
            
            points = [
                [round(x, 2), round(y, 2)],
                [round(x + w, 2), round(y, 2)],
                [round(x + w, 2), round(y + h, 2)],
                [round(x, 2), round(y + h, 2)]
            ]
            
            zones.append(DetectedZone(
                id=f"free-{idx}",
                type=zone_type.value,
                label=label,
                x=round(x, 2),
                y=round(y, 2),
                width=round(w, 2),
                height=round(h, 2),
                area=round(area, 2),
                centroid_x=round(x + w / 2, 2),
                centroid_y=round(y + h / 2, 2),
                polygon_points=points,
                is_auto_generated=True
            ))
        
        # 3. Métricas (Shapely - exacto)
        metrics = self.calculate_metrics()
        
        # 4. Validación ERP (Shapely - exacto)
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
    """
    engine = GeometryEngine(
        length=dimensions.get('length', 80),
        width=dimensions.get('width', 40)
    )
    engine.add_elements(elements)
    return engine.calculate_layout()


# Alias para compatibilidad con main.py
GeometryService = GeometryEngine
