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

  // Estado para arrastrar sin re-renderizar todo el componente
  const dragState = useRef({
    isDragging: false,
    draggedElement: null,
    offset: new THREE.Vector3()
  })

  // --- LÓGICA DE ARRASTRE (DRAG & DROP) ---
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
    // Límites de seguridad para no sacar elementos de la nave
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

  // --- LÓGICA DE MEDICIÓN ---
  const handleMeasureClick = (event) => {
    if (!measurementMode) return

    const rect = gl.domElement.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    raycaster.current.setFromCamera(mouse, camera)
    // Intersectar con el plano invisible del suelo
    const intersects = raycaster.current.intersectObject(planeRef.current, true)
    
    if (intersects.length > 0) {
      const point = intersects[0].point
      point.y = 0.2 // Elevar un poco para que se vea sobre el suelo
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

  // --- CONTROL DE CÁMARA 2D/3D (CORREGIDO CON CENTRADO REAL) ---
  useEffect(() => {
    const { length, width, height } = dimensions
    const center = new THREE.Vector3(length / 2, 0, width / 2)
    
    // 1. Obtener dimensiones REALES del lienzo 3D (sin la barra lateral)
    const canvasWidth = gl.domElement.clientWidth
    const canvasHeight = gl.domElement.clientHeight
    
    if (viewMode === 'Planta') {
      // CÁMARA CENITAL
      camera.position.set(center.x, 100, center.z)
      camera.lookAt(center)
      camera.rotation.z = 0 // Reset rotación Z por si acaso
      camera.up.set(0, 0, -1) // Norte arriba
      
      if (camera.isOrthographicCamera) {
        // Calcular zoom basado en el tamaño del Canvas, no de la ventana
        const maxDim = Math.max(length, width)
        const zoom = Math.min(canvasWidth, canvasHeight) / maxDim * 0.8 // 0.8 deja un margen
        
        camera.zoom = zoom
        camera.updateProjectionMatrix()
      }
    } 
    else if (viewMode === 'Alzado') {
      // VISTA FRONTAL
      camera.position.set(center.x, height / 2, width + 100)
      camera.lookAt(center.x, height / 2, center.z)
      camera.up.set(0, 1, 0)
      
      if (camera.isOrthographicCamera) {
        // Ajustar para que quepa el largo y el alto
        const zoom = Math.min(canvasWidth / length, canvasHeight / height) * 0.8
        
        camera.zoom = zoom
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === 'Perfil') {
      // VISTA LATERAL
      camera.position.set(length + 100, height / 2, center.z)
      camera.lookAt(center.x, height / 2, center.z)
      camera.up.set(0, 1, 0)
      
      if (camera.isOrthographicCamera) {
        // Ajustar para que quepa el ancho y el alto
        const zoom = Math.min(canvasWidth / width, canvasHeight / height) * 0.8
        
        camera.zoom = zoom
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === '3D') {
      // VISTA PERSPECTIVA
      camera.position.set(length * 1.2, height * 1.5, width * 1.2)
      camera.lookAt(center)
      camera.up.set(0, 1, 0)
    }

    // Actualizar target de los controles orbitales
    if (controls) {
      controls.enableRotate = (viewMode === '3D')
      controls.target.copy(center)
      controls.update()
    }

  }, [viewMode, dimensions, camera, controls, gl.domElement.clientWidth, gl.domElement.clientHeight])

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[50, 100, 50]} intensity={1.2} castShadow />
      <hemisphereLight intensity={0.3} groundColor="#b0bec5" />

      {/* PLANO INVISIBLE PARA GESTIONAR EL ARRASTRE */}
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

      {/* SUELO VISIBLE */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[dimensions.length/2, -0.05, dimensions.width/2]}
        receiveShadow
        onClick={() => !dragState.current.isDragging && selectElement(null)}
      >
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>

      {/* GRID (Solo en 3D y Planta) */}
      {(viewMode === '3D' || viewMode === 'Planta') && (
        <gridHelper 
          args={[
            Math.max(dimensions.length, dimensions.width) * 1.5, 
            Math.max(dimensions.length, dimensions.width), 
            '#1976d2', // Eje principal azul
            '#e0e0e0'  // Secundario gris suave
          ]} 
          position={[dimensions.length/2, -0.04, dimensions.width/2]}
        />
      )}

      {/* COTAS DE DIMENSIONES */}
      <Dimensions dimensions={dimensions} viewMode={viewMode} />

      {/* ELEMENTOS DE LA NAVE */}
      {elements.map(element => (
        <DraggableElement
          key={element.id}
          element={element}
          isSelected={selectedElement?.id === element.id}
          // Pasamos estado de drag para optimizar renderizado
          isDragging={dragState.current.isDragging && dragState.current.draggedElement?.id === element.id}
          onPointerDown={handlePointerDown}
          pallet={getCurrentPallet()}
          viewMode={viewMode}
        />
      ))}

      {previewElement && <PreviewElement element={previewElement} />}
      
      {/* LÍNEAS DE MEDICIÓN */}
      {measurements.map((meas) => (
        <group key={meas.id}>
          <Line points={[meas.start, meas.end]} color="#ff0000" lineWidth={3} />
          <Html position={[(meas.start[0] + meas.end[0]) / 2, 0.5, (meas.start[2] + meas.end[2]) / 2]}>
            <div style={{
              background: 'white', 
              padding: '2px 6px', 
              borderRadius: '4px', 
              border: '1px solid #ff0000', 
              fontSize: '10px', 
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}>
              📏 {meas.distance}m
            </div>
          </Html>
          {/* Puntos extremos */}
          <mesh position={meas.start}><sphereGeometry args={[0.15]} /><meshBasicMaterial color="red"/></mesh>
          <mesh position={meas.end}><sphereGeometry args={[0.15]} /><meshBasicMaterial color="red"/></mesh>
        </group>
      ))}

      {/* CONTORNO TÉCNICO DE LA NAVE */}
      <WarehouseShell dimensions={dimensions} columns={columns} viewMode={viewMode} />
    </>
  )
}

// --- COMPONENTES AUXILIARES ---

function Dimensions({ dimensions, viewMode }) {
  // Solo mostrar en 3D y Planta
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
  
  // --- ✅ CONTROL DE CÁMARA CORREGIDO ---
  useEffect(() => {
    const { length, width, height } = dimensions
    const center = new THREE.Vector3(length / 2, height / 2, width / 2)
    
    if (viewMode === 'Planta') {
      // ✅ VISTA CENITAL (desde arriba, mirando hacia abajo)
      camera.position.set(center.x, Math.max(length, width) * 1.5, center.z)
      camera.lookAt(center.x, 0, center.z)
      camera.up.set(0, 0, -1) // Norte arriba
      camera.rotation.z = 0
      
      if (camera.isOrthographicCamera) {
        camera.zoom = 10
        camera.updateProjectionMatrix()
      }
    } 
    else if (viewMode === 'Alzado') {
      // ✅ VISTA FRONTAL PURA (desde el frente, SIN profundidad)
      camera.position.set(center.x, center.y, width + Math.max(length, height))
      camera.lookAt(center.x, center.y, center.z)
      camera.up.set(0, 1, 0)
      camera.rotation.z = 0
      
      if (camera.isOrthographicCamera) {
        camera.zoom = 8
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === 'Perfil') {
      // ✅ VISTA LATERAL PURA (desde el lado, SIN profundidad)
      camera.position.set(length + Math.max(width, height), center.y, center.z)
      camera.lookAt(center.x, center.y, center.z)
      camera.up.set(0, 1, 0)
      camera.rotation.z = 0
      
      if (camera.isOrthographicCamera) {
        camera.zoom = 8
        camera.updateProjectionMatrix()
      }
    }
    else if (viewMode === '3D') {
      // ✅ VISTA PERSPECTIVA 3D
      camera.position.set(length * 1.2, height * 1.5, width * 1.2)
      camera.lookAt(center)
      camera.up.set(0, 1, 0)
    }

    // Actualizar controles
    if (controls) {
      controls.enableRotate = (viewMode === '3D')
      controls.target.copy(viewMode === 'Planta' ? new THREE.Vector3(center.x, 0, center.z) : center)
      controls.update()
    }

  }, [viewMode, dimensions, camera, controls])

  const highlightColor = isSelected ? '#2196f3' : (hovered ? '#64b5f6' : null)

  // Calcular tamaño para la caja de selección
  let w, d
  if (element.type === 'shelf') { w = element.dimensions.length; d = element.dimensions.depth }
  else if (element.type === 'office') { w = element.dimensions.largo; d = element.dimensions.ancho }
  else { w = element.dimensions.width; d = element.dimensions.depth || 3 }

  return (
    <group
      position={[element.position.x, 0, element.position.y]}
      rotation={[0, (element.position.rotation || 0) * Math.PI / 180, 0]}
      onPointerDown={(e) => onPointerDown(e, element)}
      onPointerOver={() => !isDragging && setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Caja de resaltado */}
      {(isSelected || hovered) && !isDragging && (
        <mesh position={[w/2, 0.05, d/2]}>
          <boxGeometry args={[w + 0.2, 0.1, d + 0.2]} />
          <meshBasicMaterial color={highlightColor} transparent opacity={0.4} depthTest={false} />
        </mesh>
      )}

      {/* Renderizar geometría específica */}
      {element.type === 'shelf' && <ShelfMesh element={element} customColor={highlightColor} pallet={pallet} isSelected={isSelected && !isDragging} viewMode={viewMode} />}
      {element.type === 'office' && <OfficeMesh element={element} customColor={highlightColor} isSelected={isSelected && !isDragging} />}
      {element.type === 'dock' && <DockMesh element={element} customColor={highlightColor} isSelected={isSelected && !isDragging} />}
    </group>
  )
}

// --- GEOMETRÍAS DE ELEMENTOS (Igual que tu versión anterior) ---

function ShelfMesh({ element, customColor, pallet, isSelected, viewMode }) {
  const { length, height, depth, levels } = element.dimensions
  const color = customColor || '#ff6b35'
  const palletsPerLevel = Math.floor((length / pallet.length) * (depth / pallet.width))
  const totalPallets = palletsPerLevel * levels

  return (
    <group>
      <mesh position={[length/2, height/2, depth/2]} castShadow>
        <boxGeometry args={[length, height, depth]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Líneas de detalle solo en 3D para no ensuciar el plano */}
      {viewMode === '3D' && Array.from({ length: levels }).map((_, i) => {
        const y = (height / levels) * (i + 1)
        return <Line key={i} points={[[0, y, 0], [length, y, 0], [length, y, depth], [0, y, depth], [0, y, 0]]} color="white" lineWidth={1} />
      })}
      
      {isSelected && (
        <Html position={[length/2, height + 0.5, depth/2]} center>
          <div className="capacity-label">📦 {totalPallets} pales</div>
        </Html>
      )}
    </group>
  )
}

function OfficeMesh({ element, customColor, isSelected }) {
  const { largo, ancho, alto } = element.dimensions
  const color = customColor || '#1e88e5'
  return (
    <group>
      <mesh position={[largo/2, alto/2, ancho/2]} castShadow receiveShadow>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshPhysicalMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <lineSegments position={[largo/2, alto/2, ancho/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(largo, alto, ancho)]} />
        <lineBasicMaterial color="white" />
      </lineSegments>
      {isSelected && (
        <Html position={[largo/2, alto + 0.5, ancho/2]} center>
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
        <Html position={[width/2, height + 1, depth + maneuverZone/2]} center>
          <div className="element-label maneuver">🚛 MUELLE</div>
        </Html>
      )}
    </group>
  )
}

function PreviewElement({ element }) {
  if (!element) return null
  const dims = element.dimensions
  const w = dims.largo || dims.length || dims.width || 5
  const d = dims.ancho || dims.depth || 5
  const h = dims.alto || dims.height || 2
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
  
  // Contornos técnicos para vistas 2D
  if (viewMode === 'Planta') {
    return (
      <Line 
        points={[[0,0,0], [length,0,0], [length,0,width], [0,0,width], [0,0,0]]} 
        color="#1976d2" lineWidth={3} position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} // Girado para verse desde arriba
      />
    )
  }
  // ... (resto de lógica de shell, igual que tu versión)
  // Mantenemos tu implementación de Alzado, Perfil y 3D que estaba correcta.
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