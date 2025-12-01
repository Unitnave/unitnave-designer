"""
UNITNAVE - Constantes y Tablas de Normativa V5
Todos los defaults automáticos según industria real

ARCHIVO: backend/constants.py
ACCIÓN: REEMPLAZAR contenido completo
"""

from enum import Enum
from typing import Dict, List, Optional, Tuple

# ==================== ENUMS NUEVOS ====================

class Priority(str, Enum):
    CAPACITY = "capacity"
    BALANCE = "balance"
    OPERATIONS = "operations"

class WarehouseType(str, Enum):
    INDUSTRIAL = "industrial"
    ECOMMERCE = "ecommerce"
    LOGISTICS_3PL = "3pl"
    MASSIVE = "almacen_masivo"
    CROSSDOCK = "crossdock"
    COLD = "frio"

class RackOrientation(str, Enum):
    PARALLEL_LENGTH = "parallel_length"
    PARALLEL_WIDTH = "parallel_width"

class AisleStrategy(str, Enum):
    CENTRAL = "central"
    PERIMETER = "perimeter"
    MULTIPLE = "multiple"

# ==================== PALETS ====================
PALLET_TYPES = {
    "EUR": {"length": 1.2, "width": 0.8, "height": 1.5, "weight": 1000, "name": "Europalet"},
    "US": {"length": 1.2, "width": 1.0, "height": 1.5, "weight": 1200, "name": "Americano"},
    "CUSTOM": {"length": 0, "width": 0, "height": 0, "weight": 0, "name": "Personalizado"}
}

# ==================== ESTANTERÍAS ====================
RACK_STANDARDS = {
    "conventional": {
        "beam_length": 2.7,
        "depth": 1.1,
        "level_height": 1.75,
        "post_width": 0.1,
        "max_weight_level": 2000
    }
}

# ==================== PASILLOS ====================
AISLE_WIDTHS = {
    "transpaleta": 1.8,
    "apilador": 2.4,
    "retractil": 2.8,
    "contrapesada": 3.6,
    "trilateral": 1.9,
    "recogepedidos": 2.5
}

AISLE_TYPES = {
    "operational": lambda machinery: AISLE_WIDTHS.get(machinery, 2.8),
    "main": 4.5,
    "pedestrian": 1.5,
    "emergency": 1.2
}

# ==================== AISLE_STANDARDS (para ABC Zoning) ====================
# Estructura compatible con optimizer.py ABCZoneBuilder
AISLE_STANDARDS = {
    "transpaleta": {"width": 1.8},
    "apilador": {"width": 2.4},
    "retractil": {"width": 2.8},
    "contrapesada": {"width": 3.6},
    "trilateral": {"width": 1.9},
    "recogepedidos": {"width": 2.5},
    "main_aisle": {"width": 4.5}  # Pasillo principal/vertebral
}

# ==================== PALLET_SIZES (para ABC Zoning) ====================
# Dimensiones de palets para cálculos de profundidad de rack
PALLET_SIZES = {
    "EUR": {"length": 1.2, "width": 0.8, "depth": 1.1},  # depth = profundidad rack estándar
    "US": {"length": 1.2, "width": 1.0, "depth": 1.2}
}

# ==================== MUELLES (OPTIMIZADO V5) ====================
DOCK_STANDARDS = {
    "width": 3.5,
    "depth": 4.0,
    "height": 1.2,
    "maneuver_zone": 4.0,  # REDUCIDO de 12m a 4m para maximizar almacenamiento
    "separation": 1.0
}

# ==================== OFICINAS Y SERVICIOS ====================
OFFICE_STANDARDS = {
    "m2_per_worker": 2.0,
    "ceiling_height": 3.5,
    "min_area": 20.0,
    "break_room_m2_per_worker": 0.8,
    "locker_m2_per_worker": 1.2,
    "floor_options": ["ground", "mezzanine", "both"]
}

