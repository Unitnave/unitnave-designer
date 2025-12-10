"""
UNITNAVE - Exportador DXF Profesional
Genera archivos DXF compatibles con AutoCAD, FreeCAD, etc.

Características:
- Capas separadas por tipo de elemento
- Bloques reutilizables para estanterías
- Acotaciones automáticas
- Escala 1:1 (metros)
- Compatible con AutoCAD 2018+

@version 1.0
"""

import io
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

import ezdxf
from ezdxf import units
from ezdxf.addons import text2path
from ezdxf.enums import TextEntityAlignment

logger = logging.getLogger(__name__)


# ============================================================
# CONFIGURACIÓN DE CAPAS
# ============================================================
LAYER_CONFIG = {
    'WAREHOUSE_BOUNDARY': {
        'color': 7,  # Blanco
        'linetype': 'CONTINUOUS',
        'lineweight': 50  # 0.5mm
    },
    'SHELVES': {
        'color': 5,  # Azul
        'linetype': 'CONTINUOUS',
        'lineweight': 35
    },
    'DOCKS': {
        'color': 3,  # Verde
        'linetype': 'CONTINUOUS',
        'lineweight': 35
    },
    'OFFICES': {
        'color': 6,  # Magenta
        'linetype': 'CONTINUOUS',
        'lineweight': 35
    },
    'AISLES': {
        'color': 8,  # Gris
        'linetype': 'DASHED',
        'lineweight': 25
    },
    'CIRCULATION': {
        'color': 4,  # Cyan
        'linetype': 'CONTINUOUS',
        'lineweight': 25
    },
    'DIMENSIONS': {
        'color': 2,  # Amarillo
        'linetype': 'CONTINUOUS',
        'lineweight': 18
    },
    'TEXT': {
        'color': 7,  # Blanco
        'linetype': 'CONTINUOUS',
        'lineweight': 18
    },
    'GRID': {
        'color': 8,  # Gris oscuro
        'linetype': 'CONTINUOUS',
        'lineweight': 13
    }
}


