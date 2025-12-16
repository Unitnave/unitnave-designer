"""
UNITNAVE API v6.3.1 - Motor CAD Profesional
Backend con Optimizador Unificado + Geometría Exacta (Shapely) + DXF + WebSocket

CAMBIOS v6.3.1:
- ✅ Optimizer unificado con ConfigResolver (usa machinery del usuario)
- ✅ /api/layout/reoptimize_smart pasa machinery al optimizer
- ✅ /api/layout/full pasa machinery al optimizer
- ✅ FullLayoutRequest incluye campo machinery

ARCHIVO: backend/main.py
"""

import os
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
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

# Importar Geometría (Shapely)
try:
    from geometry_service import analyze_layout, GeometryService
    GEOMETRY_AVAILABLE = True
    logger.info("✅ Servicio de geometría exacta cargado (Shapely)")
except ImportError as e:
    GEOMETRY_AVAILABLE = False
    analyze_layout = None
    logger.warning(f"⚠️ Servicio de geometría no disponible: {e}")

# Importar Optimizer Unificado (antes OR-Tools, ahora con Quantum Brain)
try:
    from optimizer_ortools import optimize_layout as ortools_optimize, LayoutOptimizer, AISLE_WIDTHS
    ORTOOLS_AVAILABLE = True
    logger.info("✅ Optimizador Unificado cargado (Quantum Brain)")
except ImportError as e:
    ORTOOLS_AVAILABLE = False
    ortools_optimize = None
    LayoutOptimizer = None
    AISLE_WIDTHS = {}
    logger.warning(f"⚠️ Optimizador no disponible: {e}")

# Importar DXF
try:
    from dxf_exporter import export_to_dxf, DXFExporter
    DXF_AVAILABLE = True
    logger.info("✅ Exportador DXF cargado")
except ImportError as e:
    DXF_AVAILABLE = False
    export_to_dxf = None
    logger.warning(f"⚠️ Exportador DXF no disponible: {e}")

# ==================== WEBSOCKET (NUEVO) ====================
WEBSOCKET_AVAILABLE = False
ws_router = None
layout_engines = {}

