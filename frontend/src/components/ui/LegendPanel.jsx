/**
 * UNITNAVE Designer - Panel de Leyenda
 * Muestra métricas y resumen del diseño
 */

import React from 'react'

export default function LegendPanel({
  dimensions,
  elements,
  capacity,
  surfaces,
  machinery,
  position = 'right',
  onToggle
}) {
  const shelves = elements?.filter(e => e.type === 'shelf') || []
  const docks = elements?.filter(e => e.type === 'dock') || []
  
  const styles = {
    container: {
      position: 'fixed',
      top: '80px',
      [position]: '20px',
      width: '280px',
      background: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      padding: '16px',
      color: 'white',
      fontSize: '13px',
      zIndex: 1000,
      border: '1px solid rgba(255,255,255,0.1)',
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    },
    title: {
      fontSize: '15px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.6)',
      cursor: 'pointer',
      fontSize: '18px',
      padding: '4px'
    },
    section: {
      marginBottom: '16px'
    },
    sectionTitle: {
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      color: 'rgba(255,255,255,0.5)',
      marginBottom: '8px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px'
    },
    metric: {
      background: 'rgba(255,255,255,0.05)',
      padding: '10px',
      borderRadius: '8px'
    },
    metricValue: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#f59e0b'
    },
    metricLabel: {
      fontSize: '10px',
      color: 'rgba(255,255,255,0.6)',
      marginTop: '2px'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 0'
    },
    legendColor: {
      width: '12px',
      height: '12px',
      borderRadius: '3px'
    },
    legendText: {
      flex: 1,
      fontSize: '12px'
    },
    legendCount: {
      fontSize: '12px',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.8)'
    }
  }
  
  const legendItems = [
    { type: 'shelf', color: '#ff7800', label: 'Estanterías', count: shelves.length },
    { type: 'dock', color: '#3b82f6', label: 'Muelles', count: docks.length },
    { type: 'office', color: '#10b981', label: 'Oficinas', count: elements?.filter(e => e.type === 'office').length || 0 },
    { type: 'service', color: '#8b5cf6', label: 'Servicios', count: elements?.filter(e => e.type === 'service_room').length || 0 }
  ]
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span>📊</span>
          Resumen
        </div>
        {onToggle && (
          <button style={styles.closeBtn} onClick={onToggle}>×</button>
        )}
      </div>
      
      {/* Dimensiones */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Nave</div>
        <div style={styles.grid}>
          <div style={styles.metric}>
            <div style={styles.metricValue}>{dimensions?.length || 0}</div>
            <div style={styles.metricLabel}>Largo (m)</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricValue}>{dimensions?.width || 0}</div>
            <div style={styles.metricLabel}>Ancho (m)</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricValue}>{dimensions?.height || 0}</div>
            <div style={styles.metricLabel}>Alto (m)</div>
          </div>
          <div style={styles.metric}>
            <div style={styles.metricValue}>
              {((dimensions?.length || 0) * (dimensions?.width || 0)).toLocaleString()}
            </div>
            <div style={styles.metricLabel}>m² Total</div>
          </div>
        </div>
      </div>
      
      {/* Capacidad */}
      {capacity && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Capacidad</div>
          <div style={styles.grid}>
            <div style={{...styles.metric, gridColumn: 'span 2', background: 'rgba(245, 158, 11, 0.15)'}}>
              <div style={{...styles.metricValue, fontSize: '24px'}}>
                {capacity.total_pallets?.toLocaleString() || 0}
              </div>
              <div style={styles.metricLabel}>Palets Totales</div>
            </div>
            <div style={styles.metric}>
              <div style={styles.metricValue}>{capacity.levels_avg || 0}</div>
              <div style={styles.metricLabel}>Niveles</div>
            </div>
            <div style={styles.metric}>
              <div style={styles.metricValue}>{capacity.efficiency_percentage || 0}%</div>
              <div style={styles.metricLabel}>Eficiencia</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Superficies */}
      {surfaces && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Superficies</div>
          <div style={{fontSize: '12px', lineHeight: '1.8'}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: 'rgba(255,255,255,0.7)'}}>Almacenaje</span>
              <span>{surfaces.storage_area?.toLocaleString() || 0} m²</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: 'rgba(255,255,255,0.7)'}}>Circulación</span>
              <span>{surfaces.circulation_area?.toLocaleString() || 0} m²</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: 'rgba(255,255,255,0.7)'}}>Oficinas</span>
              <span>{surfaces.office_area?.toLocaleString() || 0} m²</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Leyenda */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Elementos</div>
        {legendItems.map(item => (
          <div key={item.type} style={styles.legendItem}>
            <div style={{...styles.legendColor, background: item.color}} />
            <span style={styles.legendText}>{item.label}</span>
            <span style={styles.legendCount}>{item.count}</span>
          </div>
        ))}
      </div>
      
      {/* Maquinaria */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Configuración</div>
        <div style={{fontSize: '12px', color: 'rgba(255,255,255,0.7)'}}>
          🚜 Maquinaria: <span style={{color: 'white'}}>{machinery}</span>
        </div>
      </div>
    </div>
  )
}
