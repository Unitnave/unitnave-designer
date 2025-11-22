import useWarehouseStore from '../stores/useWarehouseStore'
import useUIStore from '../stores/useUIStore'
import useCalculationsStore from '../stores/useCalculationsStore'

export default function Sidebar() {
  const { dimensions, elements, setDimensions, deleteElement } = useWarehouseStore()
  const { selectedElement, selectElement, openAddModal } = useUIStore()
  const { palletType, setPalletType, customPallet, setCustomPallet } = useCalculationsStore()

  const handleDimensionChange = (key, value) => {
    setDimensions({ ...dimensions, [key]: Number(value) })
  }

  const handleCustomPalletChange = (key, value) => {
    setCustomPallet({ ...customPallet, [key]: value })
  }

  return (
    <aside className="sidebar-left compact">
      <div className="section-compact">
        <h2>➕ ELEMENTOS</h2>
        <button onClick={() => openAddModal('shelf')} className="btn-compact shelf">
          📦 Estantería
        </button>
        <button onClick={() => openAddModal('office')} className="btn-compact office">
          🏢 Oficina
        </button>
        <button onClick={() => openAddModal('dock')} className="btn-compact dock">
          🚛 Muelle
        </button>
      </div>

      <div className="section-compact">
        <h2>📐 NAVE</h2>
        <label className="label-compact">
          Largo: {dimensions.length}m
          <input 
            type="range" 
            min="20" 
            max="100" 
            value={dimensions.length}
            onChange={(e) => handleDimensionChange('length', e.target.value)}
          />
        </label>
        <label className="label-compact">
          Ancho: {dimensions.width}m
          <input 
            type="range" 
            min="15" 
            max="50" 
            value={dimensions.width}
            onChange={(e) => handleDimensionChange('width', e.target.value)}
          />
        </label>
        <label className="label-compact">
          Alto: {dimensions.height}m
          <input 
            type="range" 
            min="6" 
            max="15" 
            value={dimensions.height}
            onChange={(e) => handleDimensionChange('height', e.target.value)}
          />
        </label>
      </div>

      <div className="section-compact">
        <h2>📦 TIPO PALET</h2>
        <select 
          value={palletType} 
          onChange={(e) => setPalletType(e.target.value)}
          className="select-compact"
        >
          <option value="EUR">Europalet (1.2×0.8m)</option>
          <option value="US">Americano (1.2×1.0m)</option>
          <option value="CUSTOM">Personalizado</option>
        </select>
        
        {palletType === 'CUSTOM' && (
          <div style={{marginTop: '8px'}}>
            <input 
              type="number" 
              placeholder="Largo (m)" 
              step="0.1"
              value={customPallet.length}
              onChange={(e) => handleCustomPalletChange('length', e.target.value)}
              style={{width: '100%', marginBottom: '4px', padding: '4px', fontSize: '12px'}}
            />
            <input 
              type="number" 
              placeholder="Ancho (m)" 
              step="0.1"
              value={customPallet.width}
              onChange={(e) => handleCustomPalletChange('width', e.target.value)}
              style={{width: '100%', padding: '4px', fontSize: '12px'}}
            />
          </div>
        )}
      </div>

      {elements.length > 0 && (
        <div className="section-compact">
          <h2>📋 ELEMENTOS ({elements.length})</h2>
          <div className="elements-list-compact">
            {elements.map(el => (
              <div 
                key={el.id} 
                className={`element-item-compact ${selectedElement?.id === el.id ? 'selected' : ''}`}
                onClick={() => selectElement(el)}
              >
                <span>{el.type === 'shelf' ? '📦' : el.type === 'office' ? '🏢' : '🚛'}</span>
                <span style={{flex: 1, fontSize: '11px'}}>#{el.id.slice(-4)}</span>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    deleteElement(el.id);
                  }}
                  style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px'}}
                >
                  ❌
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}