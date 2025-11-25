/**
 * UNITNAVE Designer - App Principal v4.0
 * 
 * Integración completa:
 * - Visor 3D profesional (Warehouse3DPro)
 * - Panel de leyenda con métricas
 * - Modo manual y wizard
 * - Configuración de palet y oficinas
 */

import { useState, useCallback, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import './index.css'

// Stores
import useWarehouseStore from './stores/useWarehouseStore'
import useUIStore from './stores/useUIStore'
import useCalculationsStore from './stores/useCalculationsStore'

// Componentes
import Warehouse3DPro from './components/Warehouse3DPro'
import Sidebar from './components/Sidebar'
import FloatingPanel from './components/FloatingPanel'
import AddElementModal from './components/AddElementModal'
import Notification from './components/Notification'
import LegendPanel from './components/ui/LegendPanel'

// Wizard
import DesignPage from './pages/DesignPage'

export default function App() {
  const [mode, setMode] = useState('manual')

  if (mode === 'wizard') {
    return (
      <div style={{ position: 'relative' }}>
        <DesignPage />
        
        <button
          onClick={() => setMode('manual')}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)'
          }}
          title="Modo Manual"
        >
          ✏️
        </button>
      </div>
    )
  }

  return <ManualDesignMode onSwitchToWizard={() => setMode('wizard')} />
}

function ManualDesignMode({ onSwitchToWizard }) {
  const { dimensions, elements } = useWarehouseStore()
  const { viewMode, setViewMode } = useUIStore()
  const { calculateCapacity, palletHeight, machinery, capacity, surfaces } = useCalculationsStore()
  
  const [showLegend, setShowLegend] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)

  // Calcular automáticamente al cambiar elementos
  useEffect(() => {
    if (elements.length > 0) {
      calculateCapacity(dimensions, elements)
    }
  }, [elements, dimensions])

  const handleCalculate = useCallback(async () => {
    setIsCalculating(true)
    try {
      await calculateCapacity(dimensions, elements)
    } catch (e) {
      console.error('Error:', e)
    }
    setIsCalculating(false)
  }, [dimensions, elements, calculateCapacity])

  const is3DView = viewMode === '3D'

  return (
    <div className="app">
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>🏭</span>
          <div>
            <div style={{
              fontSize: '20px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '2px'
            }}>
              UNITNAVE
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '4px'
            }}>
              DESIGNER PRO
            </div>
          </div>
        </div>

        {/* Vistas */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: '3D', icon: '🎮', label: '3D' },
            { id: 'Planta', icon: '📐', label: 'Planta' },
            { id: 'Alzado', icon: '🏗️', label: 'Alzado' },
            { id: 'Perfil', icon: '📊', label: 'Perfil' }
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              style={{
                padding: '10px 18px',
                background: viewMode === v.id
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : 'rgba(255,255,255,0.05)',
                border: viewMode === v.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: viewMode === v.id ? '600' : '400',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <span>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowLegend(!showLegend)}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📊 {showLegend ? 'Ocultar' : 'Mostrar'} Info
          </button>

          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: isCalculating ? 'wait' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              opacity: isCalculating ? 0.7 : 1
            }}
          >
            {isCalculating ? '⏳ Calculando...' : '🧮 Calcular'}
          </button>

          <button
            onClick={onSwitchToWizard}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative'
            }}
          >
            ⚡ Optimizar GA
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: '#ef4444',
              color: 'white',
              fontSize: '9px',
              padding: '3px 6px',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              AI
            </span>
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="main-content">
        <Sidebar />

        <div className="canvas-container" style={{ position: 'relative', flex: 1 }}>
          <Canvas
            shadows
            style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)' }}
            gl={{ antialias: true, alpha: false }}
          >
            {is3DView ? (
              <PerspectiveCamera
                makeDefault
                position={[dimensions.length * 0.8, dimensions.height * 2, dimensions.width * 0.8]}
                fov={50}
                near={0.1}
                far={1000}
              />
            ) : (
              <OrthographicCamera
                makeDefault
                position={[0, 100, 0]}
                zoom={8}
                near={-500}
                far={500}
              />
            )}

            <Warehouse3DPro />

            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.05}
              minDistance={5}
              maxDistance={300}
              enableRotate={is3DView}
              enablePan={true}
              enableZoom={true}
              screenSpacePanning={!is3DView}
              maxPolarAngle={Math.PI / 2.1}
            />
          </Canvas>

          {/* Indicador vista */}
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            background: 'rgba(30, 41, 59, 0.9)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span style={{ fontSize: '18px' }}>{viewMode === '3D' ? '🎮' : '📐'}</span>
            Vista {viewMode}
            {viewMode !== '3D' && <span style={{ opacity: 0.6 }}>(2D)</span>}
          </div>

          {/* Métricas rápidas */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            display: 'flex',
            gap: '10px'
          }}>
            <MetricBadge 
              value={elements.length} 
              label="Elementos" 
              color="rgba(30, 41, 59, 0.9)"
            />
            <MetricBadge 
              value={(dimensions.length * dimensions.width).toLocaleString()} 
              label="m²" 
              color="rgba(30, 41, 59, 0.9)"
            />
            {capacity?.total_pallets > 0 && (
              <MetricBadge 
                value={capacity.total_pallets.toLocaleString()} 
                label="Palets" 
                color="linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.9) 100%)"
                highlight
              />
            )}
          </div>

          {/* Ayuda de controles */}
          {is3DView && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              background: 'rgba(30, 41, 59, 0.8)',
              backdropFilter: 'blur(10px)',
              color: 'rgba(255,255,255,0.7)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '11px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              🖱️ Rotar · 🔍 Scroll zoom · ✋ Click derecho pan
            </div>
          )}
        </div>

        <FloatingPanel />
      </div>

      {/* Panel de leyenda */}
      {showLegend && (
        <LegendPanel
          dimensions={dimensions}
          elements={elements}
          capacity={capacity}
          surfaces={surfaces}
          machinery={machinery || 'retractil'}
          position="right"
          onToggle={() => setShowLegend(false)}
        />
      )}

      <AddElementModal />
      <Notification />
    </div>
  )
}

// Componente auxiliar
function MetricBadge({ value, label, color, highlight }) {
  return (
    <div style={{
      background: color,
      backdropFilter: 'blur(10px)',
      padding: '12px 18px',
      borderRadius: '12px',
      textAlign: 'center',
      border: highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
      boxShadow: highlight ? '0 4px 15px rgba(245, 158, 11, 0.3)' : 'none'
    }}>
      <div style={{
        fontSize: '22px',
        fontWeight: '700',
        color: 'white'
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '10px',
        color: highlight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        {label}
      </div>
    </div>
  )
}
