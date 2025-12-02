/**
 * UNITNAVE Designer - Instanced Shelves
 * 
 * Renderizado optimizado de estanterías usando THREE.InstancedMesh
 * MEJORA DE RENDIMIENTO: Factor 10x para naves con muchas estanterías
 * 
 * En lugar de crear un <mesh> por cada estantería, se crea UN SOLO
 * InstancedMesh que renderiza TODAS las estanterías en una sola draw call.
 * 
 * @version 1.0
 */

import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Colores por zona ABC
const ZONE_COLORS = {
  A: new THREE.Color('#ef4444'), // Rojo - Alta rotación
  B: new THREE.Color('#f59e0b'), // Naranja - Media rotación
  C: new THREE.Color('#22c55e'), // Verde - Baja rotación
  default: new THREE.Color('#3b82f6') // Azul - Sin zona
}

/**
 * Componente principal de estanterías instanciadas
 * 
 * @param {Array} shelves - Array de estanterías con position, dimensions, zone
 * @param {boolean} showLabels - Mostrar etiquetas
 * @param {Function} onShelfClick - Handler de click
 * @param {string} selectedId - ID de estantería seleccionada
 */
export default function InstancedShelves({ 
  shelves = [], 
  showLabels = false,
  onShelfClick,
  selectedId = null
}) {
  const meshRef = useRef()
  const outlineRef = useRef()
  
  // Geometría compartida (memoizada)
  const geometry = useMemo(() => {
    // Geometría base de estantería (normalizada a 1x1x1)
    return new THREE.BoxGeometry(1, 1, 1)
  }, [])
  
  // Material compartido con soporte para instancias de color
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: false,
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.9
    })
  }, [])
  
  // Material para outline de selección
  const outlineMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#ffff00',
      transparent: true,
      opacity: 0.8,
      side: THREE.BackSide
    })
  }, [])
  
  // Matriz temporal para transformaciones
  const tempMatrix = useMemo(() => new THREE.Matrix4(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])
  
  // Actualizar instancias cuando cambian las estanterías
  useEffect(() => {
    if (!meshRef.current || shelves.length === 0) return
    
    const mesh = meshRef.current
    
    shelves.forEach((shelf, i) => {
      // Posición y escala
      const x = shelf.position?.x ?? shelf.x ?? 0
      const y = (shelf.dimensions?.height ?? 10) / 2 // Centrar en Y
      const z = shelf.position?.y ?? shelf.y ?? 0 // Y del layout = Z en 3D
      
      const scaleX = shelf.dimensions?.length ?? 2.7
      const scaleY = shelf.dimensions?.height ?? 10
      const scaleZ = shelf.dimensions?.depth ?? 1.1
      
      // Rotación
      const rotation = shelf.rotation ?? 0
      
      // Construir matriz de transformación
      tempMatrix.identity()
      tempMatrix.makeRotationY(rotation * Math.PI / 180)
      tempMatrix.setPosition(x + scaleX / 2, y, z + scaleZ / 2)
      tempMatrix.scale(new THREE.Vector3(scaleX, scaleY, scaleZ))
      
      mesh.setMatrixAt(i, tempMatrix)
      
      // Color según zona
      const zone = shelf.properties?.zone ?? shelf.zone ?? 'default'
      const color = ZONE_COLORS[zone] || ZONE_COLORS.default
      
      // Si está seleccionado, color amarillo
      if (shelf.id === selectedId) {
        mesh.setColorAt(i, new THREE.Color('#ffff00'))
      } else {
        mesh.setColorAt(i, color)
      }
    })
    
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    
  }, [shelves, selectedId, tempMatrix])
  
  // Actualizar outline de selección
  useEffect(() => {
    if (!outlineRef.current || !selectedId) return
    
    const selectedShelf = shelves.find(s => s.id === selectedId)
    if (!selectedShelf) {
      outlineRef.current.visible = false
      return
    }
    
    outlineRef.current.visible = true
    
    const x = selectedShelf.position?.x ?? selectedShelf.x ?? 0
    const y = (selectedShelf.dimensions?.height ?? 10) / 2
    const z = selectedShelf.position?.y ?? selectedShelf.y ?? 0
    
    const scaleX = (selectedShelf.dimensions?.length ?? 2.7) + 0.2
    const scaleY = (selectedShelf.dimensions?.height ?? 10) + 0.2
    const scaleZ = (selectedShelf.dimensions?.depth ?? 1.1) + 0.2
    
    outlineRef.current.position.set(x + scaleX / 2 - 0.1, y, z + scaleZ / 2 - 0.1)
    outlineRef.current.scale.set(scaleX, scaleY, scaleZ)
    
  }, [shelves, selectedId])
  
  // Handler de click en instancia
  const handleClick = (event) => {
    event.stopPropagation()
    
    if (!onShelfClick) return
    
    const instanceId = event.instanceId
    if (instanceId !== undefined && shelves[instanceId]) {
      onShelfClick(shelves[instanceId].id)
    }
  }
  
  if (shelves.length === 0) return null
  
  return (
    <group>
      {/* Mesh instanciado principal */}
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, shelves.length]}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        {/* Colores por instancia */}
        <instancedBufferAttribute
          attach="instanceColor"
          args={[new Float32Array(shelves.length * 3), 3]}
        />
      </instancedMesh>
      
      {/* Outline de selección */}
      <mesh
        ref={outlineRef}
        visible={false}
        material={outlineMaterial}
        geometry={geometry}
      />
      
      {/* Etiquetas (opcional, solo si hay pocas estanterías) */}
      {showLabels && shelves.length < 50 && shelves.map(shelf => (
        <ShelfLabel key={shelf.id} shelf={shelf} />
      ))}
    </group>
  )
}

