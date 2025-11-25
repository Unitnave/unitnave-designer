"""
UNITNAVE API v4.0
Backend con Optimizador Genético

Endpoints:
- /api/optimize - Optimización estándar
- /api/optimize/ga - Optimización con Algoritmo Genético
- /api/calculate - Cálculos de capacidad
- /api/designs - CRUD de diseños
"""

import os
import logging
from datetime import datetime
from typing import Dict, List, Optional
import uuid

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ==================== LOGGING ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== IMPORTS LOCALES ====================
from models import (
    WarehouseInput, OptimizationResult, WarehouseElement,
    ElementPosition, ElementDimensions, CapacityResult,
    SurfaceSummary, ValidationItem
)

from optimizer import WarehouseOptimizer
from calculations import CapacityCalculator
from validation import WarehouseValidator

# Importar GA (opcional)
try:
    from optimizer_ga import optimize_with_ga, GAConfig
    GA_AVAILABLE = True
    logger.info("✅ Optimizador GA cargado")
except ImportError as e:
    GA_AVAILABLE = False
    optimize_with_ga = None
    GAConfig = None
    logger.warning(f"⚠️ Optimizador GA no disponible: {e}")

# ==================== FASTAPI APP ====================
app = FastAPI(
    title="UNITNAVE Designer API",
    description="API para diseño y optimización de naves industriales",
    version="4.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# ==================== CORS ====================
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:8080"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELOS ====================

class GAConfigRequest(BaseModel):
    """Configuración opcional para GA"""
    population_size: int = Field(default=50, ge=10, le=200)
    generations: int = Field(default=100, ge=20, le=500)
    mutation_rate: float = Field(default=0.15, ge=0.01, le=0.5)
    crossover_rate: float = Field(default=0.8, ge=0.5, le=1.0)
    weight_pallets: float = Field(default=0.6, ge=0, le=1)
    weight_distance: float = Field(default=0.4, ge=0, le=1)


class OptimizeRequest(BaseModel):
    """Request para optimización"""
    length: float = Field(..., gt=10, le=500)
    width: float = Field(..., gt=10, le=500)
    height: float = Field(..., gt=3, le=20)
    n_docks: int = Field(default=4, ge=1, le=50)
    machinery: str = Field(default="retractil")
    pallet_type: str = Field(default="EUR")
    pallet_height: Optional[float] = Field(default=1.5, ge=0.5, le=3.0)
    activity_type: str = Field(default="industrial")
    workers: Optional[int] = Field(default=None, ge=1, le=500)
    
    # Configuración de oficinas
    office_floor: str = Field(default="mezzanine")  # ground, mezzanine, both
    office_height: float = Field(default=3.5, ge=2.5, le=5)
    has_elevator: bool = Field(default=True)
    
    # Config GA opcional
    ga_config: Optional[GAConfigRequest] = None


class CalculateRequest(BaseModel):
    """Request para cálculos"""
    name: str = "Cálculo"
    dimensions: Dict[str, float]
    elements: List[Dict]


# ==================== BASE DE DATOS (Memoria) ====================
designs_db: Dict[str, Dict] = {}

# ==================== ENDPOINTS ====================

@app.get("/")
async def root():
    return {
        "name": "UNITNAVE Designer API",
        "version": "4.0.0",
        "status": "running",
        "endpoints": {
            "optimize": "/api/optimize",
            "optimize_ga": "/api/optimize/ga",
            "calculate": "/api/calculate",
            "docs": "/api/docs"
        }
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "optimizers": {
            "standard": True,
            "ga": GA_AVAILABLE
        }
    }


@app.post("/api/optimize")
async def optimize_layout(request: OptimizeRequest):
    """
    Optimización estándar
    """
    try:
        input_data = WarehouseInput(
            length=request.length,
            width=request.width,
            height=request.height,
            n_docks=request.n_docks,
            machinery=request.machinery,
            pallet_type=request.pallet_type,
            activity_type=request.activity_type,
            workers=request.workers
        )
        
        input_data.pallet_height = request.pallet_height
        input_data.office_config = {
            "floor": request.office_floor,
            "height": request.office_height,
            "hasElevator": request.has_elevator
        }
        
        optimizer = WarehouseOptimizer(input_data)
        result = optimizer.generate_layout()
        
        logger.info(f"✅ Layout generado: {result.capacity.total_pallets} palets")
        
        return result.model_dump() if hasattr(result, 'model_dump') else result.__dict__
        
    except Exception as e:
        logger.error(f"❌ Error en optimización: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize/ga")
async def optimize_genetic(request: OptimizeRequest):
    """
    Optimización con Algoritmo Genético
    
    Maximiza: Capacidad de palets
    Minimiza: Distancia de recorridos
    """
    if not GA_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="Optimizador GA no disponible. Verifica que optimizer_ga.py existe."
        )
    
    try:
        input_data = WarehouseInput(
            length=request.length,
            width=request.width,
            height=request.height,
            n_docks=request.n_docks,
            machinery=request.machinery,
            pallet_type=request.pallet_type,
            activity_type=request.activity_type,
            workers=request.workers
        )
        
        input_data.pallet_height = request.pallet_height
        
        ga_config = None
        if request.ga_config:
            ga_config = GAConfig(
                population_size=request.ga_config.population_size,
                generations=request.ga_config.generations,
                mutation_rate=request.ga_config.mutation_rate,
                crossover_rate=request.ga_config.crossover_rate,
                weight_pallets=request.ga_config.weight_pallets,
                weight_distance=request.ga_config.weight_distance
            )
        
        logger.info("🧬 Iniciando optimización GA...")
        result = optimize_with_ga(input_data, ga_config)
        
        logger.info(f"✅ GA completado: {result.capacity.total_pallets} palets")
        
        return result.model_dump() if hasattr(result, 'model_dump') else result.__dict__
        
    except Exception as e:
        logger.error(f"❌ Error en GA: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calculate")