# ==================== FASTAPI APP ====================
app = FastAPI(
    title="UNITNAVE Designer API",
    description="API para diseño y optimización de naves industriales - Motor CAD Profesional",
    version="6.3.1",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# ==================== DEBUG WEBSOCKET ====================

print("=" * 60)
print("🔍 DEBUG: Verificando WebSocket...")

try:
    from websocket_routes import router as ws_router
    print("✅ websocket_routes.py importado correctamente")
    
    routes = [r.path for r in ws_router.routes]
    print(f"✅ Rutas en el router: {routes}")
    
    app.include_router(ws_router)
    print("✅ Router montado en app")
    
    WEBSOCKET_AVAILABLE = True
    
except Exception as e:
    print(f"❌ ERROR AL IMPORTAR/MONTAR: {e}")
    import traceback
    traceback.print_exc()
    WEBSOCKET_AVAILABLE = False
    
print(f"🔌 Estado final WEBSOCKET_AVAILABLE: {WEBSOCKET_AVAILABLE}")
print("=" * 60)


# ==================== MIDDLEWARE DE LOGGING ====================
@app.middleware("http")
async def log_every_single_request(request: Request, call_next):
    """Middleware para logging detallado de TODAS las requests"""
    logger.info("=" * 80)
    logger.info(f"🎯 INCOMING REQUEST: {request.method} {request.url}")
    logger.info(f"🎯 Client HOST: {request.client.host if request.client else 'UNKNOWN'}")
    
    if request.method in ["POST", "PUT"]:
        try:
            body = await request.body()
            body_str = body.decode()[:500] if body else "<empty>"
            logger.info(f"🎯 BODY: {body_str}")
            from starlette.requests import Request as StarletteRequest
            async def receive():
                return {"type": "http.request", "body": body}
            request = Request(request.scope, receive)
        except Exception as e:
            logger.info(f"🎯 BODY: <could not read: {e}>")
    
    try:
        response = await call_next(request)
        logger.info(f"🎯 RESPONSE STATUS: {response.status_code}")
        logger.info("=" * 80)
        return response
    except Exception as e:
        logger.error(f"🔥 ERROR EN REQUEST: {e}")
        logger.info("=" * 80)
        raise


# ==================== MIDDLEWARE CORS PARA WEBSOCKET ====================
@app.middleware("http")
async def websocket_cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin", "")
    
    if request.method == "OPTIONS":
        response = Response(status_code=200)
        response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response
    
    response = await call_next(request)
    
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response


# ==================== CORS ESTÁNDAR ====================
ALLOWED_ORIGINS_DEFAULT = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://unitnave.vercel.app",
    "https://unitnave.com",
    "https://unitnave-designer.vercel.app",
    "https://unitnave-designer-production.up.railway.app"
]

ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
if ALLOWED_ORIGINS_ENV:
    ALLOWED_ORIGINS_LIST = [origin.strip() for origin in ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
else:
    ALLOWED_ORIGINS_LIST = ALLOWED_ORIGINS_DEFAULT

logger.info(f"🌐 CORS configurado para: {ALLOWED_ORIGINS_LIST}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ==================== DEBUG ENDPOINT ====================
@app.get("/debug/websocket-diagnosis")
async def websocket_diagnosis(request: Request):
    """Endpoint de diagnóstico"""
    routes = [route.path for route in app.routes if hasattr(route, "path")]
    websocket_routes = ["/ws/layout/{session_id}", "/realtime/layout/{session_id}"]
    
    mounted_routes = []
    for ws_route in websocket_routes:
        if ws_route in routes:
            mounted_routes.append(ws_route)
    
    is_mounted = len(mounted_routes) > 0
    
    return {
        "status": "diagnosis_complete",
        "websocket_available": WEBSOCKET_AVAILABLE,
        "websocket_route_mounted": is_mounted,
        "mounted_routes": mounted_routes,
        "services": {
            "geometry": GEOMETRY_AVAILABLE,
            "ortools": ORTOOLS_AVAILABLE,
            "dxf": DXF_AVAILABLE,
            "ga": GA_AVAILABLE,
            "websocket": WEBSOCKET_AVAILABLE
        },
        "aisle_widths": AISLE_WIDTHS if ORTOOLS_AVAILABLE else {}
    }


# ==================== MODELOS REQUEST ====================

class OfficeConfigRequest(BaseModel):
    """Configuración de oficinas V5.2"""
    floor: str = Field(default="mezzanine")
    position: str = Field(default="front_left")
    height_under: float = Field(default=4.0, ge=2.5, le=8.0)
    floor_height: float = Field(default=3.0, ge=2.5, le=4.0)
    num_floors: int = Field(default=1, ge=1, le=5)
    area_per_floor: float = Field(default=100, ge=30, le=500)
    has_elevator: bool = Field(default=True)
    has_stairs: bool = Field(default=True)
    area: Optional[float] = Field(default=None)
    mezzanine_height: Optional[float] = Field(default=None)


class DockConfigRequest(BaseModel):
    """Configuración de muelles"""
    count: int = Field(default=4, ge=1, le=20)
    position: str = Field(default="center")
    maneuver_zone: float = Field(default=4.0, ge=3.0, le=12.0)
    dock_width: float = Field(default=3.5, ge=3.0, le=5.0)
    dock_depth: float = Field(default=4.0, ge=3.0, le=6.0)


class PreferencesRequest(BaseModel):
    """Preferencias de diseño"""
    include_offices: bool = Field(default=True)
    include_services: bool = Field(default=True)
    include_docks: bool = Field(default=True)
    include_technical: bool = Field(default=True)
    priority: str = Field(default="balance")
    warehouse_type: str = Field(default="industrial")
    layout_complexity: str = Field(default="medio")
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
    length: float = Field(..., gt=10, le=500)
    width: float = Field(..., gt=10, le=500)
    height: float = Field(..., gt=3, le=20)
    n_docks: int = Field(default=4, ge=1, le=50)
    machinery: str = Field(default="retractil")
    pallet_type: str = Field(default="EUR")
    pallet_height: Optional[float] = Field(default=1.5, ge=0.5, le=3.0)
    custom_pallet: Optional[Dict[str, float]] = None
    activity_type: str = Field(default="industrial")
    workers: Optional[int] = Field(default=None, ge=1, le=500)
    office_floor: str = Field(default="mezzanine")
    office_height: float = Field(default=3.5, ge=2.5, le=5)
    has_elevator: bool = Field(default=True)
    office_config: Optional[OfficeConfigRequest] = None
    dock_config: Optional[DockConfigRequest] = None
    preferences: Optional[PreferencesRequest] = None
    ga_config: Optional[GAConfigRequest] = None


class CalculateRequest(BaseModel):
    """Request para cálculos"""
    name: str = "Cálculo"
    dimensions: Dict[str, float]
    elements: List[Dict]


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
    machinery: Optional[str] = Field(
        None,
        description="Tipo de maquinaria para calcular pasillo"
    )


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


class FullLayoutRequest(BaseModel):
    """Request completo para análisis + optimización"""
    dimensions: Dict[str, float]
    elements: List[Dict]
    moved_element_id: Optional[str] = None
    moved_position: Optional[Dict[str, float]] = None
    optimize: bool = True
    machinery: Optional[str] = None  # ✅ AÑADIDO: machinery del usuario


# ==================== BASE DE DATOS (Memoria) ====================
designs_db: Dict[str, Dict] = {}


# ==================== FUNCIONES AUXILIARES ====================

def build_office_config_dict(request: OptimizeRequest) -> Optional[Dict]:
    """Construye diccionario de office_config desde request."""
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
    """Construye WarehouseInput desde request con soporte V5.2."""
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
        office_config=office_config_dict,
        office_floor=request.office_config.floor if request.office_config else request.office_floor,
        office_height=getattr(request.office_config, 'floor_height', 3.5) if request.office_config else (request.office_height or 3.5),
        has_elevator=request.office_config.has_elevator if request.office_config else request.has_elevator
    )


def build_preferences(request: OptimizeRequest) -> Optional[DesignPreferences]:
    """Construye DesignPreferences desde request."""
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
        enable_abc_zones=request.preferences.enable_abc_zones,
        abc_zone_a_pct=request.preferences.abc_zone_a_pct,
        abc_zone_b_pct=request.preferences.abc_zone_b_pct,
        abc_zone_c_pct=request.preferences.abc_zone_c_pct,
        forbidden_zones=request.preferences.forbidden_zones,
        high_rotation_pct=request.preferences.high_rotation_pct
    )


