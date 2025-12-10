"""
UNITNAVE API v5.0 - Multi-Escenario
Backend con Optimizador V5 + Evaluación Fitness + Informes Detallados

ARCHIVO: backend/main.py
ACCIÓN: REEMPLAZAR contenido completo
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

from optimizer import WarehouseOptimizer, DesignPreferences, ScenarioGenerator
from calculations import CapacityCalculator
from validation import WarehouseValidator
from constants import get_fitness_weights, get_macro_config

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
    description="API para diseño y optimización de naves industriales - V5 Multi-Escenario",
    version="5.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# ==================== CORS ====================
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:8080,https://unitnave.vercel.app,https://unitnave.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELOS REQUEST ====================

class OfficeConfigRequest(BaseModel):
    """Configuración de oficinas V5.2"""
    floor: str = Field(default="mezzanine")  # ground, mezzanine
    position: str = Field(default="front_left")  # front_left, front_right, side_left, side_right
    height_under: float = Field(default=4.0, ge=2.5, le=8.0)  # Altura libre bajo oficina
    floor_height: float = Field(default=3.0, ge=2.5, le=4.0)  # Altura por planta
    num_floors: int = Field(default=1, ge=1, le=5)  # Número de plantas
    area_per_floor: float = Field(default=100, ge=30, le=500)  # m² por planta
    has_elevator: bool = Field(default=True)
    has_stairs: bool = Field(default=True)
    # Legacy
    area: Optional[float] = Field(default=None)
    mezzanine_height: Optional[float] = Field(default=None)


class DockConfigRequest(BaseModel):
    """Configuración de muelles"""
    count: int = Field(default=4, ge=1, le=20)
    position: str = Field(default="center")  # center, left, right, distributed
    maneuver_zone: float = Field(default=4.0, ge=3.0, le=12.0)
    dock_width: float = Field(default=3.5, ge=3.0, le=5.0)
    dock_depth: float = Field(default=4.0, ge=3.0, le=6.0)


class PreferencesRequest(BaseModel):
    """Preferencias de diseño"""
    include_offices: bool = Field(default=True)
    include_services: bool = Field(default=True)
    include_docks: bool = Field(default=True)
    include_technical: bool = Field(default=True)
    
    priority: str = Field(default="balance")  # capacity, balance, operations
    warehouse_type: str = Field(default="industrial")
    layout_complexity: str = Field(default="medio")
    
    # ABC Zoning (NUEVO)
    enable_abc_zones: bool = Field(default=False)
    abc_zone_a_pct: float = Field(default=0.20, ge=0.1, le=0.4)
    abc_zone_b_pct: float = Field(default=0.40, ge=0.2, le=0.6)
    abc_zone_c_pct: float = Field(default=0.40, ge=0.1, le=0.6)
    
    forbidden_zones: List[Dict] = Field(default=[])
    min_free_area_center: float = Field(default=0)
    high_rotation_pct: float = Field(default=0.20, ge=0, le=1)


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
    # Dimensiones
    length: float = Field(..., gt=10, le=500)
    width: float = Field(..., gt=10, le=500)
    height: float = Field(..., gt=3, le=20)
    
    # Operativa
    n_docks: int = Field(default=4, ge=1, le=50)
    machinery: str = Field(default="retractil")
    pallet_type: str = Field(default="EUR")
    pallet_height: Optional[float] = Field(default=1.5, ge=0.5, le=3.0)
    custom_pallet: Optional[Dict[str, float]] = None
    activity_type: str = Field(default="industrial")
    workers: Optional[int] = Field(default=None, ge=1, le=500)
    
    # Configuración oficinas (legacy)
    office_floor: str = Field(default="mezzanine")
    office_height: float = Field(default=3.5, ge=2.5, le=5)
    has_elevator: bool = Field(default=True)
    
    # Nuevas configs V5 (opcionales)
    office_config: Optional[OfficeConfigRequest] = None
    dock_config: Optional[DockConfigRequest] = None
    preferences: Optional[PreferencesRequest] = None
    
    # GA (opcional)
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
        "version": "5.0.0",
        "status": "running",
        "features": {
            "multi_scenario": True,
            "fitness_evaluation": True,
            "detailed_report": True,
            "reduced_maneuver_zone": True
        },
        "endpoints": {
            "optimize": "/api/optimize",
            "scenarios": "/api/scenarios",
            "compare": "/api/optimize/compare",
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
        "version": "5.0.0",
        "optimizers": {
            "v5_multi_scenario": True,
            "ga": GA_AVAILABLE
        }
    }


# ==================== FUNCIONES AUXILIARES ====================

def build_office_config_dict(request: OptimizeRequest) -> Optional[Dict]:
    """
    Construye diccionario de office_config desde request.
    Maneja tanto el nuevo modelo V5.2 como el legacy.
    """
    if not request.office_config:
        return None
    
    oc = request.office_config
    return {
        "floor": oc.floor,
        "position": getattr(oc, 'position', 'front_left'),
        "height_under": getattr(oc, 'height_under', None) or getattr(oc, 'mezzanine_height', None) or 4.0,
        "floor_height": getattr(oc, 'floor_height', 3.0),
        "num_floors": getattr(oc, 'num_floors', 1),
        "area_per_floor": getattr(oc, 'area_per_floor', None) or getattr(oc, 'area', None) or 100,
        "has_elevator": oc.has_elevator,
        "has_stairs": getattr(oc, 'has_stairs', True)
    }


def build_warehouse_input(request: OptimizeRequest) -> WarehouseInput:
    """
    Construye WarehouseInput desde request con soporte V5.2.
    """
    office_config_dict = build_office_config_dict(request)
    
    return WarehouseInput(
        length=request.length,
        width=request.width,
        height=request.height,
        n_docks=request.dock_config.count if request.dock_config else request.n_docks,
        machinery=request.machinery,
        pallet_type=request.pallet_type,
        pallet_height=request.pallet_height,
        custom_pallet=request.custom_pallet,
        activity_type=request.activity_type,
        workers=request.workers,
        # V5.2: Pasar office_config completo
        office_config=office_config_dict,
        # Legacy fallback
        office_floor=request.office_config.floor if request.office_config else request.office_floor,
        office_height=getattr(request.office_config, 'floor_height', 3.5) if request.office_config else (request.office_height or 3.5),
        has_elevator=request.office_config.has_elevator if request.office_config else request.has_elevator
    )


def build_preferences(request: OptimizeRequest) -> Optional[DesignPreferences]:
    """
    Construye DesignPreferences desde request.
    """
    if not request.preferences:
        return None
    
    return DesignPreferences(
        include_offices=request.preferences.include_offices,
        include_services=request.preferences.include_services,
        include_docks=request.preferences.include_docks,
        include_technical=request.preferences.include_technical,
        priority=request.preferences.priority,
        warehouse_type=request.preferences.warehouse_type,
        layout_complexity=getattr(request.preferences, 'layout_complexity', 'medio'),
        # ABC Zoning
        enable_abc_zones=request.preferences.enable_abc_zones,
        abc_zone_a_pct=request.preferences.abc_zone_a_pct,
        abc_zone_b_pct=request.preferences.abc_zone_b_pct,
        abc_zone_c_pct=request.preferences.abc_zone_c_pct,
        # Resto
        forbidden_zones=request.preferences.forbidden_zones,
        high_rotation_pct=request.preferences.high_rotation_pct
    )


# ==================== ENDPOINTS DE OPTIMIZACIÓN ====================

@app.post("/api/optimize")
async def optimize_layout(request: OptimizeRequest):
    """
    🚀 Optimización V5.2 Multi-Escenario
    
    - Genera 5-8 escenarios según tipo de almacén (15-20 con ABC)
    - Evalúa con fitness multi-criterio
    - Selecciona el mejor + alternativas
    - Incluye informe detallado con medidas
    - Soporta optimización ABC por zonas
    - V5.2: Configuración completa de oficinas por plantas
    """
    try:
        # Construir input usando función auxiliar
        input_data = build_warehouse_input(request)
        
        # Construir preferencias usando función auxiliar
        prefs = build_preferences(request)
        
        # Optimizar
        optimizer = WarehouseOptimizer(input_data, prefs)
        result = optimizer.optimize()
        
        abc_status = "ABC activo" if (prefs and prefs.enable_abc_zones) else "uniforme"
        logger.info(
            f"✅ Optimización V5.2 completada ({abc_status}): {result.capacity.total_pallets} palets, "
            f"{result.metadata.get('scenarios_evaluated', 1)} escenarios evaluados"
        )
        
        return result.model_dump() if hasattr(result, 'model_dump') else result.__dict__
        
    except Exception as e:
        logger.error(f"❌ Error en optimización: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scenarios")
async def get_all_scenarios(request: OptimizeRequest):
    """
    📊 Obtener TODOS los escenarios evaluados
    
    Útil para mostrar comparativa completa en frontend
    """
    try:
        input_data = WarehouseInput(
            length=request.length,
            width=request.width,
            height=request.height,
            n_docks=request.n_docks,
            machinery=request.machinery,
            pallet_type=request.pallet_type,
            pallet_height=request.pallet_height,
            activity_type=request.activity_type,
            workers=request.workers
        )
        
        prefs = DesignPreferences(
            warehouse_type=request.preferences.warehouse_type if request.preferences else request.activity_type,
            priority=request.preferences.priority if request.preferences else "balance"
        )
        
        optimizer = WarehouseOptimizer(input_data, prefs)
        optimizer.optimize()
        
        all_scenarios = []
        for i, scenario in enumerate(optimizer.scenarios_evaluated):
            all_scenarios.append({
                "rank": i + 1,
                "name": scenario["config"].name,
                "score": scenario["score"],
                "pallets": scenario["fitness"].total_pallets,
                "efficiency": scenario["fitness"].storage_efficiency,
                "is_best": i == 0,
                "config": {
                    "orientation": scenario["config"].rack_orientation,
                    "aisle_strategy": scenario["config"].aisle_strategy
                }
            })
        
        return {
            "total_evaluated": len(all_scenarios),
            "best": all_scenarios[0] if all_scenarios else None,
            "all_scenarios": all_scenarios
        }
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo escenarios: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize/compare")
async def compare_priorities(request: OptimizeRequest):
    """
    ⚖️ Comparar mismo layout con diferentes prioridades
    
    Ejecuta optimización con capacity, balance y operations
    para mostrar trade-offs
    """
    try:
        input_data = WarehouseInput(
            length=request.length,
            width=request.width,
            height=request.height,
            n_docks=request.n_docks,
            machinery=request.machinery,
            pallet_type=request.pallet_type,
            pallet_height=request.pallet_height,
            activity_type=request.activity_type,
            workers=request.workers
        )
        
        comparison = {}
        
        for priority in ["capacity", "balance", "operations"]:
            prefs = DesignPreferences(
                warehouse_type=request.activity_type,
                priority=priority
            )
            
            optimizer = WarehouseOptimizer(input_data, prefs)
            result = optimizer.optimize()
            
            comparison[priority] = {
                "pallets": result.capacity.total_pallets,
                "efficiency": result.capacity.efficiency_percentage,
                "score": result.metadata.get("fitness", {}).get("normalized_score", 0),
                "scenario": result.metadata.get("scenario_name", "")
            }
        
        # Determinar recomendación
        scores = {k: v["score"] for k, v in comparison.items()}
        recommended = max(scores, key=scores.get)
        
        return {
            "comparison": comparison,
            "recommendation": recommended,
            "explanation": {
                "capacity": "Maximiza palets, puede sacrificar accesibilidad",
                "balance": "Equilibrio óptimo entre capacidad y operativa",
                "operations": "Minimiza distancias, ideal para alto picking"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error en comparación: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize/ga")
async def optimize_genetic(request: OptimizeRequest):
    """
    🧬 Optimización con Algoritmo Genético (Experimental)
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
            pallet_height=request.pallet_height,
            custom_pallet=request.custom_pallet,
            activity_type=request.activity_type,
            workers=request.workers,
            office_floor=request.office_floor,
            office_height=request.office_height,
            has_elevator=request.has_elevator
        )
        
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


