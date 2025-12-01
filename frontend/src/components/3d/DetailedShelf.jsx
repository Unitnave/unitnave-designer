/**
 * UNITNAVE Designer - DetailedShelf v2.0
 * 
 * Estantería industrial realista con INSTANCING AUTOMÁTICO
 * 
 * VISUAL:
 * - Postes verticales AZULES (#1a5fb4)
 * - Largueros horizontales NARANJAS (#ff7800)
 * - Palets EUR de madera con carga
 * - Estructura abierta (no cubos sólidos)
 * 
 * RENDIMIENTO:
 * - Umbral automático: >200 palets → InstancedMesh
 * - Sin cambios en la API del componente
 * - Usuario no nota diferencia visual
 */

import React, { useRef, useMemo, useEffect } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// ==================== CONSTANTES ====================

const COLORS = {
  post: '#1a5fb4',        // Azul industrial (bastidores)
  beam: '#ff7800',        // Naranja Mecalux (largueros)
  connector: '#ffd700',   // Amarillo seguridad
  palletWood: '#c9a66b',  // Madera palet
  palletSlat: '#b8956a',  // Listones
  cardboard: '#d4a574',   // Cajas cartón
  plastic: '#3498db',     // Cajas plástico azul
  wrapped: '#c8e6c9',     // Retractilado verde
  mixed: '#a0522d'        // Carga mixta
}

const DIMENSIONS = {
  POST_WIDTH: 0.10,
  POST_DEPTH: 0.08,
  BEAM_HEIGHT: 0.12,
  BEAM_DEPTH: 0.05,
  PALLET_LENGTH: 1.2,
  PALLET_WIDTH: 0.8,
  PALLET_HEIGHT: 0.144,
  DIAGONAL_SIZE: 0.03
}

// Umbral para activar instancing
const INSTANCING_THRESHOLD = 200

// ==================== GEOMETRÍAS COMPARTIDAS ====================

const sharedGeometries = {
  post: new THREE.BoxGeometry(DIMENSIONS.POST_WIDTH, 1, DIMENSIONS.POST_DEPTH),
  beam: new THREE.BoxGeometry(1, DIMENSIONS.BEAM_HEIGHT, DIMENSIONS.BEAM_DEPTH),
  pallet: new THREE.BoxGeometry(DIMENSIONS.PALLET_LENGTH, DIMENSIONS.PALLET_HEIGHT, DIMENSIONS.PALLET_WIDTH),
  cargo: new THREE.BoxGeometry(DIMENSIONS.PALLET_LENGTH * 0.9, 1, DIMENSIONS.PALLET_WIDTH * 0.9),
  connector: new THREE.BoxGeometry(0.08, 0.08, 0.08)
}

const sharedMaterials = {
  post: new THREE.MeshStandardMaterial({ color: COLORS.post, roughness: 0.6 }),
  beam: new THREE.MeshStandardMaterial({ color: COLORS.beam, roughness: 0.5 }),
  connector: new THREE.MeshStandardMaterial({ color: COLORS.connector, roughness: 0.4 }),
  palletWood: new THREE.MeshStandardMaterial({ color: COLORS.palletWood, roughness: 0.8 }),
  cardboard: new THREE.MeshStandardMaterial({ color: COLORS.cardboard, roughness: 0.9 }),
  plastic: new THREE.MeshStandardMaterial({ color: COLORS.plastic, roughness: 0.3 }),
  wrapped: new THREE.MeshStandardMaterial({ color: COLORS.wrapped, roughness: 0.4, transparent: true, opacity: 0.85 }),
  mixed: new THREE.MeshStandardMaterial({ color: COLORS.mixed, roughness: 0.7 })
}

// ==================== COMPONENTE PALET INDIVIDUAL ====================

