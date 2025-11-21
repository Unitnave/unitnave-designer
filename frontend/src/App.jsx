import { useState, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, TransformControls, Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import './index.css'
import { config } from './config'

// Vistas disponibles
const VIEW_MODES = ['3D', 'Planta', 'Alzado', 'Perfil', 'Cenital']

function Warehouse3D({ dimensions, elements, selectedElement, onSelectElement, onUpdateElement, viewMode }) {
  const { camera } = useThree()

  useEffect(() => {
    const { length, width, height } = dimensions
    
    switch(viewMode) {
      case 'Planta':
      case 'Cenital':
        camera.position.set(length/2, height * 2.5, width/2)
        camera.lookAt(length/2, 0, width/2)
        break
      case 'Alzado':
        camera.position.set(length/2, height/2, width * 1.8)
        camera.lookAt(length/2, height/2, 0)
        break
      case 'Perfil':
        camera.position.set(length * 1.8, height/2, width/2)
        camera.lookAt(0, height/2, width/2)
        break
      default: // 3D
        camera.position.set(length * 1.2, height * 1.2, width * 1.2)
        camera.lookAt(length/2, height/2, width/2)
    }
  }, [viewMode, dimensions, camera])

  return (
    <>
      {/* Suelo con grid */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[dimensions.length/2, -0.01, dimensions.width/2]} 
        receiveShadow
        onClick={() => onSelectElement(null)}
      >
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>

      <gridHelper 
        args={[Math.max(dimensions.length, dimensions.width), 40, '#999', '#ccc']} 
        position={[dimensions.length/2, 0, dimensions.width/2]}
      />

      {/* Ejes de referencia */}
      <axesHelper args={[5]} />

      {/* Nave transparente con wireframe */}
      <WarehouseShell dimensions={dimensions} />

      {/* Elementos */}
      {elements.map(element => (
        <Element3D
          key={element.id}
          element={element}
          isSelected={selectedElement?.id === element.id}
          onSelect={() => onSelectElement(element)}
          onUpdate={onUpdateElement}
        />
      ))}

      {/* Iluminación mejorada */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[20, 30, 20]} intensity={1} castShadow />
      <directionalLight position={[-20, 20, -20]} intensity={0.4} />
      <hemisphereLight intensity={0.5} groundColor="#444" />
    </>
  )
}

function WarehouseShell({ dimensions }) {
  const { length, width, height } = dimensions

  // Material transparente para las paredes
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: '#e3f2fd',
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  })

  // Wireframe para los bordes
  const edgesMaterial = new THREE.LineBasicMaterial({ color: '#1976d2', linewidth: 2 })

  return (
    <group>
      {/* Paredes transparentes */}
      {/* Pared frontal */}
      <mesh position={[length/2, height/2, 0]} material={wallMaterial}>
        <planeGeometry args={[length, height]} />
      </mesh>
      
      {/* Pared trasera */}
      <mesh position={[length/2, height/2, width]} material={wallMaterial} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[length, height]} />
      </mesh>
      
      {/* Pared izquierda */}
      <mesh position={[0, height/2, width/2]} material={wallMaterial} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[width, height]} />
      </mesh>
      
      {/* Pared derecha */}
      <mesh position={[length, height/2, width/2]} material={wallMaterial} rotation={[0, -Math.PI/2, 0]}>
        <planeGeometry args={[width, height]} />
      </mesh>

      {/* Techo transparente */}
      <mesh position={[length/2, height, width/2]} material={wallMaterial} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[length, width]} />
      </mesh>

      {/* Wireframe de la estructura */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(length, height, width)]} />
        <lineBasicMaterial color="#1976d2" linewidth={2} />
      </lineSegments>

      {/* Dimensiones de la nave */}
      <Text
        position={[length/2, height + 1, width/2]}
        fontSize={1.5}
        color="#333"
        anchorX="center"
        anchorY="middle"
      >
        {`${length}m × ${width}m × ${height}m`}
      </Text>
    </group>
  )
}