@app.post("/api/optimize/scenarios")
async def optimize_scenarios(request: OptimizeRequest):
    """
    📊 Comparador de escenarios por maquinaria
    Genera 3 variantes con diferentes maquinarias
    """
    try:
        scenarios = {}
        machinery_types = ["retractil", "trilateral", "contrapesada"]
        
        for machinery in machinery_types:
            input_data = WarehouseInput(
                length=request.length,
                width=request.width,
                height=request.height,
                n_docks=request.n_docks,
                machinery=machinery,
                pallet_type=request.pallet_type,
                pallet_height=request.pallet_height,
                activity_type=request.activity_type,
                workers=request.workers
            )
            
            optimizer = WarehouseOptimizer(input_data)
            result = optimizer.optimize()
            
            scenarios[machinery] = {
                "total_pallets": result.capacity.total_pallets,
                "efficiency": result.capacity.efficiency_percentage,
                "elements_count": len(result.elements),
                "full_result": result.model_dump() if hasattr(result, 'model_dump') else result.__dict__
            }
        
        logger.info(f"✅ Comparación completada: {len(scenarios)} escenarios")
        
        return scenarios
        
    except Exception as e:
        logger.error(f"❌ Error en comparación: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calculate")
async def calculate_capacity(request: CalculateRequest):
    """Calcular capacidad y métricas de un diseño existente"""
    try:
        elements = []
        for el in request.elements:
            elements.append(WarehouseElement(
                id=el.get("id", str(uuid.uuid4())),
                type=el.get("type", "shelf"),
                position=ElementPosition(**el.get("position", {"x": 0, "y": 0, "z": 0, "rotation": 0})),
                dimensions=ElementDimensions(**el.get("dimensions", {})),
                properties=el.get("properties", {})
            ))
        
        dims = request.dimensions
        input_data = WarehouseInput(
            length=dims.get("length", 50),
            width=dims.get("width", 30),
            height=dims.get("height", 10),
            n_docks=4,
            machinery="retractil",
            pallet_type="EUR"
        )
        
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


