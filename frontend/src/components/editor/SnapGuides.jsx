/**
 * UNITNAVE Designer - Snap Guides V2.2
 * 
 * Líneas guía dinámicas que aparecen durante el drag:
 * - Alineación vertical (X)
 * - Alineación horizontal (Z)
 * - Indicador de ortho
 * - Indicador de tipo de snap
 * 
 * @version 2.2
 */

import React from 'react'
import { Line, Html } from '@react-three/drei'

import useEditorStore from '../../stores/useEditorStore'

// Colores por tipo de guía/snap
const GUIDE_COLORS = {
  'guide-v': '#f59e0b',     // Guía vertical (naranja)
  'guide-h': '#f59e0b',     // Guía horizontal (naranja)
  'ortho-h': '#8b5cf6',     // Ortho horizontal (púrpura)
  'ortho-v': '#8b5cf6',     // Ortho vertical (púrpura)
  'wall': '#ef4444',        // Pared (rojo)
  'grid': '#3b82f6',        // Grid (azul)
  'center': '#22c55e',      // Centro (verde)
  'corner': '#22c55e',      // Esquina (verde)
  'midpoint': '#06b6d4',    // Punto medio (cyan)
  'endpoint': '#22c55e'     // Extremo (verde)
}

/**
 * Etiquetas para tipos de snap
 */
const SNAP_LABELS = {
  'endpoint': '⬡ ESQUINA',
  'corner': '⬡ ESQUINA',
  'center': '◎ CENTRO',
  'midpoint': '◇ MEDIO',
  'wall': '▤ PARED',
  'grid': '# GRID',
  'ortho-h': '↔ HORIZONTAL',
  'ortho-v': '↕ VERTICAL',
  'guide-v': '⫼ ALINEADO V',
  'guide-h': '⫼ ALINEADO H'
}

/**
 * Línea guía individual
 */
function GuideLine({ type, position, dimensions, label }) {
  const color = GUIDE_COLORS[type] || '#f59e0b'
  const isVertical = type === 'vertical' || type === 'guide-v'
  const y = 0.08
  
  // Calcular puntos de la línea
  let points
  if (isVertical) {
    points = [
      [position, y, 0],
      [position, y, dimensions.width]
    ]
  } else {
    points = [
      [0, y, position],
      [dimensions.length, y, position]
    ]
  }
  
  return (
    <group>
      {/* Línea discontinua */}
      <Line
        points={points}
        color={color}
        lineWidth={1.5}
        dashed
        dashSize={0.5}
        gapSize={0.3}
      />
      
      {/* Etiqueta en el centro */}
      <Html 
        position={[
          isVertical ? position : dimensions.length / 2,
          0.15,
          isVertical ? dimensions.width / 2 : position
        ]} 
        center 
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: color,
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 600,
          opacity: 0.9
        }}>
          {label || (isVertical ? `X: ${position.toFixed(1)}` : `Z: ${position.toFixed(1)}`)}
        </div>
      </Html>
    </group>
  )
}

/**
 * Indicador de snap actual
 */
function SnapIndicator({ position, type }) {
  if (!position) return null
  
  const color = GUIDE_COLORS[type] || '#22c55e'
  const label = SNAP_LABELS[type] || type?.toUpperCase()
  
  return (
    <group position={[position.x, 0.04, position.z]}>
      {/* Círculo indicador */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.4, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      
      {/* Cruz central */}
      <Line
        points={[[-0.5, 0.02, 0], [0.5, 0.02, 0]]}
        color={color}
        lineWidth={2}
      />
      <Line
        points={[[0, 0.02, -0.5], [0, 0.02, 0.5]]}
        color={color}
        lineWidth={2}
      />
      
      {/* Etiqueta del tipo de snap */}
      <Html position={[0, 0.6, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: color,
          color: 'white',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

/**
 * Línea ortogonal (muestra la restricción H/V)
 */
function OrthoLine({ origin, current, type, dimensions }) {
  if (!origin || !current) return null
  
  const color = GUIDE_COLORS[type] || '#8b5cf6'
  const y = 0.06
  
  // Línea desde origen hasta posición actual
  const points = type === 'ortho-h' 
    ? [[origin.x, y, origin.z], [current.x, y, origin.z]]  // Horizontal
    : [[origin.x, y, origin.z], [origin.x, y, current.z]]  // Vertical
  
  // Línea extendida tenue
  const extendedPoints = type === 'ortho-h'
    ? [[0, y, origin.z], [dimensions.length, y, origin.z]]
    : [[origin.x, y, 0], [origin.x, y, dimensions.width]]
  
  return (
    <group>
      {/* Línea extendida tenue */}
      <Line
        points={extendedPoints}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.2}
        dashed
        dashSize={1}
        gapSize={0.5}
      />
      
      {/* Línea principal */}
      <Line
        points={points}
        color={color}
        lineWidth={2}
      />
      
      {/* Punto de origen */}
      <mesh position={[origin.x, y, origin.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

/**
 * Componente principal de guías de snap
 */
export default function SnapGuides({ dimensions }) {
  const {
    activeGuides,
    lastSnapResult,
    dragOrigin,
    snapConfig,
    shiftPressed,
    layers,
    isTransforming
  } = useEditorStore()
  
  // Solo mostrar durante transformación
  if (!isTransforming) return null
  
  // Verificar capa visible
  if (layers.grid && !layers.grid.visible) return null
  
  const isOrtho = snapConfig.orthoMode || shiftPressed
  const snapType = lastSnapResult?.type
  
  return (
    <group name="snap-guides">
      {/* Líneas guía dinámicas */}
      {activeGuides && activeGuides.map((guide, i) => (
        <GuideLine
          key={`${guide.type}-${i}`}
          type={guide.type}
          position={guide.position}
          dimensions={dimensions}
          label={guide.label}
        />
      ))}
      
      {/* Línea ortogonal */}
      {isOrtho && dragOrigin && lastSnapResult && (
        <OrthoLine
          origin={dragOrigin}
          current={lastSnapResult}
          type={snapType}
          dimensions={dimensions}
        />
      )}
      
      {/* Indicador de snap actual */}
      {lastSnapResult && (
        <SnapIndicator 
          position={lastSnapResult} 
          type={snapType}
        />
      )}
    </group>
  )
}

/**
 * Panel de información de SHIFT (se muestra en UI)
 */
export function ShiftIndicator() {
  const { shiftPressed, snapConfig } = useEditorStore()
  
  if (!shiftPressed && !snapConfig.orthoMode) return null
  
  return (
    <div style={{
      position: 'absolute',
      top: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#8b5cf6',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 600,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
    }}>
      {shiftPressed && <span>⇧ SHIFT</span>}
      <span>MODO ORTOGONAL ACTIVO</span>
      {!snapConfig.orthoMode && <span style={{ opacity: 0.7, fontSize: '10px' }}>(suelta SHIFT para desactivar)</span>}
    </div>
  )
}
