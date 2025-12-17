"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              OPTIMIZER - VERSIÓN DIAGNÓSTICO EXTREMO                         ║
║                                                                              ║
║  Esta versión loggea ABSOLUTAMENTE TODO para encontrar el bug               ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from copy import deepcopy
import time

logger = logging.getLogger(__name__)

# Forzar nivel de logging
logging.basicConfig(level=logging.INFO)

AISLE_WIDTHS = {
    'transpaleta': 1.8,
    'apilador': 2.4,
    'retractil': 2.8,
    'contrapesada': 3.6,
    'trilateral': 1.9,
    'bilateral': 1.6,
    'manual': 1.5,
    'electrica': 2.0,
}

DEFAULT_SHELF_WIDTH = 2.7
DEFAULT_SHELF_DEPTH = 1.1
MIN_SHELF_GAP = 0.05
ROW_TOLERANCE = 0.5


@dataclass
class ShelfInfo:
    id: str
    x: float
    y: float
    width: float
    depth: float
    original_data: Dict[str, Any]
    
    @property
    def x2(self) -> float:
        return self.x + self.width
    
    @property
    def y2(self) -> float:
        return self.y + self.depth
    
    def __repr__(self):
        return f"Shelf({self.id[:8]}... x={self.x:.1f}-{self.x2:.1f}, y={self.y:.1f}-{self.y2:.1f})"