# ==================== ENDPOINT DE INFORME DETALLADO ====================

@app.post("/api/report")
async def generate_detailed_report(request: OptimizeRequest):
    """
    📋 Genera informe detallado con todas las mediciones (en cm)
    
    Incluye:
    - Detalle de cada estantería (posición, dimensiones, palets)
    - Distancias a paredes
    - Desglose por zona ABC
    - Palets por nivel
    - Resumen de distancias
    """
    try:
        from report_generator import ReportGenerator
        
        # Construir input usando función auxiliar
        input_data = build_warehouse_input(request)
        
        # Construir preferencias usando función auxiliar
        prefs = build_preferences(request)
        
        # Optimizar
        optimizer = WarehouseOptimizer(input_data, prefs)
        result = optimizer.optimize()
        
        # Generar informe
        generator = ReportGenerator(result, input_data, prefs)
        report = generator.generate()
        
        # Convertir a diccionario
        report_dict = generator.to_dict()
        
        logger.info(f"📋 Informe generado: {report_dict.get('resumen_palets', {}).get('total_palets', 0)} palets")
        
        return report_dict
        
    except Exception as e:
        logger.error(f"❌ Error generando informe: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/report/pdf")
async def generate_pdf_report(request: OptimizeRequest):
    """
    📄 Genera informe en PDF
    
    Devuelve el PDF como descarga
    """
    try:
        from report_generator import generate_pdf_report as gen_pdf
        from fastapi.responses import FileResponse
        import tempfile
        import os
        
        # Construir input usando función auxiliar
        input_data = build_warehouse_input(request)
        
        # Construir preferencias usando función auxiliar
        prefs = build_preferences(request)
        
        # Optimizar
        optimizer = WarehouseOptimizer(input_data, prefs)
        result = optimizer.optimize()
        
        # Generar PDF
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            pdf_path = tmp.name
        
        gen_pdf(result, input_data, prefs, pdf_path)
        
        logger.info(f"📄 PDF generado: {pdf_path}")
        
        return FileResponse(
            pdf_path,
            media_type='application/pdf',
            filename=f'informe_nave_{int(request.length)}x{int(request.width)}.pdf'
        )
        
    except Exception as e:
        logger.error(f"❌ Error generando PDF: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== GEOMETRY ANALYSIS (EXACT) ====================

# Importar servicio de geometría
try:
    from geometry_service import analyze_layout, GeometryService
    GEOMETRY_AVAILABLE = True
    logger.info("✅ Servicio de geometría exacta cargado (Shapely)")
except ImportError as e:
    GEOMETRY_AVAILABLE = False
    analyze_layout = None
    logger.warning(f"⚠️ Servicio de geometría no disponible: {e}")


class LayoutAnalysisRequest(BaseModel):
    """Request para análisis de geometría exacta"""
    dimensions: Dict[str, float] = Field(
        ..., 
        description="Dimensiones de la nave: {length, width}",
        example={"length": 80, "width": 40}
    )
    elements: List[Dict] = Field(
        ..., 
        description="Lista de elementos con type, position, dimensions, rotation"
    )


class ZoneResult(BaseModel):
    """Zona detectada"""
    id: str
    type: str
    label: str
    area: float
    x: float
    y: float
    width: float
    height: float
    centroid: Dict[str, float]
    isAutoGenerated: bool = True


class MetricsResult(BaseModel):
    """Métricas calculadas"""
    totalArea: float
    occupiedArea: float
    freeArea: float
    aisleArea: float
    circulationArea: float
    efficiency: float
    freePercentage: float


class LayoutAnalysisResponse(BaseModel):
    """Response del análisis de geometría"""
    zones: List[ZoneResult]
    metrics: MetricsResult
    dimensions: Dict[str, float]


@app.post(
    "/api/layout/analyze",
    summary="Análisis de Geometría Exacta",
    description="""
    Calcula espacios libres y pasillos usando operaciones booleanas exactas (Shapely/GEOS).
    
    Características:
    - Cálculo exacto de espacio libre (diferencia booleana)
    - Soporte para rotaciones arbitrarias
    - Clasificación automática de zonas (pasillos, circulación, etc.)
    - Métricas precisas de área
    - Validación de normativa ERP
    
    Tipos de zona detectados:
    - main_aisle: Pasillo principal (≥ 3.5m de ancho)
    - cross_aisle: Pasillo transversal (≥ 3m)
    - aisle: Pasillo operativo (≥ 2.5m)
    - circulation: Zona de circulación amplia
    - free_zone: Zona libre genérica
    """
)
async def analyze_layout_geometry(request: LayoutAnalysisRequest):
    """
    Endpoint para análisis de geometría exacta del layout
    """
    if not GEOMETRY_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Servicio de geometría no disponible. Instalar: pip install shapely"
        )
    
    try:
        logger.info(f"📐 Analizando layout: {request.dimensions}")
        
        result = analyze_layout(
            dimensions=request.dimensions,
            elements=request.elements
        )
        
        logger.info(f"✅ Análisis completado: {len(result['zones'])} zonas detectadas")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error en análisis de geometría: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== OR-TOOLS OPTIMIZATION ====================

