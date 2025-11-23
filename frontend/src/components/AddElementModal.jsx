import useWarehouseStore from '../stores/useWarehouseStore'
import useUIStore from '../stores/useUIStore'

export default function AddElementModal() {
  const { dimensions, addElement } = useWarehouseStore()
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
    // ✅ Posición AUTO inteligente
    let autoX = parseFloat(formData.x) || 5
    let autoY = parseFloat(formData.y) || 5
    
    // Validar que no esté fuera
    const dims = getDimensionsFromForm(newElementType, formData)
    const maxX = newElementType === 'shelf' ? dims.length : 
                 newElementType === 'office' ? dims.largo : dims.width
    const maxY = newElementType === 'shelf' ? dims.depth : 
                 newElementType === 'office' ? dims.ancho : dims.depth || 3
    
    if (autoX + maxX > dimensions.length) {
      autoX = Math.max(0, dimensions.length - maxX - 1)
    }
    if (autoY + maxY > dimensions.width) {
      autoY = Math.max(0, dimensions.width - maxY - 1)
    }
    
    const element = {
      id: `${newElementType}-${Date.now()}`,
      type: newElementType,
      position: {
        x: autoX,
        y: autoY,
        z: parseFloat(formData.z) || 0,
        rotation: parseFloat(formData.rotation) || 0
      },
      dimensions: dims,
      properties: {}
    }
    
    const success = addElement(element)
    
    if (success !== false) {
      closeAddModal()
      setViewMode('Planta')
      showNotification('success', 'Elemento añadido correctamente')
    } else {
      showNotification('error', 'Error: elemento fuera de límites. Ajusta las dimensiones.')
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
            <OfficeForm formData={formData} onChange={handleInputChange} dimensions={dimensions} />
          ) : newElementType === 'dock' ? (
            <DockForm formData={formData} onChange={handleInputChange} dimensions={dimensions} />
          ) : (
            <ShelfForm formData={formData} onChange={handleInputChange} dimensions={dimensions} />
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

function OfficeForm({ formData, onChange, dimensions }) {
  return (
    <>
      <label>
        <strong>Largo (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder={`Máx: ${dimensions.length}`}
          value={formData.largo || ''}
          onChange={(e) => onChange('largo', e.target.value)}
        />
      </label>
      <label>
        <strong>Ancho (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder={`Máx: ${dimensions.width}`}
          value={formData.ancho || ''}
          onChange={(e) => onChange('ancho', e.target.value)}
        />
      </label>
      <label>
        <strong>Alto (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder={`Máx: ${dimensions.height}`}
          value={formData.alto || ''}
          onChange={(e) => onChange('alto', e.target.value)}
        />
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

function DockForm({ formData, onChange, dimensions }) {
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
      </label>
      <label>
        <strong>Zona maniobra (m)</strong>
        <input
          type="number"
          step="1"
          value={formData.maneuverZone || '12'}
          onChange={(e) => onChange('maneuverZone', e.target.value)}
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
    </>
  )
}

function ShelfForm({ formData, onChange, dimensions }) {
  return (
    <>
      <label>
        <strong>Largo (m)</strong>
        <input
          type="number"
          step="0.1"
          placeholder={`Máx: ${dimensions.length}`}
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
          placeholder={`Máx: ${dimensions.height}`}
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