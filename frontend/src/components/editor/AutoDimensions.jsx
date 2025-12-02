/**
 * UNITNAVE Designer - Auto Dimensions V2
 * 
 * Sistema de cotas automáticas:
 * - Dimensiones de la nave
 * - Dimensiones de elementos
 * - Distancias entre elementos
 * - Anchos de pasillo
 * 
 * @version 2.0
 */

import React, { useMemo } from 'react'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'

import useEditorStore from '../stores/useEditorStore'

// Estilos de cota
const DIMENSION_STYLE = {
  lineColor: '#1e40af',
  textColor: '#1e40af',
  backgroundColor: 'white',
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: '3px',
  fontWeight: 600,
  arrowSize: 0.3,
  extensionLength: 1.0,
  offset: 2.5
}

/**
 * Flecha tipo AutoCAD (triángulo relleno)
 */
function DimensionArrow({ position, direction, color = '#1e40af', size = 0.35 }) {
  // direction: 'left', 'right', 'up', 'down'
  const rotations = {
    right: 0,
    left: Math.PI,
    up: Math.PI / 2,
    down: -Math.PI / 2
  }
  
  const rotation = rotations[direction] || 0
  
  // Crear forma de flecha triangular
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(-size, size * 0.4)
    s.lineTo(-size * 0.7, 0)
    s.lineTo(-size, -size * 0.4)
    s.closePath()
    return s
  }, [size])
  
  return (
    <mesh 
      position={[position[0], 0.06, position[2]]} 
      rotation={[-Math.PI / 2, 0, rotation]}
    >
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  )
}

/**
 * Línea de cota con extensiones y etiqueta
 */
export function DimensionLine({
  start,
  end,
  label,
  offset = DIMENSION_STYLE.offset,
  direction = 'horizontal', // 'horizontal' | 'vertical'
  color = DIMENSION_STYLE.lineColor,
  showExtensions = true,
  labelPosition = 'center' // 'center' | 'start' | 'end'
}) {
  const isHorizontal = direction === 'horizontal'
  
  // Calcular posiciones con offset
  const offsetVector = isHorizontal 
    ? [0, 0.05, offset]
    : [offset, 0.05, 0]
  
  const startPoint = [
    start[0] + offsetVector[0],
    offsetVector[1],
    start[2] + offsetVector[2]
  ]
  
  const endPoint = [
    end[0] + offsetVector[0],
    offsetVector[1],
    end[2] + offsetVector[2]
  ]
  
  // Punto medio para la etiqueta
  const midPoint = [
    (startPoint[0] + endPoint[0]) / 2,
    0.1,
    (startPoint[2] + endPoint[2]) / 2
  ]
  
  // Extensiones
  const ext1Start = isHorizontal
    ? [start[0], 0.05, start[2]]
    : [start[0], 0.05, start[2]]
  const ext1End = startPoint
  
  const ext2Start = isHorizontal
    ? [end[0], 0.05, end[2]]
    : [end[0], 0.05, end[2]]
  const ext2End = endPoint
  
  return (
    <group name="dimension-line">
      {/* Línea principal */}
      <Line
        points={[startPoint, endPoint]}
        color={color}
        lineWidth={1.5}
      />
      
      {/* Extensiones */}
      {showExtensions && (
        <>
          <Line
            points={[ext1Start, ext1End]}
            color={color}
            lineWidth={1}
            transparent
            opacity={0.6}
          />
          <Line
            points={[ext2Start, ext2End]}
            color={color}
            lineWidth={1}
            transparent
            opacity={0.6}
          />
        </>
      )}
      
      {/* Flechas tipo AutoCAD en los extremos */}
      <DimensionArrow 
        position={startPoint} 
        direction={isHorizontal ? 'right' : 'up'} 
        color={color} 
      />
      <DimensionArrow 
        position={endPoint} 
        direction={isHorizontal ? 'left' : 'down'} 
        color={color} 
      />
      
      {/* Etiqueta */}
      <Html position={midPoint} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: DIMENSION_STYLE.backgroundColor,
          color: DIMENSION_STYLE.textColor,
          padding: DIMENSION_STYLE.padding,
          borderRadius: DIMENSION_STYLE.borderRadius,
          fontSize: DIMENSION_STYLE.fontSize,
          fontWeight: DIMENSION_STYLE.fontWeight,
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          border: `1px solid ${color}`
        }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

/**
 * Cotas de la nave (largo y ancho)
 */
export function NaveDimensions({ dimensions }) {
  const { dimensionsConfig, cameraMode, layers } = useEditorStore()
  
  if (!dimensionsConfig.showNaveDimensions || cameraMode !== '2D') return null
  if (!layers.dimensions.visible) return null
  
  const { length, width } = dimensions
  const offset = 3
  
  return (
    <group name="nave-dimensions">
      {/* Cota inferior - LARGO */}
      <DimensionLine
        start={[0, 0, 0]}
        end={[length, 0, 0]}
        label={`${length.toFixed(1)} m`}
        offset={-offset}
        direction="horizontal"
      />
      
      {/* Cota lateral - ANCHO */}
      <DimensionLine
        start={[0, 0, 0]}
        end={[0, 0, width]}
        label={`${width.toFixed(1)} m`}
        offset={-offset}
        direction="vertical"
      />
      
      {/* Superficie total en el centro */}
      <Html 
        position={[length / 2, 0.1, width / 2]} 
        center 
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 700,
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)'
        }}>
          <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '2px' }}>
            Superficie
          </div>
          {(length * width).toLocaleString()} m²
        </div>
      </Html>
    </group>
  )
}