# ==================== ENDPOINTS BÁSICOS ====================

@app.get("/")
async def root():
    logger.info("🏠 Root endpoint llamado")
    return {
        "name": "UNITNAVE Designer API",
        "version": "6.3.1",
        "status": "running",
        "features": {
            "multi_scenario": True,
            "fitness_evaluation": True,
            "detailed_report": True,
            "geometry_exact": GEOMETRY_AVAILABLE,
            "quantum_brain_optimizer": ORTOOLS_AVAILABLE,
            "dxf_export": DXF_AVAILABLE,
            "ga_optimizer": GA_AVAILABLE,
            "websocket_interactive": WEBSOCKET_AVAILABLE,
            "machinery_aisle_widths": True
        },
        "aisle_widths": AISLE_WIDTHS if ORTOOLS_AVAILABLE else {},
        "endpoints": {
            "optimize": "/api/optimize",
            "scenarios": "/api/scenarios",
            "compare": "/api/optimize/compare",
            "optimize_ga": "/api/optimize/ga",
            "calculate": "/api/calculate",
            "layout_analyze": "/api/layout/analyze",
            "layout_optimize": "/api/layout/optimize",
            "layout_export_dxf": "/api/layout/export/dxf",
            "layout_full": "/api/layout/full",
            "reoptimize_smart": "/api/layout/reoptimize_smart",
            "websocket": "/ws/layout/{session_id}",
            "debug": "/debug/websocket-diagnosis",
            "docs": "/api/docs"
        }
    }


@app.get("/api/health")
async def health():
    logger.info("💓 Health check llamado")
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "6.3.1",
        "services": {
            "geometry": GEOMETRY_AVAILABLE,
            "quantum_brain": ORTOOLS_AVAILABLE,
            "dxf": DXF_AVAILABLE,
            "ga": GA_AVAILABLE,
            "websocket": WEBSOCKET_AVAILABLE
        },
        "aisle_widths": AISLE_WIDTHS if ORTOOLS_AVAILABLE else {},
        "active_sessions": len(layout_engines) if WEBSOCKET_AVAILABLE else 0
    }


# ==================== ENDPOINT: ANCHOS DE PASILLO ====================

