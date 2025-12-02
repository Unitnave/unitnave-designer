/**
 * UNITNAVE Designer - Editor Components Index
 * 
 * Exportaciones centralizadas de todos los componentes del editor
 * 
 * V2.2 Mejoras:
 * - Flechas tipo AutoCAD en cotas
 * - SHIFT para ortho temporal
 * - Líneas guía dinámicas (SnapGuides)
 * 
 * @version 2.2
 */

// Componente principal
export { default as Warehouse3DEditor } from './Warehouse3DEditor'

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
export { default as useEditorStore, AISLE_WIDTHS, ELEMENT_DEFAULTS } from '../stores/useEditorStore'
