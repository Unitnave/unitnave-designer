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

  addElement: (element) => set((state) => {
    const { length, width } = state.dimensions
    const pos = element.position
    
    let maxX = 0, maxY = 0
    if (element.type === 'shelf') {
      maxX = element.dimensions.length
      maxY = element.dimensions.depth
    } else if (element.type === 'office') {
      maxX = element.dimensions.largo
      maxY = element.dimensions.ancho
    } else if (element.type === 'dock') {
      maxX = element.dimensions.width
    }

    if (pos.x + maxX > length || pos.y + maxY > width) {
      return { }
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