/**
 * Cotas de un elemento individual
 */
export function ElementDimension({ element, showLabel = true }) {
  const { dimensionsConfig, layers } = useEditorStore()
  
  if (!dimensionsConfig.showElementDimensions) return null
  if (!layers.dimensions.visible) return null
  
  const { position, dimensions, type } = element
  const x = position?.x || 0
  const z = position?.y || position?.z || 0
  
  const length = dimensions?.length || dimensions?.width || 2.7
  const depth = dimensions?.depth || dimensions?.width || 1.1
  
  // Color según tipo
  const colors = {
    shelf: '#3b82f6',
    dock: '#22c55e',
    office: '#a855f7',
    zone: '#06b6d4'
  }
  const color = colors[type] || colors.shelf
  
  const offset = 0.6
  
  return (
    <group name={`element-dimension-${element.id}`}>
      {/* Cota de largo */}
      <DimensionLine
        start={[x, 0, z]}
        end={[x + length, 0, z]}
        label={`${length.toFixed(1)}m`}
        offset={-offset}
        direction="horizontal"
        color={color}
        showExtensions={false}
      />
      
      {/* Cota de profundidad */}
      <DimensionLine
        start={[x, 0, z]}
        end={[x, 0, z + depth]}
        label={`${depth.toFixed(1)}m`}
        offset={-offset}
        direction="vertical"
        color={color}
        showExtensions={false}
      />
      
      {/* Etiqueta central */}
      {showLabel && (
        <Html 
          position={[x + length / 2, 0.3, z + depth / 2]} 
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: color,
            color: 'white',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}>
            {element.properties?.label || type}
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * Muestra distancia entre dos elementos
 */
export function DistanceBetweenElements({ element1, element2, showLine = true }) {
  const { dimensionsConfig, layers } = useEditorStore()
  
  if (!dimensionsConfig.showDistances) return null
  if (!layers.dimensions.visible) return null
  
  // Calcular centros
  const x1 = element1.position.x + (element1.dimensions?.length || 2.7) / 2
  const z1 = (element1.position.y || 0) + (element1.dimensions?.depth || 1.1) / 2
  
  const x2 = element2.position.x + (element2.dimensions?.length || 2.7) / 2
  const z2 = (element2.position.y || 0) + (element2.dimensions?.depth || 1.1) / 2
  
  const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2))
  
  const midX = (x1 + x2) / 2
  const midZ = (z1 + z2) / 2
  
  return (
    <group name="distance-line">
      {showLine && (
        <Line
          points={[[x1, 0.1, z1], [x2, 0.1, z2]]}
          color="#f59e0b"
          lineWidth={1}
          dashed
          dashSize={0.3}
          gapSize={0.2}
        />
      )}
      
      <Html position={[midX, 0.2, midZ]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: '#f59e0b',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 600
        }}>
          {distance.toFixed(1)}m
        </div>
      </Html>
    </group>
  )
}

/**
 * Indicador de ancho de pasillo
 */
export function AisleWidthIndicator({ position, width, minRequired, orientation = 'vertical' }) {
  const { dimensionsConfig, layers } = useEditorStore()
  
  if (!dimensionsConfig.showAisleWidths) return null
  if (!layers.aisles?.visible) return null
  
  const isValid = width >= minRequired
  const color = isValid ? '#22c55e' : '#ef4444'
  
  const x = position.x
  const z = position.z
  
  return (
    <group position={[x, 0.05, z]}>
      {/* Línea indicadora */}
      <Line
        points={
          orientation === 'vertical'
            ? [[0, 0, 0], [0, 0, width]]
            : [[0, 0, 0], [width, 0, 0]]
        }
        color={color}
        lineWidth={3}
      />
      
      {/* Marcadores de extremo */}
      <mesh>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={orientation === 'vertical' ? [0, 0, width] : [width, 0, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Etiqueta */}
      <Html 
        position={orientation === 'vertical' ? [0, 0.3, width / 2] : [width / 2, 0.3, 0]} 
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: color,
          color: 'white',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}>
          {width.toFixed(1)}m
          {!isValid && (
            <span style={{ marginLeft: '4px', opacity: 0.8 }}>
              (mín {minRequired}m)
            </span>
          )}
        </div>
      </Html>
    </group>
  )
}

/**
 * Componente principal que renderiza todas las cotas
 */
export default function AutoDimensions({ dimensions, elements, selectedElement }) {
  const { dimensionsConfig, cameraMode, layers } = useEditorStore()
  
  if (!layers.dimensions.visible) return null
  
  // Filtrar elementos visibles
  const visibleShelves = useMemo(() => 
    elements?.filter(el => el.type === 'shelf').slice(0, 10) || [],
    [elements]
  )
  
  return (
    <group name="auto-dimensions">
      {/* Cotas de la nave */}
      {dimensions && (
        <NaveDimensions dimensions={dimensions} />
      )}
      
      {/* Cotas del elemento seleccionado */}
      {selectedElement && (
        <ElementDimension element={selectedElement} showLabel={true} />
      )}
      
      {/* Cotas de estanterías (limitado para performance) */}
      {cameraMode === '2D' && dimensionsConfig.showElementDimensions && (
        visibleShelves.map(shelf => (
          <ElementDimension 
            key={shelf.id} 
            element={shelf} 
            showLabel={false}
          />
        ))
      )}
    </group>
  )
}
