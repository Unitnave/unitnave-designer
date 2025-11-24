"""
UNITNAVE - Optimizador Layout Naves Industriales
Algoritmo Greedy + Heurísticas + Validación Normativa
"""
import uuid
import numpy as np
from typing import List, Dict, Tuple, Optional
from constants import *
from models import *

class WarehouseOptimizer:
    def __init__(self, input_data: WarehouseInput):
        self.input = input_data
        self.dims = {
            "length": input_data.length,
            "width": input_data.width,
            "height": input_data.height
        }
        
        # Cálculos derivados
        self.total_area = self.dims["length"] * self.dims["width"]
        self.workers = input_data.workers or estimate_workers(self.total_area, input_data.activity_type)
        self.aisle_width = AISLE_WIDTHS.get(input_data.machinery, 2.8)
        
        # Grid discreto para tracking (resolución 0.5m)
        self.grid_resolution = 0.5
        self.grid = self._init_grid()
        
        # Almacenamiento elementos
        self.elements: List[WarehouseElement] = []
        self.zones_occupied = []
        
    def _init_grid(self) -> np.ndarray:
        """Grid NumPy para tracking ocupación"""
        rows = int(self.dims["length"] / self.grid_resolution)
        cols = int(self.dims["width"] / self.grid_resolution)
        return np.zeros((rows, cols), dtype=np.uint8)
    
    def _mark_grid(self, x: float, z: float, width: float, depth: float, value: int = 1):
        """Marcar zona ocupada en grid"""
        x_start = int(x / self.grid_resolution)
        z_start = int(z / self.grid_resolution)
        x_end = int((x + width) / self.grid_resolution)
        z_end = int((z + depth) / self.grid_resolution)
        
        # Clamping para evitar índices fuera
        x_start = max(0, min(x_start, self.grid.shape[0] - 1))
        x_end = max(0, min(x_end, self.grid.shape[0]))
        z_start = max(0, min(z_start, self.grid.shape[1] - 1))
        z_end = max(0, min(z_end, self.grid.shape[1]))
        
        self.grid[x_start:x_end, z_start:z_end] = value
    
    def _add_element(self, element_type: str, x: float, z: float, dims: Dict, props: Dict = None) -> WarehouseElement:
        """Helper crear elementos con formato correcto"""
        element = WarehouseElement(
            id=f"{element_type}-{uuid.uuid4().hex[:8]}",
            type=element_type,
            position=ElementPosition(
                x=round(x, 2),
                y=round(z, 2),
                z=props.get("elevation", 0) if props else 0,
                rotation=props.get("rotation", 0) if props else 0
            ),
            dimensions=ElementDimensions(**dims),
            properties=props or {}
        )
        self.elements.append(element)
        
        # Marcar en grid
        width = dims.get("width") or dims.get("largo") or dims.get("length", 0)
        depth = dims.get("depth") or dims.get("ancho") or dims.get("width", 0)
        self._mark_grid(x, z, width, depth)
        
        return element
    
    # ==================== PIPELINE GENERACIÓN ====================
    
    def generate_layout(self) -> OptimizationResult:
        """Pipeline completo optimización"""
        try:
            # FASE 1: Zonas fijas (no negociables)
            self._place_loading_docks()
            self._place_offices_mezzanine()
            
            # FASE 2: Servicios empleados
            self._place_employee_services()
            
            # FASE 3: Instalaciones técnicas
            self._place_technical_rooms()
            
            # FASE 4: Zonas operativas
            self._place_operational_zones()
            
            # FASE 5: CORE - Estanterías optimizadas
            storage_zones = self._get_available_storage_zones()
            self._place_racks_optimized(storage_zones)
            
            # FASE 6: Cálculos finales
            from calculations import CapacityCalculator
            calculator = CapacityCalculator(self.input, self.elements, self.dims)
            capacity = calculator.calculate_total_capacity()
            surfaces = calculator.calculate_surfaces()
            
            # FASE 7: Validaciones
            from validation import WarehouseValidator
            validator = WarehouseValidator(self.input, self.elements, self.dims)
            validations = validator.run_all_validations()
            
            return OptimizationResult(
                status="success" if not any(v.type == "error" for v in validations) else "warning",
                elements=self.elements,
                capacity=capacity,
                surfaces=surfaces,
                validations=validations,
                metadata=self._generate_metadata()
            )
            
        except Exception as e:
            # Error crítico
            return OptimizationResult(
                status="error",
                elements=[],
                capacity=CapacityResult(total_pallets=0, pallets_per_level=0, levels_avg=0, storage_volume_m3=0, efficiency_percentage=0),
                surfaces=SurfaceSummary(total_area=0, storage_area=0, operational_area=0, services_area=0, circulation_area=0, office_area=0, efficiency=0),
                validations=[ValidationItem(type="error", code="CRITICAL", message=str(e))],
                metadata={"error": str(e)}
            )
    
    # ==================== MUELLES ====================
    
    def _place_loading_docks(self):
        """Muelles en frontal nave"""
        n_docks = self.input.n_docks
        dock_width = DOCK_STANDARDS["width"]
        dock_separation = DOCK_STANDARDS["separation"]
        
        total_width = (n_docks * dock_width) + ((n_docks - 1) * dock_separation)
        
        # Centrar en el largo de la nave
        start_x = (self.dims["length"] - total_width) / 2
        
        for i in range(n_docks):
            x = start_x + i * (dock_width + dock_separation)
            
            self._add_element("dock", x, 0, {
                "width": dock_width,
                "depth": DOCK_STANDARDS["depth"],
                "height": DOCK_STANDARDS["height"],
                "maneuverZone": DOCK_STANDARDS["maneuver_zone"]
            }, {"label": f"Muelle {i+1}"})
    
    # ==================== OFICINAS ====================
    
    def _place_offices_mezzanine(self):
        """Oficinas SOLO en entreplanta (corregido)"""
        office_area = max(
            OFFICE_STANDARDS["min_area"],
            self.workers * OFFICE_STANDARDS["m2_per_worker"]
        )
        
        # Dimensiones: intentar cuadrado/rectangular proporcionado
        office_width = min(10, self.dims["width"] * 0.25)  # Max 25% ancho
        office_length = office_area / office_width
        
        # Posicionar en esquina (izquierda, fondo)
        x = 0
        z = self.dims["width"] - office_width
        
        self._add_element("office", x, z, {
            "largo": round(office_length, 1),
            "ancho": round(office_width, 1),
            "alto": OFFICE_STANDARDS["ceiling_height"]
        }, {
            "elevation": 3.5,  # Sobre pilares
            "is_mezzanine": True,
            "label": "Oficinas Administrativas",
            "workers": self.workers
        })
        
        # Escalera + Ascensor (debajo oficinas)
        stairs_width = SERVICE_ROOMS["stairs"]["width"]
        stairs_depth = SERVICE_ROOMS["stairs"]["depth"]
        
        self._add_element("service_room", office_length, z, {
            "largo": stairs_width,
            "ancho": stairs_depth,
            "alto": 7.0  # Altura completa
        }, {
            "label": "Escalera + Ascensor",
            "type": "vertical_access"
        })
    
    # ==================== SERVICIOS EMPLEADOS ====================
    
    def _place_employee_services(self):
        """Vestuarios, baños, comedor"""
        
        # BAÑOS (obligatorio)
        num_restrooms = max(2, int(np.ceil(self.workers / SERVICE_ROOMS["restroom"]["per_workers"])))
        restroom_width = SERVICE_ROOMS["restroom"]["width"]
        restroom_depth = SERVICE_ROOMS["restroom"]["depth"]
        
        # Colocar junto a escalera (acceso planta baja y primera)
        x_start = 0
        z_start = self.dims["width"] - restroom_depth - 12  # Detrás oficinas
        
        for i in range(num_restrooms):
            self._add_element("service_room", x_start + i * (restroom_width + 0.5), z_start, {
                "largo": restroom_width,
                "ancho": restroom_depth,
                "alto": 3.0
            }, {"label": f"Baño {i+1}", "type": "restroom"})
        
        # VESTUARIOS (si >10 trabajadores)
        if self.workers >= SERVICE_ROOMS["locker_room"]["min_workers"]:
            locker_width = SERVICE_ROOMS["locker_room"]["width"]
            locker_depth = SERVICE_ROOMS["locker_room"]["depth"]
            
            # 2 vestuarios (H/M)
            for i in range(2):
                self._add_element("service_room", x_start, z_start - (i+1) * (locker_depth + 1), {
                    "largo": locker_width,
                    "ancho": locker_depth,
                    "alto": 3.0
                }, {"label": f"Vestuario {'Hombres' if i==0 else 'Mujeres'}", "type": "locker_room"})
        
        # COMEDOR (obligatorio si jornada >6h)
        break_area = self.workers * OFFICE_STANDARDS["break_room_m2_per_worker"]
        break_width = SERVICE_ROOMS["break_room"]["width"]
        break_depth = break_area / break_width
        
        # En entreplanta junto oficinas
        self._add_element("service_room", 20, self.dims["width"] - break_width, {
            "largo": round(break_depth, 1),
            "ancho": break_width,
            "alto": 3.5
        }, {
            "elevation": 3.5,
            "label": "Comedor / Zona Descanso",
            "type": "break_room"
        })
    
    # ==================== INSTALACIONES TÉCNICAS ====================
    
    def _place_technical_rooms(self):
        """Salas eléctricas, baterías"""
        
        # SALA ELÉCTRICA (obligatoria)
        elec_width = TECHNICAL_ROOMS["electrical"]["width"]
        elec_depth = TECHNICAL_ROOMS["electrical"]["depth"]
        
        # En lateral, accesible desde exterior
        self._add_element("technical_room", self.dims["length"] - elec_width - 1, 1, {
            "largo": elec_width,
            "ancho": elec_depth,
            "alto": 3.0
        }, {"label": "Sala Eléctrica", "type": "electrical"})
        
        # ZONA CARGA BATERÍAS (si vehículos eléctricos)
        battery_width = TECHNICAL_ROOMS["battery_charging"]["width"]
        battery_depth = TECHNICAL_ROOMS["battery_charging"]["depth"]
        
        # Lejos de oficinas (normativa >10m)
        self._add_element("technical_room", self.dims["length"] - battery_width - 1, 10, {
            "largo": battery_width,
            "ancho": battery_depth,
            "alto": 2.5
        }, {"label": "Carga Baterías (Ventilada)", "type": "battery_charging"})
    
    # ==================== ZONAS OPERATIVAS ====================
    
    def _place_operational_zones(self):
        """Recepción, picking, expedición"""
        
        # RECEPCIÓN (junto a muelles)
        receiving_area = self.total_area * OPERATIONAL_ZONES["receiving"]
        receiving_width = min(15, self.dims["length"] * 0.3)
        receiving_depth = receiving_area / receiving_width
        
        self._add_element("operational_zone", 5, DOCK_STANDARDS["maneuver_zone"] + 2, {
            "largo": round(receiving_width, 1),
            "ancho": round(receiving_depth, 1),
            "alto": 0.1  # Zona de suelo
        }, {"label": "Recepción", "type": "receiving"})
        
        # PICKING (zona central accesible)
        picking_area = self.total_area * OPERATIONAL_ZONES["picking"]
        picking_width = min(20, self.dims["length"] * 0.4)
        picking_depth = picking_area / picking_width
        
        self._add_element("operational_zone", self.dims["length"] / 2 - picking_width / 2, self.dims["width"] / 2, {
            "largo": round(picking_width, 1),
            "ancho": round(picking_depth, 1),
            "alto": 0.1
        }, {"label": "Picking / Preparación", "type": "picking"})
        
        # EXPEDICIÓN (junto a muelles, opuesta recepción)
        shipping_area = self.total_area * OPERATIONAL_ZONES["shipping"]
        shipping_width = receiving_width
        shipping_depth = shipping_area / shipping_width
        
        self._add_element("operational_zone", self.dims["length"] - shipping_width - 5, DOCK_STANDARDS["maneuver_zone"] + 2, {
            "largo": round(shipping_width, 1),
            "ancho": round(shipping_depth, 1),
            "alto": 0.1
        }, {"label": "Expedición", "type": "shipping"})
    
    # ==================== ESTANTERÍAS (CORE ALGORITHM) ====================
    
    def _get_available_storage_zones(self) -> List[Dict]:
        """Calcular áreas libres para almacenamiento"""
        # Zona principal: Entre muelles y oficinas
        storage_z_start = DOCK_STANDARDS["maneuver_zone"] + 15  # Margen zonas operativas
        storage_z_end = self.dims["width"] - 15  # Margen oficinas
        storage_x_start = 2  # Margen pared
        storage_x_end = self.dims["length"] - 12  # Margen instalaciones
        
        return [{
            "x_start": storage_x_start,
            "x_end": storage_x_end,
            "z_start": storage_z_start,
            "z_end": storage_z_end
        }]
    
    def _place_racks_optimized(self, storage_zones: List[Dict]):
        """Algoritmo greedy mejorado para estanterías"""
        
        rack_depth = RACK_STANDARDS["conventional"]["depth"]
        beam_length = RACK_STANDARDS["conventional"]["beam_length"]
        max_levels = calculate_rack_levels(self.dims["height"])
        
        for zone in storage_zones:
            available_width = zone["z_end"] - zone["z_start"]
            available_length = zone["x_end"] - zone["x_start"]
            
            # Módulo: Rack doble (espalda con espalda) + pasillo
            rack_module_depth = (rack_depth * 2) + self.aisle_width
            
            # Calcular cuántas filas caben
            num_rows = int(available_width / rack_module_depth)
            
            current_z = zone["z_start"]
            
            for row in range(num_rows):
                # Fila A (frontal)
                self._add_element("shelf", zone["x_start"], current_z, {
                    "length": available_length,
                    "depth": rack_depth,
                    "height": max_levels * RACK_STANDARDS["conventional"]["level_height"],
                    "levels": max_levels
                }, {"row": f"A{row+1}"})
                
                # Fila B (espalda con espalda)
                self._add_element("shelf", zone["x_start"], current_z + rack_depth, {
                    "length": available_length,
                    "depth": rack_depth,
                    "height": max_levels * RACK_STANDARDS["conventional"]["level_height"],
                    "levels": max_levels
                }, {"row": f"B{row+1}"})
                
                # Avanzar cursor
                current_z += rack_module_depth
    
    # ==================== METADATA ====================
    
    def _generate_metadata(self) -> Dict:
        """Información adicional diseño"""
        return {
            "generator": "UNITNAVE Optimizer v1.0",
            "input_params": self.input.dict(),
            "workers_estimated": self.workers,
            "aisle_width_used": self.aisle_width,
            "grid_resolution": self.grid_resolution,
            "total_elements": len(self.elements)
        }