import { useState, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import './index.css'
import { config } from './config'

const PALLET_TYPES = {
  EUR: { name: 'Europalet', length: 1.2, width: 0.8 },
  US: { name: 'Americano', length: 1.2, width: 1.0 },
  CUSTOM: { name: 'Personalizado', length: 0, width: 0 }
}

const VIEW_MODES = ['3D', 'Planta', 'Alzado', 'Perfil']

function Warehouse3D({ dimensions, elements, selectedElement, onSelectElement, onUpdateElement, viewMode, palletType }) {
  const { camera } = useThree()

  useEffect(() => {
    const { length, width, height } = dimensions
    
    switch(viewMode) {
      case 'Planta':
        camera.position.set(length/2, height * 2, width/2)
        camera.lookAt(length/2, 0, width/2)
        break
      case 'Alzado':
        camera.position.set(length/2, height/2, width * 1.5)
        camera.lookAt(length/2, height/2, 0)
        break
      case 'Perfil':
        camera.position.set(length * 1.5, height/2, width/2)
        camera.lookAt(0, height/2, width/2)
        break
      default:
        camera.position.set(length * 1.1, height * 0.9, width * 1.1)
        camera.lookAt(length/2, height/3, width/2)
    }
  }, [viewMode, dimensions, camera])

  return (
    <>
      {/* Suelo */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[dimensions.length/2, 0, dimensions.width/2]}
        receiveShadow
        onClick={() => onSelectElement(null)}
      >
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshStandardMaterial color="#eceff1" />
      </mesh>

      {/* Grid con medidas cada 5m */}
      <gridHelper 
        args={[Math.max(dimensions.length, dimensions.width), Math.max(dimensions.length, dimensions.width) / 5, '#90a4ae', '#cfd8dc']} 
        position={[dimensions.length/2, 0.01, dimensions.width/2]}
      />

      {/* Nave */}
      <WarehouseShell dimensions={dimensions} />

      {/* Acotaciones de la nave */}
      <Dimensions dimensions={dimensions} />

      {/* Elementos */}
      {elements.map(element => (
        <Element3D
          key={element.id}
          element={element}
          isSelected={selectedElement?.id === element.id}
          onSelect={() => onSelectElement(element)}
          onUpdate={onUpdateElement}
          palletType={palletType}
        />
      ))}

      {/* Iluminación */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[30, 40, 30]} intensity={1.2} castShadow />
      <directionalLight position={[-20, 30, -20]} intensity={0.5} />
      <hemisphereLight intensity={0.6} groundColor="#b0bec5" />
    </>
  )
}

function WarehouseShell({ dimensions }) {
  const { length, width, height } = dimensions

  // Material muy transparente
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: '#e3f2fd',
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    transmission: 0.9
  })

  return (
    <group>
      {/* Estructura wireframe DESDE EL SUELO */}
      <lineSegments position={[length/2, height/2, width/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(length, height, width)]} />
        <lineBasicMaterial color="#1976d2" linewidth={1.5} transparent opacity={0.4} />
      </lineSegments>

      {/* Paredes muy transparentes */}
      <mesh position={[length/2, height/2, 0]} material={wallMaterial}>
        <planeGeometry args={[length, height]} />
      </mesh>
      <mesh position={[length/2, height/2, width]} material={wallMaterial} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[length, height]} />
      </mesh>
      <mesh position={[0, height/2, width/2]} material={wallMaterial} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh position={[length, height/2, width/2]} material={wallMaterial} rotation={[0, -Math.PI/2, 0]}>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh position={[length/2, height, width/2]} material={wallMaterial} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[length, width]} />
      </mesh>
    </group>
  )
}