class LayoutOptimizer:
    
    def __init__(self, length: float, width: float, **kwargs):
        self.length = length
        self.width = width
        self.machinery = kwargs.get('machinery', 'retractil')
        self.aisle_width = AISLE_WIDTHS.get(self.machinery, 3.0)
        
        self.shelves: Dict[str, ShelfInfo] = {}
        self.other_elements: List[Dict] = []
        self.fixed_zones: List[Dict] = []
        
        logger.info("=" * 80)
        logger.info("🔬 OPTIMIZER DIAGNÓSTICO INICIADO")
        logger.info(f"   Almacén: {self.length}m x {self.width}m")
        logger.info(f"   Maquinaria: {self.machinery} → Pasillo: {self.aisle_width}m")
        logger.info("=" * 80)
    
    def optimize(
        self,
        elements: List[Dict[str, Any]],
        moved_element_id: Optional[str] = None,
        moved_position: Optional[Dict[str, float]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        
        logger.info("=" * 80)
        logger.info("🔬 OPTIMIZE() LLAMADO")
        logger.info(f"   moved_element_id: {moved_element_id}")
        logger.info(f"   moved_position: {moved_position}")
        logger.info(f"   Elementos recibidos: {len(elements)}")
        logger.info("=" * 80)
        
        # 1. Cargar elementos
        self._load_elements(elements)
        
        if not moved_element_id or not moved_position:
            logger.info("   ⚠️ Sin movimiento, retornando sin cambios")
            return self._build_result(True, "Sin movimiento", [])
        
        # 2. Encontrar la estantería movida
        moved_shelf = self.shelves.get(moved_element_id)
        if not moved_shelf:
            logger.error(f"   ❌ SHELF NO ENCONTRADO: {moved_element_id}")
            logger.error(f"   IDs disponibles: {list(self.shelves.keys())}")
            return self._build_result(False, "Shelf no encontrado", [])
        
        logger.info(f"   📦 Shelf encontrado: {moved_shelf}")
        
        target_x = moved_position.get('x', 0)
        target_y = moved_position.get('y', 0)
        
        logger.info(f"   🎯 Target: ({target_x:.2f}, {target_y:.2f})")
        logger.info(f"   📍 Original: ({moved_shelf.x:.2f}, {moved_shelf.y:.2f})")
        
        # 3. DIAGNÓSTICO: Mostrar TODAS las estanterías y sus posiciones
        logger.info("")
        logger.info("   📋 TODAS LAS ESTANTERÍAS:")
        logger.info("   " + "-" * 70)
        
        # Agrupar por Y (filas)
        shelves_by_y = {}
        for shelf in self.shelves.values():
            y_key = round(shelf.y, 1)
            if y_key not in shelves_by_y:
                shelves_by_y[y_key] = []
            shelves_by_y[y_key].append(shelf)
        
        for y_val in sorted(shelves_by_y.keys()):
            shelves_in_row = shelves_by_y[y_val]
            logger.info(f"   FILA Y={y_val}m: {len(shelves_in_row)} estanterías")
            for s in sorted(shelves_in_row, key=lambda x: x.x):
                is_moved = " ← MOVIDA" if s.id == moved_element_id else ""
                logger.info(f"      - {s.id[:12]}... X=[{s.x:.1f} - {s.x2:.1f}]{is_moved}")
        
        logger.info("   " + "-" * 70)
        
        # 4. Encontrar estanterías en la MISMA FILA que el target
        target_y_rounded = round(target_y, 1)
        logger.info(f"")
        logger.info(f"   🔍 BUSCANDO COLISIONES EN FILA Y≈{target_y_rounded}m")
        
        # Buscar filas cercanas (tolerancia)
        matching_rows = []
        for y_val in shelves_by_y.keys():
            if abs(y_val - target_y) < ROW_TOLERANCE:
                matching_rows.append(y_val)
        
        if not matching_rows:
            logger.info(f"   ⚠️ NO HAY FILA CERCANA A Y={target_y:.1f}")
            logger.info(f"   Filas existentes: {sorted(shelves_by_y.keys())}")
            logger.info(f"   Tolerancia: {ROW_TOLERANCE}m")
            # Sin fila, simplemente mover
            moved_shelf.x = target_x
            moved_shelf.y = target_y
            return self._build_result(True, "Sin fila cercana, movido directamente", [])
        
        logger.info(f"   ✅ Filas cercanas encontradas: {matching_rows}")
        
        # 5. Verificar colisiones
        affected = []
        
        for y_row in matching_rows:
            shelves_in_row = [s for s in shelves_by_y[y_row] if s.id != moved_element_id]
            logger.info(f"")
            logger.info(f"   🔍 Verificando {len(shelves_in_row)} estanterías en fila Y={y_row}")
            
            for other in shelves_in_row:
                # Verificar overlap en X
                # La estantería movida ocupará [target_x, target_x + width]
                # La otra ocupa [other.x, other.x2]
                
                moved_x1 = target_x
                moved_x2 = target_x + moved_shelf.width
                other_x1 = other.x
                other_x2 = other.x2
                
                # Overlap si NO están separadas
                overlap_x = not (moved_x2 <= other_x1 or other_x2 <= moved_x1)
                
                logger.info(f"      vs {other.id[:12]}...")
                logger.info(f"         Movida: X=[{moved_x1:.1f} - {moved_x2:.1f}]")
                logger.info(f"         Otra:   X=[{other_x1:.1f} - {other_x2:.1f}]")
                logger.info(f"         ¿Overlap? {overlap_x}")
                
                if overlap_x:
                    logger.info(f"         💥 ¡COLISIÓN DETECTADA!")
                    
                    # Decidir dirección de desplazamiento
                    other_center = (other_x1 + other_x2) / 2
                    moved_center = (moved_x1 + moved_x2) / 2
                    
                    if other_center < moved_center:
                        # Desplazar a la izquierda
                        new_x = moved_x1 - MIN_SHELF_GAP - other.width
                        direction = "←"
                    else:
                        # Desplazar a la derecha
                        new_x = moved_x2 + MIN_SHELF_GAP
                        direction = "→"
                    
                    logger.info(f"         {direction} Desplazando de X={other.x:.1f} a X={new_x:.1f}")
                    
                    # Verificar límites
                    if new_x < 0:
                        logger.info(f"         ❌ No cabe (X < 0)")
                        continue
                    if new_x + other.width > self.length:
                        logger.info(f"         ❌ No cabe (X > {self.length})")
                        continue
                    
                    affected.append({
                        'id': other.id,
                        'old_x': other.x,
                        'new_x': new_x,
                        'direction': direction
                    })
                    other.x = new_x
        
        # 6. Actualizar posición de la movida
        moved_shelf.x = target_x
        moved_shelf.y = target_y
        
        logger.info("")
        logger.info("=" * 80)
        logger.info(f"📊 RESULTADO:")
        logger.info(f"   Shelf movida a: ({moved_shelf.x:.1f}, {moved_shelf.y:.1f})")
        logger.info(f"   Estanterías desplazadas: {len(affected)}")
        for aff in affected:
            logger.info(f"      - {aff['id'][:12]}... {aff['direction']} X: {aff['old_x']:.1f} → {aff['new_x']:.1f}")
        logger.info("=" * 80)
        
        return self._build_result(True, f"OK, {len(affected)} desplazadas", affected)
    
    def _load_elements(self, elements: List[Dict[str, Any]]):
        self.shelves = {}
        self.other_elements = []
        self.fixed_zones = []
        
        for el in elements:
            el_type = el.get('type', '')
            
            if el_type == 'shelf':
                pos = el.get('position', {})
                dims = el.get('dimensions', {})
                
                shelf = ShelfInfo(
                    id=el.get('id', ''),
                    x=float(pos.get('x', 0)),
                    y=float(pos.get('y', pos.get('z', 0))),
                    width=float(dims.get('length', DEFAULT_SHELF_WIDTH)),
                    depth=float(dims.get('depth', DEFAULT_SHELF_DEPTH)),
                    original_data=el
                )
                self.shelves[shelf.id] = shelf
            else:
                self.other_elements.append(el)
                if el_type in ['dock', 'office']:
                    self._add_fixed_zone(el)
        
        logger.info(f"   📦 Cargadas {len(self.shelves)} estanterías")
        logger.info(f"   🏢 Zonas fijas: {len(self.fixed_zones)}")
    
    def _add_fixed_zone(self, el: Dict):
        pos = el.get('position', {})
        dims = el.get('dimensions', {})
        self.fixed_zones.append({
            'id': el.get('id'),
            'type': el.get('type'),
            'x': float(pos.get('x', 0)),
            'y': float(pos.get('y', 0)),
            'width': float(dims.get('width', dims.get('length', 10))),
            'height': float(dims.get('depth', dims.get('height', 10)))
        })
    
    def _build_result(self, success: bool, message: str, affected: List[Dict]) -> Dict[str, Any]:
        elements = []
        
        for shelf in self.shelves.values():
            el = deepcopy(shelf.original_data)
            el['position'] = {
                'x': shelf.x,
                'y': shelf.y,
                'z': el.get('position', {}).get('z', 0)
            }
            el['was_moved'] = any(a['id'] == shelf.id for a in affected)
            elements.append(el)
        
        elements.extend(self.other_elements)
        
        return {
            'success': success,
            'elements': elements,
            'solver_status': 'OPTIMAL' if success else 'FAILED',
            'solve_time_ms': 1.0,
            'messages': [message],
            'affected_shelves': affected,
            'animation_data': [
                {'id': a['id'], 'old_x': a['old_x'], 'new_x': a['new_x'], 'animation': 'slide'}
                for a in affected
            ],
            'metrics': {
                'total_shelves': len(self.shelves),
                'affected_count': len(affected)
            },
            'config': {
                'machinery': self.machinery,
                'aisle_width': self.aisle_width
            }
        }


def optimize_layout(
    dimensions: Dict[str, float],
    elements: List[Dict[str, Any]],
    moved_element_id: Optional[str] = None,
    moved_position: Optional[Dict[str, float]] = None,
    **kwargs
) -> Dict[str, Any]:
    
    optimizer = LayoutOptimizer(
        length=dimensions.get('length', 80),
        width=dimensions.get('width', 40),
        **kwargs
    )
    
    return optimizer.optimize(
        elements=elements,
        moved_element_id=moved_element_id,
        moved_position=moved_position
    )


def get_aisle_widths() -> Dict[str, float]:
    return AISLE_WIDTHS.copy()

def get_aisle_width_for_machinery(machinery: str) -> float:
    return AISLE_WIDTHS.get(machinery, 3.0)
