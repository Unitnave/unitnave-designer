/**
 * UNITNAVE Designer - Editor Grid V2
 * 
 * Grid magnético profesional con:
 * - Líneas de rejilla configurables
 * - Puntos de snap visuales
 * - Ejes de referencia
 * - Marcadores de escala
 * 
 * @version 2.0
 */

import React, { useMemo } from 'react'
import { Line, Html, Circle } from '@react-three/drei'
import * as THREE from 'three'

import useEditorStore from '../stores/useEditorStore'

export default function EditorGrid({ dimensions }) {
  const { 
    gridConfig, 
    snapConfig, 
    cameraMode,
    layers 
  } = useEditorStore()
  
  const { length = 80, width = 40 } = dimensions || {}
  const { size: gridSize, mainColor, subColor, visible, showLabels } = gridConfig
  
  if (!visible || !layers.grid.visible) return null
  
  // Generar líneas del grid
  const gridLines = useMemo(() => {
    const lines = []
    const mainEvery = 5 // Línea principal cada 5 unidades
    
    // Líneas verticales (X constante)
    for (let x = 0; x <= length; x += gridSize) {
      const isMain = x % (mainEvery * gridSize) === 0
      lines.push({
        points: [[x, 0.01, 0], [x, 0.01, width]],
        color: isMain ? mainColor : subColor,
        lineWidth: isMain ? 1.5 : 0.5,
        isMain
      })
    }
    
    // Líneas horizontales (Z constante)
    for (let z = 0; z <= width; z += gridSize) {
      const isMain = z % (mainEvery * gridSize) === 0
      lines.push({
        points: [[0, 0.01, z], [length, 0.01, z]],
        color: isMain ? mainColor : subColor,
        lineWidth: isMain ? 1.5 : 0.5,
        isMain
      })
    }
    
    return lines
  }, [length, width, gridSize, mainColor, subColor])
  
  // Puntos de snap (solo en modo 2D para optimización)
  const snapPoints = useMemo(() => {
    if (cameraMode !== '2D' || !snapConfig.enabled) return []
    
    const points = []
    const snapEvery = Math.max(gridSize * 5, 5) // Mostrar puntos cada 5 unidades mínimo
    
    for (let x = 0; x <= length; x += snapEvery) {
      for (let z = 0; z <= width; z += snapEvery) {
        points.push({ x, z })
      }
    }
    
    return points
  }, [length, width, gridSize, cameraMode, snapConfig.enabled])
  
  // Marcadores de escala (cada 10m)
  const scaleMarkers = useMemo(() => {
    if (cameraMode !== '2D') return []
    
    const markers = []
    
    // Eje X
    for (let x = 10; x <= length; x += 10) {
      markers.push({ x, z: -2, label: `${x}m`, axis: 'x' })
    }
    
    // Eje Z
    for (let z = 10; z <= width; z += 10) {
      markers.push({ x: -2, z, label: `${z}m`, axis: 'z' })
    }
    
    return markers
  }, [length, width, cameraMode])
  
  return (
    <group name="editor-grid">
      {/* Líneas del grid */}
      {gridLines.map((line, i) => (
        <Line
          key={`grid-${i}`}
          points={line.points}
          color={line.color}
          lineWidth={line.lineWidth}
          transparent
          opacity={line.isMain ? 0.6 : 0.3}
        />
      ))}
      
      {/* Ejes de referencia */}
      <group name="reference-axes">
        {/* Eje X (rojo) */}
        <Line
          points={[[0, 0.02, 0], [Math.min(length, 15), 0.02, 0]]}
          color="#ef4444"
          lineWidth={3}
        />
        <mesh position={[Math.min(length, 15) + 0.5, 0.02, 0]}>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        
        {/* Eje Z (azul) */}
        <Line
          points={[[0, 0.02, 0], [0, 0.02, Math.min(width, 15)]]}
          color="#3b82f6"
          lineWidth={3}
        />
        <mesh position={[0, 0.02, Math.min(width, 15) + 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        
        {/* Origen */}
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </group>
      
      {/* Puntos de snap (solo 2D) */}
      {snapPoints.map((point, i) => (
        <mesh 
          key={`snap-${i}`} 
          position={[point.x, 0.03, point.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.4} />
        </mesh>
      ))}
      
      {/* Marcadores de escala */}
      {showLabels && scaleMarkers.map((marker, i) => (
        <Html
          key={`marker-${i}`}
          position={[marker.x, 0.1, marker.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: marker.axis === 'x' ? '#ef4444' : '#3b82f6',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}>
            {marker.label}
          </div>
        </Html>
      ))}
      
      {/* Perímetro de la nave */}
      <Line
        points={[
          [0, 0.02, 0],
          [length, 0.02, 0],
          [length, 0.02, width],
          [0, 0.02, width],
          [0, 0.02, 0]
        ]}
        color="#1e40af"
        lineWidth={2}
      />
      
      {/* Centro de la nave */}
      <mesh 
        position={[length / 2, 0.02, width / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.3} />
      </mesh>
      
      {/* Indicador de Snap activo (esquina) */}
      {cameraMode === '2D' && snapConfig.enabled && (
        <Html
          position={[length - 1, 0.1, 1]}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: '#22c55e',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'white',
              animation: 'pulse 1.5s infinite'
            }} />
            SNAP {snapConfig.snapDistance}m
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * Hook para obtener posición con snap aplicado
 * Uso: const snappedPos = useSnapToGrid({ x, z }, elements, dimensions)
 */
export function useSnapToGrid(position, elements, dimensions) {
  const { snapPosition } = useEditorStore()
  
  return useMemo(() => {
    if (!position) return { x: 0, z: 0, snappedTo: null }
    return snapPosition(position.x, position.z, elements, dimensions)
  }, [position, elements, dimensions, snapPosition])
}

/**
 * Componente visual para mostrar punto de snap durante drag
 */
export function SnapIndicator({ position, snappedTo }) {
  if (!snappedTo) return null
  
  const colors = {
    grid: '#3b82f6',
    wall: '#ef4444',
    corner: '#22c55e',
    center: '#f59e0b',
    midpoint: '#a855f7'
  }
  
  const color = colors[snappedTo] || colors.grid
  
  return (
    <group position={[position.x, 0.05, position.z]}>
      {/* Círculo indicador */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      
      {/* Cruz */}
      <Line
        points={[[-0.6, 0, 0], [0.6, 0, 0]]}
        color={color}
        lineWidth={2}
      />
      <Line
        points={[[0, 0, -0.6], [0, 0, 0.6]]}
        color={color}
        lineWidth={2}
      />
      
      {/* Label */}
      <Html position={[0, 0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: color,
          color: 'white',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase'
        }}>
          {snappedTo}
        </div>
      </Html>
    </group>
  )
}