# Importar optimizador OR-Tools
try:
    from optimizer_ortools import optimize_layout as ortools_optimize, LayoutOptimizer
    ORTOOLS_AVAILABLE = True
    logger.info("✅ Optimizador OR-Tools cargado")
except ImportError as e:
    ORTOOLS_AVAILABLE = False
    ortools_optimize = None
    logger.warning(f"⚠️ OR-Tools no disponible: {e}")


class OptimizeLayoutRequest(BaseModel):
    """Request para optimización de layout"""
    dimensions: Dict[str, float] = Field(
        ..., 
        description="Dimensiones de la nave: {length, width}",
        example={"length": 80, "width": 40}
    )
    elements: List[Dict] = Field(
        ..., 
        description="Lista de elementos"
    )
    moved_element_id: Optional[str] = Field(
        None,
        description="ID del elemento que se movió manualmente"
    )
    moved_position: Optional[Dict[str, float]] = Field(
        None,
        description="Nueva posición del elemento movido: {x, y}"
    )
    fixed_elements: Optional[List[str]] = Field(
        None,
        description="IDs de elementos que no deben moverse"
    )


class OptimizedElementResponse(BaseModel):
    """Elemento optimizado"""
    id: str
    type: str
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0
    was_moved: bool = False


class OptimizeLayoutResponse(BaseModel):
    """Response de optimización"""
    success: bool
    elements: List[OptimizedElementResponse]
    solver_status: str
    solve_time_ms: float
    objective_value: float
    messages: List[str]