@app.get("/api/aisle-widths")
async def get_aisle_widths():
    """Retorna los anchos de pasillo por tipo de maquinaria"""
    if ORTOOLS_AVAILABLE and AISLE_WIDTHS:
        return {
            "aisle_widths": AISLE_WIDTHS,
            "default": 3.0
        }
    return {
        "aisle_widths": {
            'transpaleta': 1.8,
            'apilador': 2.4,
            'retractil': 2.8,
            'contrapesada': 3.6,
            'trilateral': 1.9
        },
        "default": 3.0
    }


# ==================== ENDPOINTS DE OPTIMIZACIÓN ====================

@app.post("/api/optimize")
async def optimize_layout(request: OptimizeRequest):
    """🚀 Optimización V5.2 Multi-Escenario"""
    try:
        logger.info(f"🚀 Optimización solicitada: {request.length}x{request.width}x{request.height}")
        
        input_data = build_warehouse_input(request)
        prefs = build_preferences(request)
        
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
    """📊 Obtener TODOS los escenarios evaluados"""
    try:
        logger.info(f"📊 Escenarios solicitados: {request.length}x{request.width}")
        
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
        
        logger.info(f"✅ {len(all_scenarios)} escenarios generados")
        
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
    """⚖️ Comparar mismo layout con diferentes prioridades"""
    try:
        logger.info(f"⚖️ Comparación de prioridades: {request.length}x{request.width}")
        
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
        
        scores = {k: v["score"] for k, v in comparison.items()}
        recommended = max(scores, key=scores.get)
        
        logger.info(f"✅ Comparación completada, recomendado: {recommended}")
        
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
    """🧬 Optimización con Algoritmo Genético"""
    if not GA_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="Optimizador GA no disponible."
        )
    
    try:
        logger.info(f"🧬 Optimización GA: {request.length}x{request.width}")
        
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
        
        result = optimize_with_ga(input_data, ga_config)
        
        logger.info(f"✅ GA completado: {result.capacity.total_pallets} palets")
        
        return result.model_dump() if hasattr(result, 'model_dump') else result.__dict__
        
    except Exception as e:
        logger.error(f"❌ Error en GA: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize/scenarios")
async def optimize_scenarios(request: OptimizeRequest):
    """📊 Comparador de escenarios por maquinaria"""
    try:
        logger.info(f"📊 Escenarios por maquinaria: {request.length}x{request.width}")
        
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


# ==================== CALCULATE ====================

@app.post("/api/calculate")
async def calculate_capacity(request: CalculateRequest):
    """Calcular capacidad y métricas de un diseño existente"""
    try:
        logger.info(f"🧮 Cálculo solicitado: {request.name}")
        
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
        
        logger.info(f"✅ Cálculo completado")
        
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
    logger.info(f"💾 Diseño guardado: {design_id}")
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
    logger.info(f"🗑️ Diseño eliminado: {design_id}")
    return {"message": "Diseño eliminado"}


# ==================== INFORME DETALLADO ====================

@app.post("/api/report")
async def generate_detailed_report(request: OptimizeRequest):
    """📋 Genera informe detallado"""
    try:
        logger.info(f"📋 Generando informe: {request.length}x{request.width}")
        
        from report_generator import ReportGenerator
        
        input_data = build_warehouse_input(request)
        prefs = build_preferences(request)
        
        optimizer = WarehouseOptimizer(input_data, prefs)
        result = optimizer.optimize()
        
        generator = ReportGenerator(result, input_data, prefs)
        report = generator.generate()
        report_dict = generator.to_dict()
        
        logger.info(f"📋 Informe generado")
        
        return report_dict
        
    except Exception as e:
        logger.error(f"❌ Error generando informe: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/report/pdf")
async def generate_pdf_report(request: OptimizeRequest):
    """📄 Genera informe en PDF"""
    try:
        logger.info(f"📄 Generando PDF: {request.length}x{request.width}")
        
        from report_generator import generate_pdf_report as gen_pdf
        import tempfile
        
        input_data = build_warehouse_input(request)
        prefs = build_preferences(request)
        
        optimizer = WarehouseOptimizer(input_data, prefs)
        result = optimizer.optimize()
        
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


# ==================== GEOMETRÍA EXACTA (SHAPELY) ====================

@app.post("/api/layout/analyze")
async def analyze_layout_geometry(request: LayoutAnalysisRequest):
    """Endpoint para análisis de geometría exacta del layout"""
    if not GEOMETRY_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Servicio de geometría no disponible."
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


