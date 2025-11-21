"""
UNITNAVE - API Backend para Diseñador de Naves Industriales 3D
FastAPI + Python 3.11+
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime
import json

app = FastAPI(
    title="UNITNAVE Diseñador API",
    description="API para diseño interactivo de naves industriales",
    version="1.0.0"
)

# CORS para permitir conexiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especifica dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== MODELOS DE DATOS ====================

class ElementPosition(BaseModel):
    x: float
    y: float
    z: float
    rotation: float = 0.0

class WarehouseElement(BaseModel):
    id: str
    type: str  # "shelf", "office", "dock", "picking_zone"
    position: ElementPosition
    dimensions: Dict[str, float]
    properties: Optional[Dict] = {}

class WarehouseDesign(BaseModel):
    id: Optional[str] = None
    name: str
    dimensions: Dict[str, float]  # length, width, height
    elements: List[WarehouseElement]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CapacityCalculation(BaseModel):
    total_pallets: int
    usable_area: float
    occupied_area: float
    circulation_area: float
    efficiency_percentage: float
    warnings: List[str]

# ==================== BASE DE DATOS EN MEMORIA (temporal) ====================
# En producción usarías PostgreSQL con SQLAlchemy
designs_db: Dict[str, WarehouseDesign] = {}

# ==================== ENDPOINTS ====================

@app.get("/")
async def root():
    """Endpoint raíz - información de la API"""
    return {
        "app": "UNITNAVE Diseñador de Naves",
        "version": "1.0.0",
        "status": "online",
        "endpoints": {
            "designs": "/api/designs",
            "calculate": "/api/calculate",
            "render": "/api/render"
        }
    }

@app.get("/health")
async def health_check():
    """Health check para Railway"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# ==================== DISEÑOS ====================

@app.post("/api/designs", response_model=WarehouseDesign)
async def create_design(design: WarehouseDesign):
    """Crear un nuevo diseño de nave"""
    design.id = str(uuid.uuid4())
    design.created_at = datetime.now()
    design.updated_at = datetime.now()
    designs_db[design.id] = design
    return design

@app.get("/api/designs/{design_id}", response_model=WarehouseDesign)
async def get_design(design_id: str):
    """Obtener un diseño específico"""
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    return designs_db[design_id]

@app.put("/api/designs/{design_id}", response_model=WarehouseDesign)
async def update_design(design_id: str, design: WarehouseDesign):
    """Actualizar un diseño existente"""
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    design.id = design_id
    design.updated_at = datetime.now()
    design.created_at = designs_db[design_id].created_at
    designs_db[design_id] = design
    return design

@app.delete("/api/designs/{design_id}")
async def delete_design(design_id: str):
    """Eliminar un diseño"""
    if design_id not in designs_db:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    del designs_db[design_id]
    return {"message": "Diseño eliminado correctamente"}

@app.get("/api/designs", response_model=List[WarehouseDesign])
async def list_designs(limit: int = 50):
    """Listar todos los diseños"""
    return list(designs_db.values())[:limit]

# ==================== CÁLCULOS ====================