function Element3D({ element, isSelected, onSelect, onUpdate }) {
  const meshRef = useRef()
  const transformRef = useRef()

  const handleDragEnd = () => {
    if (meshRef.current) {
      const pos = meshRef.current.position
      onUpdate(element.id, {
        position: {
          ...element.position,
          x: parseFloat(pos.x.toFixed(2)),
          y: parseFloat(pos.z.toFixed(2)),
          z: parseFloat(pos.y.toFixed(2))
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
        {element.type === 'shelf' && <ShelfMesh element={element} isSelected={isSelected} />}
        {element.type === 'office' && <OfficeMesh element={element} isSelected={isSelected} />}
        {element.type === 'dock' && <DockMesh element={element} isSelected={isSelected} />}
        
        {/* Etiqueta con info */}
        {isSelected && (
          <Text
            position={[0, element.dimensions.height + 1, 0]}
            fontSize={0.8}
            color="#000"
            anchorX="center"
            anchorY="bottom"
          >
            {`${element.type.toUpperCase()}\n${element.dimensions.length || element.dimensions.width}m × ${element.dimensions.width || element.dimensions.depth}m`}
          </Text>
        )}
      </group>
    </group>
  )
}

function ShelfMesh({ element, isSelected }) {
  const { length, height, depth, levels } = element.dimensions
  const color = isSelected ? '#ff9800' : '#ff6b35'

  return (
    <group>
      {/* Postes */}
      {[0, length].map((x, i) => 
        [0, depth].map((z, j) => (
          <mesh key={`post-${i}-${j}`} position={[x, height/2, z]} castShadow>
            <boxGeometry args={[0.12, height, 0.12]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
        ))
      )}

      {/* Niveles */}
      {Array.from({ length: levels + 1 }).map((_, level) => {
        const y = (height / levels) * level
        return (
          <mesh key={`level-${level}`} position={[length/2, y, depth/2]} castShadow>
            <boxGeometry args={[length, 0.08, depth]} />
            <meshStandardMaterial color={color} metalness={0.6} />
          </mesh>
        )
      })}

      {/* Bounding box si está seleccionado */}
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(length, height, depth)]} />
          <lineBasicMaterial color="#ffeb3b" linewidth={3} />
        </lineSegments>
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
        <meshStandardMaterial 
          color={color}
          transparent
          opacity={0.6}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>

      {/* Ventanas */}
      <mesh position={[length/2, height * 0.7, width/2 + width/2 + 0.05]}>
        <planeGeometry args={[length * 0.8, height * 0.25]} />
        <meshBasicMaterial color="#87ceeb" transparent opacity={0.5} />
      </mesh>

      {/* Puerta */}
      <mesh position={[length * 0.3, 1.2, width/2 + width/2 + 0.02]}>
        <planeGeometry args={[1.2, 2.4]} />
        <meshStandardMaterial color="#795548" />
      </mesh>

      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(length, height, width)]} />
          <lineBasicMaterial color="#ffeb3b" linewidth={3} />
        </lineSegments>
      )}
    </group>
  )
}

