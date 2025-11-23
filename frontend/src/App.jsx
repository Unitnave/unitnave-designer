import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import './index.css';

import useWarehouseStore from './stores/useWarehouseStore';
import useUIStore from './stores/useUIStore';
import useCalculationsStore from './stores/useCalculationsStore';

import Warehouse3D from './components/Warehouse3D.jsx';
import Sidebar from './components/Sidebar.jsx';
import FloatingPanel from './components/FloatingPanel.jsx';
import AddElementModal from './components/AddElementModal.jsx';
import Notification from './components/Notification.jsx';

export default function App() {
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
          {/* Logo SVG inline para asegurar que siempre funcione */}
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

        <button className="btn-calculate" onClick={handleCalculate}>
          🧮 CALCULAR CAPACIDAD
        </button>
      </header>

      <div className="main-content">
        <Sidebar />

        <div className="canvas-container">
          <Canvas
            shadows
            style={{ background: '#263238' }}
          >
            {is3DView ? (
              <PerspectiveCamera makeDefault position={[50, 50, 50]} fov={50} />
            ) : (
              <OrthographicCamera makeDefault position={[0, 50, 0]} zoom={10} near={-200} far={200} />
            )}

            <Warehouse3D />
            
            <OrbitControls 
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

        {/* Panel flotante en lugar de barra fija */}
        <FloatingPanel />
      </div>

      <AddElementModal />
      <Notification />
    </div>
  );
}