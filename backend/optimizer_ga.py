"""
UNITNAVE - Optimizador con Algoritmo Genético
Versión 4.0

OBJETIVOS:
1. MAXIMIZAR capacidad de palets
2. MINIMIZAR distancia de recorridos (muelle → estantería → expedición)

ALGORITMO:
- Población de layouts (cromosomas)
- Fitness multiobjetivo (palets + recorridos)
- Selección por torneo
- Cruce de layouts
- Mutación de posiciones
- Evolución por N generaciones

Autor: UNITNAVE Team
"""

import uuid
import math
import random
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime
from copy import deepcopy

from constants import AISLE_WIDTHS, PALLET_TYPES, DOCK_STANDARDS
from models import (
    WarehouseInput, OptimizationResult, WarehouseElement,
    ElementPosition, ElementDimensions, CapacityResult,
    SurfaceSummary, ValidationItem
)


# ==================== CONFIGURACIÓN GA ====================

@dataclass
class GAConfig:
    """Configuración del algoritmo genético"""
    population_size: int = 50
    generations: int = 100
    mutation_rate: float = 0.15
    crossover_rate: float = 0.8
    elitism_count: int = 5
    tournament_size: int = 3
    
    # Pesos del fitness (deben sumar 1.0)
    weight_pallets: float = 0.6      # Peso para maximizar palets
    weight_distance: float = 0.4     # Peso para minimizar distancias
    
    # Penalizaciones
    collision_penalty: float = 1000
    out_of_bounds_penalty: float = 500


# ==================== CROMOSOMA (LAYOUT) ====================

@dataclass
class Chromosome:
    """Un layout completo como cromosoma"""
    genes: List[Dict]  # Lista de estanterías con posición
    fitness: float = 0.0
    pallets: int = 0
    avg_distance: float = 0.0
    
    def copy(self) -> 'Chromosome':
        return Chromosome(
            genes=deepcopy(self.genes),
            fitness=self.fitness,
            pallets=self.pallets,
            avg_distance=self.avg_distance
        )


# ==================== OPTIMIZADOR GA ====================