/**
 * Componente de etiqueta para estantería individual
 */
function ShelfLabel({ shelf }) {
  const x = shelf.position?.x ?? shelf.x ?? 0
  const z = shelf.position?.y ?? shelf.y ?? 0
  const height = shelf.dimensions?.height ?? 10
  const label = shelf.properties?.label ?? shelf.label ?? shelf.id
  
  return (
    <group position={[x + 1.35, height + 1, z + 0.55]}>
      {/* Sprite con texto */}
      <sprite scale={[3, 1.5, 1]}>
        <spriteMaterial>
          <canvasTexture
            attach="map"
            image={createLabelCanvas(label)}
          />
        </spriteMaterial>
      </sprite>
    </group>
  )
}

/**
 * Crear canvas con texto para etiquetas
 */
function createLabelCanvas(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  
  const ctx = canvas.getContext('2d')
  
  // Fondo
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'
  ctx.roundRect(0, 0, 256, 128, 16)
  ctx.fill()
  
  // Texto
  ctx.fillStyle = 'white'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 64)
  
  return canvas
}

// ==================== COMPONENTE ALTERNATIVO PARA NAVES PEQUEÑAS ====================

/**
 * Versión no-instanciada para naves pequeñas (< 20 estanterías)
 * Permite más detalle visual pero menos rendimiento
 */
export function DetailedShelves({ shelves = [], onShelfClick, selectedId }) {
  return (
    <group>
      {shelves.map(shelf => (
        <DetailedShelf 
          key={shelf.id}
          shelf={shelf}
          isSelected={shelf.id === selectedId}
          onClick={() => onShelfClick?.(shelf.id)}
        />
      ))}
    </group>
  )
}

/**
 * Estantería individual con detalles (largueros, travesaños)
 */
function DetailedShelf({ shelf, isSelected, onClick }) {
  const x = shelf.position?.x ?? shelf.x ?? 0
  const z = shelf.position?.y ?? shelf.y ?? 0
  const length = shelf.dimensions?.length ?? 2.7
  const depth = shelf.dimensions?.depth ?? 1.1
  const height = shelf.dimensions?.height ?? 10
  const levels = shelf.properties?.levels ?? 5
  const zone = shelf.properties?.zone ?? 'default'
  
  const color = ZONE_COLORS[zone] || ZONE_COLORS.default
  const levelHeight = height / levels
  
  // Geometrías memoizadas
  const beamGeometry = useMemo(() => new THREE.BoxGeometry(length, 0.1, 0.05), [length])
  const postGeometry = useMemo(() => new THREE.BoxGeometry(0.08, height, 0.08), [height])
  const palletGeometry = useMemo(() => new THREE.BoxGeometry(1.2, 0.15, 0.8), [])
  
  return (
    <group 
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      {/* Postes verticales */}
      {[0, length].map((px, i) => (
        [0, depth].map((pz, j) => (
          <mesh 
            key={`post-${i}-${j}`}
            geometry={postGeometry}
            position={[px + 0.04, height / 2, pz + 0.04]}
          >
            <meshStandardMaterial color="#f97316" metalness={0.3} roughness={0.7} />
          </mesh>
        ))
      ))}
      
      {/* Travesaños horizontales por nivel */}
      {Array.from({ length: levels + 1 }).map((_, level) => (
        <group key={`level-${level}`} position={[0, level * levelHeight, 0]}>
          {/* Travesaños frontales y traseros */}
          {[0, depth].map((bz, i) => (
            <mesh
              key={`beam-${level}-${i}`}
              geometry={beamGeometry}
              position={[length / 2, 0.05, bz + 0.025]}
            >
              <meshStandardMaterial color="#fb923c" metalness={0.2} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      
      {/* Área de almacenamiento (semi-transparente) */}
      <mesh position={[length / 2, height / 2, depth / 2]}>
        <boxGeometry args={[length - 0.1, height - 0.1, depth - 0.1]} />
        <meshStandardMaterial 
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Outline de selección */}
      {isSelected && (
        <mesh position={[length / 2, height / 2, depth / 2]}>
          <boxGeometry args={[length + 0.2, height + 0.2, depth + 0.2]} />
          <meshBasicMaterial 
            color="#ffff00"
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  )
}

// ==================== SELECTOR AUTOMÁTICO ====================

/**
 * Componente que elige automáticamente entre versión instanciada y detallada
 * según el número de estanterías
 */
export function SmartShelves({ 
  shelves = [], 
  onShelfClick, 
  selectedId,
  threshold = 30 // Usar instancing si hay más de 30 estanterías
}) {
  if (shelves.length > threshold) {
    return (
      <InstancedShelves 
        shelves={shelves}
        onShelfClick={onShelfClick}
        selectedId={selectedId}
        showLabels={shelves.length < 100}
      />
    )
  }
  
  return (
    <DetailedShelves
      shelves={shelves}
      onShelfClick={onShelfClick}
      selectedId={selectedId}
    />
  )
}