async def calculate_capacity(request: CalculateRequest):
    """
    Calcular capacidad y métricas de un diseño existente
    """
    try:
        # Convertir elementos
        elements = []
        for el in request.elements:
            elements.append(WarehouseElement(
                id=el.get("id", str(uuid.uuid4())),
                type=el.get("type", "shelf"),
                position=ElementPosition(**el.get("position", {"x": 0, "y": 0, "z": 0, "rotation": 0})),
                dimensions=ElementDimensions(**el.get("dimensions", {})),
                properties=el.get("properties", {})
            ))
        
        # Crear input temporal
        dims = request.dimensions
        input_data = WarehouseInput(
            length=dims.get("length", 50),
            width=dims.get("width", 30),
            height=dims.get("height", 10),
            n_docks=4,
            machinery="retractil",
            pallet_type="EUR"
        )
        
        # Calcular
        calculator = CapacityCalculator(input_data, elements, dims)
        capacity = calculator.calculate_total_capacity()
        surfaces = calculator.calculate_surfaces()
        
        return {
            "status": "success",
            "capacity": capacity.model_dump() if hasattr(capacity, 'model_dump') else capacity.__dict__,
            "surfaces": surfaces.model_dump() if hasattr(surfaces, 'model_dump') else surfaces.__dict__,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error en cálculo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CRUD DISEÑOS ====================

@app.post("/api/designs")
async def save_design(design: Dict):
    """Guardar un diseño"""
    design_id = str(uuid.uuid4())
    designs_db[design_id] = {
        **design,
        "id": design_id,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    return {"id": design_id, "message": "Diseño guardado"}


@app.get("/api/designs/{design_id}")
async def get_design(design_id: str):
    """Obtener un diseño"""
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    return designs_db[design_id]


@app.get("/api/designs")
async def list_designs():
    """Listar diseños"""
    return list(designs_db.values())


@app.delete("/api/designs/{design_id}")
async def delete_design(design_id: str):
    """Eliminar un diseño"""
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    del designs_db[design_id]
    return {"message": "Diseño eliminado"}


# ==================== COMPARACIÓN ====================

@app.post("/api/compare")
async def compare_scenarios(request: OptimizeRequest):
    """
    Comparar optimización estándar vs GA
    """
    try:
        scenarios = {}
        
        input_data = WarehouseInput(
            length=request.length,
            width=request.width,
            height=request.height,
            n_docks=request.n_docks,
            machinery=request.machinery,
            pallet_type=request.pallet_type,
            activity_type=request.activity_type,
            workers=request.workers
        )
        input_data.pallet_height = request.pallet_height
        
        # Escenario 1: Estándar
        optimizer = WarehouseOptimizer(input_data)
        scenarios["standard"] = optimizer.generate_layout()
        
        # Escenario 2: GA (si disponible)
        if GA_AVAILABLE:
            config_balanced = GAConfig(
                generations=80,
                weight_pallets=0.6,
                weight_distance=0.4
            )
            scenarios["ga_balanced"] = optimize_with_ga(input_data, config_balanced)
        
        # Formatear comparación
        comparison = {}
        for name, result in scenarios.items():
            comparison[name] = {
                "total_pallets": result.capacity.total_pallets,
                "efficiency": result.capacity.efficiency_percentage,
                "elements_count": len(result.elements)
            }
        
        return {
            "comparison": comparison,
            "scenarios": {
                k: v.model_dump() if hasattr(v, 'model_dump') else v.__dict__
                for k, v in scenarios.items()
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error en comparación: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    logger.info("=" * 50)
    logger.info("🏭 UNITNAVE Designer API v4.0")
    logger.info("=" * 50)
    logger.info(f"📍 CORS: {ALLOWED_ORIGINS}")
    logger.info(f"🧬 GA disponible: {GA_AVAILABLE}")
    logger.info("=" * 50)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
