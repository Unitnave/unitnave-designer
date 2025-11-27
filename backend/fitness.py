"""
UNITNAVE - Funciones de Fitness para Optimización V5

MEJORAS V5:
- FitnessResult dataclass con desglose completo
- Evaluación multi-criterio con pesos configurables
- Eficiencia de almacenamiento con modificadores
- Comparación de escenarios automática

ARCHIVO: backend/fitness.py
ACCIÓN: REEMPLAZAR contenido completo
"""

import math
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field


# ==================== CONFIGURACIÓN ====================

DEFAULT_WEIGHTS = {
    "pallets": 0.40,
    "distance": 0.25,
    "accessibility": 0.20,
    "efficiency": 0.15
}

EFFICIENCY_THRESHOLDS = {
    "excellent": 0.75,
    "good": 0.65,
    "acceptable": 0.50,
    "poor": 0.40
}

EFFICIENCY_MODIFIERS = {
    "excellent": 1.3,
    "good": 1.15,
    "acceptable": 1.0,
    "poor": 0.85,
    "critical": 0.7
}


# ==================== DATA CLASSES ====================

@dataclass
class FitnessResult:
    """Resultado completo de evaluación de fitness"""
    total_score: float
    normalized_score: float  # 0-100
    
    # Componentes individuales
    pallets_score: float = 0
    distance_score: float = 0
    accessibility_score: float = 0
    efficiency_score: float = 0
    
    # Métricas brutas
    total_pallets: int = 0
    avg_distance: float = 0
    storage_area: float = 0
    storage_efficiency: float = 0
    
    # Penalizaciones
    collisions: int = 0
    violations: int = 0
    collision_penalty: float = 0
    violation_penalty: float = 0
    
    # Modificadores
    efficiency_modifier: float = 1.0
    efficiency_status: str = "acceptable"
    
    # Desglose
    breakdown: Dict = field(default_factory=dict)


# ==================== CÁLCULO DE PALETS ====================

def calculate_total_pallets(
    racks: List[Dict],
    pallet_length: float = 1.2,
    pallet_width: float = 0.8
) -> int:
    """Calcular capacidad total de palets"""
    total = 0
    
    for rack in racks:
        length = rack.get("length", 0)
        depth = rack.get("depth", 1.1)
        levels = rack.get("levels", 4)
        
        option1 = int(length / pallet_length) * int(depth / pallet_width)
        option2 = int(length / pallet_width) * int(depth / pallet_length)
        
        pallets_per_level = max(option1, option2)
        total += pallets_per_level * levels
    
    return total


def calculate_pallets_per_rack(
    rack: Dict,
    pallet_length: float = 1.2,
    pallet_width: float = 0.8
) -> Dict:
    """Calcular detalles de capacidad de una estantería"""
    length = rack.get("length", 0)
    depth = rack.get("depth", 1.1)
    levels = rack.get("levels", 4)
    
    option1 = int(length / pallet_length) * int(depth / pallet_width)
    option2 = int(length / pallet_width) * int(depth / pallet_length)
    
    pallets_per_level = max(option1, option2)
    
    return {
        "pallets_per_level": pallets_per_level,
        "total_pallets": pallets_per_level * levels,
        "levels": levels,
        "best_orientation": "longitudinal" if option1 >= option2 else "transversal"
    }


def calculate_storage_area(racks: List[Dict]) -> float:
    """Calcular área total ocupada por estanterías"""
    total = 0
    for rack in racks:
        length = rack.get("length", 0)
        depth = rack.get("depth", 1.1)
        total += length * depth
    return total


# ==================== CÁLCULO DE DISTANCIAS ====================

def calculate_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Distancia euclidiana entre dos puntos"""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)


def calculate_manhattan_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Distancia Manhattan (más realista para movimientos de carretilla)"""
    return abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])


