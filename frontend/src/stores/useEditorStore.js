/**
 * UNITNAVE Designer - Editor Store V2
 * 
 * Store principal del editor con:
 * - Sistema de Tools explícito (select, move, rotate, draw_rack, etc.)
 * - Layers con visibilidad y bloqueo
 * - Grid magnético con Snap
 * - Undo/Redo robusto
 * - Validaciones en tiempo real (inteligencia logística)
 * 
 * @version 2.0
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ==================== CONSTANTES DE MAQUINARIA ====================
// Anchos mínimos de pasillo según tipo de maquinaria (metros)
export const AISLE_WIDTHS = {
  transpaleta: 2.0,
  apilador: 2.5,
  retractil: 3.2,
  contrapesada: 4.0,
  trilateral: 1.8  // Pasillo estrecho VNA
}

// Dimensiones estándar de elementos
export const ELEMENT_DEFAULTS = {
  shelf: { length: 2.7, depth: 1.1, height: 10 },
  dock: { width: 3.5, depth: 0.3, height: 4.5 },
  office: { length: 12, width: 8, height: 3 },
  zone: { length: 10, width: 10 }
}

// ==================== STORE PRINCIPAL ====================
const useEditorStore = create(
  subscribeWithSelector((set, get) => ({
    
    // ==================== SISTEMA DE TOOLS ====================
    /**
     * Herramienta actual del editor
     * - select: Seleccionar elementos
     * - move: Mover elementos
     * - rotate: Rotar elementos
     * - draw_shelf: Dibujar estantería
     * - draw_dock: Dibujar muelle
     * - draw_office: Dibujar oficina
     * - draw_zone: Dibujar zona
     * - erase: Borrar elementos
     * - measure: Medir distancias
     * - pan: Mover vista
     */
    currentTool: 'select',
    previousTool: 'select',
    
    // Configuración de herramienta de dibujo activa
    drawConfig: {
      elementType: null,  // 'shelf', 'dock', 'office', 'zone'
      previewPosition: null,
      isDrawing: false
    },
    
    setTool: (tool) => set((state) => ({
      previousTool: state.currentTool,
      currentTool: tool,
      drawConfig: {
        ...state.drawConfig,
        elementType: tool.startsWith('draw_') ? tool.replace('draw_', '') : null,
        isDrawing: false
      }
    })),
    
    // Atajos rápidos para tools
    tools: {
      select: { key: 'V', icon: '↖️', label: 'Seleccionar', cursor: 'default' },
      move: { key: 'M', icon: '✥', label: 'Mover', cursor: 'move' },
      rotate: { key: 'R', icon: '↻', label: 'Rotar', cursor: 'crosshair' },
      draw_shelf: { key: 'S', icon: '📦', label: 'Estantería', cursor: 'crosshair' },
      draw_dock: { key: 'D', icon: '🚛', label: 'Muelle', cursor: 'crosshair' },
      draw_office: { key: 'O', icon: '🏢', label: 'Oficina', cursor: 'crosshair' },
      draw_zone: { key: 'Z', icon: '🔲', label: 'Zona', cursor: 'crosshair' },
      erase: { key: 'E', icon: '🗑️', label: 'Borrar', cursor: 'not-allowed' },
      measure: { key: 'X', icon: '📏', label: 'Medir', cursor: 'crosshair' },
      pan: { key: 'H', icon: '✋', label: 'Mover vista', cursor: 'grab' }
    },
    
    // ==================== LAYERS ====================
    layers: {
      shelves: { 
        id: 'shelves',
        name: 'Estanterías', 
        visible: true, 
        locked: false, 
        color: '#3b82f6',
        icon: 'Inventory2'
      },
      docks: { 
        id: 'docks',
        name: 'Muelles', 
        visible: true, 
        locked: false, 
        color: '#22c55e',
        icon: 'LocalShipping'
      },
      offices: { 
        id: 'offices',
        name: 'Oficinas', 
        visible: true, 
        locked: false, 
        color: '#a855f7',
        icon: 'Business'
      },
      services: { 
        id: 'services',
        name: 'Servicios', 
        visible: true, 
        locked: false, 
        color: '#f59e0b',
        icon: 'Wc'
      },
      zones: { 
        id: 'zones',
        name: 'Zonas ABC', 
        visible: true, 
        locked: false, 
        color: '#06b6d4',
        icon: 'Dashboard'
      },
      aisles: { 
        id: 'aisles',
        name: 'Pasillos', 
        visible: true, 
        locked: true, 
        color: '#64748b',
        icon: 'LinearScale'
      },
      walls: { 
        id: 'walls',
        name: 'Muros', 
        visible: true, 
        locked: true, 
        color: '#94a3b8',
        icon: 'CropSquare'
      },
      dimensions: { 
        id: 'dimensions',
        name: 'Cotas', 
        visible: true, 
        locked: true, 
        color: '#1e40af',
        icon: 'Straighten'
      },
      grid: { 
        id: 'grid',
        name: 'Rejilla', 
        visible: true, 
        locked: true, 
        color: '#e2e8f0',
        icon: 'Grid4x4'
      },
      warnings: {
        id: 'warnings',
        name: 'Avisos',
        visible: true,
        locked: true,
        color: '#ef4444',
        icon: 'Warning'
      }
    },
    
    showLayersPanel: false,
    
    toggleLayersPanel: () => set((state) => ({ 
      showLayersPanel: !state.showLayersPanel 
    })),
    
    toggleLayer: (layerId) => set((state) => ({
      layers: {
        ...state.layers,
        [layerId]: {
          ...state.layers[layerId],
          visible: !state.layers[layerId].visible
        }
      }
    })),
    
    setLayerVisibility: (layerId, visible) => set((state) => ({
      layers: {
        ...state.layers,
        [layerId]: { ...state.layers[layerId], visible }
      }
    })),
    
    setLayerLocked: (layerId, locked) => set((state) => ({
      layers: {
        ...state.layers,
        [layerId]: { ...state.layers[layerId], locked }
      }
    })),
    
    isolateLayer: (layerId) => set((state) => {
      const newLayers = { ...state.layers }
      Object.keys(newLayers).forEach(key => {
        if (!['walls', 'grid'].includes(key)) {
          newLayers[key] = { ...newLayers[key], visible: key === layerId }
        }
      })
      return { layers: newLayers }
    }),
    
    showAllLayers: () => set((state) => {
      const newLayers = { ...state.layers }
      Object.keys(newLayers).forEach(key => {
        newLayers[key] = { ...newLayers[key], visible: true }
      })
      return { layers: newLayers }
    }),
    
    hideAllLayers: () => set((state) => {
      const newLayers = { ...state.layers }
      Object.keys(newLayers).forEach(key => {
        if (!['walls', 'grid'].includes(key)) {
          newLayers[key] = { ...newLayers[key], visible: false }
        }
      })
      return { layers: newLayers }
    }),
    
    // Mapeo tipo elemento -> layer
    getLayerForType: (type) => {
      const mapping = {
        shelf: 'shelves',
        dock: 'docks',
        office: 'offices',
        service: 'services',
        zone: 'zones',
        operationalZone: 'zones'
      }
      return mapping[type] || 'shelves'
    },
    
    isElementVisible: (type) => {
      const state = get()
      const layerId = state.getLayerForType(type)
      return state.layers[layerId]?.visible ?? true
    },
    
    isElementLocked: (type) => {
      const state = get()
      const layerId = state.getLayerForType(type)
      return state.layers[layerId]?.locked ?? false
    },
    
    // ==================== GRID Y SNAP ====================
    gridConfig: {
      visible: true,
      size: 1.0,        // metros entre líneas
      divisions: 10,
      mainColor: '#94a3b8',
      subColor: '#e2e8f0',
      showLabels: true
    },
    
    snapConfig: {
      enabled: true,
      gridSnap: true,       // Snap a intersecciones de grid
      objectSnap: true,     // Snap a otros objetos
      wallSnap: true,       // Snap a paredes
      endpointSnap: true,   // Snap a extremos
      midpointSnap: true,   // Snap a puntos medios
      snapDistance: 0.5,    // Distancia de atracción (metros)
      orthoMode: false      // Bloquear a 0°/90°
    },
    
    setGridSize: (size) => set((state) => ({
      gridConfig: { ...state.gridConfig, size: Math.max(0.25, Math.min(5, size)) }
    })),
    
    toggleGrid: () => set((state) => ({
      gridConfig: { ...state.gridConfig, visible: !state.gridConfig.visible }
    })),
    
    toggleSnap: () => set((state) => ({
      snapConfig: { ...state.snapConfig, enabled: !state.snapConfig.enabled }
    })),
    
    toggleOrtho: () => set((state) => ({
      snapConfig: { ...state.snapConfig, orthoMode: !state.snapConfig.orthoMode }
    })),
    
    setSnapDistance: (distance) => set((state) => ({
      snapConfig: { ...state.snapConfig, snapDistance: Math.max(0.1, Math.min(2, distance)) }
    })),
    
    // ==================== SHIFT PARA ORTHO TEMPORAL ====================
    shiftPressed: false,
    setShiftPressed: (pressed) => set({ shiftPressed: pressed }),
    
    // ==================== LÍNEAS GUÍA DINÁMICAS ====================
    activeGuides: [],  // [{ type: 'horizontal'|'vertical', position: number, label: string }]
    setActiveGuides: (guides) => set({ activeGuides: guides }),
    clearGuides: () => set({ activeGuides: [] }),
    
    // Origen del drag para ortho
    dragOrigin: null,
    setDragOrigin: (point) => set({ dragOrigin: point }),
    clearDragOrigin: () => set({ dragOrigin: null, activeGuides: [], lastSnapResult: null }),
    
    // Último resultado de snap (para visualización)
    lastSnapResult: null,
    setLastSnapResult: (result) => set({ lastSnapResult: result }),
    
    /**
     * Calcula líneas guía basadas en alineación con otros elementos
     */
    calculateGuides: (currentX, currentZ, currentWidth, currentDepth, elements, excludeId) => {
      const guides = []
      const threshold = 0.3
      
      const currentCenterX = currentX + currentWidth / 2
      const currentCenterZ = currentZ + currentDepth / 2
      const currentRight = currentX + currentWidth
      const currentBottom = currentZ + currentDepth
      
      for (const el of elements) {
        if (el.id === excludeId || !el.position) continue
        
        const ex = el.position.x
        const ez = el.position.y ?? el.position.z ?? 0
        const ew = el.dimensions?.length || el.dimensions?.width || 2.7
        const ed = el.dimensions?.depth || el.dimensions?.width || 1.1
        
        const elCenterX = ex + ew / 2
        const elCenterZ = ez + ed / 2
        const elRight = ex + ew
        const elBottom = ez + ed
        
        // Guías verticales (alineación X)
        if (Math.abs(currentX - ex) < threshold) {
          guides.push({ type: 'vertical', position: ex, label: 'Izq-Izq' })
        }
        if (Math.abs(currentRight - elRight) < threshold) {
          guides.push({ type: 'vertical', position: elRight, label: 'Der-Der' })
        }
        if (Math.abs(currentCenterX - elCenterX) < threshold) {
          guides.push({ type: 'vertical', position: elCenterX, label: 'Centro' })
        }
        
        // Guías horizontales (alineación Z)
        if (Math.abs(currentZ - ez) < threshold) {
          guides.push({ type: 'horizontal', position: ez, label: 'Arr-Arr' })
        }
        if (Math.abs(currentBottom - elBottom) < threshold) {
          guides.push({ type: 'horizontal', position: elBottom, label: 'Abj-Abj' })
        }
        if (Math.abs(currentCenterZ - elCenterZ) < threshold) {
          guides.push({ type: 'horizontal', position: elCenterZ, label: 'Centro' })
        }
      }
      
      // Eliminar duplicados
      const unique = guides.filter((g, i, arr) => 
        arr.findIndex(x => x.type === g.type && Math.abs(x.position - g.position) < 0.1) === i
      )
      
      set({ activeGuides: unique })
      return unique
    },
    
    /**
     * Calcula posición con snap aplicado
     * @param {number} x - Posición X original
     * @param {number} z - Posición Z original
     * @param {Array} elements - Elementos existentes
     * @param {Object} dimensions - Dimensiones de la nave
     * @returns {Object} { x, z, snappedTo } - Posición con snap y tipo de snap
     */
    snapPosition: (x, z, elements = [], dimensions = {}, excludeId = null) => {
      const state = get()
      const { snapConfig, gridConfig, shiftPressed, dragOrigin, activeGuides } = state
      
      if (!snapConfig.enabled) {
        return { x, z, snappedTo: null }
      }
      
      let snappedX = x
      let snappedZ = z
      let snappedTo = null
      const snapDist = snapConfig.snapDistance
      
      // ========== MODO ORTOGONAL (T o SHIFT) ==========
      const useOrtho = snapConfig.orthoMode || shiftPressed
      if (useOrtho && dragOrigin) {
        const dx = Math.abs(x - dragOrigin.x)
        const dz = Math.abs(z - dragOrigin.z)
        
        if (dx > dz) {
          snappedZ = dragOrigin.z
          snappedTo = 'ortho-h'
        } else {
          snappedX = dragOrigin.x
          snappedTo = 'ortho-v'
        }
        
        // En modo ortho, aplicar snap de grid solo en el eje libre
        if (snapConfig.gridSnap) {
          const gs = gridConfig.size
          if (snappedTo === 'ortho-h') {
            const gx = Math.round(snappedX / gs) * gs
            if (Math.abs(snappedX - gx) < snapDist) snappedX = gx
          } else {
            const gz = Math.round(snappedZ / gs) * gs
            if (Math.abs(snappedZ - gz) < snapDist) snappedZ = gz
          }
        }
        
        state.setLastSnapResult({ x: snappedX, z: snappedZ, type: snappedTo })
        return { x: snappedX, z: snappedZ, snappedTo }
      }
      
      // ========== SNAP A LÍNEAS GUÍA DINÁMICAS ==========
      if (activeGuides && activeGuides.length > 0) {
        for (const guide of activeGuides) {
          if (guide.type === 'vertical' && Math.abs(x - guide.position) < snapDist) {
            snappedX = guide.position
            snappedTo = 'guide-v'
          }
          if (guide.type === 'horizontal' && Math.abs(z - guide.position) < snapDist) {
            snappedZ = guide.position
            snappedTo = 'guide-h'
          }
        }
        
        if (snappedTo && snappedTo.startsWith('guide')) {
          state.setLastSnapResult({ x: snappedX, z: snappedZ, type: snappedTo })
          return { x: snappedX, z: snappedZ, snappedTo }
        }
      }
      
      // 1. Snap a Grid
      if (snapConfig.gridSnap) {
        const gridSize = gridConfig.size
        const nearestGridX = Math.round(x / gridSize) * gridSize
        const nearestGridZ = Math.round(z / gridSize) * gridSize
        
        if (Math.abs(x - nearestGridX) < snapDist) {
          snappedX = nearestGridX
          snappedTo = 'grid'
        }
        if (Math.abs(z - nearestGridZ) < snapDist) {
          snappedZ = nearestGridZ
          snappedTo = 'grid'
        }
      }
      
      // 2. Snap a Paredes
      if (snapConfig.wallSnap && dimensions.length && dimensions.width) {
        // Pared izquierda (x = 0)
        if (Math.abs(snappedX) < snapDist) {
          snappedX = 0
          snappedTo = 'wall'
        }
        // Pared derecha (x = length)
        if (Math.abs(snappedX - dimensions.length) < snapDist) {
          snappedX = dimensions.length
          snappedTo = 'wall'
        }
        // Pared frontal (z = 0)
        if (Math.abs(snappedZ) < snapDist) {
          snappedZ = 0
          snappedTo = 'wall'
        }
        // Pared trasera (z = width)
        if (Math.abs(snappedZ - dimensions.width) < snapDist) {
          snappedZ = dimensions.width
          snappedTo = 'wall'
        }
      }
      
      // 3. Snap a Objetos existentes
      if (snapConfig.objectSnap && elements.length > 0) {
        for (const el of elements) {
          if (!el.position) continue
          
          const elX = el.position.x
          const elZ = el.position.y || el.position.z || 0
          const elLength = el.dimensions?.length || 2.7
          const elDepth = el.dimensions?.depth || el.dimensions?.width || 1.1
          
          // Puntos de snap del elemento
          const snapPoints = [
            { x: elX, z: elZ, type: 'corner' },                           // Esquina inferior izquierda
            { x: elX + elLength, z: elZ, type: 'corner' },                // Esquina inferior derecha
            { x: elX, z: elZ + elDepth, type: 'corner' },                 // Esquina superior izquierda
            { x: elX + elLength, z: elZ + elDepth, type: 'corner' },      // Esquina superior derecha
            { x: elX + elLength / 2, z: elZ + elDepth / 2, type: 'center' }, // Centro
          ]
          
          // Añadir puntos medios si está habilitado
          if (snapConfig.midpointSnap) {
            snapPoints.push(
              { x: elX + elLength / 2, z: elZ, type: 'midpoint' },
              { x: elX + elLength / 2, z: elZ + elDepth, type: 'midpoint' },
              { x: elX, z: elZ + elDepth / 2, type: 'midpoint' },
              { x: elX + elLength, z: elZ + elDepth / 2, type: 'midpoint' }
            )
          }
          
          // Buscar punto más cercano
          for (const point of snapPoints) {
            const distX = Math.abs(snappedX - point.x)
            const distZ = Math.abs(snappedZ - point.z)
            
            if (distX < snapDist && distZ < snapDist) {
              snappedX = point.x
              snappedZ = point.z
              snappedTo = point.type
              break
            }
          }
        }
      }
      
      // Guardar resultado para visualización
      if (snappedTo) {
        state.setLastSnapResult({ x: snappedX, z: snappedZ, type: snappedTo })
      }
      
      return { x: snappedX, z: snappedZ, snappedTo }
    },
    
    // ==================== CÁMARA Y VISTA ====================
    cameraMode: '3D',  // '2D' | '3D'
    cameraPreset: 'default',
    
    setCameraMode: (mode) => set({ cameraMode: mode }),
    
    toggleCameraMode: () => set((state) => ({
      cameraMode: state.cameraMode === '2D' ? '3D' : '2D'
    })),
    
    setCameraPreset: (preset) => set({ cameraPreset: preset }),
    
    // ==================== COTAS Y MEDICIÓN ====================
    dimensionsConfig: {
      showNaveDimensions: true,
      showElementDimensions: true,
      showDistances: false,
      showAisleWidths: true,
      showWarnings: true,
      unit: 'm',
      precision: 2
    },
    
    toggleDimensions: (key) => set((state) => ({
      dimensionsConfig: {
        ...state.dimensionsConfig,
        [key]: !state.dimensionsConfig[key]
      }
    })),
    
    // Medición activa (herramienta measure)
    activeMeasurement: null,  // { start: {x, z}, end: {x, z} }
    measurements: [],         // Mediciones guardadas
    
    startMeasurement: (point) => set({
      activeMeasurement: { start: point, end: point }
    }),
    
    updateMeasurement: (endPoint) => set((state) => ({
      activeMeasurement: state.activeMeasurement 
        ? { ...state.activeMeasurement, end: endPoint }
        : null
    })),
    
    finishMeasurement: () => set((state) => {
      if (!state.activeMeasurement) return {}
      const measurement = {
        ...state.activeMeasurement,
        id: Date.now(),
        distance: Math.sqrt(
          Math.pow(state.activeMeasurement.end.x - state.activeMeasurement.start.x, 2) +
          Math.pow(state.activeMeasurement.end.z - state.activeMeasurement.start.z, 2)
        )
      }
      return {
        measurements: [...state.measurements, measurement],
        activeMeasurement: null
      }
    }),
    
    clearMeasurements: () => set({ measurements: [], activeMeasurement: null }),
    
    // ==================== SELECCIÓN Y TRANSFORM ====================
    selectedElements: [],      // IDs de elementos seleccionados
    hoveredElement: null,      // ID del elemento bajo el cursor
    isTransforming: false,
    transformOrigin: null,     // Punto de origen para rotación
    
    selectElement: (id, addToSelection = false) => set((state) => {
      if (addToSelection) {
        const isSelected = state.selectedElements.includes(id)
        return {
          selectedElements: isSelected
            ? state.selectedElements.filter(eid => eid !== id)
            : [...state.selectedElements, id]
        }
      }
      return { selectedElements: id ? [id] : [] }
    }),
    
    selectMultiple: (ids) => set({ selectedElements: ids }),
    
    clearSelection: () => set({ selectedElements: [] }),
    
    setHoveredElement: (id) => set({ hoveredElement: id }),
    
    setIsTransforming: (value) => set({ isTransforming: value }),
    
    // ==================== UNDO / REDO ROBUSTO ====================
    history: [],
    historyIndex: -1,
    maxHistoryLength: 50,
    isUndoingRedoing: false,
    
    /**
     * Guarda un snapshot del estado actual
     * @param {Object} snapshot - Estado a guardar { elements, description }
     */
    pushToHistory: (snapshot) => set((state) => {
      if (state.isUndoingRedoing) return {}
      
      // Eliminar estados futuros si estamos en medio del historial
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      
      // Añadir nuevo snapshot
      newHistory.push({
        ...snapshot,
        timestamp: Date.now()
      })
      
      // Limitar tamaño del historial
      if (newHistory.length > state.maxHistoryLength) {
        newHistory.shift()
      }
      
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1
      }
    }),
    
    undo: () => {
      const state = get()
      if (state.historyIndex <= 0) return null
      
      set({ isUndoingRedoing: true, historyIndex: state.historyIndex - 1 })
      const snapshot = state.history[state.historyIndex - 1]
      set({ isUndoingRedoing: false })
      
      return snapshot
    },
    
    redo: () => {
      const state = get()
      if (state.historyIndex >= state.history.length - 1) return null
      
      set({ isUndoingRedoing: true, historyIndex: state.historyIndex + 1 })
      const snapshot = state.history[state.historyIndex + 1]
      set({ isUndoingRedoing: false })
      
      return snapshot
    },
    
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,
    
    clearHistory: () => set({ history: [], historyIndex: -1 }),
    
    // ==================== VALIDACIONES EN TIEMPO REAL ====================
    // "Inteligencia logística"
    
    validationWarnings: [],
    machinery: 'retractil',  // Tipo de maquinaria actual
    
    setMachinery: (type) => set({ machinery: type }),
    
    /**
     * Valida el layout actual y genera avisos
     * @param {Array} elements - Elementos del layout
     * @param {Object} dimensions - Dimensiones de la nave
     * @returns {Array} Lista de warnings
     */
    validateLayout: (elements, dimensions) => {
      const state = get()
      const warnings = []
      const minAisleWidth = AISLE_WIDTHS[state.machinery] || 3.2
      
      const shelves = elements.filter(el => el.type === 'shelf')
      const docks = elements.filter(el => el.type === 'dock')
      
      // 1. Verificar anchos de pasillo entre estanterías
      for (let i = 0; i < shelves.length; i++) {
        for (let j = i + 1; j < shelves.length; j++) {
          const s1 = shelves[i]
          const s2 = shelves[j]
          
          const s1X = s1.position.x
          const s1Z = s1.position.y || 0
          const s1Length = s1.dimensions?.length || 2.7
          const s1Depth = s1.dimensions?.depth || 1.1
          
          const s2X = s2.position.x
          const s2Z = s2.position.y || 0
          const s2Length = s2.dimensions?.length || 2.7
          const s2Depth = s2.dimensions?.depth || 1.1
          
          // Verificar si están en la misma fila (similar Z)
          if (Math.abs(s1Z - s2Z) < 0.5) {
            // Calcular distancia entre ellas en X
            const gap = Math.abs(s1X + s1Length - s2X)
            if (gap > 0.5 && gap < minAisleWidth) {
              warnings.push({
                type: 'aisle_narrow',
                severity: 'error',
                message: `Pasillo de ${gap.toFixed(1)}m - ${state.machinery} necesita ${minAisleWidth}m`,
                elements: [s1.id, s2.id],
                position: { x: (s1X + s2X) / 2, z: s1Z }
              })
            }
          }
          
          // Verificar si están en pasillos paralelos (similar X)
          if (Math.abs(s1X - s2X) < 0.5) {
            // Calcular distancia entre ellas en Z
            const gap = Math.abs((s1Z + s1Depth) - s2Z)
            if (gap > 0.5 && gap < minAisleWidth) {
              warnings.push({
                type: 'aisle_narrow',
                severity: 'error',
                message: `Pasillo de ${gap.toFixed(1)}m - ${state.machinery} necesita ${minAisleWidth}m`,
                elements: [s1.id, s2.id],
                position: { x: s1X, z: (s1Z + s2Z) / 2 }
              })
            }
          }
        }
      }
      
      // 2. Verificar bloqueo de muelles
      for (const dock of docks) {
        const dockX = dock.position.x
        const dockZ = dock.position.y || 0
        const dockWidth = dock.dimensions?.width || 3.5
        
        // Zona de maniobra frente al muelle (4m mínimo)
        const maneuverZone = 4.0
        
        for (const shelf of shelves) {
          const shelfX = shelf.position.x
          const shelfZ = shelf.position.y || 0
          const shelfLength = shelf.dimensions?.length || 2.7
          const shelfDepth = shelf.dimensions?.depth || 1.1
          
          // Verificar si la estantería está en la zona de maniobra del muelle
          const inFrontOfDock = (
            shelfX < dockX + dockWidth + 1 &&
            shelfX + shelfLength > dockX - 1 &&
            shelfZ < dockZ + maneuverZone &&
            shelfZ + shelfDepth > dockZ
          )
          
          if (inFrontOfDock) {
            warnings.push({
              type: 'dock_blocked',
              severity: 'error',
              message: `Estantería bloquea acceso al muelle`,
              elements: [dock.id, shelf.id],
              position: { x: dockX + dockWidth / 2, z: dockZ + maneuverZone / 2 }
            })
          }
        }
      }
      
      // 3. Verificar colisiones entre elementos
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const el1 = elements[i]
          const el2 = elements[j]
          
          if (state.checkCollision(el1, el2)) {
            warnings.push({
              type: 'collision',
              severity: 'error',
              message: `Colisión: ${el1.type} y ${el2.type}`,
              elements: [el1.id, el2.id],
              position: { 
                x: (el1.position.x + el2.position.x) / 2, 
                z: ((el1.position.y || 0) + (el2.position.y || 0)) / 2 
              }
            })
          }
        }
      }
      
      // 4. Verificar elementos fuera de la nave
      for (const el of elements) {
        const elX = el.position.x
        const elZ = el.position.y || 0
        const elLength = el.dimensions?.length || el.dimensions?.width || 2.7
        const elDepth = el.dimensions?.depth || el.dimensions?.width || 1.1
        
        if (elX < 0 || elZ < 0 || 
            elX + elLength > dimensions.length || 
            elZ + elDepth > dimensions.width) {
          warnings.push({
            type: 'out_of_bounds',
            severity: 'warning',
            message: `${el.type} fuera de los límites de la nave`,
            elements: [el.id],
            position: { x: elX, z: elZ }
          })
        }
      }
      
      // 5. Calcular y verificar densidad
      const totalShelfArea = shelves.reduce((sum, s) => {
        const length = s.dimensions?.length || 2.7
        const depth = s.dimensions?.depth || 1.1
        return sum + (length * depth)
      }, 0)
      
      const totalArea = dimensions.length * dimensions.width
      const density = (totalShelfArea / totalArea) * 100
      
      if (density < 20) {
        warnings.push({
          type: 'low_density',
          severity: 'info',
          message: `Densidad baja: ${density.toFixed(1)}% del espacio utilizado`,
          position: { x: dimensions.length / 2, z: dimensions.width / 2 }
        })
      } else if (density > 60) {
        warnings.push({
          type: 'high_density',
          severity: 'warning',
          message: `Densidad alta: ${density.toFixed(1)}% - verificar circulación`,
          position: { x: dimensions.length / 2, z: dimensions.width / 2 }
        })
      }
      
      set({ validationWarnings: warnings })
      return warnings
    },
    
    /**
     * Verifica colisión entre dos elementos
     */
    checkCollision: (el1, el2) => {
      const x1 = el1.position.x
      const z1 = el1.position.y || el1.position.z || 0
      const w1 = el1.dimensions?.length || el1.dimensions?.width || 2.7
      const d1 = el1.dimensions?.depth || el1.dimensions?.width || 1.1
      
      const x2 = el2.position.x
      const z2 = el2.position.y || el2.position.z || 0
      const w2 = el2.dimensions?.length || el2.dimensions?.width || 2.7
      const d2 = el2.dimensions?.depth || el2.dimensions?.width || 1.1
      
      // AABB collision detection
      return (
        x1 < x2 + w2 &&
        x1 + w1 > x2 &&
        z1 < z2 + d2 &&
        z1 + d1 > z2
      )
    },
    
    clearWarnings: () => set({ validationWarnings: [] }),
    
    // ==================== CLIPBOARD ====================
    clipboard: null,
    
    copyElement: (element) => set({ 
      clipboard: JSON.parse(JSON.stringify(element)) 
    }),
    
    cutElement: (element) => {
      set({ clipboard: JSON.parse(JSON.stringify(element)) })
      return element.id  // Retorna ID para que el store principal lo elimine
    },
    
    getClipboard: () => get().clipboard,
    
    clearClipboard: () => set({ clipboard: null }),
    
    // ==================== KEYBOARD SHORTCUTS ====================
    registerKeyboardShortcuts: (warehouseStoreActions) => {
      const handleKeyDown = (e) => {
        // Detectar SHIFT para ortho temporal
        if (e.key === 'Shift') {
          get().setShiftPressed(true)
        }
        
        // Ignorar si está en un input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
        
        const state = get()
        const key = e.key.toUpperCase()
        const ctrl = e.ctrlKey || e.metaKey
        const shift = e.shiftKey
        
        // Ctrl+Z - Undo
        if (ctrl && key === 'Z' && !shift) {
          e.preventDefault()
          const snapshot = state.undo()
          if (snapshot && warehouseStoreActions?.setElements) {
            warehouseStoreActions.setElements(snapshot.elements)
          }
          return
        }
        
        // Ctrl+Y o Ctrl+Shift+Z - Redo
        if ((ctrl && key === 'Y') || (ctrl && shift && key === 'Z')) {
          e.preventDefault()
          const snapshot = state.redo()
          if (snapshot && warehouseStoreActions?.setElements) {
            warehouseStoreActions.setElements(snapshot.elements)
          }
          return
        }
        
        // Ctrl+C - Copiar
        if (ctrl && key === 'C') {
          const selectedId = state.selectedElements[0]
          if (selectedId && warehouseStoreActions?.getElementById) {
            const element = warehouseStoreActions.getElementById(selectedId)
            if (element) state.copyElement(element)
          }
          return
        }
        
        // Ctrl+V - Pegar
        if (ctrl && key === 'V') {
          const clipboard = state.getClipboard()
          if (clipboard && warehouseStoreActions?.addElement) {
            const newElement = {
              ...clipboard,
              id: `${clipboard.type}-${Date.now()}`,
              position: {
                ...clipboard.position,
                x: clipboard.position.x + 2,
                y: (clipboard.position.y || 0) + 2
              }
            }
            warehouseStoreActions.addElement(newElement)
          }
          return
        }
        
        // Delete - Borrar selección
        if (key === 'DELETE' || key === 'BACKSPACE') {
          if (state.selectedElements.length > 0 && warehouseStoreActions?.removeElement) {
            state.selectedElements.forEach(id => {
              warehouseStoreActions.removeElement(id)
            })
            state.clearSelection()
          }
          return
        }
        
        // Escape - Cancelar / Deseleccionar
        if (key === 'ESCAPE') {
          state.clearSelection()
          state.setTool('select')
          return
        }
        
        // Tools shortcuts (sin modificadores)
        if (!ctrl && !shift) {
          switch (key) {
            case 'V': state.setTool('select'); break
            case 'M': state.setTool('move'); break
            case 'R': state.setTool('rotate'); break
            case 'S': state.setTool('draw_shelf'); break
            case 'D': state.setTool('draw_dock'); break
            case 'O': state.setTool('draw_office'); break
            case 'Z': state.setTool('draw_zone'); break
            case 'E': state.setTool('erase'); break
            case 'X': state.setTool('measure'); break
            case 'H': state.setTool('pan'); break
            case 'G': state.toggleGrid(); break
            case 'N': state.toggleSnap(); break  // N de "snap" (S está ocupado)
            case 'T': state.toggleOrtho(); break
            case 'L': state.toggleLayersPanel(); break
            case 'C': state.toggleCameraMode(); break
          }
        }
      }
      
      const handleKeyUp = (e) => {
        // Detectar SHIFT release
        if (e.key === 'Shift') {
          get().setShiftPressed(false)
        }
      }
      
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
    }
  }))
)

export default useEditorStore