function SinglePallet({ position, cargoType = 'cardboard', cargoHeight = 1.2 }) {
  const cargoMaterial = sharedMaterials[cargoType] || sharedMaterials.cardboard
  
  return (
    <group position={position}>
      {/* Base palet */}
      <mesh geometry={sharedGeometries.pallet} material={sharedMaterials.palletWood} position={[0, DIMENSIONS.PALLET_HEIGHT / 2, 0]} />
      
      {/* Carga */}
      <mesh position={[0, DIMENSIONS.PALLET_HEIGHT + cargoHeight / 2, 0]}>
        <boxGeometry args={[DIMENSIONS.PALLET_LENGTH * 0.9, cargoHeight, DIMENSIONS.PALLET_WIDTH * 0.9]} />
        <meshStandardMaterial {...cargoMaterial} />
      </mesh>
    </group>
  )
}

// ==================== INSTANCED PALLETS ====================

function InstancedPallets({ positions, cargoType = 'cardboard', cargoHeight = 1.2 }) {
  const palletRef = useRef()
  const cargoRef = useRef()
  
  const count = positions.length
  
  const cargoColor = useMemo(() => {
    const colors = {
      cardboard: COLORS.cardboard,
      plastic: COLORS.plastic,
      wrapped: COLORS.wrapped,
      mixed: COLORS.mixed
    }
    return colors[cargoType] || COLORS.cardboard
  }, [cargoType])
  
  useEffect(() => {
    if (!palletRef.current || !cargoRef.current) return
    
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3(1, 1, 1)
    
    positions.forEach((pos, i) => {
      // Palet base
      tempPosition.set(pos[0], pos[1] + DIMENSIONS.PALLET_HEIGHT / 2, pos[2])
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
      palletRef.current.setMatrixAt(i, tempMatrix)
      
      // Carga
      tempPosition.set(pos[0], pos[1] + DIMENSIONS.PALLET_HEIGHT + cargoHeight / 2, pos[2])
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
      cargoRef.current.setMatrixAt(i, tempMatrix)
    })
    
    palletRef.current.instanceMatrix.needsUpdate = true
    cargoRef.current.instanceMatrix.needsUpdate = true
  }, [positions, cargoHeight])
  
  if (count === 0) return null
  
  return (
    <group>
      {/* Palets instanciados */}
      <instancedMesh ref={palletRef} args={[sharedGeometries.pallet, sharedMaterials.palletWood, count]} />
      
      {/* Cargas instanciadas */}
      <instancedMesh ref={cargoRef} args={[null, null, count]}>
        <boxGeometry args={[DIMENSIONS.PALLET_LENGTH * 0.9, cargoHeight, DIMENSIONS.PALLET_WIDTH * 0.9]} />
        <meshStandardMaterial color={cargoColor} roughness={0.7} />
      </instancedMesh>
    </group>
  )
}

// ==================== INSTANCED POSTS ====================

function InstancedPosts({ positions, height }) {
  const ref = useRef()
  const count = positions.length
  
  useEffect(() => {
    if (!ref.current) return
    
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3(1, height, 1)
    
    positions.forEach((pos, i) => {
      tempPosition.set(pos[0], height / 2, pos[2])
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
      ref.current.setMatrixAt(i, tempMatrix)
    })
    
    ref.current.instanceMatrix.needsUpdate = true
  }, [positions, height])
  
  if (count === 0) return null
  
  return <instancedMesh ref={ref} args={[sharedGeometries.post, sharedMaterials.post, count]} />
}

// ==================== INSTANCED BEAMS ====================

