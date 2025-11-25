/**
 * UNITNAVE Designer - Visualizador 3D Profesional
 * 
 * Características:
 * - Nave abierta por arriba (vista maqueta)
 * - Paredes con corte diagonal
 * - Integración de componentes detallados
 * - Iluminación profesional
 */

import { useRef, useEffect, useState, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'

import useWarehouseStore from '../stores/useWarehouseStore'
import useUIStore from '../stores/useUIStore'
import useCalculationsStore from '../stores/useCalculationsStore'

// Componentes 3D detallados
import DetailedShelf from './3d/DetailedShelf'
import DetailedOffice from './3d/DetailedOffice'
import DetailedDock from './3d/DetailedDock'
import DetailedServiceRooms from './3d/DetailedServiceRooms'
import DetailedOperationalZone from './3d/DetailedOperationalZone'
import IndustrialFloor from './3d/IndustrialFloor'

// Colores de la estructura
const STRUCTURE_COLORS = {
  wallExterior: '#4a5568',    // Gris oscuro exterior
  wallInterior: '#718096',    // Gris medio interior
  wallCut: '#e53e3e',         // Rojo para el corte (efecto maqueta)
  column: '#2d3748',          // Columnas estructurales
  beam: '#4a5568',            // Vigas de cubierta
  roofFrame: '#1a202c',       // Cerchas
  floor: '#a0aec0',           // Solera
}

export default function Warehouse3DPro() {
  const { dimensions, elements, columns, updateElement } = useWarehouseStore()
  const { viewMode, selectedElement, selectElement, previewElement } = useUIStore()
  const { palletHeight } = useCalculationsStore()

  const { camera, gl, controls } = useThree()
  const groupRef = useRef()

  // Estado de drag & drop
  const dragState = useRef({
    isDragging: false,
    draggedElement: null,
    offset: new THREE.Vector3()
  })

  // Posiciones de muelles para el suelo
  const dockPositions = useMemo(() => {
    return elements
      .filter(el => el.type === 'dock')
      .map(el => ({
        x: el.position.x,
        z: el.position.y,
        width: el.dimensions?.width || 3.5,
        depth: el.dimensions?.depth || 4,
        maneuverZone: el.dimensions?.maneuverZone || 12
      }))
  }, [elements])

  // Ancho de pasillo
  const aisleWidth = useCalculationsStore(state => state.aisleWidth) || 2.8

  // Handlers de interacción
  const handlePointerDown = (e, element) => {
    if (viewMode !== 'Planta' && viewMode !== '3D') return
    
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
    if (dragState.current.isDragging) {
      dragState.current.isDragging = false
      dragState.current.draggedElement = null
      if (controls) controls.enabled = true
      gl.domElement.style.cursor = 'auto'
    }
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

  // Configuración de cámara según vista
  useEffect(() => {
    const { length, width, height } = dimensions
    const centerX = length / 2
    const centerZ = width / 2

    if (controls) {
      controls.enableRotate = (viewMode === '3D')
      controls.enablePan = true
      controls.enableZoom = true
    }

    if (viewMode === 'Planta') {
      camera.position.set(centerX, Math.max(length, width) * 1.5, centerZ)
      camera.lookAt(centerX, 0, centerZ)
      camera.up.set(0, 0, -1)
    } else if (viewMode === '3D') {
      camera.position.set(
        centerX + length * 0.8,
        height * 2.5,
        centerZ + width * 0.8
      )
      camera.lookAt(centerX, height / 3, centerZ)
      camera.up.set(0, 1, 0)
    } else if (viewMode === 'Alzado') {
      camera.position.set(centerX, height / 2, width + Math.max(length, width))
      camera.lookAt(centerX, height / 2, centerZ)
      camera.up.set(0, 1, 0)
    } else if (viewMode === 'Perfil') {
      camera.position.set(length + Math.max(length, width), height / 2, centerZ)
      camera.lookAt(centerX, height / 2, centerZ)
      camera.up.set(0, 1, 0)
    }

    if (controls) controls.update()
  }, [viewMode, dimensions, camera, controls])

  return (
    <group ref={groupRef}>
      {/* Iluminación profesional */}
      <ambientLight intensity={0.4} />
      <hemisphereLight 
        intensity={0.5} 
        color="#ffffff" 
        groundColor="#8d6e63" 
      />
      <directionalLight
        position={[dimensions.length * 0.5, dimensions.height * 3, dimensions.width * 0.5]}
        intensity={1.0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <directionalLight
        position={[-dimensions.length * 0.3, dimensions.height * 2, -dimensions.width * 0.3]}
        intensity={0.3}
      />
      {/* Luz puntual interior para realismo */}
      <pointLight 
        position={[dimensions.length / 2, dimensions.height - 1, dimensions.width / 2]} 
        intensity={0.5} 
        distance={dimensions.length}
        color="#fff5e6"
      />

      {/* Suelo industrial */}
      <IndustrialFloor
        dimensions={dimensions}
        aisleWidth={aisleWidth}
        mainAisleWidth={4.5}
        showGrid={viewMode === 'Planta'}
        showAisles={true}
        showSafetyZones={true}
        dockPositions={dockPositions}
        viewMode={viewMode}
      />

      {/* Plano de interacción invisible */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[dimensions.length / 2, 0.001, dimensions.width / 2]}
        visible={false}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <planeGeometry args={[dimensions.length * 2, dimensions.width * 2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Estructura de la nave (abierta por arriba) */}
      <WarehouseStructureOpen
        dimensions={dimensions}
        columns={columns}
        viewMode={viewMode}
      />

      {/* Elementos del diseño */}
      {elements.map(element => (
        <ElementRenderer
          key={element.id}
          element={element}
          isSelected={selectedElement?.id === element.id}
          isDragging={dragState.current.draggedElement?.id === element.id}
          onPointerDown={handlePointerDown}
          viewMode={viewMode}
          palletHeight={palletHeight || 1.5}
        />
      ))}

      {/* Preview de elemento nuevo */}
      {previewElement && <PreviewElement element={previewElement} />}

      {/* Escala de referencia */}
      {viewMode === 'Planta' && <ScaleIndicator dimensions={dimensions} />}
    </group>
  )
}

// =====================================================
// ESTRUCTURA DE LA NAVE - ABIERTA POR ARRIBA
// =====================================================
function WarehouseStructureOpen({ dimensions, columns, viewMode }) {
  const { length, width, height } = dimensions
  
  // Altura del corte (para efecto maqueta)
  const cutHeight = height * 0.85
  const wallThickness = 0.25

  // Solo paredes en vista 2D
  if (viewMode === 'Planta') {
    return (
      <group>
        {/* Perímetro de la nave */}
        <Line
          points={[
            [0, 0.15, 0],
            [length, 0.15, 0],
            [length, 0.15, width],
            [0, 0.15, width],
            [0, 0.15, 0]
          ]}
          color="#2d3748"
          lineWidth={4}
        />
        {/* Indicador Norte */}
        <Html position={[length / 2, 0.5, -2]} center>
          <div style={{
            background: 'rgba(45, 55, 72, 0.95)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            ⬆️ NORTE · MUELLES
          </div>
        </Html>
      </group>
    )
  }

  return (
    <group>
      {/* === PAREDES CON CORTE DIAGONAL === */}
      
      {/* Pared Norte (muelles) - cortada */}
      <group>
        {/* Parte baja de la pared */}
        <mesh position={[length / 2, cutHeight / 2, wallThickness / 2]}>
          <boxGeometry args={[length, cutHeight, wallThickness]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallExterior} metalness={0.3} roughness={0.7} />
        </mesh>
        {/* Borde del corte (rojo) */}
        <mesh position={[length / 2, cutHeight, wallThickness / 2]}>
          <boxGeometry args={[length, 0.08, wallThickness + 0.02]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} metalness={0.2} roughness={0.5} />
        </mesh>
      </group>

      {/* Pared Sur - cortada */}
      <group>
        <mesh position={[length / 2, cutHeight / 2, width - wallThickness / 2]}>
          <boxGeometry args={[length, cutHeight, wallThickness]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallExterior} metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[length / 2, cutHeight, width - wallThickness / 2]}>
          <boxGeometry args={[length, 0.08, wallThickness + 0.02]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} metalness={0.2} roughness={0.5} />
        </mesh>
      </group>

      {/* Pared Este - cortada */}
      <group>
        <mesh position={[length - wallThickness / 2, cutHeight / 2, width / 2]}>
          <boxGeometry args={[wallThickness, cutHeight, width]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallExterior} metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[length - wallThickness / 2, cutHeight, width / 2]}>
          <boxGeometry args={[wallThickness + 0.02, 0.08, width]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} metalness={0.2} roughness={0.5} />
        </mesh>
      </group>

      {/* Pared Oeste - cortada */}
      <group>
        <mesh position={[wallThickness / 2, cutHeight / 2, width / 2]}>
          <boxGeometry args={[wallThickness, cutHeight, width]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallExterior} metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[wallThickness / 2, cutHeight, width / 2]}>
          <boxGeometry args={[wallThickness + 0.02, 0.08, width]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} metalness={0.2} roughness={0.5} />
        </mesh>
      </group>

      {/* === ESTRUCTURA DE CUBIERTA (visible pero sin techo) === */}
      
      {/* Cerchas principales */}
      {Array.from({ length: Math.ceil(length / 8) }).map((_, i) => {
        const x = (i + 0.5) * (length / Math.ceil(length / 8))
        return (
          <group key={`truss-${i}`}>
            {/* Viga principal IPE */}
            <mesh position={[x, height - 0.3, width / 2]}>
              <boxGeometry args={[0.35, 0.5, width - wallThickness * 2]} />
              <meshStandardMaterial 
                color={STRUCTURE_COLORS.roofFrame} 
                metalness={0.7} 
                roughness={0.3} 
              />
            </mesh>
            
            {/* Montantes verticales de la cercha */}
            {[-0.35, 0, 0.35].map((offset, j) => (
              <mesh key={`montante-${i}-${j}`} position={[x + offset, height - 0.6, width / 2]}>
                <boxGeometry args={[0.08, 0.6, width * 0.4]} />
                <meshStandardMaterial color={STRUCTURE_COLORS.beam} metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* Correas longitudinales (donde iría la cubierta) */}
      {Array.from({ length: Math.ceil(width / 3) }).map((_, i) => {
        const z = (i + 0.5) * (width / Math.ceil(width / 3))
        return (
          <mesh key={`purlin-${i}`} position={[length / 2, height - 0.1, z]}>
            <boxGeometry args={[length - wallThickness * 2, 0.12, 0.08]} />
            <meshStandardMaterial color={STRUCTURE_COLORS.beam} metalness={0.5} roughness={0.5} />
          </mesh>
        )
      })}

      {/* === COLUMNAS ESTRUCTURALES === */}
      
      {/* Columnas de las esquinas */}
      {[
        [wallThickness, wallThickness],
        [length - wallThickness, wallThickness],
        [wallThickness, width - wallThickness],
        [length - wallThickness, width - wallThickness]
      ].map(([x, z], i) => (
        <mesh key={`corner-col-${i}`} position={[x, height / 2, z]} castShadow>
          <boxGeometry args={[0.4, height, 0.4]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.column} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* Columnas intermedias (si las hay activas) */}
      {columns.filter(col => col.active).map(col => (
        <mesh key={col.id} position={[col.x, height / 2, col.z]} castShadow>
          <boxGeometry args={[0.4, height, 0.4]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.column} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* === INDICADOR DE ESCALA 3D === */}
      <Html position={[length + 2, height / 2, width / 2]} center>
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          background: 'rgba(45, 55, 72, 0.9)',
          color: 'white',
          padding: '8px 4px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {height}m ↕
        </div>
      </Html>
    </group>
  )
}

// =====================================================
// RENDERIZADOR DE ELEMENTOS
// =====================================================
function ElementRenderer({
  element,
  isSelected,
  isDragging,
  onPointerDown,
  viewMode,
  palletHeight
}) {
  const [hovered, setHover] = useState(false)

  const position = [element.position.x, 0, element.position.y]

  return (
    <group
      position={position}
      onPointerDown={(e) => onPointerDown(e, element)}
      onPointerOver={() => !isDragging && setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {element.type === 'shelf' && (
        <DetailedShelf
          element={element}
          isSelected={isSelected}
          showLabels={viewMode === '3D' || viewMode === 'Planta'}
          showPallets={viewMode === '3D'}
          palletHeight={palletHeight}
          viewMode={viewMode}
        />
      )}

      {element.type === 'office' && (
        <DetailedOffice
          element={element}
          isSelected={isSelected}
          showLabels={viewMode === '3D' || viewMode === 'Planta'}
          showInterior={viewMode === '3D'}
          viewMode={viewMode}
        />
      )}

      {element.type === 'dock' && (
        <DetailedDock
          element={element}
          isSelected={isSelected}
          showLabels={viewMode !== 'Perfil'}
          viewMode={viewMode}
        />
      )}

      {element.type === 'service_room' && (
        <DetailedServiceRooms
          element={element}
          isSelected={isSelected}
          showLabels={viewMode !== 'Perfil'}
          viewMode={viewMode}
        />
      )}

      {element.type === 'operational_zone' && (
        <DetailedOperationalZone
          element={element}
          isSelected={isSelected}
          showLabels={viewMode === '3D' || viewMode === 'Planta'}
          viewMode={viewMode}
        />
      )}

      {element.type === 'technical_room' && (
        <TechnicalRoom
          element={element}
          isSelected={isSelected}
          showLabels={viewMode !== 'Perfil'}
        />
      )}

      {/* Indicador de selección/hover */}
      {(isSelected || hovered) && !isDragging && (
        <SelectionIndicator element={element} isSelected={isSelected} />
      )}
    </group>
  )
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function TechnicalRoom({ element, isSelected, showLabels }) {
  const { largo = 4, ancho = 3, alto = 3 } = element.dimensions || {}
  const type = element.properties?.type || 'electrical'
  const label = element.properties?.label || 'Sala Técnica'

  const colors = {
    electrical: '#ecc94b',
    battery_charging: '#ed8936',
    default: '#a0aec0'
  }

  return (
    <group>
      <mesh position={[largo / 2, alto / 2, ancho / 2]} castShadow>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshStandardMaterial
          color={isSelected ? '#00ff88' : colors[type] || colors.default}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* Puerta */}
      <mesh position={[largo / 2, 1.1, 0.06]}>
        <boxGeometry args={[0.9, 2.1, 0.12]} />
        <meshStandardMaterial color="#4a5568" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Señal de peligro para sala eléctrica */}
      {type === 'electrical' && showLabels && (
        <Html position={[largo / 2, alto - 0.3, 0.1]} center>
          <div style={{
            background: '#ecc94b',
            color: '#000',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            border: '2px solid #000'
          }}>
            ⚠️ ALTA TENSIÓN
          </div>
        </Html>
      )}

      {showLabels && (
        <Html position={[largo / 2, alto + 0.6, ancho / 2]} center>
          <div style={{
            background: 'rgba(160, 174, 192, 0.95)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {type === 'electrical' ? '⚡' : '🔋'} {label}
          </div>
        </Html>
      )}
    </group>
  )
}

function SelectionIndicator({ element, isSelected }) {
  const dims = element.dimensions || {}
  const w = dims.length || dims.largo || dims.width || 1
  const d = dims.depth || dims.ancho || 1

  return (
    <mesh position={[w / 2, 0.03, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w + 0.5, d + 0.5]} />
      <meshBasicMaterial
        color={isSelected ? '#00ff88' : '#4299e1'}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function PreviewElement({ element }) {
  const dims = element.dimensions || {}
  const w = dims.largo || dims.length || dims.width || 2
  const d = dims.ancho || dims.depth || 2
  const h = dims.alto || dims.height || 3

  return (
    <group position={[element.position?.x || 0, 0, element.position?.y || 0]}>
      <mesh position={[w / 2, h / 2, d / 2]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color="#ecc94b" transparent opacity={0.4} wireframe />
      </mesh>
      <Html position={[w / 2, h + 1, d / 2]} center>
        <div style={{
          background: 'rgba(236, 201, 75, 0.95)',
          color: '#000',
          padding: '8px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 'bold'
        }}>
          ✨ Arrastra para colocar
        </div>
      </Html>
    </group>
  )
}

function ScaleIndicator({ dimensions }) {
  const { length, width } = dimensions

  return (
    <group position={[length - 12, 0.1, width + 4]}>
      <Line
        points={[[0, 0, 0], [10, 0, 0]]}
        color="#2d3748"
        lineWidth={4}
      />
      <Line points={[[0, 0, -0.4], [0, 0, 0.4]]} color="#2d3748" lineWidth={3} />
      <Line points={[[10, 0, -0.4], [10, 0, 0.4]]} color="#2d3748" lineWidth={3} />

      <Html position={[5, 0.3, 0]} center>
        <div style={{
          background: 'rgba(45, 55, 72, 0.95)',
          color: 'white',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: 'bold'
        }}>
          10 metros
        </div>
      </Html>

      <Html position={[5, 1.2, 0]} center>
        <div style={{
          background: 'rgba(45, 55, 72, 0.9)',
          color: 'white',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
            {length} × {width} m
          </div>
          <div style={{ opacity: 0.8, marginTop: '4px' }}>
            {(length * width).toLocaleString()} m²
          </div>
        </div>
      </Html>
    </group>
  )
}