def calculate_travel_distance(
    rack: Dict,
    dock_positions: List[Dict],
    expedition_zone: Dict,
    use_manhattan: bool = True
) -> float:
    """Calcular distancia de recorrido típico para una estantería"""
    rack_center = (
        rack["x"] + rack.get("length", 5) / 2,
        rack["z"] + rack.get("depth", 1.1) / 2
    )
    
    dist_func = calculate_manhattan_distance if use_manhattan else calculate_distance
    
    min_dock_dist = float('inf')
    for dock in dock_positions:
        dist = dist_func((dock["x"], dock["z"]), rack_center)
        min_dock_dist = min(min_dock_dist, dist)
    
    exp_dist = dist_func(rack_center, (expedition_zone["x"], expedition_zone["z"]))
    
    return min_dock_dist + exp_dist


def calculate_avg_travel_distance(
    racks: List[Dict],
    dock_positions: List[Dict],
    expedition_zone: Dict
) -> float:
    """Calcular distancia promedio de recorrido"""
    if not racks or not dock_positions:
        return float('inf')
    
    total_distance = sum(
        calculate_travel_distance(rack, dock_positions, expedition_zone)
        for rack in racks
    )
    
    return total_distance / len(racks)


def calculate_weighted_travel_distance(
    racks: List[Dict],
    dock_positions: List[Dict],
    expedition_zone: Dict,
    pallet_length: float = 1.2,
    pallet_width: float = 0.8
) -> float:
    """Distancia ponderada por capacidad"""
    if not racks or not dock_positions:
        return float('inf')
    
    total_weighted = 0
    total_pallets = 0
    
    for rack in racks:
        pallets = calculate_pallets_per_rack(rack, pallet_length, pallet_width)["total_pallets"]
        distance = calculate_travel_distance(rack, dock_positions, expedition_zone)
        
        total_weighted += distance * pallets
        total_pallets += pallets
    
    return total_weighted / total_pallets if total_pallets > 0 else float('inf')


# ==================== DETECCIÓN DE COLISIONES ====================

def check_collision(r1: Dict, r2: Dict, min_aisle: float = 2.8) -> bool:
    """Verificar si dos estanterías colisionan"""
    margin = min_aisle / 2
    
    r1_box = {
        "x_min": r1["x"] - margin,
        "x_max": r1["x"] + r1.get("length", 5) + margin,
        "z_min": r1["z"] - margin,
        "z_max": r1["z"] + r1.get("depth", 1.1) + margin
    }
    
    r2_box = {
        "x_min": r2["x"],
        "x_max": r2["x"] + r2.get("length", 5),
        "z_min": r2["z"],
        "z_max": r2["z"] + r2.get("depth", 1.1)
    }
    
    x_overlap = not (r1_box["x_max"] < r2_box["x_min"] or r1_box["x_min"] > r2_box["x_max"])
    z_overlap = not (r1_box["z_max"] < r2_box["z_min"] or r1_box["z_min"] > r2_box["z_max"])
    
    return x_overlap and z_overlap


def count_collisions(racks: List[Dict], min_aisle: float = 2.8) -> int:
    """Contar número total de colisiones"""
    collisions = 0
    for i, r1 in enumerate(racks):
        for r2 in racks[i+1:]:
            if check_collision(r1, r2, min_aisle):
                collisions += 1
    return collisions


def get_collision_pairs(racks: List[Dict], min_aisle: float = 2.8) -> List[Tuple[int, int]]:
    """Obtener pares de estanterías que colisionan"""
    pairs = []
    for i, r1 in enumerate(racks):
        for j, r2 in enumerate(racks[i+1:], i+1):
            if check_collision(r1, r2, min_aisle):
                pairs.append((i, j))
    return pairs


# ==================== VERIFICACIÓN DE LÍMITES ====================

def is_out_of_bounds(rack: Dict, warehouse_dims: Dict) -> bool:
    """Verificar si una estantería está fuera de los límites"""
    x_end = rack["x"] + rack.get("length", 5)
    z_end = rack["z"] + rack.get("depth", 1.1)
    
    if rack["x"] < 0 or x_end > warehouse_dims["length"]:
        return True
    if rack["z"] < 0 or z_end > warehouse_dims["width"]:
        return True
    return False


