import { create } from 'zustand'

const useUIStore = create((set) => ({
  // ==================== ESTADO ====================
  
  // Vista actual (3D, Planta, Alzado, Perfil)
  viewMode: '3D',
  
  // Elemento seleccionado actualmente
  selectedElement: null,
  
  // Modal de añadir elemento
  showAddModal: false,
  newElementType: null,
  formData: {},
  
  // Preview del elemento antes de confirmar
  previewElement: null,
  
  // Mostrar/ocultar distancias
  showDistances: true,
  
  // Loading states
  isCalculating: false,
  isSaving: false,
  isLoading: false,
  
  // Notificaciones/Toast
  notification: null, // { type: 'success'|'error'|'warning', message: string }

  // ==================== ACTIONS ====================
  
  // Cambiar vista
  setViewMode: (mode) => set({ viewMode: mode }),
  
  // Seleccionar elemento
  selectElement: (element) => set({ selectedElement: element }),
  
  // Deseleccionar
  deselectElement: () => set({ selectedElement: null }),
  
  // Abrir modal de añadir elemento
  openAddModal: (type) => set({ 
    showAddModal: true, 
    newElementType: type,
    formData: getEmptyFormByType(type)
  }),
  
  // Cerrar modal
  closeAddModal: () => set({ 
    showAddModal: false, 
    newElementType: null,
    formData: {},
    previewElement: null
  }),
  
  // Actualizar datos del formulario
  updateFormData: (data) => set({ formData: data }),
  
  // Actualizar preview
  setPreviewElement: (element) => set({ previewElement: element }),
  
  // Toggle distancias
  toggleDistances: () => set(state => ({ showDistances: !state.showDistances })),
  
  // Loading states
  setCalculating: (isCalculating) => set({ isCalculating }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoading: (isLoading) => set({ isLoading }),
  
  // Mostrar notificación
  showNotification: (type, message) => {
    set({ notification: { type, message } })
    
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
      set({ notification: null })
    }, 3000)
  },
  
  // Ocultar notificación
  hideNotification: () => set({ notification: null })
}))

// Helper: Formulario vacío según tipo de elemento
function getEmptyFormByType(type) {
  switch(type) {
    case 'shelf':
      return { 
        length: '', 
        depth: '', 
        height: '', 
        levels: '', 
        x: '', 
        y: '', 
        z: '', 
        rotation: '' 
      }
    case 'office':
      return { 
        largo: '', 
        ancho: '', 
        alto: '', 
        x: '', 
        y: '', 
        z: '' 
      }
    case 'dock':
      return { 
        width: '3.5', 
        depth: '3', 
        height: '1.2', 
        maneuverZone: '12', 
        x: '', 
        y: '' 
      }
    default:
      return {}
  }
}

export default useUIStore