function DockMesh({ element, isSelected }) {
  const { width, height, depth } = element.dimensions
  const color = isSelected ? '#757575' : '#616161'

  return (
    <group>
      {/* Plataforma */}
      <mesh position={[0, height/2, 0]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>

      {/* Rampa */}
      <mesh position={[0, height * 0.3, depth/2 + 1]} rotation={[-Math.PI / 8, 0, 0]} castShadow>
        <boxGeometry args={[width, 0.2, 2]} />
        <meshStandardMaterial color="#424242" />
      </mesh>

      {/* Señal */}
      <mesh position={[width/2 - 0.3, height + 0.5, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.1]} />
        <meshStandardMaterial color="#ffc107" emissive="#ff6f00" emissiveIntensity={0.5} />
      </mesh>

      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
          <lineBasicMaterial color="#ffeb3b" linewidth={3} />
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

  const addElementStart = (type) => {
    setNewElementType(type)
    setFormData(getEmptyFormByType(type))
    setShowAddForm(true)
  }

  const getEmptyFormByType = (type) => {
    switch(type) {
      case 'shelf':
        return { length: '', depth: '', height: '', levels: '', x: '', y: '', z: '', rotation: '0' }
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
    setNewElementType(null)
    setFormData({})
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

    elements.forEach(el => {
      if (el.type === 'shelf') {
        const { length, depth, levels } = el.dimensions
        const palletsPerLevel = Math.floor((length / 1.2) * (depth / 0.8))
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
      warnings: circulationArea < totalArea * 0.30 ? ['Área de circulación < 30%'] : []
    })
  }

  useEffect(() => {
    if (elements.length > 0) {
      calculateCapacity()
    }
  }, [elements, dimensions])

  return (
    <div className="app">
      <header className="header">
        <h1>🏭 UNITNAVE Designer Pro</h1>
        <p>Diseñador profesional de naves industriales</p>
      </header>

      <div className="main-layout">
        {/* Sidebar Izquierdo */}
        <aside className="sidebar-left">
          <section className="section">
            <h2>➕ AÑADIR ELEMENTOS</h2>
            
            <button onClick={() => addElementStart('shelf')} className="element-btn shelf">
              <span className="icon">📦</span>
              <span className="label">Estantería</span>
              <small>Paletización / Picking</small>
            </button>
            
            <button onClick={() => addElementStart('office')} className="element-btn office">
              <span className="icon">🏢</span>
              <span className="label">Oficina</span>
              <small>Planta baja / Entreplanta</small>
            </button>
            
            <button onClick={() => addElementStart('dock')} className="element-btn dock">
              <span className="icon">🚛</span>
              <span className="label">Muelle Carga</span>
              <small>Con nivelador / rampa</small>
            </button>
          </section>

          <section className="section">
            <h2>📏 DIMENSIONES NAVE</h2>
            
            <label>
              Largo: <strong>{dimensions.length}m</strong>
              <input 
                type="range" 
                min="20" 
                max="100" 
                value={dimensions.length}
                onChange={(e) => setDimensions({...dimensions, length: Number(e.target.value)})}
              />
            </label>

            <label>
              Ancho: <strong>{dimensions.width}m</strong>
              <input 
                type="range" 
                min="15" 
                max="50" 
                value={dimensions.width}
                onChange={(e) => setDimensions({...dimensions, width: Number(e.target.value)})}
              />
            </label>

            <label>
              Alto: <strong>{dimensions.height}m</strong>
              <input 
                type="range" 
                min="6" 
                max="15" 
                value={dimensions.height}
                onChange={(e) => setDimensions({...dimensions, height: Number(e.target.value)})}
              />
            </label>
          </section>

          <section className="section">
            <h2>📋 ELEMENTOS ({elements.length})</h2>
            <div className="elements-list">
              {elements.map(el => (
                <div 
                  key={el.id} 
                  className={`element-item ${selectedElement?.id === el.id ? 'selected' : ''}`}
                  onClick={() => setSelectedElement(el)}
                >
                  <span className="type">{el.type === 'shelf' ? '📦' : el.type === 'office' ? '🏢' : '🚛'}</span>
                  <span className="info">{el.type} #{el.id.slice(-4)}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="delete-btn">🗑️</button>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Canvas Principal */}
        <main className="canvas-container">
          <div className="view-controls">
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
            />
            <OrbitControls 
              enableDamping 
              dampingFactor={0.05}
              minDistance={10}
              maxDistance={200}
            />
          </Canvas>

          {/* Ayuda */}
          <div className="help-box">
            <p>💡 <strong>Click</strong> en elemento para seleccionar</p>
            <p>✋ <strong>Arrastra</strong> para mover</p>
            <p>🖱️ <strong>Scroll</strong> para zoom</p>
            <p>🔄 <strong>Click derecho</strong> + arrastrar para rotar vista</p>
          </div>
        </main>

        {/* Sidebar Derecho */}
        <aside className="sidebar-right">
          {selectedElement ? (
            <section className="section">
              <h2>⚙️ PROPIEDADES</h2>
              <div className="properties">
                <div className="property">
                  <strong>Tipo:</strong>
                  <span>{selectedElement.type.toUpperCase()}</span>
                </div>
                
                <h3>📍 Posición</h3>
                <div className="property-group">
                  <label>
                    X: <input 
                      type="number" 
                      step="0.1"
                      value={selectedElement.position.x}
                      onChange={(e) => updateElement(selectedElement.id, {
                        position: {...selectedElement.position, x: parseFloat(e.target.value)}
                      })}
                    /> m
                  </label>
                  <label>
                    Y: <input 
                      type="number" 
                      step="0.1"
                      value={selectedElement.position.y}
                      onChange={(e) => updateElement(selectedElement.id, {
                        position: {...selectedElement.position, y: parseFloat(e.target.value)}
                      })}
                    /> m
                  </label>
                  <label>
                    Z (altura): <input 
                      type="number" 
                      step="0.1"
                      value={selectedElement.position.z}
                      onChange={(e) => updateElement(selectedElement.id, {
                        position: {...selectedElement.position, z: parseFloat(e.target.value)}
                      })}
                    /> m
                  </label>
                  <label>
                    Rotación: <input 
                      type="number" 
                      step="15"
                      value={selectedElement.position.rotation}
                      onChange={(e) => updateElement(selectedElement.id, {
                        position: {...selectedElement.position, rotation: parseFloat(e.target.value)}
                      })}
                    /> °
                  </label>
                </div>

                <h3>📐 Dimensiones</h3>
                <div className="property-group">
                  {Object.entries(selectedElement.dimensions).map(([key, value]) => (
                    <label key={key}>
                      {key}: <input 
                        type="number" 
                        step="0.1"
                        value={value}
                        onChange={(e) => updateElement(selectedElement.id, {
                          dimensions: {...selectedElement.dimensions, [key]: parseFloat(e.target.value)}
                        })}
                      /> {key === 'levels' ? '' : 'm'}
                    </label>
                  ))}
                </div>

                <button 
                  onClick={() => deleteElement(selectedElement.id)}
                  className="action-btn danger"
                >
                  🗑️ ELIMINAR
                </button>
              </div>
            </section>
          ) : (
            <section className="section">
              <h2>📊 CÁLCULOS</h2>
              {calculations ? (
                <div className="calculations">
                  <div className="calc-card">
                    <div className="calc-value">{calculations.total_pallets}</div>
                    <div className="calc-label">Palets Totales</div>
                  </div>
                  
                  <div className="calc-card">
                    <div className="calc-value">{calculations.efficiency_percentage}%</div>
                    <div className="calc-label">Aprovechamiento</div>
                  </div>
                  
                  <div className="calc-row">
                    <span>Área ocupada:</span>
                    <strong>{calculations.occupied_area} m²</strong>
                  </div>
                  
                  <div className="calc-row">
                    <span>Área circulación:</span>
                    <strong>{calculations.circulation_area} m²</strong>
                  </div>

                  {calculations.warnings.length > 0 && (
                    <div className="warnings">
                      {calculations.warnings.map((w, i) => (
                        <div key={i} className="warning">⚠️ {w}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="empty-state">Añade elementos para ver cálculos</p>
              )}
            </section>
          )}

          <section className="section">
            <h2>🎨 ACCIONES</h2>
            <button className="action-btn primary" onClick={calculateCapacity}>
              🔄 RECALCULAR
            </button>
            <button className="action-btn secondary">
              📸 RENDER PROFESIONAL
            </button>
            <button className="action-btn secondary">
              📄 EXPORTAR PDF
            </button>
            <button className="action-btn success">
              💾 GUARDAR DISEÑO
            </button>
          </section>
        </aside>
      </div>

      {/* Modal de Añadir Elemento */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Configurar {newElementType?.toUpperCase()}</h2>
            
            <div className="form-grid">
              {Object.keys(formData).map(key => (
                <label key={key}>
                  {key.toUpperCase()}:
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`Ingrese ${key}`}
                    value={formData[key]}
                    onChange={(e) => setFormData({...formData, [key]: e.target.value})}
                  />
                  <span className="unit">{key === 'levels' || key === 'rotation' ? '' : 'm'}</span>
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