class GeneticOptimizer:
    """
    Optimizador con Algoritmo Genético
    
    Flujo:
    1. Generar población inicial
    2. Evaluar fitness de cada cromosoma
    3. Selección de padres
    4. Cruce y mutación
    5. Nueva generación
    6. Repetir hasta convergencia
    """
    
    def __init__(self, input_data: WarehouseInput, config: GAConfig = None):
        self.input = input_data
        self.config = config or GAConfig()
        
        self.dims = {
            "length": input_data.length,
            "width": input_data.width,
            "height": input_data.height
        }
        
        self.aisle_width = AISLE_WIDTHS.get(input_data.machinery, 2.8)
        
        pallet = PALLET_TYPES.get(input_data.pallet_type, PALLET_TYPES["EUR"])
        self.pallet = {
            "length": pallet["length"],
            "width": pallet["width"],
            "height": getattr(input_data, 'pallet_height', None) or pallet["height"]
        }
        
        # Calcular niveles máximos
        level_height = self.pallet["height"] + 0.25
        self.max_levels = max(1, int((self.dims["height"] - 0.5) / level_height))
        
        # Zonas fijas (muelles, oficinas, servicios)
        self.fixed_zones = []
        self.dock_positions = []
        self.expedition_zone = None
        
        # Estadísticas
        self.generation_history = []
        self.best_ever = None
        
    # ==================== INICIALIZACIÓN ====================
    
    def _define_fixed_zones(self):
        """Definir zonas fijas que no pueden tener estanterías"""
        # Zona de muelles (norte)
        dock_depth = DOCK_STANDARDS["depth"] + DOCK_STANDARDS["maneuver_zone"]
        self.fixed_zones.append({
            "type": "docks",
            "x_min": 0, "x_max": self.dims["length"],
            "z_min": 0, "z_max": dock_depth + 2
        })
        
        # Posiciones de muelles
        n_docks = self.input.n_docks
        dock_width = DOCK_STANDARDS["width"]
        total = n_docks * dock_width + (n_docks - 1) * DOCK_STANDARDS["separation"]
        start_x = (self.dims["length"] - total) / 2
        
        for i in range(n_docks):
            x = start_x + i * (dock_width + DOCK_STANDARDS["separation"])
            self.dock_positions.append({
                "x": x + dock_width / 2,
                "z": DOCK_STANDARDS["depth"] / 2
            })
        
        # Zona de expedición (último tercio cerca de muelles)
        self.expedition_zone = {
            "x": self.dims["length"] * 0.75,
            "z": dock_depth + 5
        }
        
        # Zona de oficinas (sur)
        office_depth = self.dims["width"] * 0.2
        self.fixed_zones.append({
            "type": "offices",
            "x_min": 0, "x_max": self.dims["length"] * 0.3,
            "z_min": self.dims["width"] - office_depth, "z_max": self.dims["width"]
        })
        
        # Pasillo central
        center_z = self.dims["width"] / 2
        half_aisle = 4.5 / 2  # Pasillo principal
        self.fixed_zones.append({
            "type": "main_aisle",
            "x_min": 0, "x_max": self.dims["length"],
            "z_min": center_z - half_aisle, "z_max": center_z + half_aisle
        })
    
    def _generate_initial_population(self) -> List[Chromosome]:
        """Generar población inicial de layouts"""
        population = []
        
        for _ in range(self.config.population_size):
            chromosome = self._create_random_chromosome()
            population.append(chromosome)
        
        return population
    
    def _create_random_chromosome(self) -> Chromosome:
        """Crear un cromosoma (layout) aleatorio"""
        genes = []
        
        # Definir área utilizable para estanterías
        dock_depth = DOCK_STANDARDS["depth"] + DOCK_STANDARDS["maneuver_zone"] + 2
        office_depth = self.dims["width"] * 0.2
        
        # Zonas norte y sur del pasillo central
        center_z = self.dims["width"] / 2
        half_aisle = 2.5
        
        zones = [
            # Zona norte (entre muelles y pasillo)
            {"x_min": 5, "x_max": self.dims["length"] - 5,
             "z_min": dock_depth, "z_max": center_z - half_aisle - 1},
            # Zona sur (entre pasillo y oficinas)
            {"x_min": self.dims["length"] * 0.35, "x_max": self.dims["length"] - 5,
             "z_min": center_z + half_aisle + 1, "z_max": self.dims["width"] - office_depth - 2}
        ]
        
        # Generar estanterías en cada zona
        for zone in zones:
            zone_width = zone["x_max"] - zone["x_min"]
            zone_depth = zone["z_max"] - zone["z_min"]
            
            if zone_width < 5 or zone_depth < 3:
                continue
            
            # Número aleatorio de filas de estanterías
            rack_depth = 1.1  # Profundidad estándar
            battery_spacing = rack_depth * 2 + self.aisle_width
            num_rows = int(zone_depth / battery_spacing)
            
            for row in range(num_rows):
                z = zone["z_min"] + row * battery_spacing + rack_depth
                
                # Largo de estantería (aleatorio entre 5 y 15 metros)
                rack_length = random.uniform(5, min(15, zone_width * 0.4))
                
                # Posición X (aleatoria dentro de la zona)
                x = random.uniform(zone["x_min"], zone["x_max"] - rack_length)
                
                # Pequeña variación para diversidad
                x += random.uniform(-2, 2)
                x = max(zone["x_min"], min(zone["x_max"] - rack_length, x))
                
                genes.append({
                    "x": round(x, 2),
                    "z": round(z, 2),
                    "length": round(rack_length, 2),
                    "depth": rack_depth,
                    "levels": self.max_levels,
                    "rotation": 0
                })
                
                # Segunda estantería back-to-back
                if random.random() > 0.3:  # 70% probabilidad
                    genes.append({
                        "x": round(x, 2),
                        "z": round(z + rack_depth, 2),
                        "length": round(rack_length, 2),
                        "depth": rack_depth,
                        "levels": self.max_levels,
                        "rotation": 0
                    })
        
        return Chromosome(genes=genes)
    
    # ==================== FITNESS ====================
    
    def _evaluate_fitness(self, chromosome: Chromosome) -> float:
        """
        Evaluar fitness del cromosoma
        
        Fitness = (peso_palets * score_palets) + (peso_distancia * score_distancia) - penalizaciones
        """
        genes = chromosome.genes
        
        if not genes:
            return 0.0
        
        # 1. Calcular palets totales
        total_pallets = 0
        for rack in genes:
            pallets_length = int(rack["length"] / self.pallet["length"])
            pallets_depth = int(rack["depth"] / self.pallet["width"])
            pallets_per_level = pallets_length * pallets_depth
            total_pallets += pallets_per_level * rack["levels"]
        
        # 2. Calcular distancia promedio de recorrido
        avg_distance = self._calculate_avg_distance(genes)
        
        # 3. Detectar colisiones
        collisions = self._count_collisions(genes)
        
        # 4. Detectar fuera de límites
        out_of_bounds = self._count_out_of_bounds(genes)
        
        # Normalizar scores
        max_possible_pallets = self._estimate_max_pallets()
        pallet_score = min(1.0, total_pallets / max_possible_pallets) if max_possible_pallets > 0 else 0
        
        max_distance = math.sqrt(self.dims["length"]**2 + self.dims["width"]**2)
        distance_score = 1.0 - (avg_distance / max_distance) if max_distance > 0 else 0
        distance_score = max(0, min(1, distance_score))
        
        # Fitness combinado
        fitness = (
            self.config.weight_pallets * pallet_score * 1000 +
            self.config.weight_distance * distance_score * 1000 -
            collisions * self.config.collision_penalty -
            out_of_bounds * self.config.out_of_bounds_penalty
        )
        
        # Guardar métricas
        chromosome.fitness = max(0, fitness)
        chromosome.pallets = total_pallets
        chromosome.avg_distance = avg_distance
        
        return chromosome.fitness
    
    def _calculate_avg_distance(self, genes: List[Dict]) -> float:
        """
        Calcular distancia promedio de recorrido:
        Muelle → Estantería → Zona de Expedición
        """
        if not genes or not self.dock_positions:
            return float('inf')
        
        distances = []
        
        for rack in genes:
            rack_center_x = rack["x"] + rack["length"] / 2
            rack_center_z = rack["z"] + rack["depth"] / 2
            
            # Distancia desde el muelle más cercano
            min_dock_dist = float('inf')
            for dock in self.dock_positions:
                dist = math.sqrt((rack_center_x - dock["x"])**2 + (rack_center_z - dock["z"])**2)
                min_dock_dist = min(min_dock_dist, dist)
            
            # Distancia a zona de expedición
            exp_dist = math.sqrt(
                (rack_center_x - self.expedition_zone["x"])**2 +
                (rack_center_z - self.expedition_zone["z"])**2
            )
            
            # Distancia total del recorrido típico
            total_dist = min_dock_dist + exp_dist
            distances.append(total_dist)
        
        return sum(distances) / len(distances) if distances else float('inf')
    
    def _count_collisions(self, genes: List[Dict]) -> int:
        """Contar colisiones entre estanterías"""
        collisions = 0
        
        for i, rack1 in enumerate(genes):
            for j, rack2 in enumerate(genes[i+1:], i+1):
                if self._racks_collide(rack1, rack2):
                    collisions += 1
        
        return collisions
    
    def _racks_collide(self, r1: Dict, r2: Dict) -> bool:
        """Verificar si dos estanterías colisionan (incluyendo pasillo)"""
        margin = self.aisle_width * 0.5  # Medio pasillo mínimo
        
        # Expandir r1 con margen
        r1_x_min = r1["x"] - margin
        r1_x_max = r1["x"] + r1["length"] + margin
        r1_z_min = r1["z"] - margin
        r1_z_max = r1["z"] + r1["depth"] + margin
        
        # Bounding box de r2
        r2_x_min = r2["x"]
        r2_x_max = r2["x"] + r2["length"]
        r2_z_min = r2["z"]
        r2_z_max = r2["z"] + r2["depth"]
        
        # Verificar solapamiento
        x_overlap = not (r1_x_max < r2_x_min or r1_x_min > r2_x_max)
        z_overlap = not (r1_z_max < r2_z_min or r1_z_min > r2_z_max)
        
        return x_overlap and z_overlap
    
    def _count_out_of_bounds(self, genes: List[Dict]) -> int:
        """Contar estanterías fuera de límites o en zonas prohibidas"""
        count = 0
        
        for rack in genes:
            x_end = rack["x"] + rack["length"]
            z_end = rack["z"] + rack["depth"]
            
            # Fuera de la nave
            if rack["x"] < 0 or x_end > self.dims["length"]:
                count += 1
            if rack["z"] < 0 or z_end > self.dims["width"]:
                count += 1
            
            # En zonas prohibidas
            for zone in self.fixed_zones:
                if self._rack_in_zone(rack, zone):
                    count += 1
                    break
        
        return count
    
    def _rack_in_zone(self, rack: Dict, zone: Dict) -> bool:
        """Verificar si una estantería está en una zona prohibida"""
        rack_x_min, rack_x_max = rack["x"], rack["x"] + rack["length"]
        rack_z_min, rack_z_max = rack["z"], rack["z"] + rack["depth"]
        
        # Verificar solapamiento
        x_overlap = not (rack_x_max < zone["x_min"] or rack_x_min > zone["x_max"])
        z_overlap = not (rack_z_max < zone["z_min"] or rack_z_min > zone["z_max"])
        
        return x_overlap and z_overlap
    
    def _estimate_max_pallets(self) -> int:
        """Estimar máximo teórico de palets"""
        usable_area = self.dims["length"] * self.dims["width"] * 0.5  # 50% utilizable
        pallet_footprint = self.pallet["length"] * self.pallet["width"]
        pallets_floor = usable_area / pallet_footprint
        return int(pallets_floor * self.max_levels)
    
    # ==================== OPERADORES GENÉTICOS ====================
    
    def _selection(self, population: List[Chromosome]) -> Chromosome:
        """Selección por torneo"""
        tournament = random.sample(population, self.config.tournament_size)
        return max(tournament, key=lambda c: c.fitness)
    
    def _crossover(self, parent1: Chromosome, parent2: Chromosome) -> Tuple[Chromosome, Chromosome]:
        """Cruce de dos padres"""
        if random.random() > self.config.crossover_rate:
            return parent1.copy(), parent2.copy()
        
        # Cruce de un punto
        genes1, genes2 = parent1.genes, parent2.genes
        
        if len(genes1) < 2 or len(genes2) < 2:
            return parent1.copy(), parent2.copy()
        
        point1 = random.randint(1, len(genes1) - 1)
        point2 = random.randint(1, len(genes2) - 1)
        
        child1_genes = deepcopy(genes1[:point1]) + deepcopy(genes2[point2:])
        child2_genes = deepcopy(genes2[:point2]) + deepcopy(genes1[point1:])
        
        return Chromosome(genes=child1_genes), Chromosome(genes=child2_genes)
    
    def _mutate(self, chromosome: Chromosome) -> Chromosome:
        """Mutación del cromosoma"""
        if random.random() > self.config.mutation_rate:
            return chromosome
        
        mutated = chromosome.copy()
        
        if not mutated.genes:
            return mutated
        
        mutation_type = random.choice(["move", "resize", "add", "remove"])
        
        if mutation_type == "move" and mutated.genes:
            # Mover una estantería
            idx = random.randint(0, len(mutated.genes) - 1)
            mutated.genes[idx]["x"] += random.uniform(-3, 3)
            mutated.genes[idx]["z"] += random.uniform(-2, 2)
            
        elif mutation_type == "resize" and mutated.genes:
            # Cambiar tamaño
            idx = random.randint(0, len(mutated.genes) - 1)
            mutated.genes[idx]["length"] = max(3, mutated.genes[idx]["length"] + random.uniform(-2, 2))
            
        elif mutation_type == "add":
            # Añadir nueva estantería
            new_rack = {
                "x": random.uniform(5, self.dims["length"] - 10),
                "z": random.uniform(15, self.dims["width"] - 15),
                "length": random.uniform(5, 12),
                "depth": 1.1,
                "levels": self.max_levels,
                "rotation": 0
            }
            mutated.genes.append(new_rack)
            
        elif mutation_type == "remove" and len(mutated.genes) > 5:
            # Eliminar estantería aleatoria
            idx = random.randint(0, len(mutated.genes) - 1)
            mutated.genes.pop(idx)
        
        return mutated
    
    # ==================== EVOLUCIÓN ====================
    
    def evolve(self) -> OptimizationResult:
        """Ejecutar algoritmo genético completo"""
        self._define_fixed_zones()
        
        # Generar población inicial
        population = self._generate_initial_population()
        
        # Evaluar fitness inicial
        for chromosome in population:
            self._evaluate_fitness(chromosome)
        
        # Evolución
        for gen in range(self.config.generations):
            # Ordenar por fitness
            population.sort(key=lambda c: c.fitness, reverse=True)
            
            # Guardar estadísticas
            best = population[0]
            avg_fitness = sum(c.fitness for c in population) / len(population)
            
            self.generation_history.append({
                "generation": gen,
                "best_fitness": best.fitness,
                "best_pallets": best.pallets,
                "best_distance": best.avg_distance,
                "avg_fitness": avg_fitness
            })
            
            # Actualizar mejor global
            if self.best_ever is None or best.fitness > self.best_ever.fitness:
                self.best_ever = best.copy()
            
            # Elitismo
            new_population = [c.copy() for c in population[:self.config.elitism_count]]
            
            # Generar nueva población
            while len(new_population) < self.config.population_size:
                parent1 = self._selection(population)
                parent2 = self._selection(population)
                
                child1, child2 = self._crossover(parent1, parent2)
                child1 = self._mutate(child1)
                child2 = self._mutate(child2)
                
                self._evaluate_fitness(child1)
                self._evaluate_fitness(child2)
                
                new_population.extend([child1, child2])
            
            population = new_population[:self.config.population_size]
        
        # Convertir mejor resultado a elementos
        return self._chromosome_to_result(self.best_ever)
    
    def _chromosome_to_result(self, chromosome: Chromosome) -> OptimizationResult:
        """Convertir cromosoma ganador a OptimizationResult"""
        elements = []
        
        # Añadir muelles
        for i, dock_pos in enumerate(self.dock_positions):
            elements.append(WarehouseElement(
                id=f"dock-{i}",
                type="dock",
                position=ElementPosition(
                    x=dock_pos["x"] - DOCK_STANDARDS["width"] / 2,
                    y=0,
                    z=0,
                    rotation=0
                ),
                dimensions=ElementDimensions(
                    width=DOCK_STANDARDS["width"],
                    depth=DOCK_STANDARDS["depth"],
                    height=DOCK_STANDARDS["height"],
                    maneuverZone=DOCK_STANDARDS["maneuver_zone"]
                ),
                properties={"label": f"Muelle {i+1}"}
            ))
        
        # Añadir estanterías del cromosoma
        for i, rack in enumerate(chromosome.genes):
            pallets_per_level = int(rack["length"] / self.pallet["length"]) * int(rack["depth"] / self.pallet["width"])
            total_pallets = pallets_per_level * rack["levels"]
            
            elements.append(WarehouseElement(
                id=f"shelf-{i}",
                type="shelf",
                position=ElementPosition(
                    x=rack["x"],
                    y=rack["z"],
                    z=0,
                    rotation=rack["rotation"]
                ),
                dimensions=ElementDimensions(
                    length=rack["length"],
                    depth=rack["depth"],
                    height=rack["levels"] * (self.pallet["height"] + 0.25),
                    levels=rack["levels"]
                ),
                properties={
                    "label": f"Rack-{i+1:02d}",
                    "capacity": total_pallets,
                    "pallets_per_level": pallets_per_level
                }
            ))
        
        # Añadir oficinas
        office_x = 0
        office_z = self.dims["width"] - self.dims["width"] * 0.2
        elements.append(WarehouseElement(
            id="office-1",
            type="office",
            position=ElementPosition(x=office_x, y=office_z, z=0, rotation=0),
            dimensions=ElementDimensions(
                largo=self.dims["length"] * 0.25,
                ancho=self.dims["width"] * 0.18,
                alto=3.5
            ),
            properties={
                "label": "Oficinas",
                "elevation": 3.5,
                "is_mezzanine": True
            }
        ))
        
        # Calcular métricas
        total_pallets = chromosome.pallets
        total_area = self.dims["length"] * self.dims["width"]
        storage_area = sum(r["length"] * r["depth"] for r in chromosome.genes)
        
        capacity = CapacityResult(
            total_pallets=total_pallets,
            pallets_per_level=int(total_pallets / len(chromosome.genes) / self.max_levels) if chromosome.genes else 0,
            levels_avg=self.max_levels,
            storage_volume_m3=total_pallets * self.pallet["length"] * self.pallet["width"] * self.pallet["height"],
            efficiency_percentage=round(storage_area / total_area * 100, 2)
        )
        
        surfaces = SurfaceSummary(
            total_area=total_area,
            storage_area=storage_area,
            operational_area=total_area * 0.1,
            services_area=total_area * 0.03,
            circulation_area=total_area - storage_area - total_area * 0.15,
            office_area=self.dims["length"] * 0.25 * self.dims["width"] * 0.18,
            efficiency=round(storage_area / total_area * 100, 2)
        )
        
        validations = [
            ValidationItem(
                type="success",
                code="GA_COMPLETE",
                message=f"Optimización GA completada: {total_pallets} palets, distancia promedio: {chromosome.avg_distance:.1f}m"
            ),
            ValidationItem(
                type="info",
                code="GA_STATS",
                message=f"Generaciones: {self.config.generations}, Población: {self.config.population_size}"
            )
        ]
        
        return OptimizationResult(
            status="success",
            elements=elements,
            capacity=capacity,
            surfaces=surfaces,
            validations=validations,
            metadata={
                "algorithm": "Genetic Algorithm",
                "generations": self.config.generations,
                "population_size": self.config.population_size,
                "best_fitness": chromosome.fitness,
                "total_pallets": total_pallets,
                "avg_distance": chromosome.avg_distance,
                "generation_history": self.generation_history[-10:]  # Últimas 10
            },
            timestamp=datetime.now()
        )


# ==================== FUNCIÓN PRINCIPAL ====================

def optimize_with_ga(input_data: WarehouseInput, config: GAConfig = None) -> OptimizationResult:
    """Ejecutar optimización con algoritmo genético"""
    optimizer = GeneticOptimizer(input_data, config)
    return optimizer.evolve()
