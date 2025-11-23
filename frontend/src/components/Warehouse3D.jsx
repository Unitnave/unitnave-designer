import { useRef, useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'

import useWarehouseStore from '../stores/useWarehouseStore'
import useUIStore from '../stores/useUIStore'
import useCalculationsStore from '../stores/useCalculationsStore'

export default function Warehouse3D() {
  const { dimensions, elements, columns, updateElement } = useWarehouseStore()
  const { 
    viewMode, selectedElement, selectElement, previewElement, 
    measurementMode, measurements, addMeasurement 
  } = useUIStore()
  const { getCurrentPallet } = useCalculationsStore()

  const { camera, gl, scene, mouse, controls } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const clickPoints = useRef([])
  const planeRef = useRef()

  // Estado para arrastrar
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(new THREE.Vector3())

  // --- LÓGICA DE ARRASTRE FLUIDO ---
  const handlePointerDown = (e, element) => {
    if (measurementMode) return
    
    e.stopPropagation()
    selectElement(element)
    
    const point = e.point
    setDragOffset(new THREE.Vector3(
      element.position.x - point.x,
      0,
      element.position.y - point.z
    ))
    setIsDragging(true)
    if (controls) controls.enabled = false
  }

  const handlePointerUp = () => {
    setIsDragging(false)
    if (controls) controls.enabled = true
  }

  const handlePlaneMove = (e) => {
    if (isDragging && selectedElement) {
      const newX = Math.max(0, Math.min(dimensions.length - 1, e.point.x + dragOffset.x))
      const newZ = Math.max(0, Math.min(dimensions.width - 1, e.point.z + dragOffset.z))
      
      updateElement(selectedElement.id, {
        position: {
          ...selectedElement.position,
          x: Number(newX.toFixed(2)),
          y: Number(newZ.toFixed(2))
        }
      })
    }
  }

  // --- LÓGICA DE MEDICIÓN ---
  const handleMeasureClick = (event) => {
    if (!measurementMode) return

    const rect = gl.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    raycaster.current.setFromCamera(mouse, camera)
    const intersects = raycaster.current.intersectObjects(scene.children, true)
    
    if (intersects.length > 0) {
      const point = intersects[0].point
      point.y = 0.1 // Ligeramente sobre el suelo
      clickPoints.current.push(point.clone())
      
      if (clickPoints.current.length === 2) {
        const start = clickPoints.current[0]
        const end = clickPoints.current[1]
        const distance = start.distanceTo(end).toFixed(2)
        addMeasurement({
          id: Date.now(),
          start: start.toArray(),
          end: end.toArray(),
          distance
        })
        clickPoints.current = []
      }
    }
  }

  useEffect(() => {
    if (measurementMode) {
      gl.domElement.style.cursor = 'crosshair'
      gl.domElement.addEventListener('click', handleMeasureClick)
      return () => {
        gl.domElement.style.cursor = 'auto'
        gl.domElement.removeEventListener('click', handleMeasureClick)
      }
    }
  }, [measurementMode, gl])

  // --- CONTROL DE CÁMARA 2D PERFECTO ---
  useEffect(() => {
    const { length, width, height } = dimensions
    const maxDim = Math.max(length, width)
    
    if (viewMode === 'Planta') {
      camera.position.set(length / 2, 1000, width / 2)
      camera.lookAt(length / 2, 0, width / 2)
      camera.rotation.set(-Math.PI / 2, 0, 0)
      camera.up.set(0, 0, -1)
      
      if (camera.isOrthographicCamera) {
        camera.zoom = Math.min(window.innerWidth, window.innerHeight) / maxDim * 0.6
        camera.updateProjectionMatrix()
      }
    } 
    else if (viewMode === 'Alzado') {
      camera.position.set(length / 2, height / 2, 1000)
      camera.lookAt(length / 2, height / 2, 0)
      camera.up.set(0, 1, 0)
      
      if (camera.isOrthographicCamera) {
        camera.zoom = window.innerWidth / length * 0.7
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === 'Perfil') {
      camera.position.set(1000, height / 2, width / 2)
      camera.lookAt(0, height / 2, width / 2)
      camera.up.set(0, 1, 0)
      
      if (camera.isOrthographicCamera) {
        camera.zoom = window.innerWidth / width * 0.7
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === '3D') {
      camera.position.set(length * 1.2, height * 1.5, width * 1.2)
      camera.lookAt(length/2, 0, width/2)
      camera.up.set(0, 1, 0)
    }

    if (controls) {
      controls.enableRotate = (viewMode === '3D')
      controls.target.set(length/2, 0, width/2)
      controls.update()
    }

  }, [viewMode, dimensions, camera, controls])

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[50, 100, 50]} intensity={1.2} castShadow />
      <hemisphereLight intensity={0.3} groundColor="#b0bec5" />

      {/* SUELO INVISIBLE PARA DETECTAR ARRASTRE */}
      <mesh 
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[dimensions.length/2, 0, dimensions.width/2]}
        visible={false}
        onPointerMove={handlePlaneMove}
        onPointerUp={handlePointerUp}
        onClick={(e) => {
          if (!isDragging && !measurementMode) selectElement(null)
        }}
      >
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial />
      </mesh>

      {/* SUELO VISIBLE */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[dimensions.length/2, -0.02, dimensions.width/2]}
        receiveShadow
      >
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshStandardMaterial color="#eceff1" />
      </mesh>

      {/* GRID SOLO EN 3D Y PLANTA */}
      {(viewMode === '3D' || viewMode === 'Planta') && (
        <gridHelper 
          args={[Math.max(dimensions.length, dimensions.width) * 1.5, 50, '#cfd8dc', '#eceff1']} 
          position={[dimensions.length/2, -0.01, dimensions.width/2]}
        />
      )}

      {/* DIMENSIONES DE LA NAVE */}
      <Dimensions dimensions={dimensions} viewMode={viewMode} />

      {/* ELEMENTOS */}
      {elements.map(element => (
        <DraggableElement
          key={element.id}
          element={element}
          isSelected={selectedElement?.id === element.id}
          onPointerDown={handlePointerDown}
          pallet={getCurrentPallet()}
          viewMode={viewMode}
        />
      ))}

      {previewElement && <PreviewElement element={previewElement} />}
      
      {/* MEDICIONES */}
      {measurements.map((meas) => (
        <group key={meas.id}>
          <Line 
            points={[meas.start, meas.end]} 
            color="#ff0000" 
            lineWidth={3}
          />
          <Html position={[
            (meas.start[0] + meas.end[0]) / 2, 
            0.5, 
            (meas.start[2] + meas.end[2]) / 2
          ]}>
            <div style={{
              background: 'white', 
              padding: '4px 8px', 
              borderRadius: '4px', 
              border: '2px solid #ff0000', 
              fontSize: '11px', 
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              whiteSpace: 'nowrap'
            }}>
              📏 {meas.distance}m
            </div>
          </Html>
          {/* Puntos de inicio y fin */}
          <mesh position={meas.start}>
            <sphereGeometry args={[0.2]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
          <mesh position={meas.end}>
            <sphereGeometry args={[0.2]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
        </group>
      ))}

      <WarehouseShell dimensions={dimensions} columns={columns} viewMode={viewMode} />
    </>
  )
}

// --- COMPONENTE DIMENSIONES NAVE ---
function Dimensions({ dimensions, viewMode }) {
  if (viewMode !== 'Planta' && viewMode !== '3D') return null
  
  return (
    <>
      {/* Largo */}
      <Html position={[dimensions.length/2, 0, -2]}>
        <div className="dimension-label">{dimensions.length}m</div>
      </Html>
      {/* Ancho */}
      <Html position={[-2, 0, dimensions.width/2]}>
        <div className="dimension-label">{dimensions.width}m</div>
      </Html>
      {/* Alto (solo en 3D) */}
      {viewMode === '3D' && (
        <Html position={[-2, dimensions.height/2, -2]}>
          <div className="dimension-label height">H: {dimensions.height}m</div>
        </Html>
      )}
    </>
  )
}

// --- ELEMENTO ARRASTRABLE ---
function DraggableElement({ element, isSelected, onPointerDown, pallet, viewMode }) {
  const [hovered, setHover] = useState(false)
  
  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = 'grab'
    } else {
      document.body.style.cursor = 'auto'
    }
    return () => document.body.style.cursor = 'auto'
  }, [hovered])

  const highlightColor = isSelected ? '#2196f3' : (hovered ? '#64b5f6' : null)

  // Calcular dimensiones para highlight
  let boxWidth, boxDepth
  if (element.type === 'shelf') {
    boxWidth = element.dimensions.length
    boxDepth = element.dimensions.depth
  } else if (element.type === 'office') {
    boxWidth = element.dimensions.largo
    boxDepth = element.dimensions.ancho
  } else if (element.type === 'dock') {
    boxWidth = element.dimensions.width
    boxDepth = element.dimensions.depth || 3
  }

  return (
    <group
      position={[element.position.x, 0, element.position.y]}
      rotation={[0, (element.position.rotation || 0) * Math.PI / 180, 0]}
      onPointerDown={(e) => onPointerDown(e, element)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Highlight box */}
      {(isSelected || hovered) && (
        <mesh position={[boxWidth/2, 0.05, boxDepth/2]}>
          <boxGeometry args={[boxWidth + 0.3, 0.1, boxDepth + 0.3]} />
          <meshBasicMaterial color={highlightColor} transparent opacity={0.4} />
        </mesh>
      )}

      {element.type === 'shelf' && (
        <ShelfMesh 
          element={element} 
          customColor={highlightColor} 
          pallet={pallet} 
          isSelected={isSelected}
          viewMode={viewMode}
        />
      )}
      {element.type === 'office' && (
        <OfficeMesh 
          element={element} 
          customColor={highlightColor} 
          isSelected={isSelected}
        />
      )}
      {element.type === 'dock' && (
        <DockMesh 
          element={element} 
          customColor={highlightColor} 
          isSelected={isSelected}
        />
      )}
    </group>
  )
}

