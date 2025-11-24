"""
UNITNAVE - Motor de Cálculos
Capacidad, superficies, eficiencia, métricas
"""
import math
from typing import List, Dict
from models import *
from constants import *

class CapacityCalculator:
    def __init__(self, input_data: WarehouseInput, elements: List[WarehouseElement], dims: Dict):
        self.input = input_data
        self.elements = elements
        self.dims = dims
        self.pallet = self._get_pallet_dimensions()
        
    def _get_pallet_dimensions(self) -> Dict:
        """Obtener dimensiones palet según tipo"""
        if self.input.pallet_type == "CUSTOM" and self.input.custom_pallet:
            return self.input.custom_pallet
        return PALLET_TYPES.get(self.input.pallet_type, PALLET_TYPES["EUR"])
    
    def calculate_total_capacity(self) -> CapacityResult:
        """CRÍTICO: Calcular capacidad total en palets"""
        total_pallets = 0
        total_levels = 0
        num_shelves = 0
        storage_volume = 0
        
        by_zone = {}
        
        for element in self.elements:
            if element.type == "shelf":
                dims = element.dimensions
                
                # Palets por nivel (considerando orientación óptima)
                shelf_length = dims.length or 0
                shelf_depth = dims.depth or 0
                
                # Orientación 1: normal (palet longitudinal)
                pallets_length_1 = int(shelf_length / self.pallet["length"])
                pallets_depth_1 = int(shelf_depth / self.pallet["width"])
                capacity_1 = pallets_length_1 * pallets_depth_1
                
                # Orientación 2: rotado 90° (palet transversal)
                pallets_length_2 = int(shelf_length / self.pallet["width"])
                pallets_depth_2 = int(shelf_depth / self.pallet["length"])
                capacity_2 = pallets_length_2 * pallets_depth_2
                
                # Elegir mejor orientación
                pallets_per_level = max(capacity_1, capacity_2)
                
                levels = dims.levels or 1
                shelf_capacity = pallets_per_level * levels
                
                total_pallets += shelf_capacity
                total_levels += levels
                num_shelves += 1
                
                # Volumen ocupado
                volume = shelf_length * shelf_depth * (dims.height or 0)
                storage_volume += volume
                
                # Por zona (si tiene etiqueta)
                zone_label = element.properties.get("row", "default")
                by_zone[zone_label] = by_zone.get(zone_label, 0) + shelf_capacity
        
        # Promedios
        levels_avg = int(total_levels / num_shelves) if num_shelves > 0 else 0
        pallets_per_level_avg = int(total_pallets / total_levels) if total_levels > 0 else 0
        
        # Eficiencia volumétrica
        total_area = self.dims["length"] * self.dims["width"]
        office_area = self._calculate_office_area()
        usable_area = total_area - office_area
        
        storage_area = self._calculate_storage_area()
        efficiency = calculate_storage_efficiency(storage_area, total_area, office_area)
        
        return CapacityResult(
            total_pallets=total_pallets,
            pallets_per_level=pallets_per_level_avg,
            levels_avg=levels_avg,
            storage_volume_m3=round(storage_volume, 2),
            efficiency_percentage=efficiency,
            by_zone=by_zone if by_zone else None
        )
    
    def calculate_surfaces(self) -> SurfaceSummary:
        """Desglose áreas por tipo zona"""
        total_area = self.dims["length"] * self.dims["width"]
        
        storage_area = 0
        operational_area = 0
        services_area = 0
        office_area = 0
        
        for element in self.elements:
            dims = element.dimensions
            
            # Calcular área elemento (tolerante a diferentes formatos)
            if element.type == "shelf":
                area = (dims.length or 0) * (dims.depth or 0)
                storage_area += area
                
            elif element.type == "office":
                area = (dims.largo or 0) * (dims.ancho or 0)
                office_area += area
                
            elif element.type == "operational_zone":
                area = (dims.largo or 0) * (dims.ancho or 0)
                operational_area += area
                
            elif element.type in ["service_room", "technical_room"]:
                area = (dims.largo or 0) * (dims.ancho or 0)
                services_area += area
        
        # Circulación = resto
        circulation_area = total_area - (storage_area + operational_area + services_area + office_area)
        circulation_area = max(0, circulation_area)  # Evitar negativos
        
        # Eficiencia
        usable_area = total_area - office_area
        efficiency = (storage_area / usable_area * 100) if usable_area > 0 else 0
        
        return SurfaceSummary(
            total_area=round(total_area, 2),
            storage_area=round(storage_area, 2),
            operational_area=round(operational_area, 2),
            services_area=round(services_area, 2),
            circulation_area=round(circulation_area, 2),
            office_area=round(office_area, 2),
            efficiency=round(efficiency, 2)
        )
    
    def _calculate_office_area(self) -> float:
        """Área total oficinas"""
        total = 0
        for el in self.elements:
            if el.type == "office":
                total += (el.dimensions.largo or 0) * (el.dimensions.ancho or 0)
        return total
    
    def _calculate_storage_area(self) -> float:
        """Área total estanterías"""
        total = 0
        for el in self.elements:
            if el.type == "shelf":
                total += (el.dimensions.length or 0) * (el.dimensions.depth or 0)
        return total