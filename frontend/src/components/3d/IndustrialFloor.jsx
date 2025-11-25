/**
 * UNITNAVE Designer - Suelo Industrial Profesional
 * 
 * Características:
 * - Solera de hormigón con textura
 * - Pasillos principales marcados
 * - Señalización de seguridad
 * - Zonas de maniobra de muelles
 * - Flechas de circulación
 */

import { useMemo } from 'react'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'

const COLORS = {
  concrete: '#9ca3af',        // Hormigón base
  concreteLight: '#d1d5db',   // Hormigón claro
  mainAisle: '#4b5563',       // Pasillo principal (más oscuro)
  lineYellow: '#fbbf24',      // Líneas amarillas seguridad
  lineWhite: '#f3f4f6',       // Líneas blancas
  safetyRed: '#ef4444',       // Zona peligro
  safetyGreen: '#22c55e',     // Salida emergencia
  pedestrian: '#3b82f6',      // Paso peatonal
}

export default function IndustrialFloor({
  dimensions = { length: 50, width: 30 },
  aisleWidth = 2.8,
  mainAisleWidth = 4.5,
  showGrid = true,
  showAisles = true,
  showSafetyZones = true,
  dockPositions = [],
  viewMode = '3D'
}) {
  const { length = 50, width = 30 } = dimensions || {}

  // Pasillos principales
  const mainAisles = useMemo(() => {
    const aisles = []
    
    // Pasillo central longitudinal
    aisles.push({
      key: 'main-long',
      position: [length / 2, 0.006, width / 2],
      size: [length - 1, mainAisleWidth],
      direction: 'horizontal'
    })
    
    // Pasillos transversales cada 25m
    for (let x = 25; x < length - 10; x += 25) {
      aisles.push({
        key: `trans-${x}`,
        position: [x, 0.006, width / 2],
        size: [mainAisleWidth, width - 1],
        direction: 'vertical'
      })
    }
    
    return aisles
  }, [length, width, mainAisleWidth])

  // Líneas de demarcación
  const floorLines = useMemo(() => {
    const lines = []
    const centerZ = width / 2
    const halfAisle = mainAisleWidth / 2
    
    // Perímetro de seguridad
    lines.push({
      key: 'perimeter',
      points: [
        [0.5, 0.02, 0.5],
        [length - 0.5, 0.02, 0.5],
        [length - 0.5, 0.02, width - 0.5],
        [0.5, 0.02, width - 0.5],
        [0.5, 0.02, 0.5]
      ],
      color: COLORS.lineYellow,
      lineWidth: 4
    })
    
    // Líneas del pasillo central
    lines.push({
      key: 'aisle-left',
      points: [[1, 0.02, centerZ - halfAisle], [length - 1, 0.02, centerZ - halfAisle]],
      color: COLORS.lineYellow,
      lineWidth: 5
    })
    lines.push({
      key: 'aisle-right',
      points: [[1, 0.02, centerZ + halfAisle], [length - 1, 0.02, centerZ + halfAisle]],
      color: COLORS.lineYellow,
      lineWidth: 5
    })
    
    // Línea central discontinua
    lines.push({
      key: 'center-line',
      points: [[1, 0.02, centerZ], [length - 1, 0.02, centerZ]],
      color: COLORS.lineWhite,
      lineWidth: 2,
      dashed: true
    })
    
    // Pasos de cebra cada 20m
    for (let x = 20; x < length - 10; x += 20) {
      for (let stripe = 0; stripe < 6; stripe++) {
        lines.push({
          key: `zebra-${x}-${stripe}`,
          points: [
            [x - 1.5 + stripe * 0.5, 0.025, centerZ - halfAisle - 0.3],
            [x - 1.5 + stripe * 0.5, 0.025, centerZ + halfAisle + 0.3]
          ],
          color: COLORS.lineWhite,
          lineWidth: 6
        })
      }
    }
    
    return lines
  }, [length, width, mainAisleWidth])

  // Zonas de seguridad
  const safetyZones = useMemo(() => {
    if (!showSafetyZones) return []
    
    const zones = []
    
    // Zonas de maniobra de muelles
    dockPositions.forEach((dock, i) => {
      const zoneDepth = dock.maneuverZone || 12
      zones.push({
        key: `dock-zone-${i}`,
        type: 'dock-maneuver',
        position: [dock.x + (dock.width || 3.5) / 2, 0.008, dock.z + (dock.depth || 4) + zoneDepth / 2],
        size: [(dock.width || 3.5) + 2, zoneDepth]
      })
    })
    
    // Salidas de emergencia (esquinas)
    const exitSize = 3
    const exitPositions = [
      [exitSize / 2 + 0.5, exitSize / 2 + 0.5],
      [length - exitSize / 2 - 0.5, exitSize / 2 + 0.5],
      [exitSize / 2 + 0.5, width - exitSize / 2 - 0.5],
      [length - exitSize / 2 - 0.5, width - exitSize / 2 - 0.5]
    ]
    
    exitPositions.forEach(([x, z], i) => {
      zones.push({
        key: `exit-${i}`,
        type: 'emergency-exit',
        position: [x, 0.008, z],
        size: [exitSize, exitSize]
      })
    })
    
    return zones
  }, [dockPositions, length, width, showSafetyZones])

  // Flechas de dirección
  const flowArrows = useMemo(() => {
    const arrows = []
    const centerZ = width / 2
    const halfAisle = mainAisleWidth / 4
    
    // Flechas cada 12m
    for (let x = 12; x < length - 8; x += 12) {
      // Carril izquierdo (hacia adelante)
      arrows.push({
        key: `arrow-left-${x}`,
        position: [x, 0.03, centerZ - halfAisle],
        rotation: 0
      })
      // Carril derecho (hacia atrás)
      arrows.push({
        key: `arrow-right-${x}`,
        position: [x, 0.03, centerZ + halfAisle],
        rotation: Math.PI
      })
    }
    
    return arrows
  }, [length, width, mainAisleWidth])

  // Grid de referencia
  const gridLines = useMemo(() => {
    if (!showGrid || viewMode !== 'Planta') return { x: [], z: [] }
    
    const gridSpacing = 5
    const linesX = []
    const linesZ = []
    
    for (let x = gridSpacing; x < length; x += gridSpacing) {
      linesX.push({
        key: `grid-x-${x}`,
        points: [[x, 0.01, 0], [x, 0.01, width]],
        label: `${x}m`
      })
    }
    
    for (let z = gridSpacing; z < width; z += gridSpacing) {
      linesZ.push({
        key: `grid-z-${z}`,
        points: [[0, 0.01, z], [length, 0.01, z]],
        label: `${z}m`
      })
    }
    
    return { x: linesX, z: linesZ }
  }, [length, width, showGrid, viewMode])

  return (
    <group>
      {/* Solera de hormigón base */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[length / 2, 0, width / 2]}
        receiveShadow
      >
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial
          color={COLORS.concrete}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* Pasillos principales (color diferente) */}
      {showAisles && mainAisles.map(aisle => (
        <mesh
          key={aisle.key}
          position={[aisle.position[0], 0.004, aisle.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={
            aisle.direction === 'horizontal' 
              ? [aisle.size[0], aisle.size[1]]
              : [aisle.size[0], aisle.size[1]]
          } />
          <meshStandardMaterial
            color={COLORS.mainAisle}
            roughness={0.8}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* Líneas de demarcación */}
      {floorLines.map(line => (
        <Line
          key={line.key}
          points={line.points}
          color={line.color}
          lineWidth={line.lineWidth}
          dashed={line.dashed || false}
          dashSize={1}
          gapSize={0.5}
        />
      ))}

      {/* Zonas de seguridad */}
      {safetyZones.map(zone => (
        <group key={zone.key}>
          {/* Fondo de la zona */}
          <mesh
            position={[zone.position[0], zone.position[1], zone.position[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={zone.size} />
            <meshBasicMaterial
              color={zone.type === 'emergency-exit' ? COLORS.safetyGreen : COLORS.safetyRed}
              transparent
              opacity={0.25}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Rayas diagonales para zona de muelles */}
          {zone.type === 'dock-maneuver' && (
            <>
              {Array.from({ length: Math.floor(zone.size[0] / 1) }).map((_, i) => (
                <Line
                  key={`stripe-${zone.key}-${i}`}
                  points={[
                    [zone.position[0] - zone.size[0] / 2 + i * 1, 0.015, zone.position[2] - zone.size[1] / 2],
                    [zone.position[0] - zone.size[0] / 2 + i * 1 + zone.size[1] * 0.4, 0.015, zone.position[2] + zone.size[1] / 2]
                  ]}
                  color={COLORS.safetyRed}
                  lineWidth={2}
                />
              ))}
            </>
          )}

          {/* Icono de salida de emergencia */}
          {zone.type === 'emergency-exit' && viewMode === '3D' && (
            <Html position={[zone.position[0], 0.15, zone.position[2]]} center>
              <div style={{
                background: COLORS.safetyGreen,
                color: 'white',
                padding: '6px 10px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}>
                🚪 SALIDA
              </div>
            </Html>
          )}
        </group>
      ))}

      {/* Flechas de flujo */}
      {flowArrows.map(arrow => (
        <group
          key={arrow.key}
          position={[arrow.position[0], arrow.position[1], arrow.position[2]]}
          rotation={[-Math.PI / 2, arrow.rotation, 0]}
        >
          <mesh>
            <shapeGeometry args={[createArrowShape()]} />
            <meshBasicMaterial color={COLORS.lineWhite} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Grid de referencia (solo vista planta) */}
      {gridLines.x.map(line => (
        <group key={line.key}>
          <Line
            points={line.points}
            color="#9ca3af"
            lineWidth={1}
            transparent
            opacity={0.4}
          />
          <Html position={[line.points[0][0], 0.1, -1.5]} center>
            <div style={{
              color: '#6b7280',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: '600'
            }}>
              {line.label}
            </div>
          </Html>
        </group>
      ))}
      
      {gridLines.z.map(line => (
        <group key={line.key}>
          <Line
            points={line.points}
            color="#9ca3af"
            lineWidth={1}
            transparent
            opacity={0.4}
          />
          <Html position={[-1.5, 0.1, line.points[0][2]]} center>
            <div style={{
              color: '#6b7280',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: '600'
            }}>
              {line.label}
            </div>
          </Html>
        </group>
      ))}

      {/* Indicador de pasillo (vista planta) */}
      {viewMode === 'Planta' && showAisles && (
        <Html position={[6, 0.15, width / 2]} center>
          <div style={{
            background: 'rgba(75, 85, 99, 0.9)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}>
            ↔ Pasillo principal: {mainAisleWidth}m
          </div>
        </Html>
      )}
    </group>
  )
}

// Helper: forma de flecha
function createArrowShape() {
  const shape = new THREE.Shape()
  
  shape.moveTo(0, 0.8)       // Punta
  shape.lineTo(-0.25, 0.4)   // Esquina izquierda
  shape.lineTo(-0.1, 0.4)    // Interior izquierdo
  shape.lineTo(-0.1, -0.4)   // Base izquierda
  shape.lineTo(0.1, -0.4)    // Base derecha
  shape.lineTo(0.1, 0.4)     // Interior derecho
  shape.lineTo(0.25, 0.4)    // Esquina derecha
  shape.lineTo(0, 0.8)       // Vuelta a la punta
  
  return shape
}
