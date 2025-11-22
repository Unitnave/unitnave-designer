import { create } from 'zustand'

const PALLET_TYPES = {
  EUR: { name: 'Europalet', length: 1.2, width: 0.8 },
  US: { name: 'Americano', length: 1.2, width: 1.0 },
  CUSTOM: { name: 'Personalizado', length: 0, width: 0 }
}

const useCalculationsStore = create((set, get) => ({
  // ==================== ESTADO ====================
  
  // Tipo de palet
  palletType: 'EUR',
  
  // Palet personalizado
  customPallet: { length: '', width: '' },
  
  // Resultados de cálculos
  calculations: null,
  
  // Advertencias y validaciones
  warnings: [],
  
  // Validaciones de pasillos
  aisleValidations: [],

  // ==================== ACTIONS ====================
  
  // Cambiar tipo de palet
  setPalletType: (type) => {
    set({ palletType: type })
    get().recalculate()
  },
  
  // Actualizar palet personalizado
  setCustomPallet: (pallet) => {
    set({ customPallet: pallet })
    if (get().palletType === 'CUSTOM') {
      get().recalculate()
    }
  },
  
  // Calcular capacidad total
  calculateCapacity: (dimensions, elements) => {
    const { palletType, customPallet } = get()
    
    // Obtener dimensiones del palet
    const pallet = palletType === 'CUSTOM' ? 
      { 
        length: parseFloat(customPallet.length) || 1.2, 
        width: parseFloat(customPallet.width) || 0.8 
      } :
      PALLET_TYPES[palletType]
    
    let totalPallets = 0
    let occupiedArea = 0
    
    // Calcular por cada elemento
    elements.forEach(el => {
      if (el.type === 'shelf') {
        const { length, depth, levels } = el.dimensions
        const palletsPerLevel = Math.floor((length / pallet.length) * (depth / pallet.width))
        totalPallets += palletsPerLevel * levels
        occupiedArea += length * depth
      } else if (el.type === 'office') {
        occupiedArea += el.dimensions.largo * el.dimensions.ancho
      } else if (el.type === 'dock') {
        occupiedArea += el.dimensions.width * el.dimensions.maneuverZone
      }
    })
    
    // Áreas
    const totalArea = dimensions.length * dimensions.width
    const circulationArea = totalArea - occupiedArea
    const efficiency = ((occupiedArea / totalArea) * 100).toFixed(2)
    
    // Advertencias
    const warnings = []
    if (circulationArea < totalArea * 0.30) {
      warnings.push('⚠️ Área de circulación < 30% (recomendado mínimo 30%)')
    }
    if (circulationArea < totalArea * 0.20) {
      warnings.push('🚨 Área de circulación crítica < 20%')
    }
    
    const calculations = {
      total_pallets: totalPallets,
      occupied_area: occupiedArea.toFixed(2),
      circulation_area: circulationArea.toFixed(2),
      total_area: totalArea.toFixed(2),
      efficiency_percentage: efficiency,
      pallet_type: `${pallet.length}m × ${pallet.width}m`,
      pallet_dimensions: pallet,
      warnings
    }
    
    set({ calculations, warnings })
    return calculations
  },
  
  // Validar pasillos entre elementos
  validateAisles: (elements, minAisleWidth = 3.5) => {
    const validations = []
    
    // Comparar cada par de elementos
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const el1 = elements[i]
        const el2 = elements[j]
        
        // Calcular distancia entre elementos
        const distance = calculateDistance(el1, el2)
        
        if (distance < minAisleWidth) {
          validations.push({
            element1: el1.id,
            element2: el2.id,
            distance: distance.toFixed(2),
            status: distance < 3 ? 'critical' : 'warning',
            message: `Pasillo de ${distance.toFixed(2)}m entre elementos (mínimo ${minAisleWidth}m)`
          })
        }
      }
    }
    
    set({ aisleValidations: validations })
    return validations
  },
  
  // Recalcular todo (capacity + aisles)
  recalculate: () => {
    // Esta función será llamada desde el componente pasando dimensions y elements
    // No accedemos a warehouse store directamente para evitar dependencias circulares
    return {
      needsRecalculation: true
    }
  },
  
  // Limpiar cálculos
  clearCalculations: () => set({ 
    calculations: null, 
    warnings: [],
    aisleValidations: []
  }),
  
  // Obtener tipo de palet actual
  getCurrentPallet: () => {
    const { palletType, customPallet } = get()
    
    if (palletType === 'CUSTOM') {
      return {
        length: parseFloat(customPallet.length) || 1.2,
        width: parseFloat(customPallet.width) || 0.8
      }
    }
    
    return PALLET_TYPES[palletType]
  }
}))

// ==================== HELPERS ====================

// Calcular distancia mínima entre dos elementos
function calculateDistance(el1, el2) {
  // Obtener dimensiones
  const dims1 = el1.dimensions
  const dims2 = el2.dimensions
  
  const length1 = dims1.length || dims1.largo || 0
  const width1 = dims1.width || dims1.ancho || dims1.depth || 0
  const length2 = dims2.length || dims2.largo || 0
  const width2 = dims2.width || dims2.ancho || dims2.depth || 0
  
  // Bounding boxes
  const box1 = {
    minX: el1.position.x,
    maxX: el1.position.x + length1,
    minY: el1.position.y,
    maxY: el1.position.y + width1
  }
  
  const box2 = {
    minX: el2.position.x,
    maxX: el2.position.x + length2,
    minY: el2.position.y,
    maxY: el2.position.y + width2
  }
  
  // Calcular distancia mínima entre cajas
  let dx = 0
  let dy = 0
  
  if (box1.maxX < box2.minX) {
    dx = box2.minX - box1.maxX
  } else if (box2.maxX < box1.minX) {
    dx = box1.minX - box2.maxX
  }
  
  if (box1.maxY < box2.minY) {
    dy = box2.minY - box1.maxY
  } else if (box2.maxY < box1.minY) {
    dy = box1.minY - box2.maxY
  }
  
  return Math.sqrt(dx * dx + dy * dy)
}

export default useCalculationsStore
export { PALLET_TYPES }
