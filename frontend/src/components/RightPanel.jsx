import useWarehouseStore from '../stores/useWarehouseStore'
import useUIStore from '../stores/useUIStore'
import useCalculationsStore from '../stores/useCalculationsStore'

export default function RightPanel() {
  const { dimensions, elements, selectedElement, updateElement, deleteElement } = useWarehouseStore()
  const { deselectElement } = useUIStore()
  const { calculations, calculateCapacity } = useCalculationsStore()

  const handlePropertyChange = (key, value) => {
    updateElement(selectedElement.id, {
      position: { ...selectedElement.position, [key]: parseFloat(value) || 0 }
    })
  }

  const handleDimensionChange = (key, value) => {
    updateElement(selectedElement.id, {
      dimensions: { ...selectedElement.dimensions, [key]: parseFloat(value) || 0 }
    })
  }

  const handleDelete = () => {
    deleteElement(selectedElement.id)
    deselectElement()
  }

  const calculateDistances = () => {
    if (!selectedElement || selectedElement.type !== 'office') return null

    const dims = selectedElement.dimensions
    const pos = selectedElement.position

    return {
      left: pos.x.toFixed(1),
      right: (dimensions.length - pos.x - (dims.largo || 0)).toFixed(1),
      back: pos.y.toFixed(1),
      front: (dimensions.width - pos.y - (dims.ancho || 0)).toFixed(1)
    }
  }

  const distances = calculateDistances()

  return (
    <aside className="sidebar-right compact">
      {selectedElement ? (
        <div className="section-compact">
          <h2>⚙️ {selectedElement.type.toUpperCase()}</h2>
          
          <h3 style={{fontSize: '11px', margin: '12px 0 8px 0', color: '#666', textTransform: 'uppercase'}}>
            Posición
          </h3>
          
          <label className="label-compact">
            X (horizontal)
            <input 
              type="number" 
              step="0.1"
              value={selectedElement.position.x}
              onChange={(e) => handlePropertyChange('x', e.target.value)}
            />
          </label>
          
          <label className="label-compact">
            Y (horizontal)
            <input 
              type="number" 
              step="0.1"
              value={selectedElement.position.y}
              onChange={(e) => handlePropertyChange('y', e.target.value)}
            />
          </label>
          
          <label className="label-compact">
            Z (altura desde suelo)
            <input 
              type="number" 
              step="0.1"
              value={selectedElement.position.z}
              onChange={(e) => handlePropertyChange('z', e.target.value)}
            />
          </label>
          
          <label className="label-compact">
            Rotación (grados)
            <input 
              type="number" 
              step="15"
              value={selectedElement.position.rotation}
              onChange={(e) => handlePropertyChange('rotation', e.target.value)}
            />
          </label>

          <h3 style={{fontSize: '11px', margin: '12px 0 8px 0', color: '#666', textTransform: 'uppercase'}}>
            Dimensiones
          </h3>
          
          {Object.entries(selectedElement.dimensions).map(([key, value]) => (
            <label key={key} className="label-compact">
              {key}
              <input 
                type="number" 
                step="0.1"
                value={value}
                onChange={(e) => handleDimensionChange(key, e.target.value)}
              />
            </label>
          ))}

          {distances && (
            <>
              <h3 style={{fontSize: '11px', margin: '12px 0 8px 0', color: '#666', textTransform: 'uppercase'}}>
                📏 Distancias a Paredes
              </h3>
              <div className="distances-info">
                <div className="distance-row">
                  <span>→ Izquierda:</span>
                  <strong>{distances.left}m</strong>
                </div>
                <div className="distance-row">
                  <span>← Derecha:</span>
                  <strong>{distances.right}m</strong>
                </div>
                <div className="distance-row">
                  <span>↑ Fondo:</span>
                  <strong>{distances.back}m</strong>
                </div>
                <div className="distance-row">
                  <span>↓ Frontal:</span>
                  <strong>{distances.front}m</strong>
                </div>
              </div>
            </>
          )}

          <button 
            onClick={handleDelete}
            className="btn-danger-compact"
          >
            🗑️ ELIMINAR
          </button>
        </div>
      ) : calculations ? (
        <div className="section-compact">
          <h2>📊 RESULTADOS</h2>
          
          <div className="calc-big">{calculations.total_pallets}</div>
          <div className="calc-label">Palets Totales</div>
          <div className="calc-small">Tipo: {calculations.pallet_type}</div>
          
          <div className="calc-row-compact">
            <span>Aprovechamiento:</span>
            <strong>{calculations.efficiency_percentage}%</strong>
          </div>
          <div className="calc-row-compact">
            <span>Área ocupada:</span>
            <strong>{calculations.occupied_area} m²</strong>
          </div>
          <div className="calc-row-compact">
            <span>Circulación:</span>
            <strong>{calculations.circulation_area} m²</strong>
          </div>
          <div className="calc-row-compact">
            <span>Área total:</span>
            <strong>{calculations.total_area} m²</strong>
          </div>

          {calculations.warnings && calculations.warnings.length > 0 && (
            <div style={{marginTop: '12px'}}>
              {calculations.warnings.map((warning, i) => (
                <div key={i} className="warning-compact">{warning}</div>
              ))}
            </div>
          )}

          <button 
            className="btn-primary-compact" 
            onClick={() => calculateCapacity(dimensions, elements)}
          >
            🔄 RECALCULAR
          </button>
          <button className="btn-secondary-compact">
            📸 RENDER 3D
          </button>
          <button className="btn-secondary-compact">
            📄 EXPORTAR PDF
          </button>
          <button className="btn-secondary-compact">
            💾 GUARDAR DISEÑO
          </button>
        </div>
      ) : (
        <div style={{padding: '2rem', textAlign: 'center', color: '#999', fontSize: '13px'}}>
          Añade elementos para ver cálculos
        </div>
      )}
    </aside>
  )
}