@app.post("/api/calculate", response_model=CapacityCalculation)
async def calculate_capacity(design: WarehouseDesign):
    """Calcular capacidad y métricas del diseño"""
    
    # Constantes
    PALLET_EUR_SIZE = 1.2 * 0.8  # m²
    MIN_AISLE_WIDTH = 3.5  # metros
    SAFETY_MARGIN = 1.0  # metros
    
    total_area = design.dimensions["length"] * design.dimensions["width"]
    occupied_area = 0
    total_pallets = 0
    warnings = []
    
    # ✅ CORRECCIÓN: Calcular office_area desde elements
    office_area = 0
    
    # Calcular área ocupada y capacidad por elemento
    for element in design.elements:
        # Calcular área del elemento
        if element.type == "shelf":
            element_area = element.dimensions.get("length", 0) * element.dimensions.get("depth", 1.1)
        elif element.type == "office":
            element_area = element.dimensions.get("length", 0) * element.dimensions.get("width", 0)
            office_area += element_area  # ✅ Sumar área de oficinas
        elif element.type == "dock":
            element_area = element.dimensions.get("width", 3.0) * 3.0  # Profundidad típica muelle
        else:
            element_area = 0
        
        occupied_area += element_area
        
        if element.type == "shelf":
            # Calcular palets por estantería
            levels = element.properties.get("levels", 4)
            shelf_length = element.dimensions.get("length", 0)
            shelf_depth = element.dimensions.get("depth", 1.1)
            
            # ✅ CORRECCIÓN: Considerar rotación para cálculo de palets
            rotation = element.position.rotation if hasattr(element.position, 'rotation') else 0
            
            # Si está rotado 90° o 270°, intercambiar dimensiones
            if abs(rotation % 180) > 45 and abs(rotation % 180) < 135:
                shelf_length, shelf_depth = shelf_depth, shelf_length
            
            pallets_per_level = int((shelf_length / 1.2) * (shelf_depth / 0.8))
            total_pallets += pallets_per_level * levels
        
        elif element.type == "dock":
            # Verificar espacio para maniobra
            if element.position.y < 5.0:
                warnings.append(f"Muelle {element.id[:8]} necesita más espacio de maniobra")
    
    # Verificar pasillos
    circulation_area = total_area - occupied_area
    
    if circulation_area < total_area * 0.30:
        warnings.append("Área de circulación insuficiente (recomendado >30%)")
    
    # ✅ CORRECCIÓN: Calcular eficiencia correctamente
    usable_area = total_area - office_area
    efficiency = (occupied_area / usable_area * 100) if usable_area > 0 else 0
    
    return CapacityCalculation(
        total_pallets=total_pallets,
        usable_area=round(usable_area, 2),
        occupied_area=round(occupied_area, 2),
        circulation_area=round(circulation_area, 2),
        efficiency_percentage=round(efficiency, 2),
        warnings=warnings
    )

# ==================== RENDERS BLENDER ====================

@app.post("/api/render")
async def request_render(design: WarehouseDesign, background_tasks: BackgroundTasks):
    """Solicitar render profesional con Blender"""
    
    render_id = str(uuid.uuid4())
    
    # Agregar tarea en segundo plano
    background_tasks.add_task(generate_blender_render, design, render_id)
    
    return {
        "render_id": render_id,
        "status": "processing",
        "estimated_time": "60-90 segundos",
        "message": "Render en proceso. Consulta el estado en /api/render/{render_id}"
    }

@app.get("/api/render/{render_id}")
async def get_render_status(render_id: str):
    """Obtener estado del render"""
    # Aquí conectarías con el sistema de renders Blender
    return {
        "render_id": render_id,
        "status": "completed",  # "processing", "completed", "failed"
        "url": f"https://storage.unitnave.com/renders/{render_id}.png",
        "thumbnail": f"https://storage.unitnave.com/renders/{render_id}_thumb.png"
    }

# ==================== FUNCIÓN AUXILIAR BLENDER ====================

async def generate_blender_render(design: WarehouseDesign, render_id: str):
    """
    Generar render con Blender (esta función se ejecuta en background)
    En producción, esto llamaría a Blender vía subprocess
    """
    import asyncio
    
    # Simular tiempo de render
    await asyncio.sleep(5)
    
    # Aquí iría el código real de Blender
    # Ejemplo:
    # blender_script = generate_blender_script(design)
    # subprocess.run(["blender", "--background", "--python", blender_script])
    
    print(f"Render {render_id} completado para diseño {design.name}")

# ==================== EXPORTACIÓN PDF ====================

@app.post("/api/export/pdf")
async def export_pdf(design: WarehouseDesign):
    """Exportar diseño a PDF con planos y medidas"""
    
    # Aquí generarías el PDF con ReportLab o similar
    pdf_id = str(uuid.uuid4())
    
    return {
        "pdf_id": pdf_id,
        "url": f"https://storage.unitnave.com/pdfs/{pdf_id}.pdf",
        "filename": f"{design.name.replace(' ', '_')}.pdf"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
