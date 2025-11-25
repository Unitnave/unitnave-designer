/**
 * UNITNAVE Designer - App Principal v4.0
 * EQUILIBRADO: Funcionalidad completa pero limpia
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
  const { calculateCapacity } = useCalculationsStore()
  
  const [showLegend, setShowLegend] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)

  // Calcular automáticamente al cambiar elementos
  useEffect(() => {
    if (elements.length > 0) {
      calculateCapacity(dimensions, elements)
    }
  }, [elements, dimensions, calculateCapacity])

  const handleCalculate = useCallback(async () => {
    if (elements.length === 0) return
    
    setIsCalculating(true)
    try {
      await calculateCapacity(dimensions, elements)
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setIsCalculating(false)
    }
  }, [dimensions, elements, calculateCapacity])

  const is3DView = viewMode === '3D'

  return (
    <div className="app" style={{ background: '#ffffff' }}>
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
            disabled={isCalculating || elements.length === 0}
            style={{
              padding: '10px 20px',
              background: elements.length === 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: elements.length === 0 ? 'not-allowed' : (isCalculating ? 'wait' : 'pointer'),
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: elements.length === 0 ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.3)',
              opacity: (isCalculating || elements.length === 0) ? 0.5 : 1
            }}
          >
            {isCalculating ? '⏳ Calculando...' : '🧮 Calcular'}
          </button>

          <button
            onClick={onSwitchToWizard}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
            }}
          >
            ⚡ Optimizar
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="main-content">
        <Sidebar />

        <div className="canvas-container" style={{ position: 'relative', flex: 1 }}>
          <Canvas
            style={{ background: '#ffffff' }}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
          >
            <color attach="background" args={['#ffffff']} />
            <fog attach="fog" args={['#ffffff', 100, 300]} />

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

            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={5}
              maxDistance={300}
              maxPolarAngle={Math.PI / 2}
            />

            {/* Iluminación sin sombras - Estilo plano técnico */}
            <ambientLight intensity={1.2} />
            <directionalLight position={[50, 100, 50]} intensity={0.6} />
            <directionalLight position={[-50, 50, -50]} intensity={0.5} />
            <hemisphereLight args={['#ffffff', '#e2e8f0', 0.5]} />

            <Warehouse3DPro />
          </Canvas>

          {showLegend && <LegendPanel />}
          <FloatingPanel />
        </div>

        <AddElementModal />
        <Notification />
      </div>
    </div>
  )
}



