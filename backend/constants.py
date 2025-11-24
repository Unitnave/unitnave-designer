"""
UNITNAVE - Constantes y Tablas de Normativa
Todos los defaults automáticos según industria real
"""

# ==================== PALETS ====================
PALLET_TYPES = {
    "EUR": {"length": 1.2, "width": 0.8, "height": 1.5, "weight": 1000, "name": "Europalet"},
    "US": {"length": 1.2, "width": 1.0, "height": 1.5, "weight": 1200, "name": "Americano"},
    "CUSTOM": {"length": 0, "width": 0, "height": 0, "weight": 0, "name": "Personalizado"}
}

# ==================== ESTANTERÍAS ====================
RACK_STANDARDS = {
    "conventional": {
        "beam_length": 2.7,      # 2 posiciones palet EUR
        "depth": 1.1,            # Fondo estándar
        "level_height": 1.75,    # Palet + margen
        "post_width": 0.1,       # Grosor poste
        "max_weight_level": 2000 # kg
    }
}

# ==================== PASILLOS (CRÍTICO) ====================
AISLE_WIDTHS = {
    "transpaleta": 1.8,          # Manual
    "apilador": 2.4,             # Eléctrico básico
    "retractil": 2.8,            # ⭐ MÁS COMÚN
    "contrapesada": 3.6,         # Todo terreno
    "trilateral": 1.9,           # VNA (Very Narrow Aisle)
    "recogepedidos": 2.5         # Order picker
}

AISLE_TYPES = {
    "operational": lambda machinery: AISLE_WIDTHS.get(machinery, 2.8),
    "main": 4.5,                 # Circulación principal
    "pedestrian": 1.5,           # Peatonal
    "emergency": 1.2             # Evacuación mínimo
}

# ==================== MUELLES ====================
DOCK_STANDARDS = {
    "width": 3.5,                # Ancho puerta camión
    "depth": 4.0,                # Profundidad plataforma
    "height": 1.2,               # Altura desde suelo
    "maneuver_zone": 12.0,       # Zona maniobra trasera
    "separation": 1.0            # Entre muelles
}

# ==================== OFICINAS Y SERVICIOS ====================
OFFICE_STANDARDS = {
    "m2_per_worker": 2.0,        # Normativa mínima
    "ceiling_height": 3.5,       # Entresuelo
    "min_area": 20.0,            # Mínimo aunque sea 1 persona
    "break_room_m2_per_worker": 0.8,
    "locker_m2_per_worker": 1.2
}

SERVICE_ROOMS = {
    "restroom": {"width": 3, "depth": 2, "per_workers": 25},
    "locker_room": {"width": 6, "depth": 5, "min_workers": 10},
    "break_room": {"width": 5, "depth": 4, "min_workers": 5},
    "stairs": {"width": 2, "depth": 4, "height_per_floor": 3.5},
    "elevator": {"width": 1.6, "depth": 1.8, "min_office_area": 50}
}

# ==================== ZONAS OPERATIVAS (% superficie) ====================
OPERATIONAL_ZONES = {
    "receiving": 0.025,          # 2.5% superficie total
    "picking": 0.04,             # 4%
    "shipping": 0.025,           # 2.5%
    "quality_control": 0.008,    # 0.8% (opcional)
    "returns": 0.01              # 1% (opcional)
}

# ==================== INSTALACIONES TÉCNICAS ====================
TECHNICAL_ROOMS = {
    "electrical": {"width": 4, "depth": 2, "mandatory": True},
    "battery_charging": {
        "width": 8, 
        "depth": 6, 
        "per_vehicles": 4,  # 1 punto cada 4 vehículos
        "distance_from_offices": 10  # metros mínimo
    }
}

# ==================== SEGURIDAD Y PCI ====================
FIRE_SAFETY = {
    "extinguisher_distance": 15,  # 1 cada 15m recorrido
    "bie_distance": 25,           # BIE cada 25m (si >500m²)
    "emergency_exit_distance": 50, # Máx 50m hasta salida
    "aisle_min_emergency": 1.2    # Ancho mínimo evacuación
}

# ==================== ILUMINACIÓN ====================
LIGHTING_LEVELS = {
    "storage": 150,              # lux
    "operational_aisles": 200,
    "picking": 500,
    "offices": 500,
    "stairs": 150
}

# ==================== TRABAJADORES (estimación automática) ====================
def estimate_workers(total_area_m2: float, activity_type: str = "ecommerce") -> int:
    """Estimar trabajadores según superficie y tipo actividad"""
    ratios = {
        "ecommerce": 60,         # 1 trabajador cada 60m²
        "3pl": 80,               # Más automatizado
        "industrial": 100        # Mucho más automatizado
    }
    ratio = ratios.get(activity_type, 60)
    return max(10, int(total_area_m2 / ratio))

# ==================== CÁLCULOS AUXILIARES ====================
def calculate_rack_levels(clear_height: float) -> int:
    """Calcular niveles posibles según altura libre"""
    min_clearance = 0.5  # Espacio techo
    usable_height = clear_height - min_clearance
    level_height = RACK_STANDARDS["conventional"]["level_height"]
    return max(1, int(usable_height / level_height))

def calculate_storage_efficiency(occupied_area: float, total_area: float, office_area: float) -> float:
    """Eficiencia real = ocupado / (total - oficinas)"""
    usable_area = total_area - office_area
    if usable_area <= 0:
        return 0
    return round((occupied_area / usable_area) * 100, 2)