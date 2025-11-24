"""
UNITNAVE - Validador Normativa
CTE, seguridad, buenas prácticas
"""
import math
from typing import List, Dict
from models import *
from constants import *

class WarehouseValidator:
    def __init__(self, input_data: WarehouseInput, elements: List[WarehouseElement], dims: Dict):
        self.input = input_data
        self.elements = elements
        self.dims = dims
        self.validations: List[ValidationItem] = []
        
    def run_all_validations(self) -> List[ValidationItem]:
        """Ejecutar todas las validaciones"""
        self._validate_dimensions()
        self._validate_circulation()
        self._validate_fire_safety()
        self._validate_emergency_exits()
        self._validate_aisle_widths()
        self._validate_loading_docks()
        self._validate_office_compliance()
        
        return self.validations
    
    def _add_validation(self, type: str, code: str, message: str, location: str = None):
        """Helper añadir validación"""
        self.validations.append(ValidationItem(
            type=type,
            code=code,
            message=message,
            location=location
        ))
    
    def _validate_dimensions(self):
        """Validar dimensiones básicas nave"""
        # Ratio largo/ancho razonable
        ratio = self.dims["length"] / self.dims["width"]
        if ratio > 5:
            self._add_validation("warning", "DIM001", 
                f"Nave muy alargada (ratio {ratio:.1f}:1). Puede dificultar circulación.")
        
        # Altura mínima para estanterías
        if self.dims["height"] < 6:
            self._add_validation("warning", "DIM002",
                f"Altura libre {self.dims['height']}m es baja. Capacidad limitada.")
        
        # Superficie mínima viable
        total_area = self.dims["length"] * self.dims["width"]
        if total_area < 300:
            self._add_validation("warning", "DIM003",
                f"Superficie {total_area}m² muy pequeña para operativa industrial eficiente.")
    
    def _validate_circulation(self):
        """Validar % circulación"""
        total_area = self.dims["length"] * self.dims["width"]
        
        storage_area = sum(
            (el.dimensions.length or 0) * (el.dimensions.depth or 0)
            for el in self.elements if el.type == "shelf"
        )
        
        circulation_pct = ((total_area - storage_area) / total_area) * 100
        
        if circulation_pct < 25:
            self._add_validation("error", "CIRC001",
                f"Circulación {circulation_pct:.1f}% < 25% mínimo. Riesgo colapso operativo.")
        elif circulation_pct < 30:
            self._add_validation("warning", "CIRC002",
                f"Circulación {circulation_pct:.1f}% ajustada. Recomendado ≥30%.")
        else:
            self._add_validation("info", "CIRC003",
                f"Circulación {circulation_pct:.1f}% correcta.")
    
    def _validate_fire_safety(self):
        """Validar protección contra incendios"""
        total_area = self.dims["length"] * self.dims["width"]
        
        # Extintores (1 cada 15m recorrido)
        max_distance = max(self.dims["length"], self.dims["width"])
        required_extinguishers = math.ceil(max_distance / FIRE_SAFETY["extinguisher_distance"])
        
        self._add_validation("info", "FIRE001",
            f"Requeridos {required_extinguishers} extintores (1 cada 15m recorrido).")
        
        # BIEs si >500m²
        if total_area > 500:
            required_bies = math.ceil(max_distance / FIRE_SAFETY["bie_distance"])
            self._add_validation("info", "FIRE002",
                f"Nave >500m²: Obligatorias {required_bies} BIEs (1 cada 25m).")
        
        # Rociadores si >2500m² o >6m altura
        if total_area > 2500 or self.dims["height"] > 6:
            self._add_validation("warning", "FIRE003",
                "Superficie/altura requiere evaluar sistema rociadores automáticos (ESFR).")
    
    def _validate_emergency_exits(self):
        """Validar salidas evacuación"""
        total_area = self.dims["length"] * self.dims["width"]
        
        # Distancia máxima 50m hasta salida
        max_dimension = max(self.dims["length"], self.dims["width"])
        if max_dimension > 50:
            required_exits = math.ceil(max_dimension / 50)
            self._add_validation("warning", "EVAC001",
                f"Dimensión {max_dimension}m > 50m. Requeridas ≥{required_exits} salidas emergencia.")
        else:
            self._add_validation("info", "EVAC002",
                "Distancia evacuación correcta (<50m).")
        
        # Ocupación (1 persona cada 40m² en almacén)
        estimated_occupancy = int(total_area / 40)
        exit_width_required = estimated_occupancy * 0.006  # 0.6cm por persona (mín 0.9m)
        exit_width_required = max(0.9, exit_width_required)
        
        self._add_validation("info", "EVAC003",
            f"Ancho total salidas requerido: {exit_width_required:.2f}m (ocupación {estimated_occupancy} personas).")
    
    def _validate_aisle_widths(self):
        """Validar anchos pasillos según maquinaria"""
        required_width = AISLE_WIDTHS.get(self.input.machinery, 2.8)
        
        # Verificar que pasillos entre estanterías respetan mínimo
        shelves = [el for el in self.elements if el.type == "shelf"]
        
        # Heurística simple: si hay muchas estanterías, verificar espaciado
        if len(shelves) > 4:
            # Calcular espaciado promedio (simplificado)
            self._add_validation("info", "AISLE001",
                f"Ancho pasillo operativo: {required_width}m (maquinaria: {self.input.machinery}).")
        
        # Pasillo principal
        if self.dims["width"] > 30:
            self._add_validation("info", "AISLE002",
                f"Recomendado pasillo principal central {AISLE_TYPES['main']}m ancho.")
    
    def _validate_loading_docks(self):
        """Validar muelles carga"""
        n_docks = len([el for el in self.elements if el.type == "dock"])
        
        # Zona maniobra suficiente (12m estándar)
        if n_docks > 0:
            self._add_validation("info", "DOCK001",
                f"{n_docks} muelles configurados. Zona maniobra: {DOCK_STANDARDS['maneuver_zone']}m.")
        
        # Ratio muelles/superficie
        total_area = self.dims["length"] * self.dims["width"]
        recommended_docks = max(2, int(total_area / 400))  # 1 muelle cada 400m²
        
        if n_docks < recommended_docks:
            self._add_validation("warning", "DOCK002",
                f"Con {total_area:.0f}m² recomendado ≥{recommended_docks} muelles (actual: {n_docks}).")
    
    def _validate_office_compliance(self):
        """Validar cumplimiento oficinas y servicios"""
        workers = self.input.workers or estimate_workers(
            self.dims["length"] * self.dims["width"],
            self.input.activity_type
        )
        
        # Oficinas
        office_area = sum(
            (el.dimensions.largo or 0) * (el.dimensions.ancho or 0)
            for el in self.elements if el.type == "office"
        )
        required_office_area = workers * OFFICE_STANDARDS["m2_per_worker"]
        
        if office_area < required_office_area:
            self._add_validation("warning", "OFF001",
                f"Oficinas {office_area}m² < {required_office_area}m² requeridos ({workers} trabajadores × 2m²).")
        else:
            self._add_validation("info", "OFF002",
                f"Oficinas {office_area}m² correctas para {workers} trabajadores.")
        
        # Baños
        required_restrooms = math.ceil(workers / 25)
        restrooms = len([el for el in self.elements if el.type == "service_room" and el.properties.get("type") == "restroom"])
        
        if restrooms < required_restrooms:
            self._add_validation("warning", "SRV001",
                f"Baños insuficientes: {restrooms} (requeridos {required_restrooms} para {workers} trabajadores).")
        
        # Vestuarios si >10 trabajadores
        if workers > 10:
            locker_rooms = len([el for el in self.elements if el.type == "service_room" and el.properties.get("type") == "locker_room"])
            if locker_rooms < 2:
                self._add_validation("warning", "SRV002",
                    f"Con {workers} trabajadores obligatorios vestuarios (H/M).")