@app.post(
    "/api/layout/optimize",
    summary="Optimización con OR-Tools",
    description="""
    Optimiza el layout usando Google OR-Tools.
    
    Cuando mueves un elemento manualmente:
    1. Fija ese elemento en la nueva posición
    2. Recoloca automáticamente los demás elementos
    3. Mantiene restricciones de pasillo mínimo (3.5m)
    4. Evita solapamientos
    5. Minimiza distancia de picking a muelles
    
    Tiempo máximo: 5 segundos
    """
)
async def optimize_layout_ortools(request: OptimizeLayoutRequest):
    """
    Endpoint para optimización inteligente del layout
    """
    if not ORTOOLS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="OR-Tools no disponible. Instalar: pip install ortools"
        )
    
    try:
        logger.info(f"🧮 Optimizando layout: {len(request.elements)} elementos")
        
        result = ortools_optimize(
            dimensions=request.dimensions,
            elements=request.elements,
            moved_element_id=request.moved_element_id,
            moved_position=request.moved_position,
            fixed_elements=request.fixed_elements
        )
        
        logger.info(f"✅ Optimización completada: {result['solver_status']}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error en optimización: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DXF EXPORT ====================

# Importar exportador DXF
try:
    from dxf_exporter import export_to_dxf, DXFExporter
    DXF_AVAILABLE = True
    logger.info("✅ Exportador DXF cargado")
except ImportError as e:
    DXF_AVAILABLE = False
    export_to_dxf = None
    logger.warning(f"⚠️ Exportador DXF no disponible: {e}")


class ExportDXFRequest(BaseModel):
    """Request para exportar DXF"""
    dimensions: Dict[str, float] = Field(
        ..., 
        description="Dimensiones de la nave"
    )
    elements: List[Dict] = Field(
        ..., 
        description="Lista de elementos"
    )
    zones: Optional[List[Dict]] = Field(
        None,
        description="Zonas auto-detectadas (opcional)"
    )
    include_dimensions: bool = Field(
        True,
        description="Incluir acotaciones"
    )
    include_grid: bool = Field(
        True,
        description="Incluir grid de referencia"
    )
    scale: str = Field(
        "1:100",
        description="Escala del plano"
    )


@app.post(
    "/api/layout/export/dxf",
    summary="Exportar a DXF",
    description="""
    Exporta el layout a formato DXF profesional.
    
    Características:
    - Compatible con AutoCAD 2018+
    - Capas separadas por tipo de elemento
    - Acotaciones automáticas
    - Escala 1:1 (metros)
    - Cajetín con información del proyecto
    """
)
async def export_layout_dxf(request: ExportDXFRequest):
    """
    Endpoint para exportar layout a DXF
    """
    if not DXF_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Exportador DXF no disponible. Instalar: pip install ezdxf"
        )
    
    try:
        logger.info(f"📐 Exportando DXF: {request.dimensions}")
        
        dxf_bytes = export_to_dxf(
            dimensions=request.dimensions,
            elements=request.elements,
            zones=request.zones
        )
        
        # Crear nombre de archivo
        length = int(request.dimensions.get('length', 80))
        width = int(request.dimensions.get('width', 40))
        filename = f"plano_nave_{length}x{width}.dxf"
        
        logger.info(f"✅ DXF generado: {filename}")
        
        from fastapi.responses import Response
        return Response(
            content=dxf_bytes,
            media_type="application/dxf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Error exportando DXF: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== COMBINED ENDPOINT ====================

class FullLayoutRequest(BaseModel):
    """Request completo para análisis + optimización"""
    dimensions: Dict[str, float]
    elements: List[Dict]
    moved_element_id: Optional[str] = None
    moved_position: Optional[Dict[str, float]] = None
    optimize: bool = True


class FullLayoutResponse(BaseModel):
    """Response completo"""
    elements: List[Dict]
    zones: List[Dict]
    metrics: Dict
    warnings: List[Dict]
    optimization: Optional[Dict] = None


@app.post(
    "/api/layout/full",
    summary="Análisis Completo (Geometría + Optimización)",
    description="""
    Endpoint combinado que:
    1. Optimiza posiciones si se especifica un elemento movido
    2. Calcula geometría exacta
    3. Detecta pasillos y zonas
    4. Valida normativa ERP
    5. Retorna todo en una sola llamada
    """
)
async def full_layout_analysis(request: FullLayoutRequest):
    """
    Endpoint completo para frontend inteligente
    """
    try:
        result_elements = request.elements
        optimization_result = None
        
        # 1. Optimizar si hay movimiento
        if request.optimize and request.moved_element_id and ORTOOLS_AVAILABLE:
            logger.info(f"🧮 Optimizando por movimiento de {request.moved_element_id}")
            
            opt_result = ortools_optimize(
                dimensions=request.dimensions,
                elements=request.elements,
                moved_element_id=request.moved_element_id,
                moved_position=request.moved_position
            )
            
            if opt_result['success']:
                # Convertir elementos optimizados al formato original
                result_elements = []
                for opt_el in opt_result['elements']:
                    # Buscar elemento original
                    original = next(
                        (e for e in request.elements if e.get('id') == opt_el['id']),
                        {}
                    )
                    
                    # Actualizar posición
                    updated = {**original}
                    if 'position' in updated:
                        updated['position']['x'] = opt_el['x']
                        updated['position']['y'] = opt_el['y']
                    else:
                        updated['x'] = opt_el['x']
                        updated['y'] = opt_el['y']
                    
                    result_elements.append(updated)
                
                optimization_result = {
                    'success': True,
                    'solver_status': opt_result['solver_status'],
                    'solve_time_ms': opt_result['solve_time_ms'],
                    'messages': opt_result['messages']
                }
        
        # 2. Analizar geometría
        if GEOMETRY_AVAILABLE:
            geometry_result = analyze_layout(
                dimensions=request.dimensions,
                elements=result_elements
            )
        else:
            geometry_result = {
                'zones': [],
                'metrics': {},
                'warnings': []
            }
        
        return {
            'elements': result_elements,
            'zones': geometry_result.get('zones', []),
            'metrics': geometry_result.get('metrics', {}),
            'warnings': geometry_result.get('warnings', []),
            'optimization': optimization_result
        }
        
    except Exception as e:
        logger.error(f"❌ Error en análisis completo: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("🏭 UNITNAVE Designer API v6.0 - Motor CAD Profesional")
    logger.info("=" * 60)
    logger.info(f"📍 CORS: {ALLOWED_ORIGINS}")
    logger.info(f"🎯 Multi-Escenario: Activo")
    logger.info(f"📊 Fitness Evaluation: Activo")
    logger.info(f"🧬 GA disponible: {GA_AVAILABLE}")
    logger.info(f"📐 Geometría exacta (Shapely): {GEOMETRY_AVAILABLE}")
    logger.info(f"🧮 Optimizador (OR-Tools): {ORTOOLS_AVAILABLE}")
    logger.info(f"📄 Export DXF: {DXF_AVAILABLE}")
    logger.info("=" * 60)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