def is_in_forbidden_zone(rack: Dict, zone: Dict) -> bool:
    """Verificar si una estantería está en una zona prohibida"""
    rack_box = {
        "x_min": rack["x"],
        "x_max": rack["x"] + rack.get("length", 5),
        "z_min": rack["z"],
        "z_max": rack["z"] + rack.get("depth", 1.1)
    }
    
    x_overlap = not (rack_box["x_max"] < zone["x_min"] or rack_box["x_min"] > zone["x_max"])
    z_overlap = not (rack_box["z_max"] < zone["z_min"] or rack_box["z_min"] > zone["z_max"])
    
    return x_overlap and z_overlap


def count_violations(
    racks: List[Dict],
    warehouse_dims: Dict,
    forbidden_zones: List[Dict]
) -> int:
    """Contar violaciones de límites y zonas prohibidas"""
    violations = 0
    
    for rack in racks:
        if is_out_of_bounds(rack, warehouse_dims):
            violations += 1
        
        for zone in forbidden_zones:
            if is_in_forbidden_zone(rack, zone):
                violations += 1
                break
    
    return violations


# ==================== ACCESIBILIDAD ====================

def calculate_accessibility_score(rack: Dict, main_aisle_z: float, aisle_width: float = 4.5) -> float:
    """Puntuar accesibilidad de una estantería"""
    rack_center_z = rack["z"] + rack.get("depth", 1.1) / 2
    distance_to_aisle = abs(rack_center_z - main_aisle_z)
    
    max_distance = 20
    score = 1 - min(distance_to_aisle / max_distance, 1)
    
    return score


def calculate_layout_accessibility(racks: List[Dict], main_aisle_z: float) -> float:
    """Calcular accesibilidad promedio del layout"""
    if not racks:
        return 0
    
    total_score = sum(
        calculate_accessibility_score(rack, main_aisle_z)
        for rack in racks
    )
    
    return total_score / len(racks)


# ==================== EFICIENCIA DE ALMACENAMIENTO (NUEVO V5) ====================

def calculate_storage_efficiency(
    racks: List[Dict],
    warehouse_dims: Dict,
    fixed_area: float = 0
) -> Dict:
    """
    Calcular eficiencia de almacenamiento con estado
    
    Returns:
        Dict con efficiency, modifier, status
    """
    total_area = warehouse_dims["length"] * warehouse_dims["width"]
    available_area = total_area - fixed_area
    
    if available_area <= 0:
        return {
            "efficiency": 0,
            "modifier": EFFICIENCY_MODIFIERS["critical"],
            "status": "critical",
            "storage_area": 0,
            "available_area": 0
        }
    
    storage_area = calculate_storage_area(racks)
    efficiency = storage_area / available_area
    
    # Determinar estado y modificador
    if efficiency >= EFFICIENCY_THRESHOLDS["excellent"]:
        status = "excellent"
    elif efficiency >= EFFICIENCY_THRESHOLDS["good"]:
        status = "good"
    elif efficiency >= EFFICIENCY_THRESHOLDS["acceptable"]:
        status = "acceptable"
    elif efficiency >= EFFICIENCY_THRESHOLDS["poor"]:
        status = "poor"
    else:
        status = "critical"
    
    return {
        "efficiency": round(efficiency * 100, 2),
        "modifier": EFFICIENCY_MODIFIERS[status],
        "status": status,
        "storage_area": round(storage_area, 2),
        "available_area": round(available_area, 2)
    }


# ==================== FITNESS COMBINADO V5 ====================

