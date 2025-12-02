"""
UNITNAVE - Modelos Pydantic para validación datos
V5.2 - Añadido office_config completo
"""
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Literal, Any
from datetime import datetime


# ==================== CONFIGURACIÓN OFICINAS V5.2 ====================
class OfficeConfig(BaseModel):
    """Configuración completa de oficinas (V5.2)"""
    floor: str = Field(default="mezzanine", description="ground, mezzanine")
    position: str = Field(default="front_left", description="front_left, front_right, side_left, side_right")
    height_under: float = Field(default=4.0, ge=2.5, le=8.0, description="Altura libre bajo oficina (entresuelo)")
    floor_height: float = Field(default=3.0, ge=2.5, le=4.0, description="Altura de cada planta")
    num_floors: int = Field(default=1, ge=1, le=5, description="Número de plantas")
    # V6: Largo y ancho de oficina (prioridad sobre area_per_floor)
    office_length: float = Field(default=12, ge=5, le=50, description="Largo de oficina (m)")
    office_width: float = Field(default=8, ge=5, le=30, description="Ancho de oficina (m)")
    area_per_floor: float = Field(default=96, ge=30, le=500, description="m² por planta (calculado de largo × ancho)")
    has_elevator: bool = Field(default=True)
    has_stairs: bool = Field(default=True)
    
    @property
    def calculated_area(self) -> float:
        """Área calculada desde largo × ancho (prioridad)"""
        return self.office_length * self.office_width
    
    @property
    def total_area(self) -> float:
        """Superficie total de oficinas"""
        # Usar área calculada de largo × ancho
        return self.calculated_area * self.num_floors
    
    @property
    def total_height(self) -> float:
        """Altura total usada por oficinas"""
        if self.floor == "ground":
            return self.num_floors * self.floor_height
        else:
            return self.height_under + (self.num_floors * self.floor_height)


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
    
    # Configuración de oficinas (V5.2 - objeto completo)
    office_config: Optional[OfficeConfig] = None
    
    # Campos legacy para compatibilidad
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
    
    def get_office_config(self) -> OfficeConfig:
        """Obtener configuración de oficinas (nueva o legacy)"""
        if self.office_config:
            return self.office_config
        # Crear desde campos legacy
        return OfficeConfig(
            floor=self.office_floor or "mezzanine",
            height_under=self.office_height or 3.5,
            has_elevator=self.has_elevator if self.has_elevator is not None else True
        )

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