# ==================== LAYOUT OPTIMIZE ====================

@app.post("/api/layout/optimize")
async def optimize_layout_ortools(request: OptimizeLayoutRequest):
    """Endpoint para optimización inteligente del layout"""
    if not ORTOOLS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Optimizador no disponible."
        )
    
    try:
        logger.info(f"🧮 Optimizando layout: {len(request.elements)} elementos")
        logger.info(f"    Maquinaria: {request.machinery or 'no especificada'}")
        
        # ✅ PASAR MACHINERY AL OPTIMIZER
        result = ortools_optimize(
            dimensions=request.dimensions,
            elements=request.elements,
            moved_element_id=request.moved_element_id,
            moved_position=request.moved_position,
            fixed_elements=request.fixed_elements,
            machinery=request.machinery  # ✅ AÑADIDO
        )
        
        logger.info(f"✅ Optimización completada: {result['solver_status']}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error en optimización: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DXF EXPORT ====================

@app.post("/api/layout/export/dxf")
async def export_layout_dxf(request: ExportDXFRequest):
    """Endpoint para exportar layout a DXF"""
    if not DXF_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Exportador DXF no disponible."
        )
    
    try:
        logger.info(f"📐 Exportando DXF: {request.dimensions}")
        
        dxf_bytes = export_to_dxf(
            dimensions=request.dimensions,
            elements=request.elements,
            zones=request.zones
        )
        
        length = int(request.dimensions.get('length', 80))
        width = int(request.dimensions.get('width', 40))
        filename = f"plano_nave_{length}x{width}.dxf"
        
        logger.info(f"✅ DXF generado: {filename}")
        
        return Response(
            content=dxf_bytes,
            media_type="application/dxf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
        
    except Exception as e:
        logger.error(f"❌ Error exportando DXF: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ENDPOINT COMBINADO: /api/layout/full ====================

@app.post("/api/layout/full")
async def full_layout_analysis(request: FullLayoutRequest):
    """Endpoint completo para frontend inteligente"""
    try:
        logger.info(f"🔄 Análisis completo: {len(request.elements)} elementos")
        logger.info(f"    Maquinaria: {request.machinery or 'no especificada'}")
        
        result_elements = request.elements
        optimization_result = None
        
        # 1. Optimizar si hay movimiento
        if request.optimize and request.moved_element_id and ORTOOLS_AVAILABLE:
            logger.info(f"🧮 Optimizando por movimiento de {request.moved_element_id}")
            
            # ✅ PASAR MACHINERY AL OPTIMIZER
            opt_result = ortools_optimize(
                dimensions=request.dimensions,
                elements=request.elements,
                moved_element_id=request.moved_element_id,
                moved_position=request.moved_position,
                machinery=request.machinery  # ✅ AÑADIDO
            )
            
            if opt_result['success']:
                result_elements = opt_result.get('elements', request.elements)
                
                optimization_result = {
                    'success': True,
                    'solver_status': opt_result['solver_status'],
                    'solve_time_ms': opt_result['solve_time_ms'],
                    'messages': opt_result['messages'],
                    'affected_shelves': opt_result.get('affected_shelves', []),
                    'animation_data': opt_result.get('animation_data', []),
                    'metrics': opt_result.get('metrics', {}),
                    'config': opt_result.get('config', {})
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
        
        logger.info(f"✅ Análisis completo terminado")
        
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


# ==================== REOPTIMIZE ENDPOINT (OPCIONAL) ====================
try:
    from reoptimize_endpoint import add_reoptimize_endpoint
    add_reoptimize_endpoint(app)
    REOPTIMIZE_AVAILABLE = True
    logger.info("✅ Endpoint /api/layout/reoptimize cargado")
except ImportError as e:
    REOPTIMIZE_AVAILABLE = False
    logger.warning(f"⚠️ Endpoint reoptimize no disponible: {e}")


# ==================== REOPTIMIZE SMART (CON ZONAS PROHIBIDAS) ====================

class ReoptimizeSmartRequest(BaseModel):
    """Request para re-optimización inteligente con zonas prohibidas"""
    moved_element_id: str = Field(..., description="ID del elemento movido")
    moved_position: Dict[str, float] = Field(..., description="Nueva posición {x, y}")
    originalConfig: Dict[str, Any] = Field(..., description="Configuración original del wizard")
    currentElements: List[Dict[str, Any]] = Field(..., description="Elementos actuales")
    forbiddenZones: List[Dict[str, Any]] = Field(default=[], description="Zonas prohibidas")


@app.post("/api/layout/reoptimize_smart")
async def reoptimize_smart(req: ReoptimizeSmartRequest):
    """
    🧠 Re-optimiza el layout usando el Quantum Brain.
    
    - Usa la MAQUINARIA del usuario para calcular pasillos
    - Detecta filas automáticamente
    - Desplaza estanterías vecinas si hay colisión
    - Hace snap a filas existentes
    """
    if not ORTOOLS_AVAILABLE or not LayoutOptimizer:
        raise HTTPException(
            status_code=503,
            detail="Optimizador no disponible."
        )
    
    try:
        logger.info("=" * 60)
        logger.info("🧠 /api/layout/reoptimize_smart LLAMADO")
        logger.info(f"   Elemento movido: {req.moved_element_id}")
        logger.info(f"   Nueva posición: {req.moved_position}")
        logger.info(f"   Elementos actuales: {len(req.currentElements)}")
        logger.info(f"   Zonas prohibidas: {len(req.forbiddenZones)}")
        
        # Obtener dimensiones y MAQUINARIA de la config
        length = req.originalConfig.get('length', 80)
        width = req.originalConfig.get('width', 40)
        machinery = req.originalConfig.get('machinery', 'retractil')  # ✅ OBTENER MACHINERY
        
        logger.info(f"   Maquinaria: {machinery}")
        logger.info("=" * 60)
        
        # ✅ CREAR OPTIMIZER CON MACHINERY DEL USUARIO
        optimizer = LayoutOptimizer(
            length=length, 
            width=width, 
            machinery=machinery  # ✅ PASAR MACHINERY
        )
        
        # Ejecutar optimización
        result = optimizer.optimize(
            elements=req.currentElements,
            moved_element_id=req.moved_element_id,
            moved_position=req.moved_position,
            max_time_seconds=5.0
        )
        
        if not result.get('success'):
            logger.warning(f"⚠️ No se encontró solución: {result.get('messages')}")
            raise HTTPException(
                status_code=400, 
                detail=f"No cabe en esa posición: {result.get('messages', ['Sin solución'])}"
            )
        
        logger.info(f"✅ Re-optimización exitosa en {result.get('solve_time_ms', 0):.0f}ms")
        logger.info(f"   Config usada: {result.get('config', {})}")
        
        return {
            "status": "success",
            "elements": result.get('elements', []),
            "solver_status": result.get('solver_status'),
            "solve_time_ms": result.get('solve_time_ms'),
            "affected_shelves": result.get('affected_shelves', []),
            "animation_data": result.get('animation_data', []),
            "metrics": result.get('metrics', {}),
            "config": result.get('config', {}),
            "moved_element": req.moved_element_id,
            "moved_position": req.moved_position
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error en reoptimize_smart: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

REOPTIMIZE_SMART_AVAILABLE = True
logger.info("✅ Endpoint /api/layout/reoptimize_smart cargado")


# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    logger.info("=" * 80)
    logger.info("🏭 UNITNAVE Designer API v6.3.1 - Quantum Brain Edition")
    logger.info("🧠 Optimizador con detección de filas + machinery del usuario")
    logger.info("=" * 80)
    logger.info(f"📍 CORS: {ALLOWED_ORIGINS_LIST}")
    logger.info(f"🎯 Multi-Escenario: Activo")
    logger.info(f"📊 Fitness Evaluation: Activo")
    logger.info(f"🧬 GA disponible: {GA_AVAILABLE}")
    logger.info(f"📐 Geometría exacta (Shapely): {GEOMETRY_AVAILABLE}")
    logger.info(f"🧠 Quantum Brain Optimizer: {ORTOOLS_AVAILABLE}")
    logger.info(f"📄 Export DXF: {DXF_AVAILABLE}")
    logger.info(f"🔌 WebSocket: {WEBSOCKET_AVAILABLE}")
    logger.info(f"🔄 Reoptimize Smart: {REOPTIMIZE_SMART_AVAILABLE}")
    if ORTOOLS_AVAILABLE:
        logger.info(f"🚜 Anchos de pasillo: {AISLE_WIDTHS}")
    logger.info("=" * 80)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
