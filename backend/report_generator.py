"""
UNITNAVE Designer - Generador de Informes
Calcula y reporta todas las métricas del diseño de nave industrial
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
import json


@dataclass
class ShelfMetrics:
    """Métricas de una estantería individual"""
    id: str
    tipo: str  # "back-to-back" o "simple"
    posicion_x: float
    posicion_z: float
    largo: float
    profundidad: float
    altura: float
    niveles: int
    capacidad_palets: int
    zona_abc: Optional[str] = None
    rotacion: float = 0


@dataclass
class ShelfDetailedMetrics:
    """Métricas detalladas de una estantería con todas las distancias"""
    id: str
    label: str
    tipo: str  # "back-to-back" o "simple"
    zona_abc: Optional[str]
    
    # Posición exacta (esquina inferior izquierda)
    posicion_x: float
    posicion_z: float
    
    # Dimensiones
    largo: float
    profundidad: float
    altura: float
    niveles: int
    
    # Capacidad
    palets_por_nivel: int
    palets_totales: int
    
    # Distancias a paredes (en cm)
    distancia_pared_oeste: float  # Izquierda (X=0)
    distancia_pared_este: float   # Derecha (X=length)
    distancia_pared_norte: float  # Muelles (Z=0)
    distancia_pared_sur: float    # Trasera (Z=width)
    
    # Distancias a estanterías adyacentes
    distancia_estanteria_anterior: Optional[float] = None
    distancia_estanteria_siguiente: Optional[float] = None
    
    # Posición del extremo
    extremo_x: float = 0
    extremo_z: float = 0


@dataclass
class DistanceSummary:
    """Resumen de todas las distancias en la nave"""
    # Distancias mínimas a paredes (cm)
    min_distancia_pared_oeste: float
    min_distancia_pared_este: float
    min_distancia_pared_norte: float
    min_distancia_pared_sur: float
    
    # Anchos de pasillo (cm)
    ancho_pasillo_operativo: float
    ancho_pasillo_min: float
    ancho_pasillo_max: float
    
    # Espacios perimetrales (cm)
    espacio_libre_oeste: float
    espacio_libre_este: float
    espacio_libre_norte: float
    espacio_libre_sur: float
    
    # Distancia entre primera y última estantería
    profundidad_zona_almacenamiento: float


@dataclass
class PalletSummary:
    """Resumen detallado de palets"""
    # Por tipo de estantería
    palets_en_dobles: int
    palets_en_simples: int
    
    # Por zona ABC (si aplica)
    palets_zona_a: int
    palets_zona_b: int
    palets_zona_c: int
    
    # Por nivel
    palets_por_nivel: Dict[int, int]  # {nivel: cantidad}
    
    # Totales
    total_palets: int
    total_estanterias: int
    media_palets_por_estanteria: float
    
    # Eficiencia
    palets_por_m2_estanteria: float
    palets_por_m3_nave: float


@dataclass
class ZoneDetailedMetrics:
    """Métricas detalladas de una zona ABC"""
    zona: str  # "A", "B", "C"
    
    # Estanterías
    num_estanterias: int
    num_estanterias_dobles: int
    num_estanterias_simples: int
    
    # Palets
    palets_totales: int
    palets_por_nivel: Dict[int, int]
    
    # Dimensiones zona (cm)
    superficie_m2: float
    
    # Posiciones (cm)
    x_min: float
    x_max: float
    z_min: float
    z_max: float
    
    # Distancias a muelles/pared norte (cm)
    distancia_min_muelles: float
    distancia_max_muelles: float
    distancia_media_muelles: float
    
    # Distancias a paredes laterales (cm)
    distancia_min_pared_oeste: float
    distancia_min_pared_este: float
    distancia_min_pared_sur: float
    
    # Distancias entre estanterías de la zona (cm)
    ancho_pasillo_min: float
    ancho_pasillo_max: float
    ancho_pasillo_medio: float
    
    # Altura (cm)
    altura_estanterias: float
    niveles: int
    
    # Lista de estanterías en la zona
    estanterias: List[str] = field(default_factory=list)


@dataclass
class AisleMetrics:
    """Métricas de pasillos"""
    ancho_pasillo_operativo: float
    tipo_maquinaria: str
    numero_pasillos_operativos: int
    longitud_total_pasillos: float
    
    # Pasillos perimetrales
    ancho_pasillo_norte: float
    ancho_pasillo_sur: float
    ancho_pasillo_este: float
    ancho_pasillo_oeste: float
    
    # Pasillo principal
    ancho_pasillo_principal: Optional[float] = None
    longitud_pasillo_principal: Optional[float] = None


@dataclass
class DockMetrics:
    """Métricas de muelles"""
    numero_muelles: int
    ancho_muelle: float
    profundidad_muelle: float
    altura_rampa: float
    separacion_entre_muelles: float
    
    # Zona maniobra
    profundidad_zona_maniobra: float
    superficie_zona_maniobra: float
    
    # Totales
    longitud_fachada_muelles: float


@dataclass
class OfficeMetrics:
    """Métricas de oficinas (V5.1)"""
    posicion_x: float
    posicion_z: float
    largo: float
    ancho: float
    superficie: float
    altura_oficina: float
    
    # Si es entresuelo
    es_entresuelo: bool
    altura_desde_suelo: float  # Altura libre bajo oficina
    altura_libre_bajo_oficina: float
    altura_libre_sobre_oficina: float
    
    # Nuevo modelo V5.1
    num_floors: int = 1
    floor_height: float = 3.0
    area_per_floor: float = 0
    total_area: float = 0


@dataclass
class ServiceRoomMetrics:
    """Métricas de salas de servicio"""
    id: str
    tipo: str  # "baños", "vestuarios", "comedor"
    posicion_x: float
    posicion_z: float
    largo: float
    ancho: float
    altura: float
    superficie: float


@dataclass
class TechnicalRoomMetrics:
    """Métricas de salas técnicas"""
    id: str
    tipo: str  # "electrica", "carga_baterias"
    posicion_x: float
    posicion_z: float
    largo: float
    ancho: float
    altura: float
    superficie: float


@dataclass
class OperationalZoneMetrics:
    """Métricas de zonas operativas"""
    id: str
    tipo: str  # "recepcion", "expedicion", "picking", "cross-docking"
    posicion_x: float
    posicion_z: float
    largo: float
    ancho: float
    superficie: float


@dataclass
class SurfaceSummary:
    """Resumen de superficies"""
    superficie_estanterias: float
    superficie_pasillos_operativos: float
    superficie_pasillos_perimetrales: float
    superficie_muelles_maniobra: float
    superficie_oficinas: float
    superficie_servicios: float
    superficie_salas_tecnicas: float
    superficie_zonas_operativas: float
    superficie_total: float
    
    # Porcentajes
    pct_estanterias: float = 0
    pct_pasillos_operativos: float = 0
    pct_pasillos_perimetrales: float = 0
    pct_muelles: float = 0
    pct_oficinas: float = 0
    pct_servicios: float = 0
    pct_salas_tecnicas: float = 0
    pct_zonas_operativas: float = 0


@dataclass
class EfficiencyIndicators:
    """Indicadores de eficiencia"""
    eficiencia_almacenamiento: float  # %
    palets_por_m2_nave: float
    palets_por_m2_almacenamiento: float
    ratio_circulacion: float  # % pasillo vs almacenamiento
    distancia_max_muelle_estanteria: float
    distancia_min_muelle_estanteria: float
    distancia_media_muelle_estanteria: float


@dataclass
class SafetyMetrics:
    """Métricas de seguridad y normativa"""
    ancho_minimo_evacuacion: float
    distancia_maxima_salida: float
    numero_salidas_emergencia: int
    cumple_cte: bool
    observaciones: List[str]


@dataclass 
class ConfigurationUsed:
    """Configuración utilizada"""
    tipo_palet: str
    palet_largo: float
    palet_ancho: float
    palet_alto: float
    tipo_maquinaria: str
    ancho_pasillo_requerido: float
    tipo_estanteria: str
    abc_zoning_activo: bool
    tipo_almacen: str


@dataclass
class WarehouseReport:
    """Informe completo de la nave"""
    # Metadatos
    fecha_generacion: str
    version: str = "1.0"
    
    # Dimensiones generales
    largo_total: float = 0
    ancho_total: float = 0
    altura_libre: float = 0
    superficie_total: float = 0
    volumen_total: float = 0
    
    # Componentes
    estanterias: List[ShelfMetrics] = field(default_factory=list)
    estanterias_detalle: List[ShelfDetailedMetrics] = field(default_factory=list)
    zonas_abc: List[ZoneDetailedMetrics] = field(default_factory=list)
    pasillos: Optional[AisleMetrics] = None
    muelles: Optional[DockMetrics] = None
    oficinas: List[OfficeMetrics] = field(default_factory=list)
    servicios: List[ServiceRoomMetrics] = field(default_factory=list)
    salas_tecnicas: List[TechnicalRoomMetrics] = field(default_factory=list)
    zonas_operativas: List[OperationalZoneMetrics] = field(default_factory=list)
    
    # Resúmenes detallados
    resumen_estanterias: Dict = field(default_factory=dict)
    resumen_distancias: Optional[DistanceSummary] = None
    resumen_palets: Optional[PalletSummary] = None
    resumen_superficies: Optional[SurfaceSummary] = None
    indicadores_eficiencia: Optional[EfficiencyIndicators] = None
    seguridad: Optional[SafetyMetrics] = None
    configuracion: Optional[ConfigurationUsed] = None


class ReportGenerator:
    """Generador de informes de diseño de nave"""
    
    def __init__(self, optimization_result, warehouse_input, preferences):
        self.result = optimization_result
        self.input = warehouse_input
        self.prefs = preferences
        self.report = WarehouseReport(
            fecha_generacion=datetime.now().isoformat()
        )
    
    def _get_attr(self, obj, key, default=0):
        """Obtiene atributo de objeto Pydantic o diccionario"""
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)
    
    def generate(self) -> WarehouseReport:
        """Genera el informe completo"""
        self._calc_dimensiones_generales()
        self._calc_estanterias()
        self._calc_estanterias_detalle()
        self._calc_zonas_abc()
        self._calc_resumen_distancias()
        self._calc_resumen_palets()
        self._calc_pasillos()
        self._calc_muelles()
        self._calc_oficinas()
        self._calc_servicios()
        self._calc_salas_tecnicas()
        self._calc_zonas_operativas()
        self._calc_resumen_superficies()
        self._calc_indicadores_eficiencia()
        self._calc_seguridad()
        self._set_configuracion()
        
        return self.report
    
    def _calc_dimensiones_generales(self):
        """Calcula dimensiones generales de la nave"""
        self.report.largo_total = self.input.length
        self.report.ancho_total = self.input.width
        self.report.altura_libre = self.input.height
        self.report.superficie_total = self.input.length * self.input.width
        self.report.volumen_total = self.input.length * self.input.width * self.input.height
    
    def _calc_estanterias(self):
        """Calcula métricas de estanterías"""
        shelves = [el for el in self.result.elements if el.type == "shelf"]
        
        total_capacity = 0
        total_surface = 0
        num_dobles = 0
        num_simples = 0
        
        for shelf in shelves:
            dims = shelf.dimensions
            props = shelf.properties or {}
            
            # Acceder a atributos (puede ser objeto Pydantic o dict)
            if hasattr(dims, 'length'):
                largo = dims.length or 0
                profundidad = dims.depth or 0
                altura = dims.height or 0
                niveles = dims.levels or 1
            else:
                largo = dims.get("length", 0) if dims else 0
                profundidad = dims.get("depth", 0) if dims else 0
                altura = dims.get("height", 0) if dims else 0
                niveles = dims.get("levels", 1) if dims else 1
            
            capacidad = props.get("capacity", 0) if isinstance(props, dict) else getattr(props, "capacity", 0)
            label = props.get("label", "") if isinstance(props, dict) else getattr(props, "label", "")
            
            # Determinar si es simple o doble
            es_simple = "-S" in label or label == "S"
            tipo = "simple" if es_simple else "back-to-back"
            
            if es_simple:
                num_simples += 1
            else:
                num_dobles += 1
            
            # Detectar zona ABC correctamente
            # Formato con ABC: "A-A1", "A-B1", "B-S", "C-A1"
            zona_abc = None
            if label.startswith("A-"):
                zona_abc = "A"
            elif label.startswith("B-"):
                zona_abc = "B"
            elif label.startswith("C-"):
                zona_abc = "C"
            
            rotation = props.get("rotation", 0) if isinstance(props, dict) else getattr(props, "rotation", 0)
            
            shelf_metrics = ShelfMetrics(
                id=shelf.id,
                tipo=tipo,
                posicion_x=shelf.position.x,
                posicion_z=shelf.position.y,
                largo=largo,
                profundidad=profundidad,
                altura=altura,
                niveles=niveles,
                capacidad_palets=capacidad,
                zona_abc=zona_abc,
                rotacion=rotation
            )
            self.report.estanterias.append(shelf_metrics)
            
            total_capacity += capacidad
            total_surface += largo * profundidad
        
        # Resumen
        self.report.resumen_estanterias = {
            "numero_estanterias_dobles": num_dobles,
            "numero_estanterias_simples": num_simples,
            "numero_total_estanterias": len(shelves),
            "capacidad_total_palets": total_capacity,
            "superficie_ocupada_estanterias": round(total_surface, 2),
            "porcentaje_ocupacion": round((total_surface / self.report.superficie_total) * 100, 2)
        }
    
    def _calc_estanterias_detalle(self):
        """Calcula métricas detalladas de cada estantería con distancias al cm"""
        from constants import PALLET_SIZES
        
        shelves = [el for el in self.result.elements if el.type == "shelf"]
        
        # Dimensiones de la nave
        nave_largo = self.input.length
        nave_ancho = self.input.width
        
        # Ordenar por posición Z (de norte a sur)
        shelves_sorted = sorted(shelves, key=lambda s: (s.position.y, s.position.x))
        
        # Calcular palets por nivel basado en dimensiones de palet
        pallet_info = PALLET_SIZES.get(self.input.pallet_type or "EUR", PALLET_SIZES["EUR"])
        pallet_length = pallet_info["length"]  # 1.2m para EUR
        
        for i, shelf in enumerate(shelves_sorted):
            dims = shelf.dimensions
            props = shelf.properties
            
            # Obtener dimensiones
            largo = self._get_attr(dims, "length", 0) or 0
            profundidad = self._get_attr(dims, "depth", 1.1) or 1.1
            altura = self._get_attr(dims, "height", 0) or 0
            niveles = self._get_attr(dims, "levels", 1) or 1
            capacidad = self._get_attr(props, "capacity", 0) or 0
            label = self._get_attr(props, "label", "") or ""
            
            # Posiciones
            pos_x = shelf.position.x
            pos_z = shelf.position.y
            extremo_x = pos_x + largo
            extremo_z = pos_z + profundidad
            
            # Tipo y zona
            es_simple = "-S" in label or label == "S"
            tipo = "simple" if es_simple else "back-to-back"
            
            # Detectar zona ABC correctamente
            # Formato con ABC: "A-A1", "A-B1", "B-S", "C-A1"
            # Formato sin ABC: "A1", "B1", "S"
            zona_abc = None
            if label.startswith("A-"):
                zona_abc = "A"
            elif label.startswith("B-"):
                zona_abc = "B"
            elif label.startswith("C-"):
                zona_abc = "C"
            
            # Calcular palets por nivel
            palets_por_nivel = int(largo / pallet_length) if largo > 0 else 0
            palets_totales = palets_por_nivel * niveles
            
            # Si tenemos capacidad del optimizer, usarla
            if capacidad > 0:
                palets_totales = capacidad
                palets_por_nivel = capacidad // niveles if niveles > 0 else 0
            
            # DISTANCIAS A PAREDES (en cm, redondeado a 1 decimal)
            dist_pared_oeste = round(pos_x * 100, 1)  # X=0 es pared oeste
            dist_pared_este = round((nave_largo - extremo_x) * 100, 1)  # X=length es pared este
            dist_pared_norte = round(pos_z * 100, 1)  # Z=0 es pared norte (muelles)
            dist_pared_sur = round((nave_ancho - extremo_z) * 100, 1)  # Z=width es pared sur
            
            # DISTANCIAS A ESTANTERÍAS ADYACENTES
            dist_anterior = None
            dist_siguiente = None
            
            # Buscar estantería anterior (misma fila X, menor Z)
            for j in range(i - 1, -1, -1):
                prev_shelf = shelves_sorted[j]
                prev_z = prev_shelf.position.y
                prev_depth = self._get_attr(prev_shelf.dimensions, "depth", 1.1) or 1.1
                prev_extremo_z = prev_z + prev_depth
                
                # Si está en la misma "columna" aproximadamente
                if abs(prev_shelf.position.x - pos_x) < 1.0:
                    dist_anterior = round((pos_z - prev_extremo_z) * 100, 1)
                    break
            
            # Buscar estantería siguiente (misma fila X, mayor Z)
            for j in range(i + 1, len(shelves_sorted)):
                next_shelf = shelves_sorted[j]
                next_z = next_shelf.position.y
                
                # Si está en la misma "columna" aproximadamente
                if abs(next_shelf.position.x - pos_x) < 1.0:
                    dist_siguiente = round((next_z - extremo_z) * 100, 1)
                    break
            
            detail = ShelfDetailedMetrics(
                id=shelf.id,
                label=label,
                tipo=tipo,
                zona_abc=zona_abc,
                posicion_x=round(pos_x * 100, 1),  # cm
                posicion_z=round(pos_z * 100, 1),  # cm
                largo=round(largo * 100, 1),  # cm
                profundidad=round(profundidad * 100, 1),  # cm
                altura=round(altura * 100, 1),  # cm
                niveles=niveles,
                palets_por_nivel=palets_por_nivel,
                palets_totales=palets_totales,
                distancia_pared_oeste=dist_pared_oeste,
                distancia_pared_este=dist_pared_este,
                distancia_pared_norte=dist_pared_norte,
                distancia_pared_sur=dist_pared_sur,
                distancia_estanteria_anterior=dist_anterior,
                distancia_estanteria_siguiente=dist_siguiente,
                extremo_x=round(extremo_x * 100, 1),
                extremo_z=round(extremo_z * 100, 1)
            )
            self.report.estanterias_detalle.append(detail)
    
    def _calc_zonas_abc(self):
        """Calcula métricas detalladas por zona ABC"""
        if not self.report.estanterias_detalle:
            return
        
        detalles = self.report.estanterias_detalle
        
        # Agrupar estanterías por zona
        zonas = {"A": [], "B": [], "C": []}
        for d in detalles:
            if d.zona_abc in zonas:
                zonas[d.zona_abc].append(d)
        
        nave_ancho = self.input.width
        
        for zona_nombre, estanterias in zonas.items():
            if not estanterias:
                continue
            
            # Contar tipos
            num_dobles = sum(1 for e in estanterias if e.tipo == "back-to-back")
            num_simples = sum(1 for e in estanterias if e.tipo == "simple")
            
            # Palets totales
            palets_totales = sum(e.palets_totales for e in estanterias)
            
            # Palets por nivel
            palets_por_nivel = {}
            for e in estanterias:
                for nivel in range(1, e.niveles + 1):
                    if nivel not in palets_por_nivel:
                        palets_por_nivel[nivel] = 0
                    palets_por_nivel[nivel] += e.palets_por_nivel
            
            # Superficie (convertir de cm² a m²)
            superficie = sum((e.largo * e.profundidad) / 10000 for e in estanterias)
            
            # Posiciones extremas (ya en cm)
            x_min = min(e.posicion_x for e in estanterias)
            x_max = max(e.extremo_x for e in estanterias)
            z_min = min(e.posicion_z for e in estanterias)
            z_max = max(e.extremo_z for e in estanterias)
            
            # Distancias a muelles (pared norte, Z=0) - ya en cm
            distancias_muelles = [e.distancia_pared_norte for e in estanterias]
            dist_min_muelles = min(distancias_muelles)
            dist_max_muelles = max(distancias_muelles)
            dist_media_muelles = sum(distancias_muelles) / len(distancias_muelles)
            
            # Distancias a paredes laterales
            dist_min_oeste = min(e.distancia_pared_oeste for e in estanterias)
            dist_min_este = min(e.distancia_pared_este for e in estanterias)
            dist_min_sur = min(e.distancia_pared_sur for e in estanterias)
            
            # Distancias entre estanterías de la zona (pasillos internos)
            pasillos_zona = []
            for e in estanterias:
                if e.distancia_estanteria_siguiente is not None and e.distancia_estanteria_siguiente > 0:
                    pasillos_zona.append(e.distancia_estanteria_siguiente)
            
            if pasillos_zona:
                ancho_min = min(pasillos_zona)
                ancho_max = max(pasillos_zona)
                ancho_medio = sum(pasillos_zona) / len(pasillos_zona)
            else:
                ancho_min = ancho_max = ancho_medio = 0
            
            # Altura y niveles (asumimos todos iguales en la zona)
            altura = estanterias[0].altura
            niveles = estanterias[0].niveles
            
            # Lista de labels
            labels = [e.label for e in estanterias]
            
            zona_metrics = ZoneDetailedMetrics(
                zona=zona_nombre,
                num_estanterias=len(estanterias),
                num_estanterias_dobles=num_dobles,
                num_estanterias_simples=num_simples,
                palets_totales=palets_totales,
                palets_por_nivel=palets_por_nivel,
                superficie_m2=round(superficie, 2),
                x_min=round(x_min, 1),
                x_max=round(x_max, 1),
                z_min=round(z_min, 1),
                z_max=round(z_max, 1),
                distancia_min_muelles=round(dist_min_muelles, 1),
                distancia_max_muelles=round(dist_max_muelles, 1),
                distancia_media_muelles=round(dist_media_muelles, 1),
                distancia_min_pared_oeste=round(dist_min_oeste, 1),
                distancia_min_pared_este=round(dist_min_este, 1),
                distancia_min_pared_sur=round(dist_min_sur, 1),
                ancho_pasillo_min=round(ancho_min, 1),
                ancho_pasillo_max=round(ancho_max, 1),
                ancho_pasillo_medio=round(ancho_medio, 1),
                altura_estanterias=round(altura, 1),
                niveles=niveles,
                estanterias=labels
            )
            self.report.zonas_abc.append(zona_metrics)
    
    def _calc_resumen_distancias(self):
        """Calcula resumen de todas las distancias en la nave (en cm)"""
        from constants import AISLE_WIDTHS
        
        if not self.report.estanterias_detalle:
            return
        
        detalles = self.report.estanterias_detalle
        
        # Distancias mínimas a paredes
        min_oeste = min(d.distancia_pared_oeste for d in detalles)
        min_este = min(d.distancia_pared_este for d in detalles)
        min_norte = min(d.distancia_pared_norte for d in detalles)
        min_sur = min(d.distancia_pared_sur for d in detalles)
        
        # Anchos de pasillo entre estanterías
        pasillos = []
        for d in detalles:
            if d.distancia_estanteria_siguiente is not None and d.distancia_estanteria_siguiente > 0:
                pasillos.append(d.distancia_estanteria_siguiente)
        
        ancho_pasillo_config = AISLE_WIDTHS.get(self.input.machinery or "retractil", 2.8) * 100
        
        if pasillos:
            ancho_min = min(pasillos)
            ancho_max = max(pasillos)
        else:
            ancho_min = ancho_max = ancho_pasillo_config
        
        # Espacios libres perimetrales (la estantería más cercana a cada pared)
        espacio_oeste = min_oeste
        espacio_este = min_este
        espacio_norte = min_norte
        espacio_sur = min_sur
        
        # Profundidad zona de almacenamiento
        z_min = min(d.posicion_z for d in detalles)
        z_max = max(d.extremo_z for d in detalles)
        profundidad_almacen = z_max - z_min
        
        self.report.resumen_distancias = DistanceSummary(
            min_distancia_pared_oeste=round(min_oeste, 1),
            min_distancia_pared_este=round(min_este, 1),
            min_distancia_pared_norte=round(min_norte, 1),
            min_distancia_pared_sur=round(min_sur, 1),
            ancho_pasillo_operativo=round(ancho_pasillo_config, 1),
            ancho_pasillo_min=round(ancho_min, 1),
            ancho_pasillo_max=round(ancho_max, 1),
            espacio_libre_oeste=round(espacio_oeste, 1),
            espacio_libre_este=round(espacio_este, 1),
            espacio_libre_norte=round(espacio_norte, 1),
            espacio_libre_sur=round(espacio_sur, 1),
            profundidad_zona_almacenamiento=round(profundidad_almacen, 1)
        )
    
    def _calc_resumen_palets(self):
        """Calcula resumen detallado de palets"""
        if not self.report.estanterias_detalle:
            return
        
        detalles = self.report.estanterias_detalle
        
        # Por tipo de estantería
        palets_dobles = sum(d.palets_totales for d in detalles if d.tipo == "back-to-back")
        palets_simples = sum(d.palets_totales for d in detalles if d.tipo == "simple")
        
        # Por zona ABC
        palets_a = sum(d.palets_totales for d in detalles if d.zona_abc == "A")
        palets_b = sum(d.palets_totales for d in detalles if d.zona_abc == "B")
        palets_c = sum(d.palets_totales for d in detalles if d.zona_abc == "C")
        
        # Por nivel
        palets_por_nivel = {}
        for d in detalles:
            for nivel in range(1, d.niveles + 1):
                if nivel not in palets_por_nivel:
                    palets_por_nivel[nivel] = 0
                palets_por_nivel[nivel] += d.palets_por_nivel
        
        # Totales
        total_palets = sum(d.palets_totales for d in detalles)
        total_estanterias = len(detalles)
        media_palets = total_palets / total_estanterias if total_estanterias > 0 else 0
        
        # Eficiencia
        sup_estanterias = self.report.resumen_estanterias.get("superficie_ocupada_estanterias", 0)
        palets_m2_est = total_palets / sup_estanterias if sup_estanterias > 0 else 0
        palets_m3_nave = total_palets / self.report.volumen_total if self.report.volumen_total > 0 else 0
        
        self.report.resumen_palets = PalletSummary(
            palets_en_dobles=palets_dobles,
            palets_en_simples=palets_simples,
            palets_zona_a=palets_a,
            palets_zona_b=palets_b,
            palets_zona_c=palets_c,
            palets_por_nivel=palets_por_nivel,
            total_palets=total_palets,
            total_estanterias=total_estanterias,
            media_palets_por_estanteria=round(media_palets, 2),
            palets_por_m2_estanteria=round(palets_m2_est, 3),
            palets_por_m3_nave=round(palets_m3_nave, 5)
        )
    
    def _calc_pasillos(self):
        """Calcula métricas de pasillos"""
        from constants import AISLE_WIDTHS, DOCK_STANDARDS
        
        machinery = self.input.machinery or "retractil"
        ancho_operativo = AISLE_WIDTHS.get(machinery, 2.8)
        
        # Contar pasillos operativos (entre estanterías)
        shelves = [el for el in self.result.elements if el.type == "shelf"]
        z_positions = sorted(set([s.position.y for s in shelves]))
        
        # Agrupar por filas
        filas = []
        if z_positions:
            current_row = [z_positions[0]]
            for z in z_positions[1:]:
                if z - current_row[-1] < 3:
                    current_row.append(z)
                else:
                    filas.append(current_row)
                    current_row = [z]
            filas.append(current_row)
        
        num_pasillos = max(0, len(filas) - 1)
        longitud_pasillo = self.input.length - 4
        
        # Pasillos perimetrales
        z_min_shelf = min([s.position.y for s in shelves]) if shelves else 0
        z_max_shelf = max([s.position.y for s in shelves]) if shelves else 0
        
        rack_depth = 1.1
        zona_maniobra = DOCK_STANDARDS["maneuver_zone"]
        dock_depth = DOCK_STANDARDS["depth"]
        
        # Calcular x_max considerando largo de estanterías
        if shelves:
            x_max_shelf = max([s.position.x + self._get_attr(s.dimensions, "length", 0) for s in shelves])
            x_min_shelf = min([s.position.x for s in shelves])
        else:
            x_max_shelf = 0
            x_min_shelf = 0
        
        self.report.pasillos = AisleMetrics(
            ancho_pasillo_operativo=ancho_operativo,
            tipo_maquinaria=machinery,
            numero_pasillos_operativos=num_pasillos,
            longitud_total_pasillos=round(num_pasillos * longitud_pasillo, 2),
            ancho_pasillo_norte=round(z_min_shelf - (dock_depth + zona_maniobra), 2),
            ancho_pasillo_sur=round(self.input.width - z_max_shelf - rack_depth, 2),
            ancho_pasillo_este=round(self.input.length - x_max_shelf, 2) if shelves else 0,
            ancho_pasillo_oeste=round(x_min_shelf, 2) if shelves else 0
        )
    
    def _calc_muelles(self):
        """Calcula métricas de muelles"""
        from constants import DOCK_STANDARDS
        
        docks = [el for el in self.result.elements if el.type == "dock"]
        
        if not docks:
            return
        
        dock = docks[0]
        dims = dock.dimensions
        
        ancho = self._get_attr(dims, "width", DOCK_STANDARDS["width"])
        profundidad = self._get_attr(dims, "depth", DOCK_STANDARDS["depth"])
        altura = DOCK_STANDARDS["height"]
        zona_maniobra = self._get_attr(dims, "maneuverZone", DOCK_STANDARDS["maneuver_zone"])
        separacion = DOCK_STANDARDS["separation"]
        
        if len(docks) > 1:
            x_positions = sorted([d.position.x for d in docks])
            separaciones = [x_positions[i+1] - x_positions[i] - ancho for i in range(len(x_positions)-1)]
            separacion_real = sum(separaciones) / len(separaciones) if separaciones else separacion
        else:
            separacion_real = 0
        
        x_min = min([d.position.x for d in docks])
        x_max = max([d.position.x for d in docks]) + ancho
        longitud_fachada = x_max - x_min
        
        self.report.muelles = DockMetrics(
            numero_muelles=len(docks),
            ancho_muelle=ancho,
            profundidad_muelle=profundidad,
            altura_rampa=altura,
            separacion_entre_muelles=round(separacion_real, 2),
            profundidad_zona_maniobra=zona_maniobra,
            superficie_zona_maniobra=round(longitud_fachada * zona_maniobra, 2),
            longitud_fachada_muelles=round(longitud_fachada, 2)
        )
    
    def _calc_oficinas(self):
        """Calcula métricas de oficinas (V5.1)"""
        offices = [el for el in self.result.elements if el.type == "office"]
        
        for office in offices:
            dims = office.dimensions
            props = office.properties
            
            # Dimensiones (pueden venir como largo/ancho o length/width)
            largo = self._get_attr(dims, "largo", 0) or self._get_attr(dims, "length", 0) or 0
            ancho = self._get_attr(dims, "ancho", 0) or self._get_attr(dims, "width", 0) or 0
            altura_oficina = self._get_attr(dims, "height", 3.0) or 3.0
            
            # Nuevo modelo V5.1
            num_floors = self._get_attr(props, "num_floors", 1) or 1
            floor_height = self._get_attr(props, "floor_height", 3.0) or 3.0
            area_per_floor = self._get_attr(props, "area_per_floor", 0) or largo * ancho
            total_area = self._get_attr(props, "total_area", 0) or area_per_floor * num_floors
            
            # Entresuelo
            es_entresuelo = self._get_attr(props, "is_mezzanine", False) or self._get_attr(props, "floor", "") == "mezzanine"
            altura_libre_bajo = self._get_attr(props, "mezzanine_height", 0) or self._get_attr(props, "height_under", 3.5) or 0
            
            if not es_entresuelo:
                altura_libre_bajo = 0
            
            # Altura usada por la oficina
            altura_usada = num_floors * floor_height
            
            # Altura libre sobre oficina
            if es_entresuelo:
                altura_libre_sobre = self.input.height - altura_libre_bajo - altura_usada
            else:
                altura_libre_sobre = self.input.height - altura_usada
            
            office_metrics = OfficeMetrics(
                posicion_x=office.position.x,
                posicion_z=office.position.y,
                largo=largo,
                ancho=ancho,
                superficie=round(area_per_floor, 2),
                altura_oficina=altura_usada,
                es_entresuelo=es_entresuelo,
                altura_desde_suelo=altura_libre_bajo if es_entresuelo else 0,
                altura_libre_bajo_oficina=round(altura_libre_bajo, 2),
                altura_libre_sobre_oficina=round(max(0, altura_libre_sobre), 2),
                num_floors=num_floors,
                floor_height=floor_height,
                area_per_floor=round(area_per_floor, 2),
                total_area=round(total_area, 2)
            )
            self.report.oficinas.append(office_metrics)
    
    def _calc_servicios(self):
        """Calcula métricas de servicios (baños, vestuarios, comedor)"""
        from constants import SERVICE_STANDARDS
        
        services = [el for el in self.result.elements if el.type == "service_room"]
        
        for service in services:
            dims = service.dimensions
            props = service.properties
            
            tipo = self._get_attr(props, "service_type", "servicios") or "servicios"
            largo = self._get_attr(dims, "length", 0) or 0
            ancho = self._get_attr(dims, "width", 0) or 0
            altura = self._get_attr(dims, "height", SERVICE_STANDARDS.get("height", 3.0)) or 3.0
            
            service_metrics = ServiceRoomMetrics(
                id=service.id,
                tipo=tipo,
                posicion_x=service.position.x,
                posicion_z=service.position.y,
                largo=largo,
                ancho=ancho,
                altura=altura,
                superficie=round(largo * ancho, 2)
            )
            self.report.servicios.append(service_metrics)
    
    def _calc_salas_tecnicas(self):
        """Calcula métricas de salas técnicas"""
        from constants import TECHNICAL_ROOMS
        
        tech_rooms = [el for el in self.result.elements if el.type == "technical_room"]
        
        for room in tech_rooms:
            dims = room.dimensions
            props = room.properties
            
            tipo = self._get_attr(props, "room_type", "tecnica") or "tecnica"
            largo = self._get_attr(dims, "length", 0) or 0
            ancho = self._get_attr(dims, "width", 0) or 0
            altura = self._get_attr(dims, "height", 3.0) or 3.0
            
            room_metrics = TechnicalRoomMetrics(
                id=room.id,
                tipo=tipo,
                posicion_x=room.position.x,
                posicion_z=room.position.y,
                largo=largo,
                ancho=ancho,
                altura=altura,
                superficie=round(largo * ancho, 2)
            )
            self.report.salas_tecnicas.append(room_metrics)
    
    def _calc_zonas_operativas(self):
        """Calcula métricas de zonas operativas"""
        zones = [el for el in self.result.elements if el.type == "operational_zone"]
        
        for zone in zones:
            dims = zone.dimensions
            props = zone.properties
            
            tipo = self._get_attr(props, "zone_type", "operativa") or "operativa"
            largo = self._get_attr(dims, "length", 0) or 0
            ancho = self._get_attr(dims, "width", 0) or 0
            
            zone_metrics = OperationalZoneMetrics(
                id=zone.id,
                tipo=tipo,
                posicion_x=zone.position.x,
                posicion_z=zone.position.y,
                largo=largo,
                ancho=ancho,
                superficie=round(largo * ancho, 2)
            )
            self.report.zonas_operativas.append(zone_metrics)
    
    def _calc_resumen_superficies(self):
        """Calcula resumen de superficies"""
        superficie_total = self.report.superficie_total
        
        # Superficie estanterías
        sup_estanterias = self.report.resumen_estanterias.get("superficie_ocupada_estanterias", 0)
        
        # Superficie pasillos operativos (aproximación)
        if self.report.pasillos:
            sup_pasillos_op = self.report.pasillos.numero_pasillos_operativos * \
                             self.report.pasillos.ancho_pasillo_operativo * \
                             (self.input.length - 4)
        else:
            sup_pasillos_op = 0
        
        # Superficie pasillos perimetrales
        if self.report.pasillos:
            p = self.report.pasillos
            sup_perimetral_ns = (p.ancho_pasillo_norte + p.ancho_pasillo_sur) * self.input.length
            sup_perimetral_eo = (p.ancho_pasillo_este + p.ancho_pasillo_oeste) * self.input.width
            sup_pasillos_perim = sup_perimetral_ns + sup_perimetral_eo
        else:
            sup_pasillos_perim = 0
        
        # Superficie muelles + maniobra
        if self.report.muelles:
            sup_muelles = self.report.muelles.numero_muelles * \
                         self.report.muelles.ancho_muelle * \
                         self.report.muelles.profundidad_muelle
            sup_muelles += self.report.muelles.superficie_zona_maniobra
        else:
            sup_muelles = 0
        
        # Superficie oficinas
        sup_oficinas = sum([o.superficie for o in self.report.oficinas])
        
        # Superficie servicios
        sup_servicios = sum([s.superficie for s in self.report.servicios])
        
        # Superficie salas técnicas
        sup_tecnicas = sum([t.superficie for t in self.report.salas_tecnicas])
        
        # Superficie zonas operativas
        sup_operativas = sum([z.superficie for z in self.report.zonas_operativas])
        
        self.report.resumen_superficies = SurfaceSummary(
            superficie_estanterias=round(sup_estanterias, 2),
            superficie_pasillos_operativos=round(sup_pasillos_op, 2),
            superficie_pasillos_perimetrales=round(sup_pasillos_perim, 2),
            superficie_muelles_maniobra=round(sup_muelles, 2),
            superficie_oficinas=round(sup_oficinas, 2),
            superficie_servicios=round(sup_servicios, 2),
            superficie_salas_tecnicas=round(sup_tecnicas, 2),
            superficie_zonas_operativas=round(sup_operativas, 2),
            superficie_total=superficie_total,
            pct_estanterias=round((sup_estanterias / superficie_total) * 100, 2) if superficie_total else 0,
            pct_pasillos_operativos=round((sup_pasillos_op / superficie_total) * 100, 2) if superficie_total else 0,
            pct_pasillos_perimetrales=round((sup_pasillos_perim / superficie_total) * 100, 2) if superficie_total else 0,
            pct_muelles=round((sup_muelles / superficie_total) * 100, 2) if superficie_total else 0,
            pct_oficinas=round((sup_oficinas / superficie_total) * 100, 2) if superficie_total else 0,
            pct_servicios=round((sup_servicios / superficie_total) * 100, 2) if superficie_total else 0,
            pct_salas_tecnicas=round((sup_tecnicas / superficie_total) * 100, 2) if superficie_total else 0,
            pct_zonas_operativas=round((sup_operativas / superficie_total) * 100, 2) if superficie_total else 0
        )
    
    def _calc_indicadores_eficiencia(self):
        """Calcula indicadores de eficiencia"""
        from constants import DOCK_STANDARDS
        
        superficie_total = self.report.superficie_total
        capacidad_total = self.report.resumen_estanterias.get("capacidad_total_palets", 0)
        sup_estanterias = self.report.resumen_estanterias.get("superficie_ocupada_estanterias", 0)
        
        eficiencia = self.result.capacity.efficiency_percentage if self.result.capacity else 0
        
        palets_m2_nave = capacidad_total / superficie_total if superficie_total else 0
        palets_m2_almacen = capacidad_total / sup_estanterias if sup_estanterias else 0
        
        if self.report.resumen_superficies:
            sup_pasillos = self.report.resumen_superficies.superficie_pasillos_operativos + \
                          self.report.resumen_superficies.superficie_pasillos_perimetrales
            ratio_circulacion = (sup_pasillos / sup_estanterias * 100) if sup_estanterias else 0
        else:
            ratio_circulacion = 0
        
        docks = [el for el in self.result.elements if el.type == "dock"]
        shelves = [el for el in self.result.elements if el.type == "shelf"]
        
        if docks and shelves:
            dock_center_z = DOCK_STANDARDS["depth"] / 2
            
            distancias = []
            for shelf in shelves:
                shelf_depth = self._get_attr(shelf.dimensions, "depth", 1.1)
                shelf_center_z = shelf.position.y + (shelf_depth / 2)
                distancia = abs(shelf_center_z - dock_center_z)
                distancias.append(distancia)
            
            dist_max = max(distancias)
            dist_min = min(distancias)
            dist_media = sum(distancias) / len(distancias)
        else:
            dist_max = dist_min = dist_media = 0
        
        self.report.indicadores_eficiencia = EfficiencyIndicators(
            eficiencia_almacenamiento=round(eficiencia, 2),
            palets_por_m2_nave=round(palets_m2_nave, 3),
            palets_por_m2_almacenamiento=round(palets_m2_almacen, 3),
            ratio_circulacion=round(ratio_circulacion, 2),
            distancia_max_muelle_estanteria=round(dist_max, 2),
            distancia_min_muelle_estanteria=round(dist_min, 2),
            distancia_media_muelle_estanteria=round(dist_media, 2)
        )
    
    def _calc_seguridad(self):
        """Calcula métricas de seguridad y normativa"""
        from constants import SAFETY_STANDARDS
        
        # Ancho mínimo evacuación
        ancho_min = SAFETY_STANDARDS.get("min_aisle_width", 1.2)
        
        # Distancia máxima a salida (diagonal de la nave)
        dist_max_salida = ((self.input.length ** 2) + (self.input.width ** 2)) ** 0.5
        
        # Número de salidas (mínimo según superficie)
        superficie = self.report.superficie_total
        if superficie > 2500:
            num_salidas = 4
        elif superficie > 1000:
            num_salidas = 3
        elif superficie > 500:
            num_salidas = 2
        else:
            num_salidas = 1
        
        # Verificar CTE
        observaciones = []
        cumple_cte = True
        
        # Verificar pasillo mínimo
        if self.report.pasillos and self.report.pasillos.ancho_pasillo_operativo < ancho_min:
            observaciones.append(f"Pasillo operativo ({self.report.pasillos.ancho_pasillo_operativo}m) menor que mínimo requerido ({ancho_min}m)")
            cumple_cte = False
        
        # Verificar distancia máxima evacuación (50m según CTE)
        max_evacuacion = SAFETY_STANDARDS.get("max_evacuation_distance", 50)
        if dist_max_salida / 2 > max_evacuacion:  # Dividido por 2 porque hay salidas en ambos extremos
            observaciones.append(f"Distancia máxima a salida ({dist_max_salida/2:.1f}m) excede límite CTE ({max_evacuacion}m)")
            cumple_cte = False
        
        if not observaciones:
            observaciones.append("Diseño cumple con normativa CTE básica")
        
        self.report.seguridad = SafetyMetrics(
            ancho_minimo_evacuacion=ancho_min,
            distancia_maxima_salida=round(dist_max_salida / 2, 2),
            numero_salidas_emergencia=num_salidas,
            cumple_cte=cumple_cte,
            observaciones=observaciones
        )
    
    def _set_configuracion(self):
        """Establece la configuración utilizada"""
        from constants import AISLE_WIDTHS, PALLET_TYPES
        
        pallet_type = self.input.pallet_type or "EUR"
        pallet_info = PALLET_TYPES.get(pallet_type, PALLET_TYPES["EUR"])
        machinery = self.input.machinery or "retractil"
        
        self.report.configuracion = ConfigurationUsed(
            tipo_palet=pallet_type,
            palet_largo=pallet_info["length"],
            palet_ancho=pallet_info["width"],
            palet_alto=self.input.pallet_height or 1.5,
            tipo_maquinaria=machinery,
            ancho_pasillo_requerido=AISLE_WIDTHS.get(machinery, 2.8),
            tipo_estanteria="convencional",
            abc_zoning_activo=self.prefs.enable_abc_zones if self.prefs else False,
            tipo_almacen=self.prefs.warehouse_type if self.prefs else "industrial"
        )
    
    def to_dict(self) -> Dict:
        """Convierte el informe a diccionario"""
        import dataclasses
        
        def convert(obj):
            if dataclasses.is_dataclass(obj):
                return {k: convert(v) for k, v in dataclasses.asdict(obj).items()}
            elif isinstance(obj, list):
                return [convert(item) for item in obj]
            elif isinstance(obj, dict):
                return {k: convert(v) for k, v in obj.items()}
            else:
                return obj
        
        return convert(self.report)
    
    def to_json(self, indent=2) -> str:
        """Convierte el informe a JSON"""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)
    
    def print_summary(self):
        """Imprime un resumen del informe"""
        r = self.report
        
        print("=" * 70)
        print("📋 INFORME UNITNAVE DESIGNER")
        print("=" * 70)
        print(f"Fecha: {r.fecha_generacion}")
        print()
        
        print("📐 DIMENSIONES GENERALES")
        print("-" * 40)
        print(f"  Largo total:      {r.largo_total} m")
        print(f"  Ancho total:      {r.ancho_total} m")
        print(f"  Altura libre:     {r.altura_libre} m")
        print(f"  Superficie total: {r.superficie_total} m²")
        print(f"  Volumen total:    {r.volumen_total} m³")
        print()
        
        print("🏗️ ESTANTERÍAS")
        print("-" * 40)
        res = r.resumen_estanterias
        print(f"  Estanterías dobles (back-to-back): {res.get('numero_estanterias_dobles', 0)}")
        print(f"  Estanterías simples:               {res.get('numero_estanterias_simples', 0)}")
        print(f"  Total estanterías:                 {res.get('numero_total_estanterias', 0)}")
        print(f"  Capacidad total:                   {res.get('capacidad_total_palets', 0)} palets")
        print(f"  Superficie ocupada:                {res.get('superficie_ocupada_estanterias', 0)} m²")
        print()
        
        # DETALLE DE CADA ESTANTERÍA
        if r.estanterias_detalle:
            print("📏 DETALLE DE ESTANTERÍAS (medidas en cm)")
            print("-" * 70)
            print(f"  {'ID':<6} {'Tipo':<12} {'Pos X':>8} {'Pos Z':>8} {'Largo':>8} {'Prof':>6} {'Alt':>6} {'Niv':>4} {'Palets':>7}")
            print(f"  {'-'*70}")
            for d in r.estanterias_detalle:
                tipo_short = "BB" if d.tipo == "back-to-back" else "Simple"
                print(f"  {d.label:<6} {tipo_short:<12} {d.posicion_x:>8.1f} {d.posicion_z:>8.1f} {d.largo:>8.1f} {d.profundidad:>6.1f} {d.altura:>6.1f} {d.niveles:>4} {d.palets_totales:>7}")
            print()
            
            print("📐 DISTANCIAS A PAREDES (cm)")
            print("-" * 70)
            print(f"  {'ID':<6} {'D.Oeste':>10} {'D.Este':>10} {'D.Norte':>10} {'D.Sur':>10} {'D.Ant':>10} {'D.Sig':>10}")
            print(f"  {'-'*70}")
            for d in r.estanterias_detalle:
                d_ant = f"{d.distancia_estanteria_anterior:.1f}" if d.distancia_estanteria_anterior else "-"
                d_sig = f"{d.distancia_estanteria_siguiente:.1f}" if d.distancia_estanteria_siguiente else "-"
                print(f"  {d.label:<6} {d.distancia_pared_oeste:>10.1f} {d.distancia_pared_este:>10.1f} {d.distancia_pared_norte:>10.1f} {d.distancia_pared_sur:>10.1f} {d_ant:>10} {d_sig:>10}")
            print()
        
        # RESUMEN DE DISTANCIAS
        if r.resumen_distancias:
            print("📊 RESUMEN DE DISTANCIAS (cm)")
            print("-" * 40)
            rd = r.resumen_distancias
            print(f"  Distancia mín. a pared Oeste:  {rd.min_distancia_pared_oeste:.1f} cm")
            print(f"  Distancia mín. a pared Este:   {rd.min_distancia_pared_este:.1f} cm")
            print(f"  Distancia mín. a pared Norte:  {rd.min_distancia_pared_norte:.1f} cm")
            print(f"  Distancia mín. a pared Sur:    {rd.min_distancia_pared_sur:.1f} cm")
            print()
            print(f"  Ancho pasillo configurado:     {rd.ancho_pasillo_operativo:.1f} cm")
            print(f"  Ancho pasillo mínimo real:     {rd.ancho_pasillo_min:.1f} cm")
            print(f"  Ancho pasillo máximo real:     {rd.ancho_pasillo_max:.1f} cm")
            print()
            print(f"  Espacio libre Oeste:           {rd.espacio_libre_oeste:.1f} cm")
            print(f"  Espacio libre Este:            {rd.espacio_libre_este:.1f} cm")
            print(f"  Espacio libre Norte:           {rd.espacio_libre_norte:.1f} cm")
            print(f"  Espacio libre Sur:             {rd.espacio_libre_sur:.1f} cm")
            print()
            print(f"  Prof. zona almacenamiento:     {rd.profundidad_zona_almacenamiento:.1f} cm")
            print()
        
        # RESUMEN DE PALETS
        if r.resumen_palets:
            print("📦 RESUMEN DE PALETS")
            print("-" * 40)
            rp = r.resumen_palets
            print(f"  Palets en estanterías dobles:  {rp.palets_en_dobles}")
            print(f"  Palets en estanterías simples: {rp.palets_en_simples}")
            print(f"  TOTAL PALETS:                  {rp.total_palets}")
            print()
            if rp.palets_zona_a > 0 or rp.palets_zona_b > 0 or rp.palets_zona_c > 0:
                print(f"  Palets en Zona A:              {rp.palets_zona_a}")
                print(f"  Palets en Zona B:              {rp.palets_zona_b}")
                print(f"  Palets en Zona C:              {rp.palets_zona_c}")
                print()
            print(f"  Palets por nivel:")
            for nivel, cantidad in sorted(rp.palets_por_nivel.items()):
                print(f"    Nivel {nivel}: {cantidad} palets")
            print()
            print(f"  Media palets/estantería:       {rp.media_palets_por_estanteria:.2f}")
            print(f"  Palets por m² estantería:      {rp.palets_por_m2_estanteria:.3f}")
            print(f"  Palets por m³ nave:            {rp.palets_por_m3_nave:.5f}")
            print()
        
        # ZONAS ABC DETALLADAS
        if r.zonas_abc:
            print("🔤 DETALLE POR ZONA ABC (medidas en cm)")
            print("=" * 70)
            
            for z in r.zonas_abc:
                print(f"\n  ══════ ZONA {z.zona} ══════")
                print(f"  Estanterías: {z.num_estanterias} ({z.num_estanterias_dobles} dobles, {z.num_estanterias_simples} simples)")
                print(f"  Lista: {', '.join(z.estanterias)}")
                print()
                print(f"  📦 PALETS:")
                print(f"     Total palets:              {z.palets_totales}")
                print(f"     Por nivel:")
                for nivel, cantidad in sorted(z.palets_por_nivel.items()):
                    print(f"       Nivel {nivel}: {cantidad} palets")
                print()
                print(f"  📐 DIMENSIONES:")
                print(f"     Superficie:                {z.superficie_m2} m²")
                print(f"     Altura estanterías:        {z.altura_estanterias} cm")
                print(f"     Niveles:                   {z.niveles}")
                print()
                print(f"  📍 POSICIÓN (cm):")
                print(f"     X: {z.x_min:.1f} - {z.x_max:.1f}")
                print(f"     Z: {z.z_min:.1f} - {z.z_max:.1f}")
                print()
                print(f"  📏 DISTANCIAS A MUELLES/PARED NORTE (cm):")
                print(f"     Mínima:                    {z.distancia_min_muelles:.1f}")
                print(f"     Máxima:                    {z.distancia_max_muelles:.1f}")
                print(f"     Media:                     {z.distancia_media_muelles:.1f}")
                print()
                print(f"  📏 DISTANCIAS A PAREDES LATERALES (cm):")
                print(f"     Mín. a pared Oeste:        {z.distancia_min_pared_oeste:.1f}")
                print(f"     Mín. a pared Este:         {z.distancia_min_pared_este:.1f}")
                print(f"     Mín. a pared Sur:          {z.distancia_min_pared_sur:.1f}")
                print()
                print(f"  📏 PASILLOS INTERNOS DE LA ZONA (cm):")
                if z.ancho_pasillo_min > 0:
                    print(f"     Ancho mínimo:              {z.ancho_pasillo_min:.1f}")
                    print(f"     Ancho máximo:              {z.ancho_pasillo_max:.1f}")
                    print(f"     Ancho medio:               {z.ancho_pasillo_medio:.1f}")
                else:
                    print(f"     (Sin pasillos internos)")
            
            print()
            print("=" * 70)
            print()
        
        if r.pasillos:
            print("🚗 PASILLOS")
            print("-" * 40)
            p = r.pasillos
            print(f"  Tipo maquinaria:         {p.tipo_maquinaria}")
            print(f"  Ancho pasillo operativo: {p.ancho_pasillo_operativo} m")
            print(f"  Número pasillos:         {p.numero_pasillos_operativos}")
            print(f"  Longitud total pasillos: {p.longitud_total_pasillos} m")
            print(f"  Pasillo norte:           {p.ancho_pasillo_norte} m")
            print(f"  Pasillo sur:             {p.ancho_pasillo_sur} m")
            print(f"  Pasillo este:            {p.ancho_pasillo_este} m")
            print(f"  Pasillo oeste:           {p.ancho_pasillo_oeste} m")
            print()
        
        if r.muelles:
            print("🚛 MUELLES DE CARGA")
            print("-" * 40)
            m = r.muelles
            print(f"  Número de muelles:         {m.numero_muelles}")
            print(f"  Ancho muelle:              {m.ancho_muelle} m")
            print(f"  Profundidad muelle:        {m.profundidad_muelle} m")
            print(f"  Altura rampa:              {m.altura_rampa} m")
            print(f"  Separación entre muelles:  {m.separacion_entre_muelles} m")
            print(f"  Prof. zona maniobra:       {m.profundidad_zona_maniobra} m")
            print(f"  Sup. zona maniobra:        {m.superficie_zona_maniobra} m²")
            print()
        
        if r.oficinas:
            print("🏢 OFICINAS")
            print("-" * 40)
            for o in r.oficinas:
                print(f"  Posición:                  ({o.posicion_x}, {o.posicion_z}) m")
                print(f"  Dimensiones:               {o.largo} x {o.ancho} m")
                print(f"  Superficie:                {o.superficie} m²")
                print(f"  Altura oficina:            {o.altura_oficina} m")
                print(f"  Es entresuelo:             {'Sí' if o.es_entresuelo else 'No'}")
                if o.es_entresuelo:
                    print(f"  Altura libre bajo oficina: {o.altura_libre_bajo_oficina} m")
                    print(f"  Altura libre sobre oficina:{o.altura_libre_sobre_oficina} m")
            print()
        
        if r.servicios:
            print("🚿 SERVICIOS")
            print("-" * 40)
            for s in r.servicios:
                print(f"  {s.tipo}:")
                print(f"    Posición:    ({s.posicion_x}, {s.posicion_z}) m")
                print(f"    Dimensiones: {s.largo} x {s.ancho} x {s.altura} m")
                print(f"    Superficie:  {s.superficie} m²")
            print()
        
        if r.salas_tecnicas:
            print("⚡ SALAS TÉCNICAS")
            print("-" * 40)
            for t in r.salas_tecnicas:
                print(f"  {t.tipo}:")
                print(f"    Posición:    ({t.posicion_x}, {t.posicion_z}) m")
                print(f"    Dimensiones: {t.largo} x {t.ancho} x {t.altura} m")
                print(f"    Superficie:  {t.superficie} m²")
            print()
        
        if r.resumen_superficies:
            print("📊 RESUMEN DE SUPERFICIES")
            print("-" * 40)
            s = r.resumen_superficies
            print(f"  {'Concepto':<30} {'m²':>10} {'%':>8}")
            print(f"  {'-'*50}")
            print(f"  {'Estanterías':<30} {s.superficie_estanterias:>10.1f} {s.pct_estanterias:>7.1f}%")
            print(f"  {'Pasillos operativos':<30} {s.superficie_pasillos_operativos:>10.1f} {s.pct_pasillos_operativos:>7.1f}%")
            print(f"  {'Pasillos perimetrales':<30} {s.superficie_pasillos_perimetrales:>10.1f} {s.pct_pasillos_perimetrales:>7.1f}%")
            print(f"  {'Muelles + maniobra':<30} {s.superficie_muelles_maniobra:>10.1f} {s.pct_muelles:>7.1f}%")
            print(f"  {'Oficinas':<30} {s.superficie_oficinas:>10.1f} {s.pct_oficinas:>7.1f}%")
            print(f"  {'Servicios':<30} {s.superficie_servicios:>10.1f} {s.pct_servicios:>7.1f}%")
            print(f"  {'Salas técnicas':<30} {s.superficie_salas_tecnicas:>10.1f} {s.pct_salas_tecnicas:>7.1f}%")
            print(f"  {'Zonas operativas':<30} {s.superficie_zonas_operativas:>10.1f} {s.pct_zonas_operativas:>7.1f}%")
            print(f"  {'-'*50}")
            print(f"  {'TOTAL NAVE':<30} {s.superficie_total:>10.1f} {'100.0':>7}%")
            print()
        
        if r.indicadores_eficiencia:
            print("🎯 INDICADORES DE EFICIENCIA")
            print("-" * 40)
            e = r.indicadores_eficiencia
            print(f"  Eficiencia almacenamiento:     {e.eficiencia_almacenamiento}%")
            print(f"  Palets por m² de nave:         {e.palets_por_m2_nave}")
            print(f"  Palets por m² almacenamiento:  {e.palets_por_m2_almacenamiento}")
            print(f"  Ratio circulación:             {e.ratio_circulacion}%")
            print(f"  Dist. mín muelle-estantería:   {e.distancia_min_muelle_estanteria} m")
            print(f"  Dist. máx muelle-estantería:   {e.distancia_max_muelle_estanteria} m")
            print(f"  Dist. media muelle-estantería: {e.distancia_media_muelle_estanteria} m")
            print()
        
        if r.seguridad:
            print("🔒 SEGURIDAD Y NORMATIVA")
            print("-" * 40)
            seg = r.seguridad
            print(f"  Ancho mín. evacuación:         {seg.ancho_minimo_evacuacion} m")
            print(f"  Dist. máx. a salida:           {seg.distancia_maxima_salida} m")
            print(f"  Salidas de emergencia:         {seg.numero_salidas_emergencia}")
            print(f"  Cumple CTE:                    {'✅ Sí' if seg.cumple_cte else '❌ No'}")
            for obs in seg.observaciones:
                print(f"    → {obs}")
            print()
        
        if r.configuracion:
            print("⚙️ CONFIGURACIÓN UTILIZADA")
            print("-" * 40)
            c = r.configuracion
            print(f"  Tipo palet:           {c.tipo_palet} ({c.palet_largo}x{c.palet_ancho}x{c.palet_alto} m)")
            print(f"  Maquinaria:           {c.tipo_maquinaria}")
            print(f"  Ancho pasillo:        {c.ancho_pasillo_requerido} m")
            print(f"  Tipo estantería:      {c.tipo_estanteria}")
            print(f"  ABC Zoning:           {'Activo' if c.abc_zoning_activo else 'Desactivado'}")
            print(f"  Tipo almacén:         {c.tipo_almacen}")
        
        print()
        print("=" * 70)


def generate_report(optimization_result, warehouse_input, preferences) -> WarehouseReport:
    """Función helper para generar informe"""
    generator = ReportGenerator(optimization_result, warehouse_input, preferences)
    return generator.generate()


def generate_pdf_report(optimization_result, warehouse_input, preferences, output_path: str = "informe_nave.pdf"):
    """Genera informe en formato PDF"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    
    # Generar datos del informe
    generator = ReportGenerator(optimization_result, warehouse_input, preferences)
    report = generator.generate()
    r = report
    
    # Crear documento PDF
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Estilos
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1a365d')
    )
    
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#2c5282'),
        borderPadding=5
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )
    
    # Contenido
    story = []
    
    # === TÍTULO ===
    story.append(Paragraph("📋 INFORME UNITNAVE DESIGNER", title_style))
    story.append(Paragraph(f"Fecha: {r.fecha_generacion[:10]}", normal_style))
    story.append(Spacer(1, 20))
    
    # === DIMENSIONES GENERALES ===
    story.append(Paragraph("📐 DIMENSIONES GENERALES", section_style))
    
    dim_data = [
        ["Concepto", "Valor"],
        ["Largo total", f"{r.largo_total} m"],
        ["Ancho total", f"{r.ancho_total} m"],
        ["Altura libre bajo cercha", f"{r.altura_libre} m"],
        ["Superficie total", f"{r.superficie_total:,.0f} m²"],
        ["Volumen total", f"{r.volumen_total:,.0f} m³"],
    ]
    
    dim_table = Table(dim_data, colWidths=[8*cm, 6*cm])
    dim_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f7fafc')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
    ]))
    story.append(dim_table)
    story.append(Spacer(1, 15))
    
    # === ESTANTERÍAS ===
    story.append(Paragraph("🏗️ ESTANTERÍAS", section_style))
    
    res = r.resumen_estanterias
    shelf_data = [
        ["Concepto", "Valor"],
        ["Estanterías dobles (back-to-back)", str(res.get('numero_estanterias_dobles', 0))],
        ["Estanterías simples", str(res.get('numero_estanterias_simples', 0))],
        ["Total estanterías", str(res.get('numero_total_estanterias', 0))],
        ["Capacidad total", f"{res.get('capacidad_total_palets', 0):,} palets"],
        ["Superficie ocupada", f"{res.get('superficie_ocupada_estanterias', 0):,.1f} m²"],
        ["Porcentaje ocupación", f"{res.get('porcentaje_ocupacion', 0):.1f}%"],
    ]
    
    shelf_table = Table(shelf_data, colWidths=[8*cm, 6*cm])
    shelf_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
    ]))
    story.append(shelf_table)
    story.append(Spacer(1, 15))
    
    # === DETALLE DE ESTANTERÍAS ===
    if r.estanterias_detalle:
        story.append(Paragraph("📏 DETALLE DE ESTANTERÍAS (medidas en cm)", section_style))
        
        detail_data = [["ID", "Tipo", "Pos X", "Pos Z", "Largo", "Prof", "Alt", "Niv", "Palets"]]
        for d in r.estanterias_detalle:
            tipo_short = "BB" if d.tipo == "back-to-back" else "Simple"
            detail_data.append([
                d.label,
                tipo_short,
                f"{d.posicion_x:.0f}",
                f"{d.posicion_z:.0f}",
                f"{d.largo:.0f}",
                f"{d.profundidad:.0f}",
                f"{d.altura:.0f}",
                str(d.niveles),
                str(d.palets_totales)
            ])
        
        detail_table = Table(detail_data, colWidths=[1.2*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.2*cm, 1.2*cm, 1*cm, 1.2*cm])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(detail_table)
        story.append(Spacer(1, 15))
        
        # Distancias a paredes
        story.append(Paragraph("📐 DISTANCIAS A PAREDES (cm)", section_style))
        
        dist_data = [["ID", "D.Oeste", "D.Este", "D.Norte", "D.Sur", "D.Ant", "D.Sig"]]
        for d in r.estanterias_detalle:
            d_ant = f"{d.distancia_estanteria_anterior:.0f}" if d.distancia_estanteria_anterior else "-"
            d_sig = f"{d.distancia_estanteria_siguiente:.0f}" if d.distancia_estanteria_siguiente else "-"
            dist_data.append([
                d.label,
                f"{d.distancia_pared_oeste:.0f}",
                f"{d.distancia_pared_este:.0f}",
                f"{d.distancia_pared_norte:.0f}",
                f"{d.distancia_pared_sur:.0f}",
                d_ant,
                d_sig
            ])
        
        dist_table = Table(dist_data, colWidths=[1.5*cm, 2*cm, 2*cm, 2*cm, 2*cm, 2*cm, 2*cm])
        dist_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(dist_table)
        story.append(Spacer(1, 15))
    
    # === RESUMEN DE DISTANCIAS ===
    if r.resumen_distancias:
        story.append(Paragraph("📊 RESUMEN DE DISTANCIAS (cm)", section_style))
        rd = r.resumen_distancias
        
        rdist_data = [
            ["Concepto", "Valor"],
            ["Distancia mín. a pared Oeste", f"{rd.min_distancia_pared_oeste:.1f} cm"],
            ["Distancia mín. a pared Este", f"{rd.min_distancia_pared_este:.1f} cm"],
            ["Distancia mín. a pared Norte", f"{rd.min_distancia_pared_norte:.1f} cm"],
            ["Distancia mín. a pared Sur", f"{rd.min_distancia_pared_sur:.1f} cm"],
            ["Ancho pasillo configurado", f"{rd.ancho_pasillo_operativo:.1f} cm"],
            ["Ancho pasillo mínimo real", f"{rd.ancho_pasillo_min:.1f} cm"],
            ["Ancho pasillo máximo real", f"{rd.ancho_pasillo_max:.1f} cm"],
            ["Espacio libre Oeste", f"{rd.espacio_libre_oeste:.1f} cm"],
            ["Espacio libre Este", f"{rd.espacio_libre_este:.1f} cm"],
            ["Espacio libre Norte", f"{rd.espacio_libre_norte:.1f} cm"],
            ["Espacio libre Sur", f"{rd.espacio_libre_sur:.1f} cm"],
            ["Profundidad zona almacenamiento", f"{rd.profundidad_zona_almacenamiento:.1f} cm"],
        ]
        
        rdist_table = Table(rdist_data, colWidths=[8*cm, 6*cm])
        rdist_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(rdist_table)
        story.append(Spacer(1, 15))
    
    # === RESUMEN DE PALETS ===
    if r.resumen_palets:
        story.append(Paragraph("📦 RESUMEN DE PALETS", section_style))
        rp = r.resumen_palets
        
        pallet_data = [
            ["Concepto", "Cantidad"],
            ["Palets en estanterías dobles", str(rp.palets_en_dobles)],
            ["Palets en estanterías simples", str(rp.palets_en_simples)],
            ["TOTAL PALETS", str(rp.total_palets)],
        ]
        
        if rp.palets_zona_a > 0 or rp.palets_zona_b > 0 or rp.palets_zona_c > 0:
            pallet_data.extend([
                ["Palets en Zona A", str(rp.palets_zona_a)],
                ["Palets en Zona B", str(rp.palets_zona_b)],
                ["Palets en Zona C", str(rp.palets_zona_c)],
            ])
        
        pallet_data.extend([
            ["Media palets/estantería", f"{rp.media_palets_por_estanteria:.2f}"],
            ["Palets por m² estantería", f"{rp.palets_por_m2_estanteria:.3f}"],
            ["Palets por m³ nave", f"{rp.palets_por_m3_nave:.5f}"],
        ])
        
        pallet_table = Table(pallet_data, colWidths=[8*cm, 6*cm])
        pallet_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),  # TOTAL row
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#e2e8f0')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, 2), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(pallet_table)
        story.append(Spacer(1, 10))
        
        # Palets por nivel
        story.append(Paragraph("Palets por nivel:", normal_style))
        nivel_data = [["Nivel", "Palets"]]
        for nivel, cantidad in sorted(rp.palets_por_nivel.items()):
            nivel_data.append([f"Nivel {nivel}", str(cantidad)])
        
        nivel_table = Table(nivel_data, colWidths=[4*cm, 4*cm])
        nivel_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a5568')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(nivel_table)
        story.append(Spacer(1, 15))
    
    # === ZONAS ABC DETALLADAS ===
    if r.zonas_abc:
        story.append(Paragraph("🔤 DETALLE POR ZONA ABC", section_style))
        
        for z in r.zonas_abc:
            # Título de la zona con color según zona
            zona_colors = {"A": "#e53e3e", "B": "#3182ce", "C": "#38a169"}
            zona_color = zona_colors.get(z.zona, "#4a5568")
            
            zona_title_style = ParagraphStyle(
                f'ZonaTitle{z.zona}',
                parent=styles['Heading3'],
                fontSize=12,
                spaceBefore=15,
                spaceAfter=8,
                textColor=colors.HexColor(zona_color),
            )
            story.append(Paragraph(f"ZONA {z.zona}", zona_title_style))
            
            # Tabla de resumen de la zona
            zona_data = [
                ["Concepto", "Valor"],
                ["Estanterías", f"{z.num_estanterias} ({z.num_estanterias_dobles} dobles, {z.num_estanterias_simples} simples)"],
                ["Total palets", str(z.palets_totales)],
                ["Superficie", f"{z.superficie_m2} m²"],
                ["Altura estanterías", f"{z.altura_estanterias} cm"],
                ["Niveles", str(z.niveles)],
                ["Dist. mín. a muelles", f"{z.distancia_min_muelles:.1f} cm"],
                ["Dist. máx. a muelles", f"{z.distancia_max_muelles:.1f} cm"],
                ["Dist. media a muelles", f"{z.distancia_media_muelles:.1f} cm"],
                ["Dist. mín. pared Oeste", f"{z.distancia_min_pared_oeste:.1f} cm"],
                ["Dist. mín. pared Este", f"{z.distancia_min_pared_este:.1f} cm"],
                ["Dist. mín. pared Sur", f"{z.distancia_min_pared_sur:.1f} cm"],
            ]
            
            if z.ancho_pasillo_min > 0:
                zona_data.extend([
                    ["Pasillo interno mín.", f"{z.ancho_pasillo_min:.1f} cm"],
                    ["Pasillo interno máx.", f"{z.ancho_pasillo_max:.1f} cm"],
                ])
            
            zona_table = Table(zona_data, colWidths=[6*cm, 5*cm])
            zona_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(zona_color)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
            ]))
            story.append(zona_table)
            
            # Palets por nivel de la zona
            story.append(Paragraph(f"Palets por nivel (Zona {z.zona}):", normal_style))
            nivel_zona_data = [["Nivel", "Palets"]]
            for nivel, cantidad in sorted(z.palets_por_nivel.items()):
                nivel_zona_data.append([f"Nivel {nivel}", str(cantidad)])
            
            nivel_zona_table = Table(nivel_zona_data, colWidths=[3*cm, 3*cm])
            nivel_zona_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a5568')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
            ]))
            story.append(nivel_zona_table)
            story.append(Spacer(1, 10))
        
        story.append(Spacer(1, 15))
    
    # === PASILLOS ===
    if r.pasillos:
        story.append(Paragraph("🚗 PASILLOS", section_style))
        p = r.pasillos
        
        aisle_data = [
            ["Concepto", "Valor"],
            ["Tipo maquinaria", p.tipo_maquinaria],
            ["Ancho pasillo operativo", f"{p.ancho_pasillo_operativo} m"],
            ["Número de pasillos", str(p.numero_pasillos_operativos)],
            ["Longitud total pasillos", f"{p.longitud_total_pasillos} m"],
            ["Pasillo perimetral norte", f"{p.ancho_pasillo_norte} m"],
            ["Pasillo perimetral sur", f"{p.ancho_pasillo_sur} m"],
            ["Pasillo perimetral este", f"{p.ancho_pasillo_este} m"],
            ["Pasillo perimetral oeste", f"{p.ancho_pasillo_oeste} m"],
        ]
        
        aisle_table = Table(aisle_data, colWidths=[8*cm, 6*cm])
        aisle_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(aisle_table)
        story.append(Spacer(1, 15))
    
    # === MUELLES ===
    if r.muelles:
        story.append(Paragraph("🚛 MUELLES DE CARGA", section_style))
        m = r.muelles
        
        dock_data = [
            ["Concepto", "Valor"],
            ["Número de muelles", str(m.numero_muelles)],
            ["Ancho muelle", f"{m.ancho_muelle} m"],
            ["Profundidad muelle", f"{m.profundidad_muelle} m"],
            ["Altura rampa", f"{m.altura_rampa} m"],
            ["Separación entre muelles", f"{m.separacion_entre_muelles} m"],
            ["Profundidad zona maniobra", f"{m.profundidad_zona_maniobra} m"],
            ["Superficie zona maniobra", f"{m.superficie_zona_maniobra} m²"],
        ]
        
        dock_table = Table(dock_data, colWidths=[8*cm, 6*cm])
        dock_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(dock_table)
        story.append(Spacer(1, 15))
    
    # === OFICINAS ===
    if r.oficinas:
        story.append(Paragraph("🏢 OFICINAS", section_style))
        
        for i, o in enumerate(r.oficinas):
            office_data = [
                ["Concepto", "Valor"],
                ["Posición", f"({o.posicion_x}, {o.posicion_z}) m"],
                ["Dimensiones por planta", f"{o.largo} x {o.ancho} m"],
                ["Número de plantas", f"{o.num_floors}"],
                ["Altura por planta", f"{o.floor_height} m"],
                ["Superficie por planta", f"{o.area_per_floor} m²"],
                ["Superficie TOTAL", f"{o.total_area} m²"],
                ["Ubicación", "Entresuelo" if o.es_entresuelo else "Planta Baja"],
            ]
            if o.es_entresuelo:
                office_data.append(["Altura libre bajo oficina", f"{o.altura_libre_bajo_oficina} m"])
            office_data.append(["Altura total oficina", f"{o.altura_oficina} m"])
            office_data.append(["Altura libre sobre oficina", f"{o.altura_libre_sobre_oficina} m"])
            
            office_table = Table(office_data, colWidths=[8*cm, 6*cm])
            office_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
            ]))
            story.append(office_table)
            story.append(Spacer(1, 10))
    
    # === SERVICIOS ===
    if r.servicios:
        story.append(Paragraph("🚿 SERVICIOS", section_style))
        
        for s in r.servicios:
            serv_data = [
                ["Concepto", "Valor"],
                ["Tipo", s.tipo],
                ["Posición", f"({s.posicion_x}, {s.posicion_z}) m"],
                ["Dimensiones", f"{s.largo} x {s.ancho} x {s.altura} m"],
                ["Superficie", f"{s.superficie} m²"],
            ]
            
            serv_table = Table(serv_data, colWidths=[8*cm, 6*cm])
            serv_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
            ]))
            story.append(serv_table)
            story.append(Spacer(1, 10))
    
    # === SALAS TÉCNICAS ===
    if r.salas_tecnicas:
        story.append(Paragraph("⚡ SALAS TÉCNICAS", section_style))
        
        for t in r.salas_tecnicas:
            tech_data = [
                ["Concepto", "Valor"],
                ["Tipo", t.tipo],
                ["Posición", f"({t.posicion_x}, {t.posicion_z}) m"],
                ["Dimensiones", f"{t.largo} x {t.ancho} x {t.altura} m"],
                ["Superficie", f"{t.superficie} m²"],
            ]
            
            tech_table = Table(tech_data, colWidths=[8*cm, 6*cm])
            tech_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
            ]))
            story.append(tech_table)
            story.append(Spacer(1, 10))
    
    # === RESUMEN DE SUPERFICIES ===
    if r.resumen_superficies:
        story.append(Paragraph("📊 RESUMEN DE SUPERFICIES", section_style))
        s = r.resumen_superficies
        
        surf_data = [
            ["Concepto", "m²", "%"],
            ["Estanterías", f"{s.superficie_estanterias:,.1f}", f"{s.pct_estanterias:.1f}%"],
            ["Pasillos operativos", f"{s.superficie_pasillos_operativos:,.1f}", f"{s.pct_pasillos_operativos:.1f}%"],
            ["Pasillos perimetrales", f"{s.superficie_pasillos_perimetrales:,.1f}", f"{s.pct_pasillos_perimetrales:.1f}%"],
            ["Muelles + maniobra", f"{s.superficie_muelles_maniobra:,.1f}", f"{s.pct_muelles:.1f}%"],
            ["Oficinas", f"{s.superficie_oficinas:,.1f}", f"{s.pct_oficinas:.1f}%"],
            ["Servicios", f"{s.superficie_servicios:,.1f}", f"{s.pct_servicios:.1f}%"],
            ["Salas técnicas", f"{s.superficie_salas_tecnicas:,.1f}", f"{s.pct_salas_tecnicas:.1f}%"],
            ["Zonas operativas", f"{s.superficie_zonas_operativas:,.1f}", f"{s.pct_zonas_operativas:.1f}%"],
            ["TOTAL NAVE", f"{s.superficie_total:,.1f}", "100%"],
        ]
        
        surf_table = Table(surf_data, colWidths=[7*cm, 4*cm, 3*cm])
        surf_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e2e8f0')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(surf_table)
        story.append(Spacer(1, 15))
    
    # === INDICADORES DE EFICIENCIA ===
    if r.indicadores_eficiencia:
        story.append(Paragraph("🎯 INDICADORES DE EFICIENCIA", section_style))
        e = r.indicadores_eficiencia
        
        eff_data = [
            ["Indicador", "Valor"],
            ["Eficiencia de almacenamiento", f"{e.eficiencia_almacenamiento}%"],
            ["Palets por m² de nave", f"{e.palets_por_m2_nave:.3f}"],
            ["Palets por m² de almacenamiento", f"{e.palets_por_m2_almacenamiento:.3f}"],
            ["Ratio circulación", f"{e.ratio_circulacion:.1f}%"],
            ["Distancia mín. muelle-estantería", f"{e.distancia_min_muelle_estanteria} m"],
            ["Distancia máx. muelle-estantería", f"{e.distancia_max_muelle_estanteria} m"],
            ["Distancia media muelle-estantería", f"{e.distancia_media_muelle_estanteria} m"],
        ]
        
        eff_table = Table(eff_data, colWidths=[8*cm, 6*cm])
        eff_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(eff_table)
        story.append(Spacer(1, 15))
    
    # === SEGURIDAD ===
    if r.seguridad:
        story.append(Paragraph("🔒 SEGURIDAD Y NORMATIVA", section_style))
        seg = r.seguridad
        
        safety_data = [
            ["Concepto", "Valor"],
            ["Ancho mínimo evacuación", f"{seg.ancho_minimo_evacuacion} m"],
            ["Distancia máxima a salida", f"{seg.distancia_maxima_salida} m"],
            ["Salidas de emergencia", str(seg.numero_salidas_emergencia)],
            ["Cumple CTE", "✅ Sí" if seg.cumple_cte else "❌ No"],
        ]
        
        safety_table = Table(safety_data, colWidths=[8*cm, 6*cm])
        safety_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(safety_table)
        
        # Observaciones
        for obs in seg.observaciones:
            story.append(Paragraph(f"• {obs}", normal_style))
        story.append(Spacer(1, 15))
    
    # === CONFIGURACIÓN ===
    if r.configuracion:
        story.append(Paragraph("⚙️ CONFIGURACIÓN UTILIZADA", section_style))
        c = r.configuracion
        
        config_data = [
            ["Parámetro", "Valor"],
            ["Tipo palet", f"{c.tipo_palet} ({c.palet_largo}x{c.palet_ancho}x{c.palet_alto} m)"],
            ["Maquinaria", c.tipo_maquinaria],
            ["Ancho pasillo requerido", f"{c.ancho_pasillo_requerido} m"],
            ["Tipo estantería", c.tipo_estanteria],
            ["ABC Zoning", "Activo" if c.abc_zoning_activo else "Desactivado"],
            ["Tipo almacén", c.tipo_almacen],
        ]
        
        config_table = Table(config_data, colWidths=[8*cm, 6*cm])
        config_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')]),
        ]))
        story.append(config_table)
    
    # Construir PDF
    doc.build(story)
    
    return output_path
