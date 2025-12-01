/**
 * UNITNAVE Designer - Visualizador 3D Profesional
 * FINAL: Paredes transparentes, colores claros, funcionalidad completa
 * V5.3: Añadidas cotas/medidas en vista planta
 */

import { useRef, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
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
  wallExterior: '#e2e8f0', // Gris muy claro
  wallInterior: '#f8fafc', // Casi blanco
  wallCut: '#fca5a5',      // Rojo suave para corte
  column: '#cbd5e1',       // Columnas claras
  beam: '#94a3b8',         // Vigas claras
  roofFrame: '#64748b',    // Cerchas claras
}

export default function Warehouse3DPro() {
  const { dimensions, elements, updateElement } = useWarehouseStore()
  const { viewMode, selectedElement, selectElement, previewElement } = useUIStore()
  const { gl, controls } = useThree()

  const groupRef = useRef()

  // Estado de drag & drop
  const dragState = useRef({
    isDragging: false,
    draggedElement: null,
    offset: new THREE.Vector3()
  })

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

    e.stopPropagation()

    const newX = e.point.x + dragState.current.offset.x
    const newZ = e.point.z + dragState.current.offset.z

    const clampedX = Math.max(0, Math.min(dimensions.length, newX))
    const clampedZ = Math.max(0, Math.min(dimensions.width, newZ))

    updateElement(dragState.current.draggedElement.id, {
      position: { x: clampedX, y: clampedZ }
    })
  }

  const cutHeight = dimensions.height * 0.85
  // Forzamos SIN leyendas en todo el 3D (y planta)
  const showLabels = false

  // columnas cada 20% de la longitud/anchura,
  // pero mínimo 25 metros para no llenar naves pequeñas de pilares
  const colSpacingX = Math.max(dimensions.length * 0.2, 25)
  const colSpacingZ = Math.max(dimensions.width * 0.2, 25)

  return (
    <group ref={groupRef}>

      {/* 🔆 LUCES BÁSICAS PARA QUE TODO SE VEA */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[20, 30, 20]}
        intensity={1.2}
        castShadow
      />
      <hemisphereLight
        skyColor={'#dbeafe'}
        groundColor={'#cbd5e1'}
        intensity={0.8}
      />

      {/* Plano interactivo para drag & drop */}
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

      {/* 🔳 SUELO CLARO BASE, para evitar “todo negro” */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[dimensions.length / 2, -0.01, dimensions.width / 2]}
        receiveShadow
      >
        <planeGeometry args={[dimensions.length, dimensions.width]} />
        <meshStandardMaterial color="#e5e5e5" roughness={0.9} />
      </mesh>

      {/* ========== SUELO INDUSTRIAL ========== */}
      <IndustrialFloor
        dimensions={dimensions}
        dockPositions={dockPositions}
        aisleWidth={aisleWidth}
      />

      {/* ========== ESTRUCTURA DE LA NAVE ========== */}

      {/* Paredes - TRANSPARENTES Y CLARAS */}
      <group>
        {/* Pared norte */}
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

        {/* Pared sur */}
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

        {/* Pared oeste */}
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

        {/* Pared este */}
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

        {/* Líneas de corte superior (efecto maqueta) */}
        <mesh
          position={[dimensions.length / 2, cutHeight, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[dimensions.length + 0.4, 0.1]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} />
        </mesh>
        <mesh
          position={[dimensions.length / 2, cutHeight, dimensions.width]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[dimensions.length + 0.4, 0.1]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} />
        </mesh>
        <mesh
          position={[0, cutHeight, dimensions.width / 2]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[dimensions.width + 0.4, 0.1]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} />
        </mesh>
        <mesh
          position={[dimensions.length, cutHeight, dimensions.width / 2]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[dimensions.width + 0.4, 0.1]} />
          <meshStandardMaterial color={STRUCTURE_COLORS.wallCut} />
        </mesh>
      </group>

      {/* Columnas estructurales - PERÍMETRO COMPLETO + INTERIOR con spacing adaptado */}
      <group>
        {(() => {
          const columnas = []
          const used = new Set()

          const addColumn = (x, z) => {
            const key = `${x.toFixed(3)}-${z.toFixed(3)}`
            if (used.has(key)) return
            used.add(key)
            columnas.push(
              <mesh key={`col-${key}`} position={[x, dimensions.height / 2, z]}>
                <boxGeometry args={[0.4, dimensions.height, 0.4]} />
                <meshStandardMaterial
                  color={STRUCTURE_COLORS.column}
                  roughness={0.6}
                  transparent
                  opacity={0.5}
                />
              </mesh>
            )
          }

          // Posiciones en X
          const xPositions = []
          if (dimensions.length <= colSpacingX) {
            xPositions.push(0, dimensions.length)
          } else {
            for (let x = 0; x <= dimensions.length; x += colSpacingX) {
              xPositions.push(x)
            }
            if (xPositions[xPositions.length - 1] !== dimensions.length) {
              xPositions.push(dimensions.length)
            }
          }

          // Posiciones en Z
          const zPositions = []
          if (dimensions.width <= colSpacingZ) {
            zPositions.push(0, dimensions.width)
          } else {
            for (let z = 0; z <= dimensions.width; z += colSpacingZ) {
              zPositions.push(z)
            }
            if (zPositions[zPositions.length - 1] !== dimensions.width) {
              zPositions.push(dimensions.width)
            }
          }

          // Generar columnas en todas las combinaciones (perímetro + interior)
          for (const x of xPositions) {
            for (const z of zPositions) {
              addColumn(x, z)
            }
          }

          return columnas
        })()}
      </group>

      {/* Cerchas de cubierta */}
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

      {/* ========== ELEMENTOS 3D ========== */}
      <group>
        {elements.map(element => {
          const isSelected = selectedElement?.id === element.id
          const commonProps = {
            key: element.id,
            element,
            isSelected,
            showLabels, // ahora siempre false
            viewMode,
            onPointerDown: (e) => handlePointerDown(e, element)
          }

          switch (element.type) {
            case 'shelf':
              return <DetailedShelf {...commonProps} />
            case 'office':
              return <DetailedOffice {...commonProps} />
            case 'dock':
              return <DetailedDock {...commonProps} />
            case 'service_room':
              return <DetailedServiceRooms {...commonProps} />
            case 'operational_zone':
              return <DetailedOperationalZone {...commonProps} />
            default:
              return null
          }
        })}
      </group>

      {/* Elemento en preview (cuando se está añadiendo) */}
      {previewElement && (
        <group position={[previewElement.position.x, 0, previewElement.position.y]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry
              args={[
                previewElement.dimensions?.length || 5,
                1,
                previewElement.dimensions?.width || 5
              ]}
            />
            <meshStandardMaterial
              color="#3b82f6"
              transparent
              opacity={0.5}
              wireframe
            />
          </mesh>
        </group>
      )}

      {/* Grid de referencia y MEDIDAS (solo en vista planta) */}
      {viewMode === 'Planta' && (
        <>
          <gridHelper
            args={[Math.max(dimensions.length, dimensions.width), 20, '#cbd5e1', '#e2e8f0']}
            position={[dimensions.length / 2, 0.01, dimensions.width / 2]}
          />
          
          {/* === COTAS / MEDIDAS === */}
          {/* Línea de cota inferior (LARGO) */}
          <group position={[0, 0.02, -3]}>
            {/* Línea horizontal */}
            <mesh position={[dimensions.length / 2, 0, 0]}>
              <boxGeometry args={[dimensions.length, 0.05, 0.05]} />
              <meshBasicMaterial color="#1e40af" />
            </mesh>
            {/* Extremo izquierdo */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.05, 0.05, 1.5]} />
              <meshBasicMaterial color="#1e40af" />
            </mesh>
            {/* Extremo derecho */}
            <mesh position={[dimensions.length, 0, 0]}>
              <boxGeometry args={[0.05, 0.05, 1.5]} />
              <meshBasicMaterial color="#1e40af" />
            </mesh>
            {/* Etiqueta LARGO */}
            <Html position={[dimensions.length / 2, 0, -1]} center>
              <div style={{
                background: '#1e40af',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}>
                LARGO: {dimensions.length.toFixed(1)} m
              </div>
            </Html>
          </group>

          {/* Línea de cota lateral (ANCHO) */}
          <group position={[-3, 0.02, 0]}>
            {/* Línea vertical */}
            <mesh position={[0, 0, dimensions.width / 2]}>
              <boxGeometry args={[0.05, 0.05, dimensions.width]} />
              <meshBasicMaterial color="#1e40af" />
            </mesh>
            {/* Extremo inferior */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.5, 0.05, 0.05]} />
              <meshBasicMaterial color="#1e40af" />
            </mesh>
            {/* Extremo superior */}
            <mesh position={[0, 0, dimensions.width]}>
              <boxGeometry args={[1.5, 0.05, 0.05]} />
              <meshBasicMaterial color="#1e40af" />
            </mesh>
            {/* Etiqueta ANCHO */}
            <Html position={[-1.5, 0, dimensions.width / 2]} center>
              <div style={{
                background: '#1e40af',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                transform: 'rotate(-90deg)'
              }}>
                ANCHO: {dimensions.width.toFixed(1)} m
              </div>
            </Html>
          </group>

          {/* Indicadores de escala cada 10m en X */}
          {Array.from({ length: Math.floor(dimensions.length / 10) + 1 }).map((_, i) => (
            <group key={`scale-x-${i}`} position={[i * 10, 0.02, -1.5]}>
              <mesh>
                <boxGeometry args={[0.05, 0.05, 0.8]} />
                <meshBasicMaterial color="#64748b" />
              </mesh>
              <Html position={[0, 0, -0.8]} center>
                <div style={{
                  color: '#64748b',
                  fontSize: '10px',
                  fontWeight: '500'
                }}>
                  {i * 10}m
                </div>
              </Html>
            </group>
          ))}

          {/* Indicadores de escala cada 10m en Z */}
          {Array.from({ length: Math.floor(dimensions.width / 10) + 1 }).map((_, i) => (
            <group key={`scale-z-${i}`} position={[-1.5, 0.02, i * 10]}>
              <mesh>
                <boxGeometry args={[0.8, 0.05, 0.05]} />
                <meshBasicMaterial color="#64748b" />
              </mesh>
              <Html position={[-0.8, 0, 0]} center>
                <div style={{
                  color: '#64748b',
                  fontSize: '10px',
                  fontWeight: '500'
                }}>
                  {i * 10}m
                </div>
              </Html>
            </group>
          ))}

          {/* Superficie total */}
          <Html position={[dimensions.length / 2, 0, dimensions.width / 2]} center>
            <div style={{
              background: 'rgba(30, 64, 175, 0.1)',
              border: '2px dashed #1e40af',
              color: '#1e40af',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              {(dimensions.length * dimensions.width).toLocaleString()} m²
            </div>
          </Html>
        </>
      )}
    </group>
  )
}
