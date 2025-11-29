import { useState, useEffect } from 'react'
import { API_URL } from '../config'
import './DetailedReport.css'

export default function DetailedReport({ warehouseData, onClose }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('resumen')
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [warehouseData])

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`${API_URL}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warehouseData)
      })
      
      if (!response.ok) throw new Error('Error generando informe')
      
      const data = await response.json()
      setReport(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async () => {
    try {
      setDownloadingPdf(true)
      
      const response = await fetch(`${API_URL}/api/report/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warehouseData)
      })
      
      if (!response.ok) throw new Error('Error generando PDF')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `informe_nave_${warehouseData.length}x${warehouseData.width}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error descargando PDF: ' + err.message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="report-overlay">
        <div className="report-modal">
          <div className="report-loading">
            <div className="spinner"></div>
            <p>Generando informe detallado...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="report-overlay">
        <div className="report-modal">
          <div className="report-error">
            <h2>❌ Error</h2>
            <p>{error}</p>
            <button onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'resumen', label: '📊 Resumen', icon: '📊' },
    { id: 'estanterias', label: '🏗️ Estanterías', icon: '🏗️' },
    { id: 'distancias', label: '📏 Distancias', icon: '📏' },
    { id: 'zonas', label: '🔤 Zonas ABC', icon: '🔤' },
    { id: 'palets', label: '📦 Palets', icon: '📦' },
  ]

  return (
    <div className="report-overlay">
      <div className="report-modal report-modal-large">
        {/* Header */}
        <div className="report-header">
          <h1>📋 Informe Detallado</h1>
          <div className="report-header-actions">
            <button 
              className="btn-pdf"
              onClick={downloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? '⏳ Generando...' : '📄 Descargar PDF'}
            </button>
            <button className="btn-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="report-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`report-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="report-content">
          {activeTab === 'resumen' && <TabResumen report={report} />}
          {activeTab === 'estanterias' && <TabEstanterias report={report} />}
          {activeTab === 'distancias' && <TabDistancias report={report} />}
          {activeTab === 'zonas' && <TabZonasABC report={report} />}
          {activeTab === 'palets' && <TabPalets report={report} />}
        </div>
      </div>
    </div>
  )
}