// --- MALLA ESTANTERÍA ---
function ShelfMesh({ element, customColor, pallet, isSelected, viewMode }) {
  const { length, height, depth, levels } = element.dimensions
  const color = customColor || '#ff6b35'
  
  // Cálculo de capacidad
  const palletsPerLevel = Math.floor((length / pallet.length) * (depth / pallet.width))
  const totalPallets = palletsPerLevel * levels

  return (
    <group>
      {/* Bloque principal */}
      <mesh position={[length/2, height/2, depth/2]} castShadow>
        <boxGeometry args={[length, height, depth]} />
        <meshStandardMaterial 
          color={color} 
          metalness={0.6} 
          roughness={0.4}
        />
      </mesh>
      
      {/* Líneas de niveles (detalle visual) */}
      {viewMode === '3D' && Array.from({ length: levels }).map((_, i) => {
        const y = (height / levels) * (i + 1)
        return (
          <Line 
            key={i}
            points={[
              [0, y, 0], [length, y, 0],
              [length, y, 0], [length, y, depth],
              [length, y, depth], [0, y, depth],
              [0, y, depth], [0, y, 0]
            ]}
            color="white"
            lineWidth={1}
          />
        )
      })}
      
      {/* Label con capacidad */}
      {isSelected && (
        <Html position={[length/2, height + 0.5, depth/2]} center>
          <div className="capacity-label">
            📦 {totalPallets} palets<br/>
            <span style={{fontSize: '9px', opacity: 0.8}}>
              {palletsPerLevel}/nivel × {levels} niveles
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

// --- MALLA OFICINA ---
function OfficeMesh({ element, customColor, isSelected }) {
  const { largo, ancho, alto } = element.dimensions
  const color = customColor || '#1e88e5'
  
  return (
    <group>
      <mesh position={[largo/2, alto/2, ancho/2]} castShadow receiveShadow>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshPhysicalMaterial 
          color={color}
          transparent
          opacity={0.5}
          metalness={0.1}
          roughness={0.3}
        />
      </mesh>
      
      {/* Contorno */}
      <lineSegments position={[largo/2, alto/2, ancho/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(largo, alto, ancho)]} />
        <lineBasicMaterial color="white" linewidth={2} />
      </lineSegments>
      
      {/* Ventanas (simuladas) */}
      <mesh position={[largo/2, alto * 0.65, ancho + 0.02]}>
        <planeGeometry args={[largo * 0.7, alto * 0.3]} />
        <meshBasicMaterial color="#81d4fa" transparent opacity={0.6} />
      </mesh>
      
      {isSelected && (
        <Html position={[largo/2, alto + 0.5, ancho/2]} center>
          <div className="element-label">
            🏢 OFICINA<br/>
            {largo}m × {ancho}m × {alto}m<br/>
            <span style={{fontSize: '9px'}}>
              {(largo * ancho).toFixed(1)} m²
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

// --- MALLA MUELLE ---
function DockMesh({ element, customColor, isSelected }) {
  const { width, height, depth, maneuverZone } = element.dimensions
  const color = customColor || '#616161'
  
  return (
    <group>
      {/* Plataforma */}
      <mesh position={[width/2, height/2, depth/2]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.4} />
      </mesh>
      
      {/* Rampa */}
      <mesh 
        position={[width/2, height * 0.3, depth + 1]} 
        rotation={[-Math.PI / 8, 0, 0]} 
        castShadow
      >
        <boxGeometry args={[width, 0.15, 2]} />
        <meshStandardMaterial color="#424242" />
      </mesh>
      
      {/* Zona de maniobra visual */}
      <mesh 
        position={[width/2, 0.01, depth + maneuverZone/2]} 
        rotation={[-Math.PI/2, 0, 0]}
      >
        <planeGeometry args={[width, maneuverZone]} />
        <meshBasicMaterial 
          color="#ff1744" 
          transparent 
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Grid de maniobra */}
      <gridHelper 
        args={[maneuverZone, 10, '#ff1744', '#ff5252']} 
        position={[width/2, 0.02, depth + maneuverZone/2]}
      />
      
      {isSelected && (
        <Html position={[width/2, height + 1, depth + maneuverZone/2]} center>
          <div className="element-label maneuver">
            🚛 MUELLE<br/>
            Zona: {maneuverZone}m
          </div>
        </Html>
      )}
    </group>
  )
}

// --- PREVIEW ELEMENT ---
function PreviewElement({ element }) {
  if (!element) return null
  
  const dims = element.dimensions
  const width = dims.largo || dims.length || dims.width || 5
  const depth = dims.ancho || dims.depth || 5
  const height = dims.alto || dims.height || 2
  
  return (
    <group position={[element.position.x, 0, element.position.y]}>
      <mesh position={[width/2, height/2, depth/2]}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#ffeb3b" transparent opacity={0.3} wireframe />
      </mesh>
      
      <Html position={[width/2, height + 1, depth/2]} center>
        <div className="preview-label">
          ✨ PREVIEW - Confirma para añadir
        </div>
      </Html>
    </group>
  )
}

// --- ESTRUCTURA NAVE ---
function WarehouseShell({ dimensions, columns, viewMode }) {
  const { length, width, height } = dimensions
  
  // En vistas 2D, solo mostrar contorno simple
  if (viewMode === 'Planta') {
    return (
      <lineSegments position={[length/2, 0.01, width/2]} rotation={[-Math.PI/2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(length, width)]} />
        <lineBasicMaterial color="#1976d2" linewidth={2} />
      </lineSegments>
    )
  }
  
  if (viewMode === 'Alzado' || viewMode === 'Perfil') {
    return (
      <lineSegments position={[length/2, height/2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(length, height, 0.1)]} />
        <lineBasicMaterial color="#1976d2" linewidth={2} />
      </lineSegments>
    )
  }

  // Vista 3D completa
  return (
    <group>
      {/* Estructura de aristas */}
      <lineSegments position={[length/2, height/2, width/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(length, height, width)]} />
        <lineBasicMaterial color="#1976d2" linewidth={1.5} transparent opacity={0.6} />
      </lineSegments>

      {/* Paredes transparentes */}
      {[
        { pos: [length/2, height/2, 0], rot: [0, 0, 0], size: [length, height] },
        { pos: [length/2, height/2, width], rot: [0, Math.PI, 0], size: [length, height] },
        { pos: [0, height/2, width/2], rot: [0, Math.PI/2, 0], size: [width, height] },
        { pos: [length, height/2, width/2], rot: [0, -Math.PI/2, 0], size: [width, height] },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} rotation={wall.rot}>
          <planeGeometry args={wall.size} />
          <meshBasicMaterial 
            color="#e3f2fd" 
            transparent 
            opacity={0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Columnas */}
      {columns.filter(col => col.active).map((col) => (
        <mesh key={col.id} position={[col.x, height/2, col.z]} castShadow>
          <boxGeometry args={[0.3, height, 0.3]} />
          <meshStandardMaterial color="#78909c" metalness={0.5} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}