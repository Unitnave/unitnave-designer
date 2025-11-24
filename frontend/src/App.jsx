import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import './index.css';

// Stores del modo manual
import useWarehouseStore from './stores/useWarehouseStore';
import useUIStore from './stores/useUIStore';
import useCalculationsStore from './stores/useCalculationsStore';

// Componentes del modo manual (existentes)
import Warehouse3D from './components/Warehouse3D.jsx';
import Sidebar from './components/Sidebar.jsx';
import FloatingPanel from './components/FloatingPanel.jsx';
import AddElementModal from './components/AddElementModal.jsx';
import Notification from './components/Notification.jsx';

// Componente del modo wizard (nuevo)
import DesignPage from './pages/DesignPage.jsx';

export default function App() {
  // Estado para cambiar entre modos
  const [mode, setMode] = useState('manual'); // 'manual' o 'wizard'

  // Si está en modo Wizard, mostrar el nuevo flujo
  if (mode === 'wizard') {
    return (
      <div style={{ position: 'relative' }}>
        <DesignPage />
        
        {/* Botón flotante para volver a modo manual */}
        <button
          onClick={() => setMode('manual')}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#ff9800',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 9999,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          title="Volver a Diseño Manual"
        >
          ✏️
        </button>
      </div>
    );
  }

  // Modo Manual (tu app actual)
  return <ManualDesignMode onSwitchToWizard={() => setMode('wizard')} />;
}

// Componente separado para el modo manual
function ManualDesignMode({ onSwitchToWizard }) {
  const { dimensions, elements } = useWarehouseStore();
  const { viewMode, setViewMode } = useUIStore();
  const { calculateCapacity } = useCalculationsStore();

  const handleCalculate = () => {
    calculateCapacity(dimensions, elements);
  };

  const is3DView = viewMode === '3D';

  return (
    <div className="app">
      <header className="header-compact">
        <div className="logo-section">
          <svg width="120" height="32" viewBox="0 0 120 32" xmlns="http://www.w3.org/2000/svg">
            <text x="10" y="24" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold" fill="white">
              UNITNAVE
            </text>
          </svg>
          <h1>DESIGNER</h1>
        </div>

        <div className="view-controls">
          {['3D', 'Planta', 'Alzado', 'Perfil'].map(mode => (
            <button
              key={mode}
              className={`view-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-calculate" onClick={handleCalculate}>
            🧮 CALCULAR CAPACIDAD
          </button>
          
          {/* ⭐ NUEVO: Botón para Wizard */}
          <button 
            className="btn-calculate" 
            onClick={onSwitchToWizard}
            style={{ 
              background: '#4caf50',
              position: 'relative'
            }}
            title="Optimización Automática con IA"
          >
            ⚡ OPTIMIZAR AUTO
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: '#ff5722',
              color: 'white',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              NUEVO
            </span>
          </button>
        </div>
      </header>

      <div className="main-content">
        <Sidebar />

        <div className="canvas-container">
          <Canvas shadows style={{ background: '#263238' }}>
            {is3DView ? (
              <PerspectiveCamera makeDefault position={[50, 50, 50]} fov={50} />
            ) : (
              <OrthographicCamera makeDefault position={[0, 50, 0]} zoom={10} near={-200} far={200} />
            )}

            <Warehouse3D />
            
            <OrbitControls 
              makeDefault
              enableDamping 
              dampingFactor={0.05}
              minDistance={10}
              maxDistance={200}
              minZoom={5}
              maxZoom={50}
              enableRotate={is3DView} 
              enablePan={true}
              enableZoom={true}
              screenSpacePanning={!is3DView}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>

          {!is3DView && (
            <div className="view-mode-indicator">
              📐 VISTA TÉCNICA: {viewMode} (2D)
            </div>
          )}
          
          {is3DView && (
            <div className="view-mode-indicator view-only">
              👁️ VISTA 3D - Interactiva
            </div>
          )}
        </div>

        <FloatingPanel />
      </div>

      <AddElementModal />
      <Notification />

      {/* Tooltip flotante explicando modo Wizard */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        background: 'rgba(76, 175, 80, 0.95)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '12px',
        maxWidth: '280px',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        animation: 'slideInLeft 0.5s ease'
      }}>
        <strong>⚡ NUEVO:</strong> Prueba la optimización automática con IA. 
        Click en "OPTIMIZAR AUTO" para generar layouts inteligentes en segundos.
      </div>
    </div>
  );
}