function Dimensions({ dimensions }) {
  const { length, width, height } = dimensions

  return (
    <group>
      {/* Cota largo */}
      <Html position={[length/2, -1, -2]}>
        <div style={{
          background: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          border: '2px solid #1976d2',
          whiteSpace: 'nowrap'
        }}>
          {length}m
        </div>
      </Html>

      {/* Cota ancho */}
      <Html position={[-2, -1, width/2]}>
        <div style={{
          background: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          border: '2px solid #1976d2',
          whiteSpace: 'nowrap'
        }}>
          {width}m
        </div>
      </Html>

      {/* Cota altura */}
      <Html position={[-2, height/2, -2]}>
        <div style={{
          background: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          border: '2px solid #ff6b35',
          whiteSpace: 'nowrap'
        }}>
          H: {height}m
        </div>
      </Html>
    </group>
  )
}

function Element3D({ element, isSelected, onSelect, onUpdate, palletType }) {
  const meshRef = useRef()
  const transformRef = useRef()

  const handleDragEnd = () => {
    if (meshRef.current) {
      const pos = meshRef.current.position
      onUpdate(element.id, {
        position: {
          ...element.position,
          x: Math.max(0, parseFloat(pos.x.toFixed(1))),
          y: Math.max(0, parseFloat(pos.z.toFixed(1))),
          z: Math.max(0, parseFloat(pos.y.toFixed(1)))
        }
      })
    }
  }

  return (
    <group>
      {isSelected && (
        <TransformControls
          ref={transformRef}
          object={meshRef}
          mode="translate"
          onMouseUp={handleDragEnd}
          showX={true}
          showY={true}
          showZ={true}
        />
      )}
      
      <group
        ref={meshRef}
        position={[element.position.x, element.position.z, element.position.y]}
        rotation={[0, element.position.rotation * Math.PI / 180, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        {element.type === 'shelf' && <ShelfMesh element={element} isSelected={isSelected} palletType={palletType} />}
        {element.type === 'office' && <OfficeMesh element={element} isSelected={isSelected} />}
        {element.type === 'dock' && <DockMesh element={element} isSelected={isSelected} />}
        
        {/* Dimensiones del elemento */}
        {isSelected && (
          <Html position={[0, element.dimensions.height + 0.5, 0]} center>
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              border: '2px solid #ff6b35',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              whiteSpace: 'nowrap'
            }}>
              <div style={{color: '#333', marginBottom: '2px'}}>
                {element.type.toUpperCase()}
              </div>
              <div style={{color: '#666', fontSize: '11px'}}>
                {element.dimensions.length || element.dimensions.width}m × 
                {element.dimensions.width || element.dimensions.depth}m × 
                {element.dimensions.height}m
              </div>
              <div style={{color: '#ff6b35', fontSize: '11px', marginTop: '2px'}}>
                Pos: X{element.position.x.toFixed(1)} Y{element.position.y.toFixed(1)} Z{element.position.z.toFixed(1)}
              </div>
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

function ShelfMesh({ element, isSelected, palletType }) {
  const { length, height, depth, levels } = element.dimensions
  const color = isSelected ? '#ff9800' : '#ff6b35'

  // Calcular palets según tipo
  const pallet = palletType === 'CUSTOM' && element.customPallet ? element.customPallet : PALLET_TYPES[palletType]
  const palletsPerLevel = Math.floor((length / pallet.length) * (depth / pallet.width))
  const totalPallets = palletsPerLevel * levels

  return (
    <group>
      {/* Postes */}
      {[0, length].map((x, i) => 
        [0, depth].map((z, j) => (
          <mesh key={`post-${i}-${j}`} position={[x, height/2, z]} castShadow>
            <boxGeometry args={[0.1, height, 0.1]} />
            <meshStandardMaterial color={color} metalness={0.85} roughness={0.15} />
          </mesh>
        ))
      )}

      {/* Niveles */}
      {Array.from({ length: levels + 1 }).map((_, level) => {
        const y = (height / levels) * level
        return (
          <mesh key={`level-${level}`} position={[length/2, y, depth/2]} castShadow>
            <boxGeometry args={[length, 0.06, depth]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
          </mesh>
        )
      })}

      {isSelected && (
        <>
          <lineSegments position={[length/2, height/2, depth/2]}>
            <edgesGeometry args={[new THREE.BoxGeometry(length, height, depth)]} />
            <lineBasicMaterial color="#ffeb3b" linewidth={2} />
          </lineSegments>

          {/* Mostrar capacidad */}
          <Html position={[length/2, height/2, depth/2]} center>
            <div style={{
              background: '#1976d2',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'
            }}>
              {totalPallets} palets
            </div>
          </Html>
        </>
      )}
    </group>
  )
}

function OfficeMesh({ element, isSelected }) {
  const { length, width, height } = element.dimensions
  const color = isSelected ? '#42a5f5' : '#1e88e5'

  return (
    <group>
      <mesh position={[length/2, height/2, width/2]} castShadow receiveShadow>
        <boxGeometry args={[length, height, width]} />
        <meshPhysicalMaterial 
          color={color}
          transparent
          opacity={0.5}
          metalness={0.1}
          roughness={0.3}
          transmission={0.3}
        />
      </mesh>

      {/* Ventanas */}
      <mesh position={[length/2, height * 0.65, width/2 + width/2 + 0.02]}>
        <planeGeometry args={[length * 0.7, height * 0.3]} />
        <meshBasicMaterial color="#81d4fa" transparent opacity={0.6} />
      </mesh>

      {/* Puerta */}
      <mesh position={[length * 0.2, 1.1, width/2 + width/2 + 0.01]}>
        <planeGeometry args={[1, 2.2]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>

      {isSelected && (
        <lineSegments position={[length/2, height/2, width/2]}>
          <edgesGeometry args={[new THREE.BoxGeometry(length, height, width)]} />
          <lineBasicMaterial color="#ffeb3b" linewidth={2} />
        </lineSegments>
      )}

      {/* Área en m² */}
      {isSelected && (
        <Html position={[length/2, height + 0.3, width/2]} center>
          <div style={{
            background: '#1e88e5',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold'
          }}>
            {(length * width).toFixed(1)} m²
          </div>
        </Html>
      )}
    </group>
  )
}

function DockMesh({ element, isSelected }) {
  const { width, height, depth } = element.dimensions
  const color = isSelected ? '#757575' : '#616161'

  return (
    <group>
      <mesh position={[0, height/2, 0]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.3} />
      </mesh>

      <mesh position={[0, height * 0.25, depth/2 + 0.8]} rotation={[-Math.PI / 9, 0, 0]} castShadow>
        <boxGeometry args={[width, 0.15, 1.8]} />
        <meshStandardMaterial color="#424242" />
      </mesh>

      <mesh position={[width/2 - 0.25, height + 0.4, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.08]} />
        <meshStandardMaterial color="#ffc107" emissive="#ff6f00" emissiveIntensity={0.4} />
      </mesh>

      {isSelected && (
        <lineSegments position={[0, height/2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
          <lineBasicMaterial color="#ffeb3b" linewidth={2} />
        </lineSegments>
      )}
    </group>
  )
}

export default function App() {
  const [dimensions, setDimensions] = useState({ length: 40, width: 25, height: 10 })
  const [elements, setElements] = useState([])
  const [selectedElement, setSelectedElement] = useState(null)
  const [viewMode, setViewMode] = useState('3D')
  const [calculations, setCalculations] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newElementType, setNewElementType] = useState(null)
  const [formData, setFormData] = useState({})
  const [palletType, setPalletType] = useState('EUR')
  const [customPallet, setCustomPallet] = useState({ length: '', width: '' })

  const addElementStart = (type) => {
    setNewElementType(type)
    setFormData(getEmptyFormByType(type))
    setShowAddForm(true)
  }

  const getEmptyFormByType = (type) => {
    switch(type) {
      case 'shelf':
        return { length: '', depth: '', height: '', levels: '', x: '', y: '', z: '', rotation: '' }
      case 'office':
        return { length: '', width: '', height: '', x: '', y: '', z: '' }
      case 'dock':
        return { width: '', depth: '', height: '', x: '', y: '' }
      default:
        return {}
    }
  }

  const confirmAddElement = () => {
    const newElement = {
      id: `${newElementType}-${Date.now()}`,
      type: newElementType,
      position: {
        x: parseFloat(formData.x) || 5,
        y: parseFloat(formData.y) || 5,
        z: parseFloat(formData.z) || 0,
        rotation: parseFloat(formData.rotation) || 0
      },
      dimensions: getDimensionsFromForm(newElementType, formData),
      properties: {}
    }
    
    setElements([...elements, newElement])
    setShowAddForm(false)
    setViewMode('Planta') // Cambiar a vista planta para ver el elemento
  }

  const getDimensionsFromForm = (type, data) => {
    switch(type) {
      case 'shelf':
        return {
          length: parseFloat(data.length) || 12,
          depth: parseFloat(data.depth) || 1.1,
          height: parseFloat(data.height) || 8,
          levels: parseInt(data.levels) || 4
        }
      case 'office':
        return {
          length: parseFloat(data.length) || 10,
          width: parseFloat(data.width) || 10,
          height: parseFloat(data.height) || 3.5
        }
      case 'dock':
        return {
          width: parseFloat(data.width) || 3.5,
          depth: parseFloat(data.depth) || 4,
          height: parseFloat(data.height) || 1.2
        }
      default:
        return {}
    }
  }

  const updateElement = (id, updates) => {
    setElements(elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ))
    if (selectedElement?.id === id) {
      setSelectedElement({ ...selectedElement, ...updates })
    }
  }

  const deleteElement = (id) => {
    setElements(elements.filter(el => el.id !== id))
    if (selectedElement?.id === id) {
      setSelectedElement(null)
    }
  }

  const calculateCapacity = () => {
    let totalPallets = 0
    let occupiedArea = 0

    const pallet = palletType === 'CUSTOM' ? 
      { length: parseFloat(customPallet.length) || 1.2, width: parseFloat(customPallet.width) || 0.8 } :
      PALLET_TYPES[palletType]

    elements.forEach(el => {
      if (el.type === 'shelf') {
        const { length, depth, levels } = el.dimensions
        const palletsPerLevel = Math.floor((length / pallet.length) * (depth / pallet.width))
        totalPallets += palletsPerLevel * levels
        occupiedArea += length * depth
      } else if (el.type === 'office') {
        occupiedArea += el.dimensions.length * el.dimensions.width
      } else if (el.type === 'dock') {
        occupiedArea += el.dimensions.width * el.dimensions.depth
      }
    })

    const totalArea = dimensions.length * dimensions.width
    const circulationArea = totalArea - occupiedArea
    const efficiency = (occupiedArea / totalArea * 100).toFixed(2)

    setCalculations({
      total_pallets: totalPallets,
      occupied_area: occupiedArea.toFixed(2),
      circulation_area: circulationArea.toFixed(2),
      efficiency_percentage: efficiency,
      pallet_type: `${pallet.length}m × ${pallet.width}m`,
      warnings: circulationArea < totalArea * 0.30 ? ['⚠️ Área de circulación < 30%'] : []
    })
  }

  useEffect(() => {
    if (elements.length > 0) {
      calculateCapacity()
    }
  }, [elements, dimensions, palletType, customPallet])

  return (
    <div className="app">
      <header className="header">
        <div className="logo-container">
          <svg viewBox="0 0 450 100" xmlns="http://www.w3.org/2000/svg" style={{height: '50px', width: 'auto'}}>
            <text x="40" y="50" 
                  fontFamily="'Montserrat', 'Arial Black', sans-serif" 
                  fontSize="52" 
                  fontWeight="800" 
                  fill="#2c3e50"
                  letterSpacing="-1">
              unit<tspan fill="#ff6b35">nave</tspan>
            </text>
            <rect x="40" y="57" width="240" height="2" fill="#ff6b35" opacity="0.4"/>
            <text x="40" y="75" 
                  fontFamily="Arial, sans-serif" 
                  fontSize="13" 
                  fontWeight="600"
                  fill="#7f8c8d"
                  letterSpacing="1.5">
              Diseñador de Naves Industriales
            </text>
          </svg>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar-left compact">
          <div className="section-compact">
            <h2>➕ ELEMENTOS</h2>
            <button onClick={() => addElementStart('shelf')} className="btn-compact shelf">
              📦 Estantería
            </button>
            <button onClick={() => addElementStart('office')} className="btn-compact office">
              🏢 Oficina
            </button>
            <button onClick={() => addElementStart('dock')} className="btn-compact dock">
              🚛 Muelle
            </button>
          </div>

          <div className="section-compact">
            <h2>📐 NAVE</h2>
            <label className="label-compact">
              L: {dimensions.length}m
              <input 
                type="range" 
                min="20" 
                max="100" 
                value={dimensions.length}
                onChange={(e) => setDimensions({...dimensions, length: Number(e.target.value)})}
              />
            </label>
            <label className="label-compact">
              A: {dimensions.width}m
              <input 
                type="range" 
                min="15" 
                max="50" 
                value={dimensions.width}
                onChange={(e) => setDimensions({...dimensions, width: Number(e.target.value)})}
              />
            </label>
            <label className="label-compact">
              H: {dimensions.height}m
              <input 
                type="range" 
                min="6" 
                max="15" 
                value={dimensions.height}
                onChange={(e) => setDimensions({...dimensions, height: Number(e.target.value)})}
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
                  onChange={(e) => setCustomPallet({...customPallet, length: e.target.value})}
                  style={{width: '100%', marginBottom: '4px', padding: '4px', fontSize: '12px'}}
                />
                <input 
                  type="number" 
                  placeholder="Ancho (m)" 
                  step="0.1"
                  value={customPallet.width}
                  onChange={(e) => setCustomPallet({...customPallet, width: e.target.value})}
                  style={{width: '100%', padding: '4px', fontSize: '12px'}}
                />
              </div>
            )}
          </div>

          {elements.length > 0 && (
            <div className="section-compact">
              <h2>📋 LISTA ({elements.length})</h2>
              <div className="elements-list-compact">
                {elements.map(el => (
                  <div 
                    key={el.id} 
                    className={`element-item-compact ${selectedElement?.id === el.id ? 'selected' : ''}`}
                    onClick={() => setSelectedElement(el)}
                  >
                    <span>{el.type === 'shelf' ? '📦' : el.type === 'office' ? '🏢' : '🚛'}</span>
                    <span style={{flex: 1, fontSize: '11px'}}>#{el.id.slice(-4)}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
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

        <main className="canvas-container">
          <div className="view-controls compact">
            {VIEW_MODES.map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`view-btn ${viewMode === mode ? 'active' : ''}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <Canvas shadows camera={{ position: [40, 30, 40], fov: 50 }}>
            <color attach="background" args={['#f8f9fa']} />
            <Warehouse3D 
              dimensions={dimensions}
              elements={elements}
              selectedElement={selectedElement}
              onSelectElement={setSelectedElement}
              onUpdateElement={updateElement}
              viewMode={viewMode}
              palletType={palletType}
            />
            <OrbitControls 
              enableDamping 
              dampingFactor={0.05}
              minDistance={15}
              maxDistance={150}
            />
          </Canvas>

          <div className="help-compact">
            Click elemento → Arrastrar | Scroll = Zoom
          </div>
        </main>

        <aside className="sidebar-right compact">
          {selectedElement ? (
            <div className="section-compact">
              <h2>⚙️ {selectedElement.type.toUpperCase()}</h2>
              
              <label className="label-compact">
                Posición Horizontal X
                <input 
                  type="number" 
                  step="0.1"
                  value={selectedElement.position.x}
                  onChange={(e) => updateElement(selectedElement.id, {
                    position: {...selectedElement.position, x: parseFloat(e.target.value)}
                  })}
                />
              </label>
              
              <label className="label-compact">
                Posición Horizontal Y
                <input 
                  type="number" 
                  step="0.1"
                  value={selectedElement.position.y}
                  onChange={(e) => updateElement(selectedElement.id, {
                    position: {...selectedElement.position, y: parseFloat(e.target.value)}
                  })}
                />
              </label>
              
              <label className="label-compact">
                Altura desde suelo
                <input 
                  type="number" 
                  step="0.1"
                  value={selectedElement.position.z}
                  onChange={(e) => updateElement(selectedElement.id, {
                    position: {...selectedElement.position, z: parseFloat(e.target.value)}
                  })}
                />
              </label>
              
              <label className="label-compact">
                Rotación (grados)
                <input 
                  type="number" 
                  step="15"
                  value={selectedElement.position.rotation}
                  onChange={(e) => updateElement(selectedElement.id, {
                    position: {...selectedElement.position, rotation: parseFloat(e.target.value)}
                  })}
                />
              </label>

              <h3 style={{fontSize: '11px', margin: '12px 0 8px 0', color: '#666'}}>DIMENSIONES</h3>
              {Object.entries(selectedElement.dimensions).map(([key, value]) => (
                <label key={key} className="label-compact">
                  {key}
                  <input 
                    type="number" 
                    step="0.1"
                    value={value}
                    onChange={(e) => updateElement(selectedElement.id, {
                      dimensions: {...selectedElement.dimensions, [key]: parseFloat(e.target.value)}
                    })}
                  />
                </label>
              ))}

              <button 
                onClick={() => deleteElement(selectedElement.id)}
                className="btn-danger-compact"
              >
                🗑️ ELIMINAR
              </button>
            </div>
          ) : calculations ? (
            <div className="section-compact">
              <h2>📊 RESULTADOS</h2>
              <div className="calc-big">{calculations.total_pallets}</div>
              <div className="calc-label">Palets Totales</div>
              <div className="calc-small">Tipo: {calculations.pallet_type}</div>
              
              <div className="calc-row-compact">
                <span>Aprovechamiento:</span>
                <strong>{calculations.efficiency_percentage}%</strong>
              </div>
              <div className="calc-row-compact">
                <span>Área ocupada:</span>
                <strong>{calculations.occupied_area} m²</strong>
              </div>
              <div className="calc-row-compact">
                <span>Circulación:</span>
                <strong>{calculations.circulation_area} m²</strong>
              </div>

              {calculations.warnings.map((w, i) => (
                <div key={i} className="warning-compact">{w}</div>
              ))}

              <button className="btn-primary-compact" onClick={calculateCapacity}>
                🔄 RECALCULAR
              </button>
              <button className="btn-secondary-compact">
                📸 RENDER 3D
              </button>
              <button className="btn-secondary-compact">
                📄 PDF
              </button>
            </div>
          ) : (
            <div style={{padding: '2rem', textAlign: 'center', color: '#999', fontSize: '13px'}}>
              Añade elementos para calcular
            </div>
          )}
        </aside>
      </div>

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-compact" onClick={(e) => e.stopPropagation()}>
            <h2>Nuevo {newElementType?.toUpperCase()}</h2>
            <p style={{fontSize: '12px', color: '#666', marginBottom: '16px'}}>
              Deja campos vacíos para valores por defecto
            </p>
            
            <div className="form-grid-compact">
              {Object.keys(formData).map(key => (
                <label key={key} style={{fontSize: '12px'}}>
                  {key.toUpperCase()}
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Auto"
                    value={formData[key]}
                    onChange={(e) => setFormData({...formData, [key]: e.target.value})}
                    style={{padding: '6px', fontSize: '13px'}}
                  />
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAddForm(false)} className="btn-cancel">
                Cancelar
              </button>
              <button onClick={confirmAddElement} className="btn-confirm">
                ✓ Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
