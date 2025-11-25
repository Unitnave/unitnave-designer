"""
UNITNAVE - Funciones de Fitness para Optimización

Este módulo contiene las funciones de evaluación utilizadas
por el algoritmo genético para puntuar layouts.

MÉTRICAS:
1. Capacidad de palets (maximizar)
2. Eficiencia de recorridos (minimizar distancias)
3. Accesibilidad de estanterías
4. Flujo logístico
5. Penalizaciones por colisiones
"""

import math
from typing import List, Dict, Tuple


# ==================== CÁLCULO DE PALETS ====================

def calculate_total_pallets(
    racks: List[Dict],
    pallet_length: float = 1.2,
    pallet_width: float = 0.8
) -> int:
    """
    Calcular capacidad total de palets
    
    Args:
        racks: Lista de estanterías con {length, depth, levels}
        pallet_length: Largo del palet (default EUR 1.2m)
        pallet_width: Ancho del palet (default EUR 0.8m)
    
    Returns:
        Total de palets que caben
    """
    total = 0
    
    for rack in racks:
        length = rack.get("length", 0)
        depth = rack.get("depth", 1.1)
        levels = rack.get("levels", 4)
        
        # Orientación óptima de palets
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
    """
    Calcular detalles de capacidad de una estantería
    """
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
    """
    Calcular distancia de recorrido típico para una estantería
    
    Recorrido: Muelle → Estantería → Expedición
    
    Args:
        rack: Estantería {x, z, length, depth}
        dock_positions: Lista de muelles [{x, z}]
        expedition_zone: Zona de expedición {x, z}
        use_manhattan: Usar distancia Manhattan (más realista)
    
    Returns:
        Distancia total del recorrido
    """
    # Centro de la estantería
    rack_center = (
        rack["x"] + rack.get("length", 5) / 2,
        rack["z"] + rack.get("depth", 1.1) / 2
    )
    
    dist_func = calculate_manhattan_distance if use_manhattan else calculate_distance
    
    # Distancia al muelle más cercano
    min_dock_dist = float('inf')
    for dock in dock_positions:
        dist = dist_func((dock["x"], dock["z"]), rack_center)
        min_dock_dist = min(min_dock_dist, dist)
    
    # Distancia a expedición
    exp_dist = dist_func(rack_center, (expedition_zone["x"], expedition_zone["z"]))
    
    return min_dock_dist + exp_dist


def calculate_avg_travel_distance(
    racks: List[Dict],
    dock_positions: List[Dict],
    expedition_zone: Dict
) -> float:
    """Calcular distancia promedio de recorrido para todas las estanterías"""
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
    """
    Distancia ponderada por capacidad
    
    Estanterías con más palets tienen más peso
    (porque se acceden más frecuentemente)
    """
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
    """
    Verificar si dos estanterías colisionan (incluyendo pasillo mínimo)
    
    Args:
        r1, r2: Estanterías {x, z, length, depth}
        min_aisle: Ancho mínimo de pasillo requerido
    
    Returns:
        True si hay colisión
    """
    margin = min_aisle / 2
    
    # Bounding box de r1 con margen
    r1_box = {
        "x_min": r1["x"] - margin,
        "x_max": r1["x"] + r1.get("length", 5) + margin,
        "z_min": r1["z"] - margin,
        "z_max": r1["z"] + r1.get("depth", 1.1) + margin
    }
    
    # Bounding box de r2
    r2_box = {
        "x_min": r2["x"],
        "x_max": r2["x"] + r2.get("length", 5),
        "z_min": r2["z"],
        "z_max": r2["z"] + r2.get("depth", 1.1)
    }
    
    # Verificar solapamiento
    x_overlap = not (r1_box["x_max"] < r2_box["x_min"] or r1_box["x_min"] > r2_box["x_max"])
    z_overlap = not (r1_box["z_max"] < r2_box["z_min"] or r1_box["z_min"] > r2_box["z_max"])
    
    return x_overlap and z_overlap


