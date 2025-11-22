import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import './index.css';

import useWarehouseStore from './stores/useWarehouseStore';
import useUIStore from './stores/useUIStore';
import useCalculationsStore from './stores/useCalculationsStore';

import Warehouse3D from './components/Warehouse3D.jsx';
import Sidebar from './components/Sidebar.jsx';
import RightPanel from './components/RightPanel.jsx';
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
          <img 
            src="https://unitnave.com/wp-content/uploads/2024/06/logo-unitnave-blanco.svg" 
            alt="UNITNAVE" 
            className="logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
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
            {/* Alternar cámaras */}
            {is3DView ? (
              <PerspectiveCamera makeDefault position={[50, 50, 50]} fov={50} />
            ) : (
              <OrthographicCamera makeDefault position={[0, 50, 0]} zoom={10} near={-200} far={200} />
            )}

            <Warehouse3D />
            
            {/* Controles mejorados */}
            <OrbitControls 
              enableDamping 
              dampingFactor={0.05}
              minDistance={10}
              maxDistance={200}
              minZoom={5}  // Límites de zoom para evitar extremos
              maxZoom={50}
              enableRotate={is3DView} 
              enablePan={true}  // Siempre pan para mover en 2D
              enableZoom={true}
              screenSpacePanning={!is3DView}  // Pan como en dibujo 2D
              // Opcional: Limita ángulos en 3D para no "voltear" la vista
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>

          {!is3DView && (
            <div className="view-mode-indicator">
              📐 VISTA TÉCNICA: {viewMode} (2D - Zoom y Pan)
            </div>
          )}
          
          {is3DView && (
            <div className="view-mode-indicator view-only">
              👁️ VISTA 3D - Interactiva
            </div>
          )}
        </div>

        <RightPanel />
      </div>

      <AddElementModal />
      <Notification />
    </div>
  );
}