function InstancedBeams({ beams }) {
  const ref = useRef()
  const count = beams.length
  
  useEffect(() => {
    if (!ref.current) return
    
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3()
    
    beams.forEach((beam, i) => {
      tempPosition.set(beam.x, beam.y, beam.z)
      tempScale.set(beam.length, 1, 1)
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
      ref.current.setMatrixAt(i, tempMatrix)
    })
    
    ref.current.instanceMatrix.needsUpdate = true
  }, [beams])
  
  if (count === 0) return null
  
  return <instancedMesh ref={ref} args={[sharedGeometries.beam, sharedMaterials.beam, count]} />
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function DetailedShelf({
  element,
  isSelected = false,
  showLabels = true,
  showPallets = true,
  palletOccupancy = 0.85,
  palletHeight = 1.5,
  viewMode = '3d'
}) {
  const { position, dimensions, properties } = element
  
  // V5.4: Obtener rotación (0 = horizontal, 90 = vertical/perpendicular)
  const rotation = properties?.rotation || 0
  const isVertical = rotation === 90
  
  // V5.4: Usar dimensiones tal como vienen del backend
  // Para racks verticales: length es pequeño (~1.1), depth es la longitud real
  // Para racks horizontales: length es la longitud real, depth es pequeño (~1.1)
  const rawLength = dimensions?.length || 10
  const rawDepth = dimensions?.depth || 1.1
  
  // Para el cálculo de estructura, usamos la dimensión más larga como "longitud"
  const length = isVertical ? rawDepth : rawLength
  const depth = isVertical ? rawLength : rawDepth
  
  const height = dimensions?.height || 8
  const levels = dimensions?.levels || Math.floor((height - 0.5) / (palletHeight + 0.25))
  
  // Calcular estructura
  const { posts, beams, palletPositions, totalPallets, useInstancing } = useMemo(() => {
    const levelHeight = palletHeight + 0.25
    const actualLevels = Math.min(levels, Math.floor((height - 0.5) / levelHeight))
    
    // Postes cada 2.7m (cada 2 palets)
    const postSpacing = 2.7
    const numPostPairs = Math.max(2, Math.ceil(length / postSpacing) + 1)
    
    const posts = []
    const beams = []
    const palletPositions = []
    
    // Generar postes
    for (let i = 0; i < numPostPairs; i++) {
      const x = Math.min(i * postSpacing, length)
      posts.push({ x, z: 0 })
      posts.push({ x, z: depth })
    }
    
    // Generar largueros y posiciones de palets por nivel
    for (let level = 0; level < actualLevels; level++) {
      const y = 0.3 + level * levelHeight
      
      // Largueros frontales y traseros
      beams.push({ x: length / 2, y, z: 0, length })
      beams.push({ x: length / 2, y, z: depth, length })
      
      // Posiciones de palets en este nivel
      const palletsInLength = Math.floor(length / DIMENSIONS.PALLET_LENGTH)
      const palletsInDepth = Math.floor(depth / DIMENSIONS.PALLET_WIDTH)
      
      for (let px = 0; px < palletsInLength; px++) {
        for (let pz = 0; pz < palletsInDepth; pz++) {
          // Aplicar ocupación aleatoria
          if (Math.random() < palletOccupancy) {
            const palletX = px * DIMENSIONS.PALLET_LENGTH + DIMENSIONS.PALLET_LENGTH / 2
            const palletZ = pz * DIMENSIONS.PALLET_WIDTH + DIMENSIONS.PALLET_WIDTH / 2
            palletPositions.push([palletX, y + DIMENSIONS.BEAM_HEIGHT, palletZ])
          }
        }
      }
    }
    
    const totalPallets = palletPositions.length
    const useInstancing = totalPallets > INSTANCING_THRESHOLD
    
    return { posts, beams, palletPositions, totalPallets, useInstancing }
  }, [length, depth, height, levels, palletHeight, palletOccupancy])
  
  // Tipo de carga aleatorio pero consistente
  const cargoType = useMemo(() => {
    const types = ['cardboard', 'plastic', 'wrapped', 'mixed']
    return types[Math.floor((position?.x || 0) % 4)]
  }, [position?.x])
  
  // Vista planta: solo rectángulo
  if (viewMode === 'planta') {
    // V5.4: Para vista planta, mostramos el rectángulo con las dimensiones correctas
    // Sin rotación, solo intercambiamos width/height del plano según orientación
    const planeArgs = isVertical ? [depth, length] : [length, depth]
    
    return (
      <group position={[position?.x || 0, 0.01, position?.y || 0]}>
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[planeArgs[0] / 2, 0, planeArgs[1] / 2]}
        >
          <planeGeometry args={planeArgs} />
          <meshStandardMaterial 
            color={isSelected ? '#fbbf24' : COLORS.beam} 
            transparent 
            opacity={0.7} 
          />
        </mesh>
        {showLabels && (
          <Html position={[planeArgs[0] / 2, 0.5, planeArgs[1] / 2]} center>
            <div style={{
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              whiteSpace: 'nowrap'
            }}>
              {properties?.label || 'Rack'} ({totalPallets}p)
            </div>
          </Html>
        )}
      </group>
    )
  }
  
  // Vista 3D completa
  // V5.4: Para estanterías verticales (perpendiculares a muelles),
  // dibujamos normal y aplicamos rotación, compensando posición
  
  return (
    <group 
      position={[position?.x || 0, 0, position?.y || 0]}
      rotation={isVertical ? [0, Math.PI / 2, 0] : [0, 0, 0]}
    >
      {/* ========== ESTRUCTURA ========== */}
      
      {/* Postes - instanciados o individuales */}
      {useInstancing ? (
        <InstancedPosts positions={posts.map(p => ({ x: p.x, z: p.z }))} height={height} />
      ) : (
        posts.map((post, i) => (
          <mesh
            key={`post-${i}`}
            position={[post.x, height / 2, post.z]}
            geometry={sharedGeometries.post}
            material={sharedMaterials.post}
            scale={[1, height, 1]}
          />
        ))
      )}
      
      {/* Largueros - instanciados o individuales */}
      {useInstancing ? (
        <InstancedBeams beams={beams} />
      ) : (
        beams.map((beam, i) => (
          <mesh
            key={`beam-${i}`}
            position={[beam.x, beam.y, beam.z]}
            scale={[beam.length, 1, 1]}
            geometry={sharedGeometries.beam}
            material={sharedMaterials.beam}
          />
        ))
      )}
      
      {/* Conectores en extremos de largueros */}
      {beams.filter((_, i) => i < 8).map((beam, i) => (
        <group key={`conn-${i}`}>
          <mesh
            position={[0.05, beam.y, beam.z]}
            geometry={sharedGeometries.connector}
            material={sharedMaterials.connector}
          />
          <mesh
            position={[length - 0.05, beam.y, beam.z]}
            geometry={sharedGeometries.connector}
            material={sharedMaterials.connector}
          />
        </group>
      ))}
      
      {/* Diagonales de refuerzo (solo primeros bastidores) */}
      {posts.slice(0, 4).map((post, i) => (
        <mesh
          key={`diag-${i}`}
          position={[post.x, height * 0.4, post.z]}
          rotation={[0, 0, Math.PI / 4]}
        >
          <boxGeometry args={[DIMENSIONS.DIAGONAL_SIZE, height * 0.3, DIMENSIONS.DIAGONAL_SIZE]} />
          <meshStandardMaterial color={COLORS.post} roughness={0.6} />
        </mesh>
      ))}
      
      {/* Placas base */}
      {posts.map((post, i) => (
        <mesh key={`base-${i}`} position={[post.x, 0.01, post.z]}>
          <boxGeometry args={[0.2, 0.02, 0.15]} />
          <meshStandardMaterial color="#4a5568" roughness={0.8} />
        </mesh>
      ))}
      
      {/* ========== PALETS ========== */}
      
      {showPallets && (
        useInstancing ? (
          <InstancedPallets 
            positions={palletPositions} 
            cargoType={cargoType} 
            cargoHeight={palletHeight * 0.7} 
          />
        ) : (
          palletPositions.map((pos, i) => (
            <SinglePallet
              key={`pallet-${i}`}
              position={pos}
              cargoType={cargoType}
              cargoHeight={palletHeight * 0.7}
            />
          ))
        )
      )}
      
      {/* ========== INDICADOR DE SELECCIÓN ========== */}
      
      {isSelected && (
        <mesh position={[length / 2, 0.02, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[length + 0.5, depth + 0.5]} />
          <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
        </mesh>
      )}
      
      {/* ========== ETIQUETA ========== */}
      
      {showLabels && (
        <Html position={[length / 2, height + 0.5, depth / 2]} center>
          <div style={{
            background: useInstancing ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0,0,0,0.85)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            {properties?.label || 'Rack'} • {totalPallets} palets
            {useInstancing && <span style={{ marginLeft: '4px', fontSize: '9px' }}>⚡</span>}
          </div>
        </Html>
      )}
    </group>
  )
}

// ==================== EXPORTS ====================

export { COLORS, DIMENSIONS, INSTANCING_THRESHOLD }