def count_collisions(racks: List[Dict], min_aisle: float = 2.8) -> int:
    """Contar número total de colisiones en el layout"""
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
    """Verificar si una estantería está fuera de los límites de la nave"""
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
    """
    Puntuar accesibilidad de una estantería
    
    Estanterías más cerca del pasillo principal = mejor score
    """
    rack_center_z = rack["z"] + rack.get("depth", 1.1) / 2
    distance_to_aisle = abs(rack_center_z - main_aisle_z)
    
    # Normalizar: 0 = muy lejos, 1 = en el pasillo
    max_distance = 20  # metros
    score = 1 - min(distance_to_aisle / max_distance, 1)
    
    return score


def calculate_layout_accessibility(
    racks: List[Dict],
    main_aisle_z: float
) -> float:
    """Calcular accesibilidad promedio del layout"""
    if not racks:
        return 0
    
    total_score = sum(
        calculate_accessibility_score(rack, main_aisle_z)
        for rack in racks
    )
    
    return total_score / len(racks)


# ==================== FITNESS COMBINADO ====================

def calculate_combined_fitness(
    racks: List[Dict],
    warehouse_dims: Dict,
    dock_positions: List[Dict],
    expedition_zone: Dict,
    forbidden_zones: List[Dict],
    config: Dict = None
) -> Dict:
    """
    Calcular fitness combinado del layout
    
    Args:
        racks: Lista de estanterías
        warehouse_dims: {length, width, height}
        dock_positions: [{x, z}]
        expedition_zone: {x, z}
        forbidden_zones: [{x_min, x_max, z_min, z_max}]
        config: Configuración opcional
    
    Returns:
        Dict con fitness total y componentes
    """
    cfg = config or {
        "weight_pallets": 0.5,
        "weight_distance": 0.3,
        "weight_accessibility": 0.2,
        "penalty_collision": 100,
        "penalty_violation": 50,
        "aisle_width": 2.8
    }
    
    # 1. Palets
    total_pallets = calculate_total_pallets(racks)
    max_pallets = warehouse_dims["length"] * warehouse_dims["width"] * 0.5  # Estimado
    pallet_score = min(1.0, total_pallets / max_pallets) if max_pallets > 0 else 0
    
    # 2. Distancia
    avg_distance = calculate_avg_travel_distance(racks, dock_positions, expedition_zone)
    max_distance = math.sqrt(warehouse_dims["length"]**2 + warehouse_dims["width"]**2)
    distance_score = 1 - min(avg_distance / max_distance, 1) if max_distance > 0 else 0
    
    # 3. Accesibilidad
    main_aisle_z = warehouse_dims["width"] / 2
    accessibility_score = calculate_layout_accessibility(racks, main_aisle_z)
    
    # 4. Penalizaciones
    collisions = count_collisions(racks, cfg["aisle_width"])
    violations = count_violations(racks, warehouse_dims, forbidden_zones)
    
    # Fitness final
    fitness = (
        cfg["weight_pallets"] * pallet_score * 1000 +
        cfg["weight_distance"] * distance_score * 1000 +
        cfg["weight_accessibility"] * accessibility_score * 1000 -
        collisions * cfg["penalty_collision"] -
        violations * cfg["penalty_violation"]
    )
    
    return {
        "fitness": max(0, fitness),
        "total_pallets": total_pallets,
        "pallet_score": pallet_score,
        "avg_distance": avg_distance,
        "distance_score": distance_score,
        "accessibility_score": accessibility_score,
        "collisions": collisions,
        "violations": violations,
        "components": {
            "pallets_contribution": cfg["weight_pallets"] * pallet_score * 1000,
            "distance_contribution": cfg["weight_distance"] * distance_score * 1000,
            "accessibility_contribution": cfg["weight_accessibility"] * accessibility_score * 1000,
            "collision_penalty": -collisions * cfg["penalty_collision"],
            "violation_penalty": -violations * cfg["penalty_violation"]
        }
    }