SERVICE_ROOMS = {
    "restroom": {"width": 3, "depth": 2, "per_workers": 25},
    "locker_room": {"width": 6, "depth": 5, "min_workers": 10},
    "break_room": {"width": 5, "depth": 4, "min_workers": 5},
    "stairs": {"width": 2, "depth": 4, "height_per_floor": 3.5},
    "elevator": {"width": 1.6, "depth": 1.8, "min_office_area": 50},
    "vertical_access": {"width": 3.5, "depth": 4, "includes": ["stairs", "elevator"]}
}

# ==================== ZONAS OPERATIVAS ====================
OPERATIONAL_ZONES = {
    "receiving": {"percentage": 0.025, "min_area": 30, "near": "docks"},
    "picking": {"percentage": 0.04, "min_area": 50, "location": "center"},
    "shipping": {"percentage": 0.025, "min_area": 30, "near": "docks"},
    "quality_control": {"percentage": 0.008, "min_area": 15, "optional": True},
    "returns": {"percentage": 0.01, "min_area": 20, "optional": True}
}

# ==================== INSTALACIONES TÉCNICAS ====================
TECHNICAL_ROOMS = {
    "electrical": {"width": 4, "depth": 2, "height": 3.0, "mandatory": True},
    "battery_charging": {
        "width": 8, 
        "depth": 6,
        "height": 3.5,
        "per_vehicles": 4,
        "distance_from_offices": 10
    }
}

# ==================== SERVICIOS (BAÑOS, VESTUARIOS, COMEDOR) ====================
SERVICE_STANDARDS = {
    "height": 3.0,  # Altura estándar de servicios
    "bathroom": {
        "width": 4,
        "depth": 3,
        "height": 3.0,
        "min_per_workers": 10  # 1 baño por cada 10 trabajadores
    },
    "changing_room": {
        "width": 6,
        "depth": 4,
        "height": 3.0,
        "locker_space": 0.5  # m² por taquilla
    },
    "canteen": {
        "width": 8,
        "depth": 6,
        "height": 3.0,
        "m2_per_worker": 1.5
    }
}

# ==================== SEGURIDAD Y NORMATIVA ====================
SAFETY_STANDARDS = {
    "min_aisle_width": 1.2,  # Ancho mínimo pasillo evacuación (m)
    "max_evacuation_distance": 50,  # Distancia máxima a salida (m)
    "min_exit_width": 0.8,  # Ancho mínimo puerta evacuación (m)
    "exits_per_1000m2": 1,  # Salidas por cada 1000m²
    "fire_resistance_minutes": 60  # Resistencia al fuego mínima
}

FIRE_SAFETY = {
    "extinguisher_distance": 15,
    "bie_distance": 25,
    "emergency_exit_distance": 50,
    "aisle_min_emergency": 1.2
}

# ==================== ILUMINACIÓN ====================
LIGHTING_LEVELS = {
    "storage": 150,
    "operational_aisles": 200,
    "picking": 500,
    "offices": 500,
    "stairs": 150
}

# ==================== EFICIENCIA (NUEVO V5) ====================
EFFICIENCY_THRESHOLDS = {
    "excellent": 0.75,
    "good": 0.65,
    "acceptable": 0.50,
    "poor": 0.40,
    "storage_bonus": 0.70,
    "storage_penalty": 0.50
}

# ==================== PESOS FITNESS POR PRIORIDAD (NUEVO V5) ====================
FITNESS_WEIGHTS = {
    "capacity": {
        "pallets": 0.60,
        "distance": 0.15,
        "accessibility": 0.10,
        "efficiency": 0.15
    },
    "balance": {
        "pallets": 0.40,
        "distance": 0.25,
        "accessibility": 0.20,
        "efficiency": 0.15
    },
    "operations": {
        "pallets": 0.25,
        "distance": 0.35,
        "accessibility": 0.25,
        "efficiency": 0.15
    }
}

# ==================== CONFIGURACIÓN ESCENARIOS (NUEVO V5) ====================
# ==================== LÍMITES DE OPTIMIZACIÓN ====================
OPTIMIZATION_CONSTRAINTS = {
    "min_area_for_abc": 400.0,        # Mínimo m² para aplicar zonas ABC
    "min_depth_for_abc": 20.0,        # Mínimo fondo para dividir en 3 zonas
    "min_width_for_multi_aisle": 15.0 # Mínimo ancho para pasillos múltiples
}

