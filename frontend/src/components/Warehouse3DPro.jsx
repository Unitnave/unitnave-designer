/** 
 * UNITNAVE Designer - Visualizador 3D Profesional
 * FINAL MODIFICADO: 
 * - Luz profesional
 * - Suelo claro
 * - Columnas al 20%
 * - Cámara fija al centro
 */

import { useRef, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
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

// Colores CLAROS y profesionales
const STRUCTURE_COLORS = {
  wallExterior: '#e2e8f0',
  wallInterior: '#f8fafc',
  wallCut: '#fca5a5',
  column: '#cbd5e1',
  beam: '#94a3b8',
  roofFrame: '#64748b',
}

export default function Warehouse3DPro() {
  const { dimensions, elements, updateElement } = useWarehouseStore()
  const { viewMode, selectedElement, selectElement, previewElement } = useUIStore()
  const { camera, gl, controls } = useThree()

  const groupRef = useRef()

  // ========================
  // 🔥 Cámara fija al centro
  // ========================
  useEffect(() => {
    if (controls && dimensions) {
      controls.target.set(dimensions.length / 2, 0, dimensions.width / 2)
      controls.update()
    }
  }, [controls, dimensions])

  // Estado de drag & drop
  const dragState = useRef({
    isDragging: false,
    draggedElement: null,
    offset: new THREE.Vector3()
  })

  // ========================
  // 🔥 Luz profesional
  // ========================
  useEffect(() => {
    const scene = groupRef.current?.parent

    if (!scene) return

    // Eliminar luces antiguas
    scene.children = scene.children.filter(obj => !obj.isLight)

    const amb = new THREE.AmbientLight('#ffffff', 0.55)
    scene.add(amb)

    const sun = new THREE.DirectionalLight('#ffffff', 1.25)
    sun.position.set(25, 30, 15)
    sun.castShadow = true
    sun.shadow.mapSize.width = 2048
    sun.shadow.mapSize.height = 2048
    scene.add(sun)

    const fill = new THREE.DirectionalLight('#ffffff', 0.55)
    fill.position.set(-20, 15, -10)
    scene.add(fill)

    const hemi = new THREE.HemisphereLight('#e0f2fe', '#cbd5e1', 1)
    scene.add(hemi)
  }, [])

  // Posiciones de muelles
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

  const aisleWidth = useCalculationsStore(state => state.aisleWidth) || 2.8

  // ========================
  // 🔥 Drag & drop
  // ========================
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
    e.stopPropagation()

    const newX = e.point.x + dragState.current.offset.x
    const newZ = e.point.z + dragState.current.offset.z
    const clampedX = Math.max(0, Math.min(dimensions.length, newX))
    const clampedZ = Math.max(0, Math.min(dimensions.width, newZ))

    updateElement(dragState.current.draggedElement.id, {
      position: { x: clampedX, y: clampedZ }
    })
  }

  // ========================
  // 🔥 Columnas al 20%
  // ========================
  const colSpacingX = dimensions.length * 0.20
  const colSpacingZ = dimensions.width * 0.20

  const cutHeight = dimensions.height * 0.85
  const showLabels = viewMode === '3D' || viewMode === 'Planta'

  return (
    <group ref={groupRef}>

      {/* ========================
        Suelo claro base
      ======================== */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[dimensions.length / 2, -0.02, dimensions.width / 2]}
        receiveShadow
      >
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshStandardMaterial color="#e5e5e5" roughness={0.9} />
      </mesh>

      {/* Plano interactivo */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[dimensions.length / 2, 0, dimensions.width / 2]}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[dimensions.length * 2, dimensions.width * 2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* SUELO INDUSTRIAL ORIGINAL */}
      <IndustrialFloor
        dimensions={dimensions}
        dockPositions={dockPositions}
        aisleWidth={aisleWidth}
      />

      {/* PAREDES */}
      <group>
        {/* Norte */}
        <mesh position={[dimensions.length / 2, cutHeight / 2, 0]}>
          <boxGeometry args={[dimensions.length, cutHeight, 0.2]} />
          <meshStandardMaterial 
            color={STRUCTURE_COLORS.wallExterior}
            transparent
            opacity={0.3}
            roughness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Sur */}
        <mesh position={[dimensions.length / 2, cutHeight / 2, dimensions.width]}>
          <boxGeometry args={[dimensions.length, cutHeight, 0.2]} />
          <meshStandardMaterial 
            color={STRUCTURE_COLORS.wallExterior}
            transparent
            opacity={0.3}
            roughness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Oeste */}
        <mesh position={[0, cutHeight / 2, dimensions.width / 2]}>
          <boxGeometry args={[0.2, cutHeight, dimensions.width]} />
          <meshStandardMaterial 
            color={STRUCTURE_COLORS.wallExterior}
            transparent
            opacity={0.3}
            roughness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Este */}
        <mesh position={[dimensions.length, cutHeight / 2, dimensions.width / 2]}>
          <boxGeometry args={[0.2, cutHeight, dimensions.width]} />
          <meshStandardMaterial 
            color={STRUCTURE_COLORS.wallExterior}
            transparent
            opacity={0.3}
            roughness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* COLUMNAS → cada 20% */}
      <group>
        {(() => {
          const cols = []
          for (let x = 0; x <= dimensions.length; x += colSpacingX) {
            for (let z = 0; z <= dimensions.width; z += colSpacingZ) {
              cols.push(
                <mesh key={`col-${x}-${z}`} position={[x, dimensions.height / 2, z]}>
                  <boxGeometry args={[0.4, dimensions.height, 0.4]} />
                  <meshStandardMaterial 
                    color={STRUCTURE_COLORS.column}
                    transparent
                    opacity={0.55}
                    roughness={0.6}
                  />
                </mesh>
              )
            }
          }
          return cols
        })()}
      </group>

      {/* CERCHAS */}
      <group position={[0, dimensions.height - 0.3, 0]}>
        {Array.from({ length: Math.floor(dimensions.length / 8) }).map((_, i) => (
          <mesh key={`truss-${i}`} position={[(i + 1) * 8, 0, dimensions.width / 2]}>
            <boxGeometry args={[0.3, 0.6, dimensions.width]} />
            <meshStandardMaterial 
              color={STRUCTURE_COLORS.roofFrame}
              roughness={0.5}
              transparent
              opacity={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* ELEMENTOS INTERNOS */}
      <group>
        {elements.map(element => {
          const isSelected = selectedElement?.id === element.id
          const props = {
            key: element.id,
            element,
            isSelected,
            showLabels,
            viewMode,
            onPointerDown: (e) => handlePointerDown(e, element)
          }

          switch (element.type) {
            case 'shelf': return <DetailedShelf {...props} />
            case 'office': return <DetailedOffice {...props} />
            case 'dock': return <DetailedDock {...props} />
            case 'service_room': return <DetailedServiceRooms {...props} />
            case 'operational_zone': return <DetailedOperationalZone {...props} />
            default: return null
          }
        })}
      </group>

      {/* PREVIEW */}
      {previewElement && (
        <group position={[previewElement.position.x, 0, previewElement.position.y]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[
              previewElement.dimensions?.length || 5,
              1,
              previewElement.dimensions?.width || 5
            ]} />
            <meshStandardMaterial color="#3b82f6" transparent opacity={0.5} wireframe />
          </mesh>
        </group>
      )}

      {/* GRID */}
      {viewMode === 'Planta' && (
        <gridHelper
          args={[Math.max(dimensions.length, dimensions.width), 20, '#cbd5e1', '#e2e8f0']}
          position={[dimensions.length / 2, 0.01, dimensions.width / 2]}
        />
      )}
    </group>
  )
}
