/**
 * UNITNAVE Designer - Warehouse Store v4.0
 * 
 * Estado global del almacén:
 * - Dimensiones de la nave
 * - Elementos del diseño
 * - Configuración de maquinaria
 * - Configuración de palet (incluyendo altura)
 * - Configuración de oficinas
 */

import { create } from 'zustand'

const useWarehouseStore = create((set, get) => ({
  // ==================== DIMENSIONES ====================
  dimensions: {
    length: 60,
    width: 40,
    height: 12
  },

  // ==================== ELEMENTOS ====================
  elements: [],

  // ==================== COLUMNAS ESTRUCTURALES ====================
  columns: [
    { id: 'col-1', x: 15, z: 13, active: false },
    { id: 'col-2', x: 30, z: 13, active: false },
    { id: 'col-3', x: 45, z: 13, active: false },
    { id: 'col-4', x: 15, z: 27, active: false },
    { id: 'col-5', x: 30, z: 27, active: false },
    { id: 'col-6', x: 45, z: 27, active: false }
  ],

  // ==================== MAQUINARIA ====================
  machinery: 'retractil',
  
  AISLE_WIDTHS: {
    transpaleta: 1.8,
    apilador: 2.4,
    retractil: 2.8,
    contrapesada: 3.6,
    trilateral: 1.9
  },

  // ==================== CONFIGURACIÓN DE PALET ====================
  palletConfig: {
    type: 'EUR',
    length: 1.2,
    width: 0.8,
    height: 1.5  // Altura de carga configurable
  },

  // ==================== CONFIGURACIÓN DE OFICINAS ====================
  officeConfig: {
    floor: 'mezzanine',  // 'ground' | 'mezzanine' | 'both'
    height: 3.5,
    hasElevator: true
  },

  // ==================== ACCIONES - DIMENSIONES ====================
  setDimensions: (dims) => set({ dimensions: { ...get().dimensions, ...dims } }),

  // ==================== ACCIONES - MAQUINARIA ====================
  setMachinery: (machinery) => set({ machinery }),
  
  getAisleWidth: () => {
    const { machinery, AISLE_WIDTHS } = get()
    return AISLE_WIDTHS[machinery] || 2.8
  },

  // ==================== ACCIONES - PALET ====================
  setPalletConfig: (config) => set((state) => ({
    palletConfig: { ...state.palletConfig, ...config }
  })),

  setPalletHeight: (height) => set((state) => ({
    palletConfig: { ...state.palletConfig, height: Math.max(0.5, Math.min(3.0, height)) }
  })),

  setPalletType: (type) => {
    const types = {
      EUR: { length: 1.2, width: 0.8 },
      US: { length: 1.2, width: 1.0 }
    }
    const dims = types[type] || types.EUR
    set((state) => ({
      palletConfig: { ...state.palletConfig, type, ...dims }
    }))
  },

  // ==================== ACCIONES - OFICINAS ====================
  setOfficeConfig: (config) => set((state) => ({
    officeConfig: { ...state.officeConfig, ...config }
  })),

  // ==================== ACCIONES - ELEMENTOS ====================
  setElements: (elements) => set({ elements }),

  clearWarehouse: () => set({ elements: [] }),

  addElement: (element) => set((state) => {
    const { length, width } = state.dimensions
    const pos = element.position
    
    // Obtener dimensiones del elemento
    let elLength = 0
    let elWidth = 0
    
    switch (element.type) {
      case 'shelf':
        elLength = element.dimensions?.length || 0
        elWidth = element.dimensions?.depth || 0
        break
      case 'office':
        elLength = element.dimensions?.largo || 0
        elWidth = element.dimensions?.ancho || 0
        break
      case 'dock':
        elLength = element.dimensions?.width || 3.5
        elWidth = element.dimensions?.depth || 4
        break
      case 'service_room':
      case 'technical_room':
        elLength = element.dimensions?.largo || element.dimensions?.length || 0
        elWidth = element.dimensions?.ancho || element.dimensions?.width || 0
        break
      case 'operational_zone':
        elLength = element.dimensions?.largo || 0
        elWidth = element.dimensions?.ancho || 0
        break
      default:
        elLength = element.dimensions?.length || element.dimensions?.largo || 1
        elWidth = element.dimensions?.depth || element.dimensions?.ancho || 1
    }

    // Ajustar posición si se sale de límites
    const adjustedX = Math.min(Math.max(0, pos.x), length - elLength)
    const adjustedY = Math.min(Math.max(0, pos.y), width - elWidth)

    const adjustedElement = {
      ...element,
      position: {
        ...pos,
        x: adjustedX,
        y: adjustedY
      }
    }

    return { elements: [...state.elements, adjustedElement] }
  }),

  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    )
  })),

  deleteElement: (id) => set((state) => ({
    elements: state.elements.filter(el => el.id !== id)
  })),

  // ==================== ACCIONES - COLUMNAS ====================
  toggleColumn: (id) => set((state) => ({
    columns: state.columns.map(col =>
      col.id === id ? { ...col, active: !col.active } : col
    )
  })),

  // ==================== UTILIDADES ====================
  getSummary: () => {
    const state = get()
    const shelves = state.elements.filter(e => e.type === 'shelf')
    const pallet = state.palletConfig
    
    // Calcular niveles máximos
    const levelHeight = pallet.height + 0.25
    const maxLevels = Math.floor((state.dimensions.height - 0.5) / levelHeight)
    
    // Calcular palets totales
    const totalPallets = shelves.reduce((sum, el) => {
      const { length = 0, depth = 0, levels = maxLevels } = el.dimensions || {}
      const palletsPerLevel = Math.floor(length / pallet.length) * Math.floor(depth / pallet.width)
      return sum + (palletsPerLevel * Math.min(levels, maxLevels))
    }, 0)

    return {
      elementCount: state.elements.length,
      shelfCount: shelves.length,
      totalPallets,
      maxLevels,
      area: state.dimensions.length * state.dimensions.width,
      volume: state.dimensions.length * state.dimensions.width * state.dimensions.height
    }
  },

  // Obtener elemento por ID
  getElementById: (id) => {
    return get().elements.find(el => el.id === id)
  },

  // Duplicar elemento
  duplicateElement: (id) => {
    const state = get()
    const element = state.elements.find(el => el.id === id)
    if (!element) return

    const newElement = {
      ...element,
      id: `${element.type}-${Date.now()}`,
      position: {
        ...element.position,
        x: element.position.x + 2,
        y: element.position.y + 2
      },
      properties: {
        ...element.properties,
        label: `${element.properties?.label || element.type} (copia)`
      }
    }

    set({ elements: [...state.elements, newElement] })
  }
}))

export default useWarehouseStore