# ==================== ZONA A DINÁMICA ====================
# Reglas profesionales para dimensionar Zona A según profundidad real
ZONE_A_DYNAMIC_RULES = {
    "small": {"max_depth": 40, "a_ratio": 0.40},   # Naves pequeñas: A generosa
    "medium": {"max_depth": 70, "a_ratio": 0.30}, # Naves medias: equilibrio
    "large": {"max_depth": 999, "a_ratio": 0.20}  # Naves grandes: A compacta
}

# Boost por alta rotación (ajuste fino)
HIGH_ROTATION_BOOST = {
    "threshold_1": 0.50,  # Si high_rotation >= 50% → +5% a zona A
    "boost_1": 0.05,
    "threshold_2": 0.70,  # Si high_rotation >= 70% → +10% adicional
    "boost_2": 0.05
}

# Penalización por desalineación de orientación entre zonas
ORIENTATION_MISMATCH_PENALTY = 0.25  # -25% al score si A y B tienen orientaciones distintas


def compute_zone_proportions(depth: float, high_rotation_pct: float = 0.20) -> Tuple[float, float, float]:
    """
    Calcula proporciones dinámicas de zonas ABC según profundidad real.
    
    Esto es EXACTAMENTE lo que haría un consultor de Miebach o Swisslog.
    
    Args:
        depth: Profundidad de la zona de almacenamiento (metros)
        high_rotation_pct: Porcentaje de productos de alta rotación (0-1)
    
    Returns:
        Tuple (a_ratio, b_ratio, c_ratio) que suman 1.0
    """
    # Determinar ratio base de zona A según profundidad
    if depth < ZONE_A_DYNAMIC_RULES["small"]["max_depth"]:
        a_ratio = ZONE_A_DYNAMIC_RULES["small"]["a_ratio"]
    elif depth < ZONE_A_DYNAMIC_RULES["medium"]["max_depth"]:
        a_ratio = ZONE_A_DYNAMIC_RULES["medium"]["a_ratio"]
    else:
        a_ratio = ZONE_A_DYNAMIC_RULES["large"]["a_ratio"]
    
    # Boost por alta rotación
    if high_rotation_pct >= HIGH_ROTATION_BOOST["threshold_2"]:
        a_ratio += HIGH_ROTATION_BOOST["boost_1"] + HIGH_ROTATION_BOOST["boost_2"]
    elif high_rotation_pct >= HIGH_ROTATION_BOOST["threshold_1"]:
        a_ratio += HIGH_ROTATION_BOOST["boost_1"]
    
    # Limitar A al 50% máximo
    a_ratio = min(a_ratio, 0.50)
    
    # Distribuir resto entre B y C (55/45 para favorecer B ligeramente)
    remaining = 1.0 - a_ratio
    b_ratio = remaining * 0.55
    c_ratio = remaining * 0.45
    
    return (round(a_ratio, 2), round(b_ratio, 2), round(c_ratio, 2))


def calculate_orientation_penalty(orient_a: str, orient_b: str) -> float:
    """
    Calcula penalización por orientaciones mixtas entre zonas.
    
    Evita layouts "patchwork" donde A tiene racks longitudinales
    y B tiene transversales, creando muros internos.
    
    Returns:
        0.0 si orientaciones coinciden, ORIENTATION_MISMATCH_PENALTY si no
    """
    if orient_a == orient_b:
        return 0.0
    return ORIENTATION_MISMATCH_PENALTY

