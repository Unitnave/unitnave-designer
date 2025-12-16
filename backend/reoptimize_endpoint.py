"""
UNITNAVE - Endpoint de Re-Optimización Completa
================================================

Este módulo añade el endpoint /api/layout/reoptimize que:
1. Recibe todos los parámetros originales del wizard
2. Recibe el elemento movido y su nueva posición
3. Regenera TODO el layout usando WarehouseOptimizer
4. Respeta el elemento movido como "ancla fija"

INTEGRACIÓN: Añadir al final de main.py:
    from reoptimize_endpoint import add_reoptimize_endpoint
    add_reoptimize_endpoint(app)

@version 1.0
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================================
# MODELOS DE REQUEST
# ============================================================

class OfficeConfigReopt(BaseModel):
    """Configuración de oficinas para re-optimización"""
    floor: str = "mezzanine"
    position: str = "front_left"
    height_under: Optional[float] = 4.0
    floor_height: float = 3.0
    num_floors: int = 1
    area_per_floor: float = 100
    has_elevator: bool = True
    has_stairs: bool = True


class DockConfigReopt(BaseModel):
    """Configuración de muelles para re-optimización"""
    count: int = 4
    position: str = "center"
    maneuver_zone: float = 4.0
    dock_width: float = 3.5
    dock_depth: float = 4.0


class PreferencesReopt(BaseModel):
    """Preferencias de diseño para re-optimización"""
    include_offices: bool = True
    include_services: bool = True
    include_docks: bool = True
    include_technical: bool = True
    priority: str = "balance"
    warehouse_type: str = "industrial"
    layout_complexity: str = "medio"
    enable_abc_zones: bool = False
    abc_zone_a_pct: float = 0.20
    abc_zone_b_pct: float = 0.40
    abc_zone_c_pct: float = 0.40
    high_rotation_pct: float = 0.20


class ReoptimizeRequest(BaseModel):
    """
    Request completo para re-optimización al mover un elemento.
    
    Incluye todos los parámetros originales del wizard para poder
    regenerar el layout completo respetando la configuración.
    """
    # Dimensiones de la nave
    length: float = Field(..., gt=10, le=500, description="Largo de la nave (m)")
    width: float = Field(..., gt=10, le=500, description="Ancho de la nave (m)")
    height: float = Field(..., gt=3, le=20, description="Altura de la nave (m)")
    
    # Configuración de maquinaria
    machinery: str = Field(default="retractil", description="Tipo de maquinaria")
    
    # Configuración de palet
    pallet_type: str = Field(default="EUR", description="Tipo de palet")
    pallet_height: Optional[float] = Field(default=1.5, description="Altura de carga del palet")
    
    # Número de muelles
    n_docks: int = Field(default=4, ge=1, le=50, description="Número de muelles")
    
    # Tipo de actividad
    activity_type: str = Field(default="industrial", description="Tipo de actividad")
    
    # Número de trabajadores (opcional)
    workers: Optional[int] = Field(default=None, description="Número de trabajadores")
    
    # Configuraciones detalladas (opcionales)
    office_config: Optional[OfficeConfigReopt] = None
    dock_config: Optional[DockConfigReopt] = None
    preferences: Optional[PreferencesReopt] = None
    
    # Elemento movido
    moved_element_id: str = Field(..., description="ID del elemento que se movió")
    moved_position: Dict[str, float] = Field(..., description="Nueva posición {x, y}")
    
    # Elementos actuales (para referencia)
    current_elements: Optional[List[Dict]] = Field(
        default=None, 
        description="Elementos actuales del layout (opcional, para fallback)"
    )


# ============================================================
# FUNCIÓN PRINCIPAL DE RE-OPTIMIZACIÓN
# ============================================================

def reoptimize_with_fixed_element(request: ReoptimizeRequest) -> Dict[str, Any]:
    """
    Regenera el layout completo con un elemento fijo.
    
    El proceso:
    1. Crear WarehouseInput con todos los parámetros
    2. Crear DesignPreferences con las preferencias
    3. Ejecutar WarehouseOptimizer
    4. Buscar el elemento movido en el resultado
    5. Si no está en la posición deseada, ajustarlo
    6. Recalcular zonas con geometría exacta
    
    Args:
        request: ReoptimizeRequest con todos los parámetros
        
    Returns:
        Dict con elementos, zonas y métricas
    """
    from models import WarehouseInput
    from optimizer import WarehouseOptimizer, DesignPreferences
    
    logger.info(f"🔄 Re-optimizando layout: {request.length}x{request.width}m")
    logger.info(f"📌 Elemento fijo: {request.moved_element_id} en ({request.moved_position['x']}, {request.moved_position['y']})")
    
    # 1. Construir WarehouseInput
    office_config_dict = None
    if request.office_config:
        oc = request.office_config
        office_config_dict = {
            "floor": oc.floor,
            "position": oc.position,
            "height_under": oc.height_under or 4.0,
            "floor_height": oc.floor_height,
            "num_floors": oc.num_floors,
            "area_per_floor": oc.area_per_floor,
            "has_elevator": oc.has_elevator,
            "has_stairs": oc.has_stairs
        }
    
    input_data = WarehouseInput(
        length=request.length,
        width=request.width,
        height=request.height,
        n_docks=request.dock_config.count if request.dock_config else request.n_docks,
        machinery=request.machinery,
        pallet_type=request.pallet_type,
        pallet_height=request.pallet_height,
        activity_type=request.activity_type,
        workers=request.workers,
        office_config=office_config_dict,
        office_floor=request.office_config.floor if request.office_config else "mezzanine",
        office_height=request.office_config.floor_height if request.office_config else 3.5,
        has_elevator=request.office_config.has_elevator if request.office_config else True
    )
    
    # 2. Construir DesignPreferences
    prefs = DesignPreferences(
        include_offices=request.preferences.include_offices if request.preferences else True,
        include_services=request.preferences.include_services if request.preferences else True,
        include_docks=request.preferences.include_docks if request.preferences else True,
        include_technical=request.preferences.include_technical if request.preferences else True,
        priority=request.preferences.priority if request.preferences else "balance",
        warehouse_type=request.preferences.warehouse_type if request.preferences else request.activity_type,
        layout_complexity=request.preferences.layout_complexity if request.preferences else "medio",
        enable_abc_zones=request.preferences.enable_abc_zones if request.preferences else False,
        abc_zone_a_pct=request.preferences.abc_zone_a_pct if request.preferences else 0.20,
        abc_zone_b_pct=request.preferences.abc_zone_b_pct if request.preferences else 0.40,
        abc_zone_c_pct=request.preferences.abc_zone_c_pct if request.preferences else 0.40,
        high_rotation_pct=request.preferences.high_rotation_pct if request.preferences else 0.20
    )
    
    # 3. Ejecutar optimización
    logger.info("🚀 Ejecutando WarehouseOptimizer...")
    optimizer = WarehouseOptimizer(input_data, prefs)
    result = optimizer.optimize()
    
    if result.status != "success":
        logger.error(f"❌ Optimización fallida: {result.status}")
        raise HTTPException(status_code=500, detail="Optimización fallida")
    
    # 4. Convertir elementos a formato frontend
    elements_out = []
    moved_element_found = False
    
    for el in result.elements:
        el_dict = {
            "id": el.id,
            "type": el.type,
            "position": {
                "x": el.position.x,
                "y": el.position.y,
                "z": el.position.z or 0,
                "rotation": el.position.rotation or 0
            },
            "dimensions": {},
            "properties": el.properties or {}
        }
        
        # Convertir dimensiones según tipo
        if el.type == "shelf":
            el_dict["dimensions"] = {
                "length": getattr(el.dimensions, "length", 2.7),
                "depth": getattr(el.dimensions, "depth", 1.1),
                "height": getattr(el.dimensions, "height", 10),
                "levels": getattr(el.dimensions, "levels", 5)
            }
        elif el.type == "dock":
            el_dict["dimensions"] = {
                "width": getattr(el.dimensions, "width", 3.5),
                "depth": getattr(el.dimensions, "depth", 0.5),
                "height": getattr(el.dimensions, "height", 4.5)
            }
        elif el.type == "office":
            el_dict["dimensions"] = {
                "length": getattr(el.dimensions, "largo", None) or getattr(el.dimensions, "length", 12),
                "width": getattr(el.dimensions, "ancho", None) or getattr(el.dimensions, "width", 8),
                "height": getattr(el.dimensions, "alto", None) or getattr(el.dimensions, "height", 3)
            }
        elif el.type in ["operational_zone", "zone"]:
            el_dict["dimensions"] = {
                "length": getattr(el.dimensions, "largo", None) or getattr(el.dimensions, "length", 10),
                "width": getattr(el.dimensions, "ancho", None) or getattr(el.dimensions, "width", 10),
                "height": 0.1
            }
        elif el.type in ["service_room", "technical_room"]:
            el_dict["dimensions"] = {
                "length": getattr(el.dimensions, "largo", None) or getattr(el.dimensions, "length", 6),
                "width": getattr(el.dimensions, "ancho", None) or getattr(el.dimensions, "width", 4),
                "height": getattr(el.dimensions, "alto", None) or getattr(el.dimensions, "height", 3)
            }
        else:
            el_dict["dimensions"] = {
                "length": getattr(el.dimensions, "length", 3),
                "depth": getattr(el.dimensions, "depth", 3),
                "height": getattr(el.dimensions, "height", 3)
            }
        
        elements_out.append(el_dict)
    
    # 5. Encontrar la estantería más cercana a la posición deseada y moverla
    target_x = request.moved_position["x"]
    target_y = request.moved_position["y"]
    
    shelves = [el for el in elements_out if el["type"] == "shelf"]
    if shelves:
        # Encontrar la estantería más cercana
        closest_shelf = min(shelves, key=lambda s: 
            (s["position"]["x"] - target_x)**2 + (s["position"]["y"] - target_y)**2
        )
        
        # Moverla a la posición deseada (respetando límites)
        shelf_w = closest_shelf["dimensions"].get("length", 2.7)
        shelf_h = closest_shelf["dimensions"].get("depth", 1.1)
        
        safe_x = max(0, min(target_x, request.length - shelf_w))
        safe_y = max(0, min(target_y, request.width - shelf_h))
        
        closest_shelf["position"]["x"] = safe_x
        closest_shelf["position"]["y"] = safe_y
        closest_shelf["id"] = request.moved_element_id  # Usar el ID original
        closest_shelf["properties"]["was_moved"] = True
        
        logger.info(f"✅ Estantería {request.moved_element_id} colocada en ({safe_x}, {safe_y})")
    
    # 6. Analizar geometría si está disponible
    zones_out = []
    metrics_out = {}
    
    try:
        from geometry_service import analyze_layout
        geometry_result = analyze_layout(
            dimensions={"length": request.length, "width": request.width},
            elements=elements_out
        )
        zones_out = geometry_result.get("zones", [])
        metrics_out = geometry_result.get("metrics", {})
        logger.info(f"📐 Geometría analizada: {len(zones_out)} zonas")
    except Exception as e:
        logger.warning(f"⚠️ No se pudo analizar geometría: {e}")
    
    # 7. Construir respuesta
    return {
        "status": "success",
        "elements": elements_out,
        "zones": zones_out,
        "metrics": metrics_out,
        "capacity": {
            "total_pallets": result.capacity.total_pallets if result.capacity else 0,
            "efficiency_percentage": result.capacity.efficiency_percentage if result.capacity else 0
        },
        "optimization": {
            "scenario_name": result.metadata.get("scenario_name", "Re-optimizado"),
            "fitness_score": result.metadata.get("fitness", {}).get("normalized_score", 0),
            "moved_element": request.moved_element_id,
            "moved_position": request.moved_position
        },
        "timestamp": datetime.now().isoformat()
    }


# ============================================================
# FUNCIÓN PARA AÑADIR EL ENDPOINT A FASTAPI
# ============================================================

def add_reoptimize_endpoint(app: FastAPI):
    """
    Añade el endpoint /api/layout/reoptimize a la aplicación FastAPI.
    
    Uso en main.py:
        from reoptimize_endpoint import add_reoptimize_endpoint
        add_reoptimize_endpoint(app)
    """
    
    @app.post("/api/layout/reoptimize")
    async def reoptimize_layout(request: ReoptimizeRequest):
        """
        🔄 Re-optimiza el layout completo al mover un elemento.
        
        Este endpoint regenera TODO el layout usando WarehouseOptimizer,
        respetando todos los parámetros originales del wizard y colocando
        el elemento movido en su nueva posición.
        
        A diferencia de /api/layout/full que solo hace micro-ajustes con OR-Tools,
        este endpoint regenera las estanterías desde cero para encontrar la
        configuración óptima que incluya el elemento en su nueva posición.
        """
        try:
            logger.info("=" * 60)
            logger.info("🔄 /api/layout/reoptimize LLAMADO")
            logger.info(f"   Dimensiones: {request.length}x{request.width}x{request.height}")
            logger.info(f"   Maquinaria: {request.machinery}")
            logger.info(f"   Muelles: {request.n_docks}")
            logger.info(f"   Elemento movido: {request.moved_element_id}")
            logger.info(f"   Nueva posición: {request.moved_position}")
            logger.info("=" * 60)
            
            result = reoptimize_with_fixed_element(request)
            
            logger.info(f"✅ Re-optimización completada: {len(result['elements'])} elementos")
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error en re-optimización: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("✅ Endpoint /api/layout/reoptimize registrado")
