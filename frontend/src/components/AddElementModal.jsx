import useWarehouseStore from '../stores/useWarehouseStore'
import useUIStore from '../stores/useUIStore'

export default function AddElementModal() {
  const { addElement } = useWarehouseStore()
  const { 
    showAddModal, 
    newElementType, 
    formData, 
    updateFormData,
    setPreviewElement,
    closeAddModal,
    setViewMode,
    showNotification
  } = useUIStore()

  if (!showAddModal) return null

  const handleInputChange = (key, value) => {
    const newData = { ...formData, [key]: value }
    updateFormData(newData)
    
    if (newElementType === 'office' && newData.largo && newData.ancho && newData.alto) {
      setPreviewElement({
        type: 'office',
        position: {
          x: parseFloat(newData.x) || 5,
          y: parseFloat(newData.y) || 5,
          z: parseFloat(newData.z) || 0,
          rotation: 0
        },
        dimensions: {
          largo: parseFloat(newData.largo),
          ancho: parseFloat(newData.ancho),
          alto: parseFloat(newData.alto)
        }
      })
    }
  }

  const handleConfirm = () => {
    const element = {
      id: `${newElementType}-${Date.now()}`,
      type: newElementType,
      position: {
        x: parseFloat(formData.x) || 5,
        y: parseFloat(formData.y) || 5,
        z: parseFloat(formData.z) || 0,
        rotation: parseFloat(formData.rotation) || 0
      },
      dimensions: getDimensionsFromForm(newElementType, formData),
      properties: {}
    }
    
    const success = addElement(element)
    
    if (success) {
      closeAddModal()
      setViewMode('Planta')
      showNotification('success', 'Elemento añadido correctamente')
    } else {
      showNotification('error', 'Error: elemento fuera de límites')
    }
  }

  const handleClose = () => {
    closeAddModal()
    setPreviewElement(null)
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-compact office-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nuevo {newElementType?.toUpperCase()}</h2>
        <p style={{fontSize: '12px', color: '#666', marginBottom: '16px'}}>
          {newElementType === 'office' ? 'Define las medidas de la oficina' : 
           newElementType === 'dock' ? 'Configura el muelle de carga' : 
           'Configura la estantería'}
        </p>
        
        <div className="form-grid-office">
          {newElementType === 'office' ? (
            <OfficeForm formData={formData} onChange={handleInputChange} />
          ) : newElementType === 'dock' ? (
            <DockForm formData={formData} onChange={handleInputChange} />
          ) : (
            <ShelfForm formData={formData} onChange={handleInputChange} />
          )}
        </div>

        <div className="modal-actions">
          <button onClick={handleClose} className="btn-cancel">
            Cancelar
          </button>
          <button onClick={handleConfirm} className="btn-confirm">
            ✓ Confirmar y Añadir
          </button>
        </div>
      </div>
    </div>
  )
}