# ==================== ABC ZONING ====================
ABC_ZONE_CONFIGS = {
    "default": {
        "A": {"depth_pct": 0.20, "priority": "speed", "description": "Alta rotación (<48h)"},
        "B": {"depth_pct": 0.40, "priority": "balance", "description": "Rotación media"},
        "C": {"depth_pct": 0.40, "priority": "density", "description": "Baja rotación, densificar"}
    },
    "ecommerce": {
        "A": {"depth_pct": 0.35, "priority": "speed", "description": "Picking intensivo"},
        "B": {"depth_pct": 0.35, "priority": "balance", "description": "Stock intermedio"},
        "C": {"depth_pct": 0.30, "priority": "density", "description": "Reserva"}
    },
    "almacen_masivo": {
        "A": {"depth_pct": 0.10, "priority": "speed", "description": "Salida inmediata"},
        "B": {"depth_pct": 0.30, "priority": "balance", "description": "Stock activo"},
        "C": {"depth_pct": 0.60, "priority": "density", "description": "Almacén profundo"}
    },
    "3pl": {
        "A": {"depth_pct": 0.25, "priority": "speed", "description": "Clientes premium"},
        "B": {"depth_pct": 0.45, "priority": "balance", "description": "Flujo estándar"},
        "C": {"depth_pct": 0.30, "priority": "density", "description": "Long-tail"}
    }
}

# Configuración de densificación por zona
ZONE_RACK_STRATEGIES = {
    "speed": {
        "aisle_width_modifier": 1.0,      # Pasillos normales
        "rack_depth": "single",            # Racks simples (acceso directo)
        "allow_double_deep": False,
        "preferred_orientation": "parallel_to_docks"  # Minimiza distancia
    },
    "balance": {
        "aisle_width_modifier": 1.0,
        "rack_depth": "single",
        "allow_double_deep": False,
        "preferred_orientation": "inherit"  # Hereda de zona A
    },
    "density": {
        "aisle_width_modifier": 0.85,      # Pasillos VNA (-15%)
        "rack_depth": "double",            # Racks doble profundidad
        "allow_double_deep": True,
        "preferred_orientation": "inherit"  # Hereda para alineación
    }
}

# Penalización por desalineación de pasillos
ALIGNMENT_PENALTY = 0.15  # -15% fitness si pasillos no alinean

MACRO_SCENARIO_CONFIGS = {
    "ecommerce": {
        # E-commerce: perpendicular a muelles para picking rápido
        "orientations": [RackOrientation.PARALLEL_WIDTH, RackOrientation.PARALLEL_LENGTH],
        "aisle_strategies": [AisleStrategy.MULTIPLE, AisleStrategy.CENTRAL],
        "abc_zones": True,
        "high_rotation_pct": 0.30
    },
    "almacen_masivo": {
        # Almacén masivo: puede usar paralelo para máxima densidad
        "orientations": [RackOrientation.PARALLEL_WIDTH, RackOrientation.PARALLEL_LENGTH],
        "aisle_strategies": [AisleStrategy.CENTRAL],
        "abc_zones": False,
        "high_rotation_pct": 0.10
    },
    "crossdock": {
        # Cross-dock: perpendicular para flujo rápido
        "orientations": [RackOrientation.PARALLEL_WIDTH],
        "aisle_strategies": [AisleStrategy.CENTRAL, AisleStrategy.PERIMETER],
        "abc_zones": False,
        "high_rotation_pct": 0.80
    },
    "frio": {
        # Frío: perpendicular para minimizar recorridos
        "orientations": [RackOrientation.PARALLEL_WIDTH, RackOrientation.PARALLEL_LENGTH],
        "aisle_strategies": [AisleStrategy.CENTRAL],
        "abc_zones": True,
        "high_rotation_pct": 0.20
    },
    "3pl": {
        # 3PL: ambas orientaciones según cliente
        "orientations": [RackOrientation.PARALLEL_WIDTH, RackOrientation.PARALLEL_LENGTH],
        "aisle_strategies": [AisleStrategy.CENTRAL, AisleStrategy.MULTIPLE],
        "abc_zones": True,
        "high_rotation_pct": 0.25
    },
    "industrial": {
        # Industrial: PERPENDICULAR a muelles como estándar
        "orientations": [RackOrientation.PARALLEL_WIDTH, RackOrientation.PARALLEL_LENGTH],
        "aisle_strategies": [AisleStrategy.CENTRAL],
        "abc_zones": False,
        "high_rotation_pct": 0.15
    }
}

# ==================== FUNCIONES AUXILIARES ====================

def estimate_workers(total_area_m2: float, activity_type: str = "ecommerce") -> int:
    """Estimar trabajadores según superficie y tipo actividad"""
    ratios = {
        "ecommerce": 60,
        "3pl": 80,
        "industrial": 100,
        "almacen_masivo": 120,
        "crossdock": 70,
        "frio": 90
    }
    ratio = ratios.get(activity_type, 80)
    return max(10, int(total_area_m2 / ratio))


