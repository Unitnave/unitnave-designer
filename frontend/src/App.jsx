import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import './index.css'

import useWarehouseStore from './stores/useWarehouseStore'
import useUIStore from './stores/useUIStore'
import useCalculationsStore from './stores/useCalculationsStore'

import Warehouse3D from './components/Warehouse3D.jsx'
import Sidebar from './components/Sidebar.jsx'
import RightPanel from './components/RightPanel.jsx'
import AddElementModal from './components/AddElementModal.jsx'
import Notification from './components/Notification.jsx'

export default function App() {
  const { dimensions, elements } = useWarehouseStore()
  const { viewMode, setViewMode } = useUIStore()
  const { calculateCapacity } = useCalculationsStore()

  const handleCalculate = () => {
    calculateCapacity(dimensions, elements)
  }

  return (
    <div className="app">
      <header className="header-compact">
        <div className="logo-section">
          <img 
            src="https://unitnave.com/wp-content/uploads/2024/06/logo-unitnave-blanco.svg" 
            alt="UNITNAVE" 
            className="logo"
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
            camera={{ position: [50, 30, 50], fov: 50 }}
            style={{ background: '#263238' }}
          >
            <Warehouse3D />
            <OrbitControls 
              enableDamping 
              dampingFactor={0.05}
              minDistance={10}
              maxDistance={200}
            />
          </Canvas>
        </div>

        <RightPanel />
      </div>

      <AddElementModal />
      <Notification />
    </div>
  )
}