"""
UNITNAVE - Modelos Pydantic para validación datos
"""
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Literal, Any
from datetime import datetime

# ==================== INPUT USUARIO ====================
class WarehouseInput(BaseModel):
    """Datos del formulario frontend"""
    length: float = Field(..., gt=15, le=150, description="Largo nave (m)")
    width: float = Field(..., gt=10, le=80, description="Ancho nave (m)")
    height: float = Field(..., gt=4, le=20, description="Altura libre (m)")
    n_docks: int = Field(default=4, ge=1, le=20, description="Número muelles")
    machinery: Literal["transpaleta", "apilador", "retractil", "contrapesada", "trilateral"] = "retractil"
    pallet_type: Literal["EUR", "US", "CUSTOM"] = "EUR"
    pallet_height: Optional[float] = Field(default=1.5, ge=0.5, le=3.0, description="Altura carga palet (m)")
    custom_pallet: Optional[Dict[str, float]] = None
    workers: Optional[int] = Field(None, ge=1, le=500)
    activity_type: Literal["ecommerce", "3pl", "industrial", "logistica", "almacen"] = "industrial"
    
    # Configuración de oficinas
    office_floor: Optional[str] = Field(default="mezzanine", description="ground, mezzanine, both")
    office_height: Optional[float] = Field(default=3.5, ge=2.5, le=5.0)
    has_elevator: Optional[bool] = Field(default=True)
    
    # Permitir campos extra dinámicos
    class Config:
        extra = "allow"
    
    @validator('pallet_type', pre=True)
    def normalize_pallet_type(cls, v):
        """Convertir nombres frontend a códigos backend"""
        mapping = {
            'europalet': 'EUR',
            'universal': 'US',
            'medio': 'EUR',
            'americano': 'US'
        }
        if isinstance(v, str):
            return mapping.get(v.lower(), v)
        return v
    
    @validator('custom_pallet')
    def validate_custom_pallet(cls, v, values):
        if values.get('pallet_type') == 'CUSTOM' and not v:
            raise ValueError("custom_pallet required when pallet_type='CUSTOM'")
        if v:
            required_keys = {'length', 'width', 'height'}
            if not all(k in v for k in required_keys):
                raise ValueError(f"custom_pallet must contain: {required_keys}")
        return v

# ==================== ELEMENTOS 3D ====================
class ElementPosition(BaseModel):
    x: float
    y: float
    z: float = 0
    rotation: float = 0

class ElementDimensions(BaseModel):
    """Dimensiones flexibles según tipo elemento"""
    # Nomenclatura inglesa
    length: Optional[float] = None
    width: Optional[float] = None
    depth: Optional[float] = None
    height: Optional[float] = None
    
    # Nomenclatura española
    largo: Optional[float] = None
    ancho: Optional[float] = None
    alto: Optional[float] = None
    
    # Específicos
    levels: Optional[int] = None
    maneuverZone: Optional[float] = None
    
    class Config:
        extra = "allow"

class WarehouseElement(BaseModel):
    id: str
    type: Literal["shelf", "office", "dock", "service_room", "operational_zone", "technical_room"]
    position: ElementPosition
    dimensions: ElementDimensions
    properties: Dict[str, Any] = {}
    
    class Config:
        extra = "allow"

# ==================== OUTPUT COMPLETO ====================
class CapacityResult(BaseModel):
    total_pallets: int
    pallets_per_level: int
    levels_avg: int
    storage_volume_m3: float
    efficiency_percentage: float
    by_zone: Optional[Dict[str, int]] = None

class SurfaceSummary(BaseModel):
    total_area: float
    storage_area: float
    operational_area: float
    services_area: float
    circulation_area: float
    office_area: float
    dock_area: Optional[float] = 0
    efficiency: float

class ValidationItem(BaseModel):
    type: Literal["error", "warning", "info", "success"]
    code: str
    message: str
    location: Optional[str] = None

class OptimizationResult(BaseModel):
    status: Literal["success", "warning", "error"]
    elements: List[WarehouseElement]
    capacity: CapacityResult
    surfaces: SurfaceSummary
    validations: List[ValidationItem]
    metadata: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Config:
        extra = "allow"
