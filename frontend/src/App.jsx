/**
 * UNITNAVE Designer - App Principal v4.0
 * LIMPIO Y PROFESIONAL
 */

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import './index.css'

// Stores
import useWarehouseStore from './stores/useWarehouseStore'
import useUIStore from './stores/useUIStore'

// Componentes
import Warehouse3DPro from './components/Warehouse3DPro'
import Sidebar from './components/Sidebar'
import AddElementModal from './components/AddElementModal'

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
            zIndex: 9999
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
  const { dimensions } = useWarehouseStore()
  const { viewMode, setViewMode } = useUIStore()

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
            { id: 'Planta', icon: '📐', label: 'Planta' }
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
                gap: '6px'
              }}
            >
              <span>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* Botón Optimizar */}
        <button
          onClick={onSwitchToWizard}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: '600',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
          }}
        >
          ⚡ Optimizar
        </button>
      </header>

      {/* Contenido Principal */}
      <div style={{ 
        position: 'relative', 
        height: 'calc(100vh - 60px)',
        background: '#ffffff'
      }}>
        <Sidebar />
        <AddElementModal />

        {/* Canvas 3D */}
        <Canvas
          shadows
          gl={{ 
            preserveDrawingBuffer: true, 
            antialias: true, 
            alpha: true 
          }}
          style={{ 
            background: '#ffffff',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        >
          <color attach="background" args={['#ffffff']} />
          <fog attach="fog" args={['#ffffff', 50, 200]} />

          {/* Iluminación */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[50, 100, 50]}
            intensity={0.8}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={300}
            shadow-camera-left={-100}
            shadow-camera-right={100}
            shadow-camera-top={100}
            shadow-camera-bottom={-100}
          />
          <directionalLight position={[-50, 50, -50]} intensity={0.3} />

          {/* Cámara */}
          {is3DView ? (
            <PerspectiveCamera makeDefault position={[60, 40, 60]} fov={50} />
          ) : (
            <PerspectiveCamera makeDefault position={[dimensions.length / 2, 80, dimensions.width / 2]} fov={50} />
          )}

          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={10}
            maxDistance={200}
            maxPolarAngle={Math.PI / 2}
          />

          {/* Escena */}
          <Warehouse3DPro viewMode={viewMode} />
        </Canvas>
      </div>
    </div>
  )
}