def calculate_rack_levels(clear_height: float, pallet_height: float = 1.5) -> int:
    """Calcular niveles posibles según altura libre"""
    min_clearance = 0.5
    usable_height = clear_height - min_clearance
    level_height = pallet_height + 0.25  # Palet + margen
    return max(1, int(usable_height / level_height))


def calculate_storage_efficiency(occupied_area: float, total_area: float, fixed_area: float = 0) -> float:
    """Eficiencia real = ocupado / (total - fijas)"""
    usable_area = total_area - fixed_area
    if usable_area <= 0:
        return 0
    return round((occupied_area / usable_area) * 100, 2)


def get_fitness_weights(priority: str = "balance") -> Dict[str, float]:
    """Obtener pesos de fitness según prioridad"""
    return FITNESS_WEIGHTS.get(priority, FITNESS_WEIGHTS["balance"])


def get_macro_config(warehouse_type: str = "industrial") -> Dict:
    """Obtener configuración de escenarios según tipo de almacén"""
    return MACRO_SCENARIO_CONFIGS.get(warehouse_type, MACRO_SCENARIO_CONFIGS["industrial"])


def calculate_services_block(workers: int) -> Dict:
    """Calcular bloque compacto de servicios según trabajadores"""
    needs_lockers = workers >= SERVICE_ROOMS["locker_room"]["min_workers"]
    num_restrooms = max(2, int(workers / SERVICE_ROOMS["restroom"]["per_workers"]) + 1)
    
    # Calcular dimensiones del bloque compacto
    restroom_area = num_restrooms * SERVICE_ROOMS["restroom"]["width"] * SERVICE_ROOMS["restroom"]["depth"]
    locker_area = SERVICE_ROOMS["locker_room"]["width"] * SERVICE_ROOMS["locker_room"]["depth"] if needs_lockers else 0
    break_area = SERVICE_ROOMS["break_room"]["width"] * SERVICE_ROOMS["break_room"]["depth"]
    vertical_area = SERVICE_ROOMS["vertical_access"]["width"] * SERVICE_ROOMS["vertical_access"]["depth"]
    
    total_area = restroom_area + locker_area + break_area + vertical_area
    
    # Aproximar a un rectángulo
    block_width = 8  # Fijo para mantener proporciones
    block_depth = max(10, total_area / block_width)
    
    return {
        "width": block_width,
        "depth": round(block_depth, 1),
        "area": round(total_area, 1),
        "components": {
            "restrooms": num_restrooms,
            "lockers": needs_lockers,
            "break_room": True,
            "vertical_access": True
        }
    }


def calculate_operational_zones_area(total_area: float, n_docks: int) -> Dict:
    """Calcular áreas de zonas operativas proporcional a muelles"""
    base_receiving = total_area * OPERATIONAL_ZONES["receiving"]["percentage"]
    base_shipping = total_area * OPERATIONAL_ZONES["shipping"]["percentage"]
    base_picking = total_area * OPERATIONAL_ZONES["picking"]["percentage"]
    
    # Ajustar por número de muelles
    dock_factor = max(1, n_docks / 4)
    
    return {
        "receiving": max(OPERATIONAL_ZONES["receiving"]["min_area"], base_receiving * dock_factor),
        "shipping": max(OPERATIONAL_ZONES["shipping"]["min_area"], base_shipping * dock_factor),
        "picking": max(OPERATIONAL_ZONES["picking"]["min_area"], base_picking)
    }


def get_abc_config(warehouse_type: str) -> Dict:
    """Obtiene configuración ABC según tipo de almacén"""
    return ABC_ZONE_CONFIGS.get(warehouse_type, ABC_ZONE_CONFIGS["default"])


def get_zone_strategy(zone_priority: str) -> Dict:
    """Obtiene estrategia de racks para una zona"""
    return ZONE_RACK_STRATEGIES.get(zone_priority, ZONE_RACK_STRATEGIES["balance"])