def calculate_fitness(
    racks: List[Dict],
    warehouse_dims: Dict,
    dock_positions: List[Dict],
    expedition_zone: Dict,
    forbidden_zones: List[Dict] = None,
    fixed_area: float = 0,
    weights: Dict = None,
    aisle_width: float = 2.8,
    zone_orientations: Dict = None  # NUEVO: {"A": "parallel_length", "B": "parallel_width", ...}
) -> FitnessResult:
    """
    Calcular fitness completo del layout (V5.1)
    
    Args:
        racks: Lista de estanterías {x, z, length, depth, levels}
        warehouse_dims: {length, width, height}
        dock_positions: [{x, z}]
        expedition_zone: {x, z}
        forbidden_zones: [{x_min, x_max, z_min, z_max}]
        fixed_area: Área ocupada por elementos fijos
        weights: Pesos personalizados para cada componente
        aisle_width: Ancho mínimo de pasillo
        zone_orientations: Orientaciones por zona ABC para penalización
    
    Returns:
        FitnessResult con score y desglose completo
    """
    forbidden_zones = forbidden_zones or []
    weights = weights or DEFAULT_WEIGHTS
    
    # 1. PALETS
    total_pallets = calculate_total_pallets(racks)
    max_possible_pallets = (warehouse_dims["length"] * warehouse_dims["width"]) / 1.5  # Estimación
    pallet_score = min(1.0, total_pallets / max_possible_pallets) if max_possible_pallets > 0 else 0
    
    # 2. DISTANCIA
    if racks and dock_positions and expedition_zone:
        avg_distance = calculate_avg_travel_distance(racks, dock_positions, expedition_zone)
        max_distance = math.sqrt(warehouse_dims["length"]**2 + warehouse_dims["width"]**2) * 2
        distance_score = 1 - min(avg_distance / max_distance, 1) if max_distance > 0 else 0
    else:
        avg_distance = 0
        distance_score = 0
    
    # 3. ACCESIBILIDAD
    main_aisle_z = warehouse_dims["width"] / 2
    accessibility_score = calculate_layout_accessibility(racks, main_aisle_z)
    
    # 4. EFICIENCIA
    efficiency_data = calculate_storage_efficiency(racks, warehouse_dims, fixed_area)
    efficiency_score = efficiency_data["efficiency"] / 100
    efficiency_modifier = efficiency_data["modifier"]
    
    # 5. PENALIZACIONES
    collisions = count_collisions(racks, aisle_width)
    violations = count_violations(racks, warehouse_dims, forbidden_zones)
    
    collision_penalty = collisions * 100
    violation_penalty = violations * 50
    
    # 5.1 PENALIZACIÓN POR ORIENTACIÓN MIXTA (NUEVO V5.1)
    orientation_penalty = 0.0
    if zone_orientations:
        orient_a = zone_orientations.get("A")
        orient_b = zone_orientations.get("B")
        orient_c = zone_orientations.get("C")
        
        # Penalizar si A y B tienen orientaciones distintas
        if orient_a and orient_b and orient_a != orient_b:
            orientation_penalty = 0.25  # -25% del score base
        # Penalizar también si B y C difieren (menos grave)
        if orient_b and orient_c and orient_b != orient_c:
            orientation_penalty += 0.10  # -10% adicional
    
    # 6. SCORE FINAL
    base_score = (
        weights["pallets"] * pallet_score * 1000 +
        weights["distance"] * distance_score * 1000 +
        weights["accessibility"] * accessibility_score * 1000 +
        weights["efficiency"] * efficiency_score * 1000
    )
    
    # Aplicar modificador de eficiencia y penalizaciones
    total_score = (base_score * efficiency_modifier) - collision_penalty - violation_penalty
    
    # Aplicar penalización por orientación mixta (NUEVO)
    if orientation_penalty > 0:
        total_score *= (1 - orientation_penalty)
    
    total_score = max(0, total_score)
    
    # Normalizar a 0-100
    normalized_score = min(100, total_score / 40)  # 4000 max teórico
    
    return FitnessResult(
        total_score=round(total_score, 2),
        normalized_score=round(normalized_score, 2),
        
        pallets_score=round(pallet_score * 100, 2),
        distance_score=round(distance_score * 100, 2),
        accessibility_score=round(accessibility_score * 100, 2),
        efficiency_score=round(efficiency_score * 100, 2),
        
        total_pallets=total_pallets,
        avg_distance=round(avg_distance, 2),
        storage_area=efficiency_data["storage_area"],
        storage_efficiency=efficiency_data["efficiency"],
        
        collisions=collisions,
        violations=violations,
        collision_penalty=collision_penalty,
        violation_penalty=violation_penalty,
        
        efficiency_modifier=efficiency_modifier,
        efficiency_status=efficiency_data["status"],
        
        breakdown={
            "pallets_contribution": round(weights["pallets"] * pallet_score * 1000, 2),
            "distance_contribution": round(weights["distance"] * distance_score * 1000, 2),
            "accessibility_contribution": round(weights["accessibility"] * accessibility_score * 1000, 2),
            "efficiency_contribution": round(weights["efficiency"] * efficiency_score * 1000, 2),
            "efficiency_modifier_effect": round((efficiency_modifier - 1) * base_score, 2),
            "orientation_penalty": round(orientation_penalty * 100, 1),  # NUEVO
            "total_penalties": round(collision_penalty + violation_penalty, 2)
        }
    )