function OfficeForm({ formData, onChange }) {
  return (
    <>
      <label>
        <strong>Largo (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Ej: 10"
          value={formData.largo || ''}
          onChange={(e) => onChange('largo', e.target.value)}
        />
      </label>
      <label>
        <strong>Ancho (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Ej: 8"
          value={formData.ancho || ''}
          onChange={(e) => onChange('ancho', e.target.value)}
        />
      </label>
      <label>
        <strong>Alto (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Ej: 3.5"
          value={formData.alto || ''}
          onChange={(e) => onChange('alto', e.target.value)}
        />
      </label>
      <label>
        <strong>Altura desde suelo (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="0 = planta baja"
          value={formData.z || ''}
          onChange={(e) => onChange('z', e.target.value)}
        />
        <small style={{fontSize: '10px', color: '#999', marginTop: '2px'}}>
          0=Planta baja, 4-5=Entreplanta, 6-8=Superior
        </small>
      </label>
      <label>
        <strong>Posición X (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Auto (5m)"
          value={formData.x || ''}
          onChange={(e) => onChange('x', e.target.value)}
        />
      </label>
      <label>
        <strong>Posición Y (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Auto (5m)"
          value={formData.y || ''}
          onChange={(e) => onChange('y', e.target.value)}
        />
      </label>
    </>
  )
}

function DockForm({ formData, onChange }) {
  return (
    <>
      <label>
        <strong>Ancho (m)</strong>
        <input
          type="number"
          step="0.1"
          value={formData.width || '3.5'}
          onChange={(e) => onChange('width', e.target.value)}
        />
      </label>
      <label>
        <strong>Profundidad (m)</strong>
        <input
          type="number"
          step="0.1"
          value={formData.depth || '3'}
          onChange={(e) => onChange('depth', e.target.value)}
        />
      </label>
      <label>
        <strong>Altura plataforma (m)</strong>
        <input
          type="number"
          step="0.1"
          value={formData.height || '1.2'}
          onChange={(e) => onChange('height', e.target.value)}
        />
        <small style={{fontSize: '10px', color: '#999', marginTop: '2px'}}>
          Estándar: 1.1-1.2m
        </small>
      </label>
      <label>
        <strong>Zona maniobra (m)</strong>
        <input
          type="number"
          step="1"
          value={formData.maneuverZone || '12'}
          onChange={(e) => onChange('maneuverZone', e.target.value)}
        />
        <small style={{fontSize: '10px', color: '#999', marginTop: '2px'}}>
          Mínimo 12m para camión rígido
        </small>
      </label>
      <label>
        <strong>Posición X (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Auto"
          value={formData.x || ''}
          onChange={(e) => onChange('x', e.target.value)}
        />
      </label>
      <label>
        <strong>Posición Y (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Auto"
          value={formData.y || ''}
          onChange={(e) => onChange('y', e.target.value)}
        />
      </label>
    </>
  )
}

function ShelfForm({ formData, onChange }) {
  return (
    <>
      <label>
        <strong>Largo (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Ej: 12"
          value={formData.length || ''}
          onChange={(e) => onChange('length', e.target.value)}
        />
      </label>
      <label>
        <strong>Profundidad (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Ej: 1.1"
          value={formData.depth || ''}
          onChange={(e) => onChange('depth', e.target.value)}
        />
      </label>
      <label>
        <strong>Altura (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Ej: 8"
          value={formData.height || ''}
          onChange={(e) => onChange('height', e.target.value)}
        />
      </label>
      <label>
        <strong>Niveles</strong>
        <input
          type="number"
          step="1"
          placeholder="Ej: 4"
          value={formData.levels || ''}
          onChange={(e) => onChange('levels', e.target.value)}
        />
      </label>
      <label>
        <strong>Posición X (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Auto"
          value={formData.x || ''}
          onChange={(e) => onChange('x', e.target.value)}
        />
      </label>
      <label>
        <strong>Posición Y (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="Auto"
          value={formData.y || ''}
          onChange={(e) => onChange('y', e.target.value)}
        />
      </label>
      <label>
        <strong>Altura desde suelo (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder="0"
          value={formData.z || ''}
          onChange={(e) => onChange('z', e.target.value)}
        />
      </label>
      <label>
        <strong>Rotación (grados)</strong>
        <input
          type="number"
          step="15"
          placeholder="0"
          value={formData.rotation || ''}
          onChange={(e) => onChange('rotation', e.target.value)}
        />
      </label>
    </>
  )
}

function getDimensionsFromForm(type, data) {
  switch(type) {
    case 'shelf':
      return {
        length: parseFloat(data.length) || 12,
        depth: parseFloat(data.depth) || 1.1,
        height: parseFloat(data.height) || 8,
        levels: parseInt(data.levels) || 4
      }
    case 'office':
      return {
        largo: parseFloat(data.largo) || 10,
        ancho: parseFloat(data.ancho) || 10,
        alto: parseFloat(data.alto) || 3.5
      }
    case 'dock':
      return {
        width: parseFloat(data.width) || 3.5,
        depth: parseFloat(data.depth) || 3,
        height: parseFloat(data.height) || 1.2,
        maneuverZone: parseFloat(data.maneuverZone) || 12
      }
    default:
      return {}
  }
}