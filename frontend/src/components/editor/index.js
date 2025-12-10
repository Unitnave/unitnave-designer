/**
 * UNITNAVE Designer - Editor Components Index
 * 
 * Exportaciones centralizadas de todos los componentes del editor
 * 
 * V3.0 Mejoras:
 * - Vista 2D CAD profesional
 * - Leyenda de zonas interactiva
 * - Toggle 2D/3D
 * - Flechas tipo AutoCAD en cotas
 * - SHIFT para ortho temporal
 * - Líneas guía dinámicas (SnapGuides)
 * 
 * @version 3.0
 */

// Componente principal 3D
export { default as Warehouse3DEditor } from './Warehouse3DEditor'

// Componentes 2D CAD (NUEVO v3.0)
export { default as Warehouse2DEditor } from './Warehouse2DEditor'
export { default as Warehouse2DView, processElementsToZones, ZONE_COLORS } from './Warehouse2DView'
export { default as ZonesLegend } from './ZonesLegend'

// Editor con Toggle 2D/3D (NUEVO v3.0)
export { default as WarehouseEditorWithToggle } from './WarehouseEditorWithToggle'

// Toolbar
export { default as EditorToolbar, EditorToolbarMini } from './EditorToolbar'

// Layers
export { default as LayersPanel } from './LayersPanel'

// Grid
export { default as EditorGrid, useSnapToGrid, SnapIndicator } from './EditorGrid'

// Cotas
export { 
  default as AutoDimensions,
  DimensionLine,
  NaveDimensions,
  ElementDimension,
  DistanceBetweenElements,
  AisleWidthIndicator
} from './AutoDimensions'

// Transform
export { default as TransformableElement, useTransformControls } from './TransformableElement'

// Guías de Snap (V2.2)
export { default as SnapGuides, ShiftIndicator } from './SnapGuides'

// Validaciones
export { 
  ValidationMarkers3D, 
  ValidationPanel, 
  DensityIndicator 
} from './ValidationWarnings'

// Re-export del store para conveniencia
export { default as useEditorStore, AISLE_WIDTHS, ELEMENT_DEFAULTS } from '../../stores/useEditorStore'