def calculate_combined_fitness(
    racks: List[Dict],
    warehouse_dims: Dict,
    dock_positions: List[Dict],
    expedition_zone: Dict,
    forbidden_zones: List[Dict],
    config: Dict = None
) -> Dict:
    """
    Wrapper para compatibilidad con código existente
    Llama a calculate_fitness y devuelve Dict
    """
    cfg = config or {
        "weight_pallets": 0.5,
        "weight_distance": 0.3,
        "weight_accessibility": 0.2,
        "penalty_collision": 100,
        "penalty_violation": 50,
        "aisle_width": 2.8
    }
    
    weights = {
        "pallets": cfg.get("weight_pallets", 0.5),
        "distance": cfg.get("weight_distance", 0.3),
        "accessibility": cfg.get("weight_accessibility", 0.2),
        "efficiency": 0.0  # No incluido en versión legacy
    }
    
    result = calculate_fitness(
        racks=racks,
        warehouse_dims=warehouse_dims,
        dock_positions=dock_positions,
        expedition_zone=expedition_zone,
        forbidden_zones=forbidden_zones,
        weights=weights,
        aisle_width=cfg.get("aisle_width", 2.8)
    )
    
    return {
        "fitness": result.total_score,
        "total_pallets": result.total_pallets,
        "pallet_score": result.pallets_score / 100,
        "avg_distance": result.avg_distance,
        "distance_score": result.distance_score / 100,
        "accessibility_score": result.accessibility_score / 100,
        "collisions": result.collisions,
        "violations": result.violations,
        "components": result.breakdown
    }


# ==================== COMPARACIÓN DE ESCENARIOS (NUEVO V5) ====================

def compare_scenarios(scenarios: List[Dict]) -> List[Dict]:
    """
    Comparar múltiples escenarios y ordenar por fitness
    
    Args:
        scenarios: Lista de {name, racks, warehouse_dims, dock_positions, expedition_zone, ...}
    
    Returns:
        Lista ordenada con ranking y análisis
    """
    results = []
    
    for scenario in scenarios:
        fitness = calculate_fitness(
            racks=scenario.get("racks", []),
            warehouse_dims=scenario["warehouse_dims"],
            dock_positions=scenario.get("dock_positions", []),
            expedition_zone=scenario.get("expedition_zone", {"x": 0, "z": 0}),
            forbidden_zones=scenario.get("forbidden_zones", []),
            fixed_area=scenario.get("fixed_area", 0),
            weights=scenario.get("weights"),
            aisle_width=scenario.get("aisle_width", 2.8)
        )
        
        results.append({
            "name": scenario.get("name", "Unknown"),
            "config": scenario.get("config", {}),
            "fitness": fitness,
            "score": fitness.normalized_score,
            "pallets": fitness.total_pallets,
            "efficiency": fitness.storage_efficiency
        })
    
    # Ordenar por score descendente
    results.sort(key=lambda x: x["score"], reverse=True)
    
    # Añadir ranking
    for i, result in enumerate(results):
        result["rank"] = i + 1
        result["is_best"] = i == 0
    
    return results
