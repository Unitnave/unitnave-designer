import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls, Html } from '@react-three/drei'
import * as THREE from 'three'

import useWarehouseStore from '../stores/useWarehouseStore'
import useUIStore from '../stores/useUIStore'
import useCalculationsStore from '../stores/useCalculationsStore'

const VIEW_CONSTRAINTS = {
  '3D': { x: true, y: true, z: true },
  'Planta': { x: true, y: true, z: false },
  'Alzado': { x: true, y: false, z: true },
  'Perfil': { x: false, y: true, z: true }
}

export default function Warehouse3D() {
  const { dimensions, elements, columns } = useWarehouseStore()
  const { viewMode, selectedElement, selectElement, previewElement, showDistances } = useUIStore()
  const { getCurrentPallet } = useCalculationsStore()

  const { camera } = useThree()

  useEffect(() => {
    const { length, width, height } = dimensions
    
    switch(viewMode) {
      case 'Planta':
        camera.position.set(length/2, height * 2.5, width/2)
        camera.lookAt(length/2, 0, width/2)
        camera.up.set(0, 0, -1)
        break
      case 'Alzado':
        camera.position.set(length/2, height/2, width * 2)
        camera.lookAt(length/2, height/2, 0)
        camera.up.set(0, 1, 0)
        break
      case 'Perfil':
        camera.position.set(length * 2, height/2, width/2)
        camera.lookAt(0, height/2, width/2)
        camera.up.set(0, 1, 0)
        break
      default:
        camera.position.set(length * 1.1, height * 0.9, width * 1.1)
        camera.lookAt(length/2, height/3, width/2)
        camera.up.set(0, 1, 0)
    }
  }, [viewMode, dimensions, camera])

  return (
    <>
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[dimensions.length/2, 0, dimensions.width/2]}
        receiveShadow
        onClick={() => selectElement(null)}
      >
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshStandardMaterial color="#eceff1" />
      </mesh>

      <gridHelper 
        args={[Math.max(dimensions.length, dimensions.width), Math.max(dimensions.length, dimensions.width) / 5, '#90a4ae', '#cfd8dc']} 
        position={[dimensions.length/2, 0.01, dimensions.width/2]}
      />

      <WarehouseShell dimensions={dimensions} columns={columns} />

      <Dimensions dimensions={dimensions} />

      {previewElement && <PreviewElement element={previewElement} />}

      {elements.map(element => (
        <Element3D
          key={element.id}
          element={element}
          isSelected={selectedElement?.id === element.id}
          viewMode={viewMode}
          pallet={getCurrentPallet()}
          showDistances={showDistances && selectedElement?.id === element.id}
          warehouseDimensions={dimensions}
        />
      ))}

      <ambientLight intensity={0.65} />
      <directionalLight position={[30, 40, 30]} intensity={1.2} castShadow />
      <directionalLight position={[-20, 30, -20]} intensity={0.5} />
      <hemisphereLight intensity={0.6} groundColor="#b0bec5" />
    </>
  )
}