# ============================================================
# CLASE PRINCIPAL
# ============================================================
class DXFExporter:
    """
    Exportador de layouts a formato DXF
    
    Uso:
        exporter = DXFExporter()
        dxf_bytes = exporter.export(
            dimensions={'length': 80, 'width': 40},
            elements=elements_list,
            zones=zones_list
        )
    """
    
    def __init__(self):
        """Inicializa el exportador"""
        self.doc = None
        self.msp = None
        
    def export(
        self,
        dimensions: Dict[str, float],
        elements: List[Dict[str, Any]],
        zones: Optional[List[Dict[str, Any]]] = None,
        include_dimensions: bool = True,
        include_grid: bool = True,
        include_title_block: bool = True,
        scale: str = "1:100"
    ) -> bytes:
        """
        Exporta el layout a DXF
        
        Args:
            dimensions: {'length': float, 'width': float}
            elements: Lista de elementos
            zones: Lista de zonas detectadas (opcional)
            include_dimensions: Añadir acotaciones
            include_grid: Añadir grid de referencia
            include_title_block: Añadir cajetín
            scale: Escala del plano
            
        Returns:
            Bytes del archivo DXF
        """
        logger.info(f"📐 Generando DXF: {dimensions['length']}x{dimensions['width']}m")
        
        # Crear documento
        self.doc = ezdxf.new('R2018')  # AutoCAD 2018 format
        self.msp = self.doc.modelspace()
        
        # Configurar unidades (metros)
        self.doc.units = units.M
        
        # Crear capas
        self._create_layers()
        
        # Crear bloques reutilizables
        self._create_blocks()
        
        # Dibujar contenido
        length = dimensions.get('length', 80)
        width = dimensions.get('width', 40)
        
        # 1. Grid de referencia
        if include_grid:
            self._draw_grid(length, width)
        
        # 2. Perímetro de la nave
        self._draw_warehouse_boundary(length, width)
        
        # 3. Elementos
        for element in elements:
            self._draw_element(element)
        
        # 4. Zonas auto-detectadas (pasillos, circulación)
        if zones:
            for zone in zones:
                if zone.get('is_auto_generated', False):
                    self._draw_zone(zone)
        
        # 5. Acotaciones
        if include_dimensions:
            self._draw_dimensions(length, width, elements)
        
        # 6. Cajetín
        if include_title_block:
            self._draw_title_block(length, width, scale)
        
        # Exportar a bytes
        buffer = io.BytesIO()
        self.doc.write(buffer)
        buffer.seek(0)
        
        logger.info(f"✅ DXF generado: {len(elements)} elementos")
        
        return buffer.getvalue()
    
    def _create_layers(self):
        """Crea las capas del DXF"""
        for layer_name, config in LAYER_CONFIG.items():
            self.doc.layers.add(
                layer_name,
                color=config['color'],
                linetype=config['linetype'],
                lineweight=config['lineweight']
            )
    
    def _create_blocks(self):
        """Crea bloques reutilizables para elementos comunes"""
        # Bloque de estantería estándar (2.7m x 1.1m)
        shelf_block = self.doc.blocks.new(name='SHELF_STANDARD')
        shelf_block.add_lwpolyline(
            [(0, 0), (2.7, 0), (2.7, 1.1), (0, 1.1), (0, 0)],
            close=True
        )
        # Líneas internas simulando niveles
        for i in range(1, 5):
            y = i * 0.22
            shelf_block.add_line((0, y), (2.7, y))
        
        # Bloque de muelle estándar
        dock_block = self.doc.blocks.new(name='DOCK_STANDARD')
        dock_block.add_lwpolyline(
            [(0, 0), (3.5, 0), (3.5, 0.5), (0, 0.5), (0, 0)],
            close=True
        )
        # Símbolo de dirección
        dock_block.add_line((1.75, 0.5), (1.75, 1.5))
        dock_block.add_line((1.5, 1.2), (1.75, 1.5))
        dock_block.add_line((2.0, 1.2), (1.75, 1.5))
    
    def _draw_grid(self, length: float, width: float):
        """Dibuja grid de referencia"""
        grid_spacing = 5.0  # 5 metros
        
        # Líneas verticales
        x = 0
        while x <= length:
            self.msp.add_line(
                (x, 0), (x, width),
                dxfattribs={'layer': 'GRID'}
            )
            x += grid_spacing
        
        # Líneas horizontales
        y = 0
        while y <= width:
            self.msp.add_line(
                (0, y), (length, y),
                dxfattribs={'layer': 'GRID'}
            )
            y += grid_spacing
    
    def _draw_warehouse_boundary(self, length: float, width: float):
        """Dibuja el perímetro de la nave"""
        points = [
            (0, 0),
            (length, 0),
            (length, width),
            (0, width),
            (0, 0)
        ]
        self.msp.add_lwpolyline(
            points,
            close=True,
            dxfattribs={'layer': 'WAREHOUSE_BOUNDARY'}
        )
    
    def _draw_element(self, element: Dict[str, Any]):
        """Dibuja un elemento individual"""
        el_type = element.get('type', 'unknown')
        
        # Extraer posición y dimensiones
        pos = element.get('position', {})
        dims = element.get('dimensions', {})
        
        x = float(pos.get('x', element.get('x', 0)))
        y = float(pos.get('y', pos.get('z', element.get('y', 0))))
        rotation = element.get('rotation', 0)
        
        # Determinar capa y dimensiones
        if el_type == 'shelf':
            layer = 'SHELVES'
            w = float(dims.get('length', element.get('width', 2.7)))
            h = float(dims.get('depth', element.get('height', 1.1)))
        elif el_type == 'dock':
            layer = 'DOCKS'
            w = float(dims.get('width', element.get('width', 3.5)))
            h = float(dims.get('depth', element.get('height', 0.5)))
        elif el_type == 'office':
            layer = 'OFFICES'
            w = float(dims.get('length', dims.get('largo', element.get('width', 12))))
            h = float(dims.get('width', dims.get('ancho', element.get('height', 8))))
        else:
            layer = 'WAREHOUSE_BOUNDARY'
            w = float(dims.get('length', element.get('width', 5)))
            h = float(dims.get('depth', element.get('height', 5)))
        
        # Dibujar rectángulo
        if rotation == 0:
            # Sin rotación: polilínea simple
            points = [
                (x, y),
                (x + w, y),
                (x + w, y + h),
                (x, y + h),
                (x, y)
            ]
            self.msp.add_lwpolyline(
                points,
                close=True,
                dxfattribs={'layer': layer}
            )
        else:
            # Con rotación: calcular vértices rotados
            cx = x + w / 2
            cy = y + h / 2
            rad = math.radians(rotation)
            
            corners = [
                (-w/2, -h/2),
                (w/2, -h/2),
                (w/2, h/2),
                (-w/2, h/2)
            ]
            
            rotated = []
            for px, py in corners:
                rx = px * math.cos(rad) - py * math.sin(rad) + cx
                ry = px * math.sin(rad) + py * math.cos(rad) + cy
                rotated.append((rx, ry))
            
            rotated.append(rotated[0])  # Cerrar
            
            self.msp.add_lwpolyline(
                rotated,
                close=True,
                dxfattribs={'layer': layer}
            )
        
        # Añadir etiqueta
        label = element.get('id', element.get('label', el_type))
        self.msp.add_text(
            label,
            height=0.3,
            dxfattribs={
                'layer': 'TEXT',
                'style': 'Standard'
            }
        ).set_placement((x + w/2, y + h/2), align=TextEntityAlignment.MIDDLE_CENTER)
    
    def _draw_zone(self, zone: Dict[str, Any]):
        """Dibuja una zona auto-detectada (pasillos, circulación)"""
        zone_type = zone.get('type', 'free_zone')
        
        # Determinar capa según tipo
        if zone_type in ('aisle', 'main_aisle', 'cross_aisle'):
            layer = 'AISLES'
        elif zone_type == 'circulation':
            layer = 'CIRCULATION'
        else:
            return  # No dibujar zonas libres genéricas
        
        x = zone.get('x', 0)
        y = zone.get('y', 0)
        w = zone.get('width', 0)
        h = zone.get('height', 0)
        
        if w < 0.5 or h < 0.5:
            return  # Zona demasiado pequeña
        
        points = [
            (x, y),
            (x + w, y),
            (x + w, y + h),
            (x, y + h),
            (x, y)
        ]
        
        self.msp.add_lwpolyline(
            points,
            close=True,
            dxfattribs={'layer': layer}
        )
        
        # Etiqueta de zona
        label = zone.get('label', zone_type)
        if w > 3 and h > 1:  # Solo si hay espacio
            self.msp.add_text(
                label,
                height=0.25,
                dxfattribs={
                    'layer': 'TEXT',
                    'style': 'Standard'
                }
            ).set_placement((x + w/2, y + h/2), align=TextEntityAlignment.MIDDLE_CENTER)
    
    def _draw_dimensions(self, length: float, width: float, elements: List[Dict]):
        """Añade acotaciones al plano"""
        # Crear estilo de acotación
        self.doc.dimstyles.new(
            'UNITNAVE',
            dxfattribs={
                'dimtxt': 0.25,  # Altura texto
                'dimasz': 0.15,  # Tamaño flecha
                'dimexe': 0.1,   # Extensión línea
                'dimexo': 0.1,   # Offset línea
            }
        )
        
        # Acotación total horizontal (parte inferior)
        self.msp.add_linear_dim(
            base=(0, -3),
            p1=(0, 0),
            p2=(length, 0),
            dimstyle='UNITNAVE',
            dxfattribs={'layer': 'DIMENSIONS'}
        ).render()
        
        # Acotación total vertical (parte izquierda)
        self.msp.add_linear_dim(
            base=(-3, 0),
            p1=(0, 0),
            p2=(0, width),
            angle=90,
            dimstyle='UNITNAVE',
            dxfattribs={'layer': 'DIMENSIONS'}
        ).render()
        
        # Acotaciones de elementos principales (estanterías)
        shelves = [e for e in elements if e.get('type') == 'shelf']
        if shelves:
            # Acotar primera fila de estanterías
            first_shelf = shelves[0]
            pos = first_shelf.get('position', {})
            dims = first_shelf.get('dimensions', {})
            
            sx = float(pos.get('x', first_shelf.get('x', 0)))
            sy = float(pos.get('y', first_shelf.get('y', 0)))
            sw = float(dims.get('length', first_shelf.get('width', 2.7)))
    
    def _draw_title_block(self, length: float, width: float, scale: str):
        """Dibuja el cajetín del plano"""
        # Posición del cajetín (esquina inferior derecha del plano)
        block_width = 15
        block_height = 8
        bx = length + 2
        by = -block_height - 2
        
        # Marco del cajetín
        self.msp.add_lwpolyline(
            [
                (bx, by),
                (bx + block_width, by),
                (bx + block_width, by + block_height),
                (bx, by + block_height),
                (bx, by)
            ],
            close=True,
            dxfattribs={'layer': 'WAREHOUSE_BOUNDARY'}
        )
        
        # Líneas internas
        self.msp.add_line(
            (bx, by + 2), (bx + block_width, by + 2),
            dxfattribs={'layer': 'WAREHOUSE_BOUNDARY'}
        )
        self.msp.add_line(
            (bx, by + 4), (bx + block_width, by + 4),
            dxfattribs={'layer': 'WAREHOUSE_BOUNDARY'}
        )
        self.msp.add_line(
            (bx, by + 6), (bx + block_width, by + 6),
            dxfattribs={'layer': 'WAREHOUSE_BOUNDARY'}
        )
        
        # Textos
        self.msp.add_text(
            'UNITNAVE Designer',
            height=0.5,
            dxfattribs={'layer': 'TEXT'}
        ).set_placement((bx + block_width/2, by + 7), align=TextEntityAlignment.MIDDLE_CENTER)
        
        self.msp.add_text(
            f'Nave: {length}m x {width}m',
            height=0.3,
            dxfattribs={'layer': 'TEXT'}
        ).set_placement((bx + block_width/2, by + 5), align=TextEntityAlignment.MIDDLE_CENTER)
        
        self.msp.add_text(
            f'Escala: {scale}',
            height=0.3,
            dxfattribs={'layer': 'TEXT'}
        ).set_placement((bx + block_width/2, by + 3), align=TextEntityAlignment.MIDDLE_CENTER)
        
        self.msp.add_text(
            f'Fecha: {datetime.now().strftime("%d/%m/%Y")}',
            height=0.3,
            dxfattribs={'layer': 'TEXT'}
        ).set_placement((bx + block_width/2, by + 1), align=TextEntityAlignment.MIDDLE_CENTER)


# ============================================================
# FUNCIÓN DE CONVENIENCIA
# ============================================================
def export_to_dxf(
    dimensions: Dict[str, float],
    elements: List[Dict[str, Any]],
    zones: Optional[List[Dict[str, Any]]] = None
) -> bytes:
    """
    Función de conveniencia para exportar a DXF
    
    Args:
        dimensions: {'length': float, 'width': float}
        elements: Lista de elementos
        zones: Lista de zonas (opcional)
        
    Returns:
        Bytes del archivo DXF
    """
    exporter = DXFExporter()
    return exporter.export(dimensions, elements, zones)
