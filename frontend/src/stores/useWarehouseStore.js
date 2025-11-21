import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useWarehouseStore = create(
  persist(
    (set, get) => ({
      // ==================== ESTADO ====================
      dimensions: { 
        length: 40, 
        width: 25, 
        height: 10 
      },
      
      elements: [],
      
      columns: [],
      
      errors: [],

      // ==================== ACTIONS ====================
      
      // Actualizar dimensiones de la nave
      setDimensions: (newDimensions) => {
        // Validar dimensiones positivas
        if (newDimensions.length < 10 || newDimensions.width < 10 || newDimensions.height < 4) {
          set({ 
            errors: ['Dimensiones mínimas: Largo 10m, Ancho 10m, Alto 4m'] 
          })
          return false
        }
        
        set({ 
          dimensions: newDimensions,
          errors: []
        })
        
        // Recalcular columnas
        get().calculateColumns()
        return true
      },

      // Añadir elemento
      addElement: (element) => {
        const { dimensions, elements } = get()
        
        // Validar que esté dentro de los límites
        const maxX = dimensions.length - (element.dimensions.length || element.dimensions.largo || 0)
        const maxY = dimensions.width - (element.dimensions.width || element.dimensions.ancho || 0)
        
        if (element.position.x < 0 || element.position.x > maxX ||
            element.position.y < 0 || element.position.y > maxY) {
          set({ 
            errors: ['El elemento está fuera de los límites de la nave'] 
          })
          return false
        }
        
        set({ 
          elements: [...elements, element],
          errors: []
        })
        return true
      },

      // Actualizar elemento
      updateElement: (id, updates) => {
        const { elements, dimensions } = get()
        
        const updatedElements = elements.map(el => {
          if (el.id !== id) return el
          
          const updated = { ...el, ...updates }
          
          // Validar límites si se actualiza posición
          if (updates.position) {
            const maxX = dimensions.length - (updated.dimensions.length || updated.dimensions.largo || 0)
            const maxY = dimensions.width - (updated.dimensions.width || updated.dimensions.ancho || 0)
            
            if (updated.position.x < 0 || updated.position.x > maxX ||
                updated.position.y < 0 || updated.position.y > maxY) {
              set({ errors: ['Posición fuera de límites'] })
              return el // No actualizar
            }
          }
          
          return updated
        })
        
        set({ 
          elements: updatedElements,
          errors: []
        })
      },

      // Eliminar elemento
      deleteElement: (id) => {
        set(state => ({ 
          elements: state.elements.filter(el => el.id !== id) 
        }))
      },

      // Calcular columnas automáticamente
      calculateColumns: () => {
        const { dimensions } = get()
        const columnsX = Math.ceil(dimensions.length / 6)
        const columnsZ = Math.ceil(dimensions.width / 6)
        const columns = []
        
        for (let i = 0; i <= columnsX; i++) {
          for (let j = 0; j <= columnsZ; j++) {
            columns.push({
              id: `col-${i}-${j}`,
              x: (dimensions.length / columnsX) * i,
              z: (dimensions.width / columnsZ) * j,
              active: true // Usuario puede desactivar columnas
            })
          }
        }
        
        set({ columns })
      },

      // Limpiar errores
      clearErrors: () => set({ errors: [] }),

      // Resetear todo
      reset: () => set({
        dimensions: { length: 40, width: 25, height: 10 },
        elements: [],
        columns: [],
        errors: []
      })
    }),
    {
      name: 'unitnave-warehouse-storage', // Nombre en localStorage
      partialize: (state) => ({ 
        dimensions: state.dimensions,
        elements: state.elements 
      }) // Solo guardar dimensions y elements, no errores ni columnas
    }
  )
)

export default useWarehouseStore
