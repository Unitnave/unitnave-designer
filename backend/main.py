"""
UNITNAVE API v3.2
Backend FastAPI Completo y Corregido
"""

import os
import logging
from datetime import datetime
from typing import Dict, List, Optional
import asyncio
import uuid
import json

from fastapi import FastAPI, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError, Field

# Importaciones de tus módulos locales
from models import (
    WarehouseInput, OptimizationResult, ElementPosition, 
    ElementDimensions, WarehouseElement
)
from optimizer import WarehouseOptimizer, generate_multi_scenario_layouts

# ==================== CONFIGURACIÓN ====================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="UNITNAVE Diseñador API",
    description="API para diseño interactivo de naves industriales",
    version="3.2.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# ⭐ CORS SEGURO
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://unitnave-designer-production.up.railway.app"
).split(",")

logger.info(f"🔒 CORS configurado para: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELOS DE API ====================

class WarehouseDesign(BaseModel):
    """Diseño completo de nave para guardar en DB"""
    id: Optional[str] = None
    name: str
    dimensions: Dict[str, float]  # length, width, height
    elements: List[WarehouseElement]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CapacityCalculation(BaseModel):
    """Resultado de cálculo simple"""
    total_pallets: int
    usable_area: float
    occupied_area: float
    circulation_area: float
    efficiency_percentage: float
    warnings: List[str] = Field(default_factory=list)

# ==================== BASE DE DATOS (Memoria) ====================
# En producción, conectar a PostgreSQL
designs_db: Dict[str, WarehouseDesign] = {}
render_jobs: Dict[str, Dict] = {}

# ==================== MANEJO DE ERRORES ====================

@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Error de validación de datos", "errors": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Error no controlado: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Error interno del servidor", "message": str(exc)}
    )

# ==================== ENDPOINTS BÁSICOS ====================

