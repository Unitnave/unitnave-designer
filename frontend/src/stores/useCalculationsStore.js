/**
 * UNITNAVE Designer - Calculations Store v4.0
 * 
 * Cálculos de capacidad:
 * - Palets totales
 * - Cubicaje (volumen)
 * - Niveles según altura de palet
 * - Eficiencia de ocupación
 * - Superficies por tipo
 */

import { create } from 'zustand'

// Tipos de palet
const PALLET_TYPES = {
  EUR: { name: 'Europalet', length: 1.2, width: 0.8, defaultHeight: 1.5 },
  US: { name: 'Americano', length: 1.2, width: 1.0, defaultHeight: 1.5 }
}

// Anchos de pasillo por maquinaria
const AISLE_WIDTHS = {
  transpaleta: 1.8,
  apilador: 2.4,
  retractil: 2.8,
  contrapesada: 3.6,
  trilateral: 1.9
}

const useCalculationsStore = create((set, get) => ({
  // ==================== CONFIGURACIÓN ====================
  palletType: 'EUR',
  palletHeight: 1.5,
  machinery: 'retractil',
  aisleWidth: 2.8,

  // ==================== RESULTADOS ====================
  capacity: null,
  surfaces: null,
  cubicaje: null,
  warnings: [],
  loading: false,

  // ==================== SETTERS ====================
  setPalletType: (type) => {
    const height = PALLET_TYPES[type]?.defaultHeight || 1.5
    set({ palletType: type, palletHeight: height })
  },

  setPalletHeight: (height) => {
    set({ palletHeight: Math.max(0.5, Math.min(3.0, parseFloat(height) || 1.5)) })
  },

  setMachinery: (machinery) => {
    const width = AISLE_WIDTHS[machinery] || 2.8
    set({ machinery, aisleWidth: width })
  },

  // ==================== GETTERS ====================
  getCurrentPallet: () => {
    const { palletType, palletHeight } = get()
    const base = PALLET_TYPES[palletType] || PALLET_TYPES.EUR
    return {
      length: base.length,
      width: base.width,
      height: palletHeight
    }
  },

  getMaxLevels: (warehouseHeight) => {
    const { palletHeight } = get()
    const levelHeight = palletHeight + 0.25
    return Math.max(1, Math.floor((warehouseHeight - 0.5) / levelHeight))
  },

  // ==================== CÁLCULO PRINCIPAL ====================
  calculateCapacity: async (dimensions, elements) => {
    set({ loading: true })
    
    const { palletType, palletHeight, aisleWidth } = get()
    
    // Obtener palet
    const pallet = {
      ...(PALLET_TYPES[palletType] || PALLET_TYPES.EUR),
      height: palletHeight
    }

    // Calcular niveles máximos
    const levelHeight = palletHeight + 0.25
    const maxLevels = Math.max(1, Math.floor((dimensions.height - 0.5) / levelHeight))

    // Inicializar contadores
    let totalPallets = 0
    let totalVolume = 0
    let storageArea = 0
    let officeArea = 0
    let servicesArea = 0
    let dockArea = 0
    let operationalArea = 0
    const warnings = []

    // Procesar cada elemento
    elements.forEach(el => {
      switch (el.type) {
        case 'shelf': {
          const { length = 0, depth = 0, levels = maxLevels } = el.dimensions || {}
          
          // Calcular palets por nivel (mejor orientación)
          const opt1 = Math.floor(length / pallet.length) * Math.floor(depth / pallet.width)
          const opt2 = Math.floor(length / pallet.width) * Math.floor(depth / pallet.length)
          const palletsPerLevel = Math.max(opt1, opt2)
          
          const actualLevels = Math.min(levels, maxLevels)
          const shelfPallets = palletsPerLevel * actualLevels
          
          totalPallets += shelfPallets
          totalVolume += shelfPallets * pallet.length * pallet.width * pallet.height
          storageArea += length * depth
          break
        }

        case 'office': {
          const area = (el.dimensions?.largo || 0) * (el.dimensions?.ancho || 0)
          officeArea += area
          break
        }

        case 'dock': {
          const w = el.dimensions?.width || 3.5
          const d = el.dimensions?.depth || 4
          const m = el.dimensions?.maneuverZone || 12
          dockArea += w * (d + m)
          break
        }

        case 'service_room':
        case 'technical_room': {
          const area = (el.dimensions?.largo || 0) * (el.dimensions?.ancho || 0)
          servicesArea += area
          break
        }

        case 'operational_zone': {
          const area = (el.dimensions?.largo || 0) * (el.dimensions?.ancho || 0)
          operationalArea += area
          break
        }
      }
    })

    // Cálculos finales
    const totalArea = dimensions.length * dimensions.width
    const occupiedArea = storageArea + officeArea + servicesArea + dockArea + operationalArea
    const circulationArea = Math.max(0, totalArea - occupiedArea)
    const usableArea = totalArea - officeArea
    const efficiency = usableArea > 0 ? (storageArea / usableArea) * 100 : 0

    // Warnings
    const circulationPercent = (circulationArea / totalArea) * 100
    if (circulationPercent < 25) {
      warnings.push('⚠️ Área de circulación muy baja (<25%)')
    }
    if (circulationPercent < 15) {
      warnings.push('🚨 Circulación crítica (<15%) - revisar diseño')
    }
    if (totalPallets === 0 && elements.some(e => e.type === 'shelf')) {
      warnings.push('⚠️ Estanterías sin palets calculados')
    }

    // Capacidad
    const shelfCount = elements.filter(e => e.type === 'shelf').length
    const capacity = {
      total_pallets: totalPallets,
      pallets_per_level: shelfCount > 0 ? Math.round(totalPallets / shelfCount / maxLevels) : 0,
      levels_avg: maxLevels,
      storage_volume_m3: Math.round(totalVolume * 100) / 100,
      efficiency_percentage: Math.round(efficiency * 100) / 100
    }

    // Superficies
    const surfaces = {
      total_area: Math.round(totalArea * 100) / 100,
      storage_area: Math.round(storageArea * 100) / 100,
      office_area: Math.round(officeArea * 100) / 100,
      services_area: Math.round(servicesArea * 100) / 100,
      dock_area: Math.round(dockArea * 100) / 100,
      operational_area: Math.round(operationalArea * 100) / 100,
      circulation_area: Math.round(circulationArea * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100
    }

    // Cubicaje
    const cubicaje = {
      totalVolume: Math.round(totalVolume * 100) / 100,
      volumePerPallet: Math.round(pallet.length * pallet.width * pallet.height * 1000) / 1000,
      palletHeight: pallet.height,
      maxLevels,
      levelHeight: Math.round(levelHeight * 100) / 100,
      warehouseVolume: Math.round(totalArea * dimensions.height * 100) / 100,
      utilizationPercent: Math.round((totalVolume / (totalArea * dimensions.height)) * 10000) / 100
    }

    set({
      capacity,
      surfaces,
      cubicaje,
      warnings,
      loading: false
    })

    return { capacity, surfaces, cubicaje, warnings }
  },

  // ==================== RESET ====================
  reset: () => set({
    capacity: null,
    surfaces: null,
    cubicaje: null,
    warnings: [],
    loading: false
  })
}))

export default useCalculationsStore
export { PALLET_TYPES, AISLE_WIDTHS }
