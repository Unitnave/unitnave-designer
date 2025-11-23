import { create } from 'zustand'

const useWarehouseStore = create((set) => ({
  dimensions: {
    length: 40,
    width: 25,
    height: 10
  },

  elements: [],

  columns: [
    { id: 'col-1', x: 10, z: 10, active: false },
    { id: 'col-2', x: 30, z: 10, active: false },
    { id: 'col-3', x: 10, z: 20, active: false },
    { id: 'col-4', x: 30, z: 20, active: false }
  ],

  setDimensions: (dims) => set({ dimensions: dims }),

  // ✅ VALIDACIÓN CORREGIDA
  addElement: (element) => set((state) => {
    const { length, width } = state.dimensions
    const pos = element.position
    
    // Obtener dimensiones correctas según tipo
    let elementLength = 0
    let elementWidth = 0
    
    if (element.type === 'shelf') {
      elementLength = element.dimensions.length || 0
      elementWidth = element.dimensions.depth || 0
    } else if (element.type === 'office') {
      elementLength = element.dimensions.largo || 0
      elementWidth = element.dimensions.ancho || 0
    } else if (element.type === 'dock') {
      elementLength = element.dimensions.width || 0
      elementWidth = element.dimensions.depth || 3
    }

    // ✅ Validar con margen de seguridad
    if (pos.x + elementLength > length || pos.y + elementWidth > width) {
      console.warn('Elemento fuera de límites:', {
        position: pos,
        dimensions: { elementLength, elementWidth },
        limits: { length, width }
      })
      return state // No añadir si está fuera
    }

    return { elements: [...state.elements, element] }
  }),

  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    )
  })),

  deleteElement: (id) => set((state) => ({
    elements: state.elements.filter(el => el.id !== id)
  })),

  toggleColumn: (id) => set((state) => ({
    columns: state.columns.map(col =>
      col.id === id ? { ...col, active: !col.active } : col
    )
  }))
}))

export default useWarehouseStore