@app.get("/")
async def root():
    return {
        "app": "UNITNAVE Diseñador API",
        "status": "online",
        "version": "3.2.0",
        "docs": "/api/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ==================== ENDPOINTS DISEÑOS (CRUD) ====================

@app.post("/api/designs", response_model=WarehouseDesign)
async def create_design(design: WarehouseDesign):
    design.id = str(uuid.uuid4())
    design.created_at = datetime.now()
    design.updated_at = datetime.now()
    designs_db[design.id] = design
    return design

@app.get("/api/designs/{design_id}", response_model=WarehouseDesign)
async def get_design(design_id: str):
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    return designs_db[design_id]

@app.put("/api/designs/{design_id}", response_model=WarehouseDesign)
async def update_design(design_id: str, design: WarehouseDesign):
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    design.id = design_id
    design.created_at = designs_db[design_id].created_at
    design.updated_at = datetime.now()
    designs_db[design_id] = design
    return design

@app.delete("/api/designs/{design_id}")
async def delete_design(design_id: str):
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    del designs_db[design_id]
    return {"message": "Diseño eliminado"}

@app.get("/api/designs", response_model=List[WarehouseDesign])
async def list_designs(limit: int = 50):
    return list(designs_db.values())[:limit]

# ==================== ENDPOINTS OPTIMIZACIÓN (CRÍTICO) ====================

@app.post("/api/optimize", response_model=OptimizationResult)
async def optimize_warehouse(input_data: WarehouseInput):
    """
    ⭐ Generar diseño optimizado (Algoritmo V3)
    Este es el endpoint que te daba error 404.
    """
    try:
        logger.info(f"🚀 Optimizando nave: {input_data.length}x{input_data.width}m")
        
        # Validar dimensiones
        if input_data.length < 15 or input_data.length > 150:
            raise HTTPException(status_code=400, detail="Largo debe estar entre 15-150m")
            
        # Ejecutar optimizador
        optimizer = WarehouseOptimizer(input_data)
        result = optimizer.generate_layout()
        
        return result
        
    except Exception as e:
        logger.error(f"Error en optimización: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error optimizando: {str(e)}")

@app.post("/api/optimize/scenarios")
async def optimize_multi_scenario(input_data: WarehouseInput):
    """
    🔄 Generar múltiples escenarios (A, B, C) para comparar
    """
    try:
        logger.info("🔄 Generando escenarios comparativos...")
        scenarios = generate_multi_scenario_layouts(input_data)
        return scenarios
    except Exception as e:
        logger.error(f"Error en escenarios: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== CÁLCULO MANUAL ====================

@app.post("/api/calculate", response_model=CapacityCalculation)
async def calculate_capacity(design: WarehouseDesign):
    """Cálculo de capacidad para modo manual"""
    try:
        total_area = design.dimensions["length"] * design.dimensions["width"]
        occupied_area = 0
        total_pallets = 0
        office_area = 0
        warnings = []
        
        for element in design.elements:
            # Área
            dims = element.dimensions
            if element.type == "shelf":
                area = dims.length * dims.depth
                # Palets (lógica simplificada)
                levels = getattr(dims, 'levels', 4) or 4
                pallets = int((dims.length / 1.2) * (dims.depth / 0.8)) * levels
                total_pallets += pallets
                occupied_area += area
            elif element.type == "office":
                area = (dims.largo or dims.length) * (dims.ancho or dims.width)
                office_area += area
                occupied_area += area
            elif element.type == "dock":
                area = (dims.width) * (dims.depth or 3)
                occupied_area += area

        usable_area = total_area - office_area
        efficiency = (occupied_area / usable_area * 100) if usable_area > 0 else 0
        circulation = total_area - occupied_area

        if circulation < total_area * 0.3:
            warnings.append("Área de circulación baja (<30%)")

        return CapacityCalculation(
            total_pallets=total_pallets,
            usable_area=round(usable_area, 2),
            occupied_area=round(occupied_area, 2),
            circulation_area=round(circulation, 2),
            efficiency_percentage=round(efficiency, 2),
            warnings=warnings
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== RENDERS (Blender) ====================

async def generate_blender_render(design: WarehouseDesign, render_id: str):
    """Tarea en background para renderizar"""
    try:
        render_jobs[render_id]["status"] = "processing"
        
        # Intentar usar módulo blender
        try:
            from blender_render import generate_render
            output_path = f"/tmp/renders/{render_id}.png"
            
            # Preparar datos para el script de blender
            render_data = {
                "dimensions": design.dimensions,
                "elements": [
                    {
                        "type": el.type,
                        "position": el.position.dict(),
                        "dimensions": el.dimensions.dict()
                    } for el in design.elements
                ]
            }
            
            success = generate_render(json.dumps(render_data), output_path)
            
            if success:
                render_jobs[render_id]["status"] = "completed"
                render_jobs[render_id]["url"] = f"/renders/{render_id}.png" # Demo URL
            else:
                render_jobs[render_id]["status"] = "error"
                
        except ImportError:
            # Fallback si no hay blender instalado
            await asyncio.sleep(3)
            render_jobs[render_id]["status"] = "completed"
            render_jobs[render_id]["url"] = "https://via.placeholder.com/800x600.png?text=Render+Simulado"
            
    except Exception as e:
        logger.error(f"Render error: {e}")
        render_jobs[render_id]["status"] = "error"

@app.post("/api/render")
async def request_render(design: WarehouseDesign, background_tasks: BackgroundTasks):
    render_id = str(uuid.uuid4())
    render_jobs[render_id] = {"status": "queued", "created_at": datetime.now()}
    
    background_tasks.add_task(generate_blender_render, design, render_id)
    
    return {
        "render_id": render_id,
        "status": "queued",
        "message": "Render iniciado"
    }

@app.get("/api/render/{render_id}")
async def get_render_status(render_id: str):
    if render_id not in render_jobs:
        raise HTTPException(status_code=404, detail="Render no encontrado")
    return render_jobs[render_id]

# ==================== STARTUP ====================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)