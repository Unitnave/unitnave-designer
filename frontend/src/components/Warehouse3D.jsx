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

  const dragState = useRef({
    isDragging: false,
    draggedElement: null,
    offset: new THREE.Vector3()
  })

  // --- LÓGICA DE ARRASTRE ---
  const handlePointerDown = (e, element) => {
    if (measurementMode || (viewMode !== 'Planta' && viewMode !== '3D')) return
    
    e.stopPropagation()
    selectElement(element)
    
    dragState.current.isDragging = true
    dragState.current.draggedElement = element
    dragState.current.offset.set(
      element.position.x - e.point.x,
      0,
      element.position.y - e.point.z
    )
    
    if (controls) controls.enabled = false
    gl.domElement.style.cursor = 'grabbing'
  }

  const handlePointerUp = () => {
    dragState.current.isDragging = false
    dragState.current.draggedElement = null
    
    if (controls) controls.enabled = true
    gl.domElement.style.cursor = 'auto'
  }

  const handlePointerMove = (e) => {
    if (!dragState.current.isDragging || !dragState.current.draggedElement) return
    
    const element = dragState.current.draggedElement
    const newX = Math.max(0, Math.min(dimensions.length, e.point.x + dragState.current.offset.x))
    const newZ = Math.max(0, Math.min(dimensions.width, e.point.z + dragState.current.offset.z))
    
    updateElement(element.id, {
      position: {
        ...element.position,
        x: Number(newX.toFixed(2)),
        y: Number(newZ.toFixed(2))
      }
    })
  }

  // --- MEDICIÓN ---
  const handleMeasureClick = (event) => {
    if (!measurementMode) return

    const rect = gl.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    raycaster.current.setFromCamera(mouse, camera)
    const intersects = raycaster.current.intersectObject(planeRef.current, true)
    
    if (intersects.length > 0) {
      const point = intersects[0].point
      point.y = 0.2
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

  // ⭐ CÁMARA CORREGIDA - USA clientWidth/clientHeight
  useEffect(() => {
    const { length, width, height } = dimensions
    const centerX = length / 2
    const centerZ = width / 2
    
    // ✅ CORRECCIÓN: Obtener aspect ratio del canvas real
    const canvasWidth = gl.domElement.clientWidth
    const canvasHeight = gl.domElement.clientHeight
    const aspect = canvasWidth / canvasHeight
    
    // Configurar controles PRIMERO
    if (controls) {
      controls.enableRotate = (viewMode === '3D')
      controls.enablePan = true
      controls.enableZoom = true
      controls.screenSpacePanning = (viewMode !== '3D')
    }
    
    if (viewMode === 'Planta') {
      const targetY = 0
      
      if (controls) {
        controls.target.set(centerX, targetY, centerZ)
      }
      
      camera.position.set(centerX, 80, centerZ)
      camera.up.set(0, 0, -1)
      camera.lookAt(centerX, targetY, centerZ)
      
      if (camera.isOrthographicCamera) {
        const maxDim = Math.max(length, width)
        const viewSize = maxDim * 1.2
        
        camera.left = -viewSize * aspect / 2
        camera.right = viewSize * aspect / 2
        camera.top = viewSize / 2
        camera.bottom = -viewSize / 2
        camera.zoom = 1
        camera.updateProjectionMatrix()
      }
    } 
    else if (viewMode === 'Alzado') {
      const targetY = height / 2
      
      if (controls) {
        controls.target.set(centerX, targetY, centerZ)
      }
      
      camera.position.set(centerX, targetY, width + 50)
      camera.up.set(0, 1, 0)
      camera.lookAt(centerX, targetY, centerZ)
      
      if (camera.isOrthographicCamera) {
        const viewWidth = length * 1.2
        const viewHeight = height * 1.2
        
        camera.left = -viewWidth * aspect / 2
        camera.right = viewWidth * aspect / 2
        camera.top = viewHeight / 2
        camera.bottom = -viewHeight / 2
        camera.zoom = 1
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === 'Perfil') {
      const targetY = height / 2
      
      if (controls) {
        controls.target.set(centerX, targetY, centerZ)
      }
      
      camera.position.set(length + 50, targetY, centerZ)
      camera.up.set(0, 1, 0)
      camera.lookAt(centerX, targetY, centerZ)
      
      if (camera.isOrthographicCamera) {
        const viewWidth = width * 1.2
        const viewHeight = height * 1.2
        
        camera.left = -viewWidth * aspect / 2
        camera.right = viewWidth * aspect / 2
        camera.top = viewHeight / 2
        camera.bottom = -viewHeight / 2
        camera.zoom = 1
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === '3D') {
      const targetY = height / 2
      
      if (controls) {
        controls.target.set(centerX, targetY, centerZ)
      }
      
      camera.position.set(
        centerX + length * 0.8, 
        height * 1.5, 
        centerZ + width * 0.8
      )
      camera.up.set(0, 1, 0)
      camera.lookAt(centerX, targetY, centerZ)
      
      if (camera.isPerspectiveCamera) {
        camera.updateProjectionMatrix()
      }
    }

    if (controls) {
      controls.update()
    }

  }, [viewMode, dimensions, camera, controls, gl.domElement.clientWidth, gl.domElement.clientHeight])

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[50, 100, 50]} intensity={1.2} castShadow />
      <hemisphereLight intensity={0.3} groundColor="#b0bec5" />

      <mesh 
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[dimensions.length/2, 0, dimensions.width/2]}
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial />
      </mesh>

      {(viewMode === '3D' || viewMode === 'Planta') && (
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[dimensions.length/2, -0.05, dimensions.width/2]}
          receiveShadow
          onClick={() => !dragState.current.isDragging && selectElement(null)}
        >
          <planeGeometry args={[dimensions.length, dimensions.width]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
      )}

      {(viewMode === '3D' || viewMode === 'Planta') && (
        <gridHelper 
          args={[
            Math.max(dimensions.length, dimensions.width) * 1.5, 
            50, 
            '#1976d2', 
            '#e0e0e0'
          ]} 
          position={[dimensions.length/2, -0.04, dimensions.width/2]}
        />
      )}

      <Dimensions dimensions={dimensions} viewMode={viewMode} />

      {elements.map(element => (
        <DraggableElement
          key={element.id}
          element={element}
          isSelected={selectedElement?.id === element.id}
          isDragging={dragState.current.isDragging && dragState.current.draggedElement?.id === element.id}
          onPointerDown={handlePointerDown}
          pallet={getCurrentPallet()}
          viewMode={viewMode}
        />
      ))}

      {previewElement && <PreviewElement element={previewElement} />}
      
      {measurements.map((meas) => (
        <group key={meas.id}>
          <Line points={[meas.start, meas.end]} color="#d32f2f" lineWidth={2} />
          <Html position={[(meas.start[0] + meas.end[0]) / 2, 0.5, (meas.start[2] + meas.end[2]) / 2]}>
            <div style={{background: 'white', padding: '2px 6px', border: '1px solid #d32f2f', fontSize: '10px', fontWeight: 'bold', color: '#d32f2f'}}>
              {meas.distance}m
            </div>
          </Html>
          <mesh position={meas.start}><sphereGeometry args={[0.15]} /><meshBasicMaterial color="#d32f2f"/></mesh>
          <mesh position={meas.end}><sphereGeometry args={[0.15]} /><meshBasicMaterial color="#d32f2f"/></mesh>
        </group>
      ))}

      <WarehouseShell dimensions={dimensions} columns={columns} viewMode={viewMode} />
    </>
  )
}