// ==================== TAB RESUMEN ====================
function TabResumen({ report }) {
  return (
    <div className="tab-content">
      <div className="report-grid">
        {/* Dimensiones */}
        <div className="report-card">
          <h3>📐 Dimensiones Generales</h3>
          <table className="report-table">
            <tbody>
              <tr><td>Largo total</td><td className="value">{report.largo_total} m</td></tr>
              <tr><td>Ancho total</td><td className="value">{report.ancho_total} m</td></tr>
              <tr><td>Altura libre</td><td className="value">{report.altura_libre} m</td></tr>
              <tr><td>Superficie total</td><td className="value">{report.superficie_total?.toLocaleString()} m²</td></tr>
              <tr><td>Volumen total</td><td className="value">{report.volumen_total?.toLocaleString()} m³</td></tr>
            </tbody>
          </table>
        </div>

        {/* Estanterías resumen */}
        <div className="report-card">
          <h3>🏗️ Estanterías</h3>
          <table className="report-table">
            <tbody>
              <tr><td>Estanterías dobles</td><td className="value">{report.resumen_estanterias?.numero_estanterias_dobles}</td></tr>
              <tr><td>Estanterías simples</td><td className="value">{report.resumen_estanterias?.numero_estanterias_simples}</td></tr>
              <tr><td>Total estanterías</td><td className="value">{report.resumen_estanterias?.numero_total_estanterias}</td></tr>
              <tr className="highlight"><td>Capacidad total</td><td className="value big">{report.resumen_estanterias?.capacidad_total_palets?.toLocaleString()} palets</td></tr>
            </tbody>
          </table>
        </div>

        {/* Eficiencia */}
        {report.indicadores_eficiencia && (
          <div className="report-card">
            <h3>🎯 Indicadores de Eficiencia</h3>
            <table className="report-table">
              <tbody>
                <tr><td>Eficiencia almacenamiento</td><td className="value">{report.indicadores_eficiencia.eficiencia_almacenamiento}%</td></tr>
                <tr><td>Palets por m² nave</td><td className="value">{report.indicadores_eficiencia.palets_por_m2_nave}</td></tr>
                <tr><td>Palets por m² almacén</td><td className="value">{report.indicadores_eficiencia.palets_por_m2_almacenamiento}</td></tr>
                <tr><td>Dist. media a muelles</td><td className="value">{report.indicadores_eficiencia.distancia_media_muelle_estanteria} m</td></tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Pasillos */}
        {report.pasillos && (
          <div className="report-card">
            <h3>🚗 Pasillos</h3>
            <table className="report-table">
              <tbody>
                <tr><td>Maquinaria</td><td className="value">{report.pasillos.tipo_maquinaria}</td></tr>
                <tr><td>Ancho operativo</td><td className="value">{report.pasillos.ancho_pasillo_operativo} m</td></tr>
                <tr><td>Número de pasillos</td><td className="value">{report.pasillos.numero_pasillos_operativos}</td></tr>
                <tr><td>Pasillo Norte</td><td className="value">{report.pasillos.ancho_pasillo_norte} m</td></tr>
                <tr><td>Pasillo Sur</td><td className="value">{report.pasillos.ancho_pasillo_sur} m</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== TAB ESTANTERÍAS ====================
function TabEstanterias({ report }) {
  const estanterias = report.estanterias_detalle || []
  
  return (
    <div className="tab-content">
      <h3>📏 Detalle de Estanterías (medidas en cm)</h3>
      <div className="table-container">
        <table className="report-table-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Zona</th>
              <th>Pos X</th>
              <th>Pos Z</th>
              <th>Largo</th>
              <th>Prof.</th>
              <th>Altura</th>
              <th>Niveles</th>
              <th>Palets/Nivel</th>
              <th>Total Palets</th>
            </tr>
          </thead>
          <tbody>
            {estanterias.map((e, i) => (
              <tr key={i} className={e.zona_abc ? `zona-${e.zona_abc.toLowerCase()}` : ''}>
                <td className="id">{e.label}</td>
                <td>{e.tipo === 'back-to-back' ? 'Doble' : 'Simple'}</td>
                <td className="zona">{e.zona_abc || '-'}</td>
                <td className="num">{e.posicion_x?.toFixed(1)}</td>
                <td className="num">{e.posicion_z?.toFixed(1)}</td>
                <td className="num">{e.largo?.toFixed(1)}</td>
                <td className="num">{e.profundidad?.toFixed(1)}</td>
                <td className="num">{e.altura?.toFixed(1)}</td>
                <td className="num">{e.niveles}</td>
                <td className="num">{e.palets_por_nivel}</td>
                <td className="num highlight">{e.palets_totales}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="10" className="total-label">TOTAL PALETS</td>
              <td className="total-value">{estanterias.reduce((sum, e) => sum + (e.palets_totales || 0), 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ==================== TAB DISTANCIAS ====================
function TabDistancias({ report }) {
  const estanterias = report.estanterias_detalle || []
  const resumen = report.resumen_distancias || {}
  
  return (
    <div className="tab-content">
      {/* Resumen de distancias */}
      <div className="report-grid">
        <div className="report-card">
          <h3>📊 Resumen de Distancias (cm)</h3>
          <table className="report-table">
            <tbody>
              <tr><td>Mín. a pared Oeste</td><td className="value">{resumen.min_distancia_pared_oeste?.toFixed(1)} cm</td></tr>
              <tr><td>Mín. a pared Este</td><td className="value">{resumen.min_distancia_pared_este?.toFixed(1)} cm</td></tr>
              <tr><td>Mín. a pared Norte (muelles)</td><td className="value">{resumen.min_distancia_pared_norte?.toFixed(1)} cm</td></tr>
              <tr><td>Mín. a pared Sur</td><td className="value">{resumen.min_distancia_pared_sur?.toFixed(1)} cm</td></tr>
            </tbody>
          </table>
        </div>

        <div className="report-card">
          <h3>🚗 Anchos de Pasillo (cm)</h3>
          <table className="report-table">
            <tbody>
              <tr><td>Pasillo configurado</td><td className="value">{resumen.ancho_pasillo_operativo?.toFixed(1)} cm</td></tr>
              <tr><td>Pasillo mínimo real</td><td className="value">{resumen.ancho_pasillo_min?.toFixed(1)} cm</td></tr>
              <tr><td>Pasillo máximo real</td><td className="value">{resumen.ancho_pasillo_max?.toFixed(1)} cm</td></tr>
              <tr><td>Prof. zona almacenamiento</td><td className="value">{resumen.profundidad_zona_almacenamiento?.toFixed(1)} cm</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla detallada de distancias */}
      <h3 style={{marginTop: '20px'}}>📐 Distancias por Estantería (cm)</h3>
      <div className="table-container">
        <table className="report-table-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>D. Oeste</th>
              <th>D. Este</th>
              <th>D. Norte</th>
              <th>D. Sur</th>
              <th>D. Anterior</th>
              <th>D. Siguiente</th>
            </tr>
          </thead>
          <tbody>
            {estanterias.map((e, i) => (
              <tr key={i}>
                <td className="id">{e.label}</td>
                <td className="num">{e.distancia_pared_oeste?.toFixed(1)}</td>
                <td className="num">{e.distancia_pared_este?.toFixed(1)}</td>
                <td className="num">{e.distancia_pared_norte?.toFixed(1)}</td>
                <td className="num">{e.distancia_pared_sur?.toFixed(1)}</td>
                <td className="num">{e.distancia_estanteria_anterior?.toFixed(1) || '-'}</td>
                <td className="num">{e.distancia_estanteria_siguiente?.toFixed(1) || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==================== TAB ZONAS ABC ====================
function TabZonasABC({ report }) {
  const zonas = report.zonas_abc || []
  
  if (zonas.length === 0) {
    return (
      <div className="tab-content">
        <div className="no-data">
          <h3>ℹ️ ABC Zoning no activado</h3>
          <p>Activa ABC Zoning en las preferencias para ver el desglose por zonas.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div className="zones-grid">
        {zonas.map((z, i) => (
          <div key={i} className={`zone-card zone-${z.zona.toLowerCase()}`}>
            <div className="zone-header">
              <h2>ZONA {z.zona}</h2>
              <span className="zone-pallets">{z.palets_totales} palets</span>
            </div>
            
            <div className="zone-section">
              <h4>🏗️ Estanterías</h4>
              <p>{z.num_estanterias} total ({z.num_estanterias_dobles} dobles, {z.num_estanterias_simples} simples)</p>
              <p className="small">{z.estanterias?.join(', ')}</p>
            </div>

            <div className="zone-section">
              <h4>📐 Dimensiones</h4>
              <table className="zone-table">
                <tbody>
                  <tr><td>Superficie</td><td>{z.superficie_m2} m²</td></tr>
                  <tr><td>Altura</td><td>{z.altura_estanterias} cm</td></tr>
                  <tr><td>Niveles</td><td>{z.niveles}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="zone-section">
              <h4>📏 Distancias a Muelles (cm)</h4>
              <table className="zone-table">
                <tbody>
                  <tr><td>Mínima</td><td>{z.distancia_min_muelles?.toFixed(1)}</td></tr>
                  <tr><td>Máxima</td><td>{z.distancia_max_muelles?.toFixed(1)}</td></tr>
                  <tr><td>Media</td><td>{z.distancia_media_muelles?.toFixed(1)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="zone-section">
              <h4>📏 Distancias a Paredes (cm)</h4>
              <table className="zone-table">
                <tbody>
                  <tr><td>Oeste</td><td>{z.distancia_min_pared_oeste?.toFixed(1)}</td></tr>
                  <tr><td>Este</td><td>{z.distancia_min_pared_este?.toFixed(1)}</td></tr>
                  <tr><td>Sur</td><td>{z.distancia_min_pared_sur?.toFixed(1)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="zone-section">
              <h4>📦 Palets por Nivel</h4>
              <div className="levels-grid">
                {Object.entries(z.palets_por_nivel || {}).map(([nivel, cantidad]) => (
                  <div key={nivel} className="level-item">
                    <span className="level-num">N{nivel}</span>
                    <span className="level-qty">{cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== TAB PALETS ====================
function TabPalets({ report }) {
  const palets = report.resumen_palets || {}
  const zonas = report.zonas_abc || []
  
  return (
    <div className="tab-content">
      <div className="report-grid">
        {/* Totales */}
        <div className="report-card">
          <h3>📦 Resumen de Palets</h3>
          <div className="big-number">{palets.total_palets?.toLocaleString()}</div>
          <div className="big-label">Palets Totales</div>
          <table className="report-table">
            <tbody>
              <tr><td>En estanterías dobles</td><td className="value">{palets.palets_en_dobles?.toLocaleString()}</td></tr>
              <tr><td>En estanterías simples</td><td className="value">{palets.palets_en_simples?.toLocaleString()}</td></tr>
              <tr><td>Total estanterías</td><td className="value">{palets.total_estanterias}</td></tr>
              <tr><td>Media por estantería</td><td className="value">{palets.media_palets_por_estanteria?.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Por zona */}
        {(palets.palets_zona_a > 0 || palets.palets_zona_b > 0 || palets.palets_zona_c > 0) && (
          <div className="report-card">
            <h3>🔤 Palets por Zona ABC</h3>
            <div className="zones-bars">
              <div className="zone-bar zona-a">
                <span className="zone-name">Zona A</span>
                <div className="bar" style={{width: `${(palets.palets_zona_a / palets.total_palets) * 100}%`}}></div>
                <span className="zone-qty">{palets.palets_zona_a?.toLocaleString()}</span>
              </div>
              <div className="zone-bar zona-b">
                <span className="zone-name">Zona B</span>
                <div className="bar" style={{width: `${(palets.palets_zona_b / palets.total_palets) * 100}%`}}></div>
                <span className="zone-qty">{palets.palets_zona_b?.toLocaleString()}</span>
              </div>
              <div className="zone-bar zona-c">
                <span className="zone-name">Zona C</span>
                <div className="bar" style={{width: `${(palets.palets_zona_c / palets.total_palets) * 100}%`}}></div>
                <span className="zone-qty">{palets.palets_zona_c?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Por nivel */}
        <div className="report-card">
          <h3>📊 Palets por Nivel</h3>
          <div className="levels-chart">
            {Object.entries(palets.palets_por_nivel || {}).sort((a, b) => a[0] - b[0]).map(([nivel, cantidad]) => (
              <div key={nivel} className="level-row">
                <span className="level-label">Nivel {nivel}</span>
                <div className="level-bar-container">
                  <div 
                    className="level-bar" 
                    style={{width: `${(cantidad / Math.max(...Object.values(palets.palets_por_nivel || {}))) * 100}%`}}
                  ></div>
                </div>
                <span className="level-value">{cantidad}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Eficiencia */}
        <div className="report-card">
          <h3>📈 Eficiencia</h3>
          <table className="report-table">
            <tbody>
              <tr><td>Palets por m² estantería</td><td className="value">{palets.palets_por_m2_estanteria?.toFixed(3)}</td></tr>
              <tr><td>Palets por m³ nave</td><td className="value">{palets.palets_por_m3_nave?.toFixed(5)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
