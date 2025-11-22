import { create } from 'zustand'

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

const useUIStore = create((set) => ({
  viewMode: '3D',
  selectedElement: null,
  showAddModal: false,
  newElementType: null,
  formData: {},
  previewElement: null,
  showDistances: true,
  isCalculating: false,
  isSaving: false,
  isLoading: false,
  notification: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  selectElement: (element) => set({ selectedElement: element }),
  deselectElement: () => set({ selectedElement: null }),
  
  openAddModal: (type) => set({ 
    showAddModal: true, 
    newElementType: type,
    formData: getEmptyFormByType(type)
  }),
  
  closeAddModal: () => set({ 
    showAddModal: false, 
    newElementType: null,
    formData: {},
    previewElement: null
  }),
  
  updateFormData: (data) => set({ formData: data }),
  setPreviewElement: (element) => set({ previewElement: element }),
  toggleDistances: () => set(state => ({ showDistances: !state.showDistances })),
  setCalculating: (isCalculating) => set({ isCalculating }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoading: (isLoading) => set({ isLoading }),
  
  showNotification: (type, message) => {
    set({ notification: { type, message } })
    setTimeout(() => {
      set({ notification: null })
    }, 3000)
  },
  
  hideNotification: () => set({ notification: null })
}))

export default useUIStore