function Dimensions({ dimensions, viewMode }) {
  if (viewMode === 'Alzado' || viewMode === 'Perfil') return null
  
  return (
    <>
      <Html position={[dimensions.length/2, 0, -2]}>
        <div className="dimension-label">{dimensions.length}m</div>
      </Html>
      <Html position={[-2, 0, dimensions.width/2]}>
        <div className="dimension-label">{dimensions.width}m</div>
      </Html>
      {viewMode === '3D' && (
        <Html position={[-2, dimensions.height/2, -2]}>
          <div className="dimension-label height">H: {dimensions.height}m</div>
        </Html>
      )}
    </>
  )
}

function DraggableElement({ element, isSelected, isDragging, onPointerDown, pallet, viewMode }) {
  const [hovered, setHover] = useState(false)
  
  useEffect(() => {
    if (hovered && !isDragging) document.body.style.cursor = 'grab'
    return () => { if(!isDragging) document.body.style.cursor = 'auto' }
  }, [hovered, isDragging])

  const highlightColor = isSelected ? '#2196f3' : (hovered ? '#64b5f6' : null)

  // ✅ CORRECCIÓN: Lógica específica por tipo como en código antiguo
  let w, d
  if (element.type === 'shelf') { 
    w = element.dimensions.length || 1
    d = element.dimensions.depth || 1 
  } else if (element.type === 'office') { 
    w = element.dimensions.largo || 1
    d = element.dimensions.ancho || 1 
  } else { 
    // dock, operational_zone, service_room, technical_room
    w = element.dimensions.width || 1
    d = element.dimensions.depth || 3 
  }

  return (
    <group
      position={[element.position.x, 0, element.position.y]}
      rotation={[0, (element.position.rotation || 0) * Math.PI / 180, 0]}
      onPointerDown={(e) => onPointerDown(e, element)}
      onPointerOver={() => !isDragging && setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {(isSelected || hovered) && !isDragging && (
        <mesh position={[w/2, 0.05, d/2]}>
          <boxGeometry args={[w + 0.2, 0.1, d + 0.2]} />
          <meshBasicMaterial color={highlightColor} transparent opacity={0.4} depthTest={false} />
        </mesh>
      )}

      {element.type === 'shelf' && <ShelfMesh element={element} customColor={highlightColor} pallet={pallet} isSelected={isSelected && !isDragging} viewMode={viewMode} />}
      {element.type === 'office' && <OfficeMesh element={element} customColor={highlightColor} isSelected={isSelected && !isDragging} />}
      {element.type === 'dock' && <DockMesh element={element} customColor={highlightColor} isSelected={isSelected && !isDragging} />}
      
      {/* Nuevos elementos del optimizer V3 */}
      {element.type === 'service_room' && <ServiceRoomMesh element={element} customColor={highlightColor} isSelected={isSelected && !isDragging} />}
      {element.type === 'operational_zone' && <OperationalZoneMesh element={element} customColor={highlightColor} isSelected={isSelected && !isDragging} />}
      {element.type === 'technical_room' && <TechnicalRoomMesh element={element} customColor={highlightColor} isSelected={isSelected && !isDragging} />}
    </group>
  )
}

function ShelfMesh({ element, customColor, pallet, isSelected, viewMode }) {
  const { length, height, depth, levels } = element.dimensions
  const color = customColor || '#ff6b35'
  const palletsPerLevel = Math.floor((length / (pallet?.length || 1.2)) * (depth / (pallet?.width || 0.8)))
  const totalPallets = palletsPerLevel * (levels || 1)

  return (
    <group>
      <mesh position={[length/2, height/2, depth/2]} castShadow>
        <boxGeometry args={[length, height, depth]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {viewMode === '3D' && Array.from({ length: levels || 1 }).map((_, i) => {
        const y = (height / (levels || 1)) * (i + 1)
        return <Line key={i} points={[[0, y, 0], [length, y, 0], [length, y, depth], [0, y, depth], [0, y, 0]]} color="white" lineWidth={1} />
      })}
      
      {isSelected && (
        <Html position={[length/2, height + 0.5, depth/2]} center>
          <div className="capacity-label">📦 {totalPallets} palets</div>
        </Html>
      )}
    </group>
  )
}

function OfficeMesh({ element, customColor, isSelected }) {
  const { largo, ancho, alto } = element.dimensions
  const elevation = element.properties?.elevation || 0
  const color = customColor || '#1e88e5'
  
  return (
    <group position={[0, elevation, 0]}>
      <mesh position={[largo/2, alto/2, ancho/2]} castShadow receiveShadow>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshPhysicalMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <lineSegments position={[largo/2, alto/2, ancho/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(largo, alto, ancho)]} />
        <lineBasicMaterial color="white" />
      </lineSegments>
      {isSelected && (
        <Html position={[largo/2, alto+0.5, ancho/2]} center>
          <div className="element-label">🏢 OFICINA<br/>{(largo * ancho).toFixed(1)} m²</div>
        </Html>
      )}
    </group>
  )
}

function DockMesh({ element, customColor, isSelected }) {
  const { width, height, depth, maneuverZone } = element.dimensions
  const color = customColor || '#616161'
  
  return (
    <group>
      <mesh position={[width/2, height/2, depth/2]} castShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[width/2, 0.01, depth + maneuverZone/2]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[width, maneuverZone]} />
        <meshBasicMaterial color="#ff1744" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      <gridHelper args={[maneuverZone, 10, '#ff1744', '#ff5252']} position={[width/2, 0.02, depth + maneuverZone/2]} />
      {isSelected && (
        <Html position={[width/2, height+1, depth+maneuverZone/2]} center>
          <div className="element-label maneuver">🚛 MUELLE</div>
        </Html>
      )}
    </group>
  )
}

// ⭐ NUEVOS COMPONENTES PARA ELEMENTOS DEL OPTIMIZER V3

function ServiceRoomMesh({ element, customColor, isSelected }) {
  const { largo, ancho, alto } = element.dimensions
  const elevation = element.properties?.elevation || 0
  const label = element.properties?.label || 'Servicio'
  const color = customColor || '#4caf50'
  
  return (
    <group position={[0, elevation, 0]}>
      <mesh position={[largo/2, alto/2, ancho/2]} castShadow>
        <boxGeometry args={[largo, ancho, alto]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {isSelected && (
        <Html position={[largo/2, alto+0.5, ancho/2]} center>
          <div className="element-label">🚻 {label}</div>
        </Html>
      )}
    </group>
  )
}

function OperationalZoneMesh({ element, customColor, isSelected }) {
  const { largo, ancho } = element.dimensions
  const label = element.properties?.label || 'Zona Operativa'
  const color = customColor || '#ffeb3b'
  
  return (
    <group>
      <mesh position={[largo/2, 0.05, ancho/2]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[largo, ancho]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[largo/2, 0.06, ancho/2]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(largo, ancho)]} />
        <lineBasicMaterial color="#f57f17" linewidth={2} />
      </lineSegments>
      {isSelected && (
        <Html position={[largo/2, 1, ancho/2]} center>
          <div className="element-label">📦 {label}</div>
        </Html>
      )}
    </group>
  )
}

function TechnicalRoomMesh({ element, customColor, isSelected }) {
  const { largo, ancho, alto } = element.dimensions
  const label = element.properties?.label || 'Técnica'
  const color = customColor || '#9e9e9e'
  
  return (
    <group>
      <mesh position={[largo/2, alto/2, ancho/2]} castShadow>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      {isSelected && (
        <Html position={[largo/2, alto+0.5, ancho/2]} center>
          <div className="element-label">⚡ {label}</div>
        </Html>
      )}
    </group>
  )
}

function PreviewElement({ element }) {
  if (!element) return null
  const dims = element.dimensions
  const w = dims.largo || dims.length || dims.width || 1
  const d = dims.ancho || dims.depth || 1
  const h = dims.alto || dims.height || 1
  
  return (
    <group position={[element.position.x, 0, element.position.y]}>
      <mesh position={[w/2, h/2, d/2]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#ffeb3b" transparent opacity={0.3} wireframe />
      </mesh>
      <Html position={[w/2, h + 1, d/2]} center><div className="preview-label">✨ PREVIEW</div></Html>
    </group>
  )
}

function WarehouseShell({ dimensions, columns, viewMode }) {
  const { length, width, height } = dimensions
  
  if (viewMode === 'Planta') {
    return (
      <Line 
        points={[[0,0,0], [length,0,0], [length,0,width], [0,0,width], [0,0,0]]} 
        color="#1565c0" lineWidth={4} position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} 
      />
    )
  }
  
  if (viewMode === 'Alzado') {
    return (
      <Line 
        points={[[0,0,0], [length,0,0], [length,height,0], [0,height,0], [0,0,0]]} 
        color="#1565c0" lineWidth={4} position={[0, 0, width/2]}
      />
    )
  }

  if (viewMode === 'Perfil') {
    return (
      <Line 
        points={[[0,0,0], [0,0,width], [0,height,width], [0,height,0], [0,0,0]]} 
        color="#1565c0" lineWidth={4} position={[length/2, 0, 0]} 
      />
    )
  }

  return (
    <group>
      <lineSegments position={[length/2, height/2, width/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(length, height, width)]} />
        <lineBasicMaterial color="#1976d2" linewidth={1.5} transparent opacity={0.6} />
      </lineSegments>
      {columns.filter(col => col.active).map((col) => (
        <mesh key={col.id} position={[col.x, height/2, col.z]}>
          <boxGeometry args={[0.3, height, 0.3]} />
          <meshStandardMaterial color="#78909c" />
        </mesh>
      ))}
    </group>
  )
}