function WarehouseShell({ dimensions, columns }) {
  const { length, width, height } = dimensions

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
      <lineSegments position={[length/2, height/2, width/2]}>
        <edgesGeometry args={[new THREE.BoxGeometry(length, height, width)]} />
        <lineBasicMaterial color="#1976d2" linewidth={1.5} transparent opacity={0.4} />
      </lineSegments>

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

      {columns.filter(col => col.active).map((col) => (
        <mesh key={col.id} position={[col.x, height/2, col.z]} castShadow>
          <boxGeometry args={[0.3, height, 0.3]} />
          <meshStandardMaterial color="#78909c" metalness={0.5} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Dimensions({ dimensions }) {
  const { length, width, height } = dimensions

  return (
    <group>
      <Html position={[length/2, -1, -2]}>
        <div className="dimension-label">{length}m</div>
      </Html>
      <Html position={[-2, -1, width/2]}>
        <div className="dimension-label">{width}m</div>
      </Html>
      <Html position={[-2, height/2, -2]}>
        <div className="dimension-label height">H: {height}m</div>
      </Html>
    </group>
  )
}

function PreviewElement({ element }) {
  return (
    <group
      position={[element.position.x, element.position.z, element.position.y]}
      rotation={[0, element.position.rotation * Math.PI / 180, 0]}
    >
      {element.type === 'office' && (
        <mesh position={[element.dimensions.largo/2, element.dimensions.alto/2, element.dimensions.ancho/2]}>
          <boxGeometry args={[element.dimensions.largo, element.dimensions.alto, element.dimensions.ancho]} />
          <meshBasicMaterial color="#ffeb3b" transparent opacity={0.3} wireframe />
        </mesh>
      )}
      
      <Html position={[0, element.dimensions.alto + 1, 0]} center>
        <div className="preview-label">PREVIEW - Confirma para añadir</div>
      </Html>
    </group>
  )
}

function Element3D({ element, isSelected, viewMode, pallet, showDistances, warehouseDimensions }) {
  const meshRef = useRef()
  const transformRef = useRef()
  
  const { updateElement } = useWarehouseStore()
  const { selectElement } = useUIStore()

  const constraints = VIEW_CONSTRAINTS[viewMode]

  const handleDragEnd = () => {
    if (meshRef.current) {
      const pos = meshRef.current.position
      updateElement(element.id, {
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
          showX={constraints.x}
          showY={constraints.z}
          showZ={constraints.y}
        />
      )}
      
      <group
        ref={meshRef}
        position={[element.position.x, element.position.z, element.position.y]}
        rotation={[0, element.position.rotation * Math.PI / 180, 0]}
        onClick={(e) => {
          e.stopPropagation()
          selectElement(element)
        }}
      >
        {element.type === 'shelf' && <ShelfMesh element={element} isSelected={isSelected} pallet={pallet} />}
        {element.type === 'office' && <OfficeMesh element={element} isSelected={isSelected} />}
        {element.type === 'dock' && <DockMesh element={element} isSelected={isSelected} />}
      </group>
    </group>
  )
}

function ShelfMesh({ element, isSelected, pallet }) {
  const { length, height, depth, levels } = element.dimensions
  const color = isSelected ? '#ff9800' : '#ff6b35'

  const palletsPerLevel = Math.floor((length / pallet.length) * (depth / pallet.width))
  const totalPallets = palletsPerLevel * levels

  return (
    <group>
      {[0, length].map((x, i) => 
        [0, depth].map((z, j) => (
          <mesh key={`post-${i}-${j}`} position={[x, height/2, z]} castShadow>
            <boxGeometry args={[0.1, height, 0.1]} />
            <meshStandardMaterial color={color} metalness={0.85} roughness={0.15} />
          </mesh>
        ))
      )}

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

          <Html position={[length/2, height/2, depth/2]} center>
            <div className="capacity-label">{totalPallets} palets</div>
          </Html>
        </>
      )}
    </group>
  )
}

function OfficeMesh({ element, isSelected }) {
  const { largo, ancho, alto } = element.dimensions
  const color = isSelected ? '#42a5f5' : '#1e88e5'

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
          transmission={0.3}
        />
      </mesh>

      <mesh position={[largo/2, alto * 0.65, ancho/2 + ancho/2 + 0.02]}>
        <planeGeometry args={[largo * 0.7, alto * 0.3]} />
        <meshBasicMaterial color="#81d4fa" transparent opacity={0.6} />
      </mesh>

      <mesh position={[largo * 0.2, 1.1, ancho/2 + ancho/2 + 0.01]}>
        <planeGeometry args={[1, 2.2]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>

      {isSelected && (
        <>
          <lineSegments position={[largo/2, alto/2, ancho/2]}>
            <edgesGeometry args={[new THREE.BoxGeometry(largo, alto, ancho)]} />
            <lineBasicMaterial color="#ffeb3b" linewidth={2} />
          </lineSegments>

          <Html position={[largo/2, alto + 0.5, ancho/2]} center>
            <div className="element-label">
              OFICINA<br/>
              {largo}m × {ancho}m × {alto}m<br/>
              {(largo * ancho).toFixed(1)} m²
            </div>
          </Html>
        </>
      )}
    </group>
  )
}

function DockMesh({ element, isSelected }) {
  const { width, height, depth, maneuverZone } = element.dimensions
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

      <mesh position={[0, 0.01, -maneuverZone/2]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[width, maneuverZone]} />
        <meshBasicMaterial 
          color="#ff1744" 
          transparent 
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      <gridHelper 
        args={[maneuverZone, 10, '#ff1744', '#ff5252']} 
        position={[0, 0.02, -maneuverZone/2]}
      />

      {isSelected && (
        <>
          <lineSegments position={[0, height/2, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
            <lineBasicMaterial color="#ffeb3b" linewidth={2} />
          </lineSegments>

          <Html position={[0, height + 0.5, -maneuverZone/2]} center>
            <div className="element-label maneuver">
              Zona maniobra: {maneuverZone}m
            </div>
          </Html>
        </>
      )}
    </group>
  )
}