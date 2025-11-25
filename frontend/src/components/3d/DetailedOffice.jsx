/**
 * UNITNAVE Designer - Oficina Industrial Realista
 * 
 * Características:
 * - Entreplanta con estructura visible
 * - Escalera con peldaños y barandilla
 * - Ascensor accesible
 * - Ventanas de cristal
 * - Mobiliario interior
 * - Configuración: planta baja / entreplanta / ambas
 */

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const COLORS = {
  structure: '#64748b',       // Estructura metálica
  structureDark: '#475569',   // Estructura oscura
  floor: '#e2e8f0',           // Suelo
  wall: '#f1f5f9',            // Paredes
  glass: '#93c5fd',           // Cristal
  glassTint: '#bfdbfe',       // Cristal tintado
  railing: '#334155',         // Barandilla
  railingYellow: '#facc15',   // Pasamanos seguridad
  stairs: '#64748b',          // Escalera
  door: '#475569',            // Puerta
  desk: '#a16207',            // Escritorio madera
  chair: '#1e293b',           // Sillas
  computer: '#374151',        // Monitores
  plant: '#22c55e',           // Plantas
  elevator: '#94a3b8',        // Ascensor
}

export default function DetailedOffice({
  element,
  isSelected = false,
  showLabels = true,
  showInterior = true,
  viewMode = '3D'
}) {
  const { largo = 12, ancho = 8, alto = 3.5 } = element.dimensions || {}
  const elevation = element.properties?.elevation || 3.5
  const workers = element.properties?.workers || Math.floor((largo * ancho) / 6)
  const label = element.properties?.label || 'Oficinas'
  const floorConfig = element.properties?.floor_config || 'mezzanine'
  const hasElevator = element.properties?.has_elevator !== false
  const isMezzanine = floorConfig === 'mezzanine' || floorConfig === 'both'
  const hasGroundFloor = floorConfig === 'ground' || floorConfig === 'both'

  // Pilares de soporte
  const pillars = useMemo(() => {
    if (!isMezzanine) return []
    
    const result = []
    const spacing = 4
    
    for (let x = 0; x <= largo; x += spacing) {
      for (let z = 0; z <= ancho; z += ancho) {
        result.push({
          key: `pillar-${x}-${z}`,
          position: [x, elevation / 2, z]
        })
      }
    }
    
    // Pilares intermedios si es muy largo
    if (largo > 8) {
      for (let x = spacing; x < largo; x += spacing) {
        result.push({
          key: `pillar-mid-${x}`,
          position: [x, elevation / 2, ancho / 2]
        })
      }
    }
    
    return result
  }, [largo, ancho, elevation, isMezzanine])

  // Ventanas
  const windows = useMemo(() => {
    const result = []
    const windowWidth = 1.8
    const windowHeight = 1.5
    const windowSpacing = 2.5
    const baseY = isMezzanine ? elevation + alto / 2 : alto / 2
    
    // Ventanas frontales
    for (let x = 1.5; x < largo - 1; x += windowSpacing) {
      result.push({
        key: `win-front-${x}`,
        position: [x, baseY, 0.08],
        size: [windowWidth, windowHeight, 0.06]
      })
    }
    
    // Ventanas laterales
    for (let z = 1.5; z < ancho - 1; z += windowSpacing) {
      result.push({
        key: `win-side-${z}`,
        position: [largo - 0.08, baseY, z],
        size: [0.06, windowHeight, windowWidth]
      })
    }
    
    return result
  }, [largo, ancho, alto, elevation, isMezzanine])

  // Mobiliario
  const furniture = useMemo(() => {
    if (!showInterior) return []
    
    const items = []
    const baseY = isMezzanine ? elevation : 0
    const deskRows = Math.floor(ancho / 3)
    const desksPerRow = Math.floor(largo / 2.5)
    
    for (let row = 0; row < Math.min(deskRows, 2); row++) {
      for (let col = 0; col < Math.min(desksPerRow, 4); col++) {
        const x = 1.5 + col * 2.5
        const z = 1.5 + row * 3
        
        if (x < largo - 1 && z < ancho - 1) {
          items.push({
            key: `desk-${row}-${col}`,
            type: 'desk',
            position: [x, baseY + 0.4, z]
          })
        }
      }
    }
    
    // Plantas decorativas
    items.push(
      { key: 'plant-1', type: 'plant', position: [0.6, baseY + 0.5, 0.6] },
      { key: 'plant-2', type: 'plant', position: [largo - 0.6, baseY + 0.5, 0.6] }
    )
    
    return items
  }, [largo, ancho, elevation, showInterior, isMezzanine])

  // Escalera
  const staircase = useMemo(() => {
    if (!isMezzanine) return null
    
    const stairWidth = 1.2
    const stairDepth = 3.5
    const numSteps = Math.ceil(elevation / 0.18)
    const stepHeight = elevation / numSteps
    const stepDepth = stairDepth / numSteps
    
    const steps = []
    for (let i = 0; i < numSteps; i++) {
      steps.push({
        key: `step-${i}`,
        position: [largo + stairWidth / 2 + 0.3, (i + 0.5) * stepHeight, ancho / 2 - stairDepth / 2 + i * stepDepth],
        size: [stairWidth, stepHeight * 0.95, stepDepth * 0.9]
      })
    }
    
    return {
      steps,
      width: stairWidth,
      depth: stairDepth,
      handrailHeight: 1.0
    }
  }, [largo, ancho, elevation, isMezzanine])

  // Ascensor
  const elevator = useMemo(() => {
    if (!isMezzanine || !hasElevator) return null
    
    return {
      position: [largo + 3, 0, ancho / 2],
      size: [1.6, elevation + alto, 1.8]
    }
  }, [largo, ancho, elevation, alto, isMezzanine, hasElevator])

  return (
    <group>
      {/* === PILARES DE SOPORTE (entreplanta) === */}
      {pillars.map(pillar => (
        <mesh key={pillar.key} position={pillar.position} castShadow>
          <boxGeometry args={[0.2, elevation, 0.2]} />
          <meshStandardMaterial 
            color={isSelected ? '#00ff88' : COLORS.structure}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}

      {/* === SUELO DE OFICINA === */}
      <mesh 
        position={[largo / 2, isMezzanine ? elevation : 0.08, ancho / 2]} 
        receiveShadow
      >
        <boxGeometry args={[largo, 0.15, ancho]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.8} />
      </mesh>

      {/* === PAREDES === */}
      {/* Pared frontal (cristal) */}
      <mesh position={[largo / 2, (isMezzanine ? elevation : 0) + alto / 2, 0.06]} castShadow>
        <boxGeometry args={[largo, alto, 0.12]} />
        <meshPhysicalMaterial
          color={COLORS.glass}
          transparent
          opacity={0.3}
          roughness={0.05}
          metalness={0.1}
          transmission={0.7}
        />
      </mesh>

      {/* Pared trasera (sólida) */}
      <mesh position={[largo / 2, (isMezzanine ? elevation : 0) + alto / 2, ancho - 0.08]}>
        <boxGeometry args={[largo, alto, 0.15]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
      </mesh>

      {/* Pared lateral derecha (cristal parcial) */}
      <mesh position={[largo - 0.06, (isMezzanine ? elevation : 0) + alto / 2, ancho / 2]} castShadow>
        <boxGeometry args={[0.12, alto, ancho]} />
        <meshPhysicalMaterial
          color={COLORS.glassTint}
          transparent
          opacity={0.35}
          roughness={0.05}
          transmission={0.6}
        />
      </mesh>

      {/* Pared lateral izquierda (contra nave - sólida) */}
      <mesh position={[0.08, (isMezzanine ? elevation : 0) + alto / 2, ancho / 2]}>
        <boxGeometry args={[0.15, alto, ancho]} />
        <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
      </mesh>

      {/* === VENTANAS === */}
      {windows.map(win => (
        <mesh key={win.key} position={win.position}>
          <boxGeometry args={win.size} />
          <meshPhysicalMaterial
            color="#bfdbfe"
            transparent
            opacity={0.5}
            roughness={0.02}
            metalness={0.1}
            transmission={0.85}
          />
        </mesh>
      ))}

      {/* === TECHO === */}
      <mesh position={[largo / 2, (isMezzanine ? elevation : 0) + alto, ancho / 2]} receiveShadow>
        <boxGeometry args={[largo + 0.3, 0.12, ancho + 0.3]} />
        <meshStandardMaterial color={COLORS.structure} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* === BARANDILLA (entreplanta) === */}
      {isMezzanine && (
        <group>
          {/* Barandilla frontal */}
          <mesh position={[largo / 2, elevation + 1.1, -0.2]}>
            <boxGeometry args={[largo + 0.4, 0.06, 0.06]} />
            <meshStandardMaterial color={COLORS.railing} metalness={0.7} roughness={0.3} />
          </mesh>
          
          {/* Barandilla lateral */}
          <mesh position={[largo + 0.2, elevation + 1.1, ancho / 2]}>
            <boxGeometry args={[0.06, 0.06, ancho + 0.4]} />
            <meshStandardMaterial color={COLORS.railing} metalness={0.7} roughness={0.3} />
          </mesh>

          {/* Postes de barandilla */}
          {Array.from({ length: Math.ceil(largo / 1.5) }).map((_, i) => (
            <mesh key={`post-${i}`} position={[0.5 + i * 1.5, elevation + 0.55, -0.2]}>
              <boxGeometry args={[0.04, 1.1, 0.04]} />
              <meshStandardMaterial color={COLORS.railing} metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          
          {/* Barandilla intermedia (seguridad) */}
          <mesh position={[largo / 2, elevation + 0.55, -0.2]}>
            <boxGeometry args={[largo + 0.4, 0.04, 0.04]} />
            <meshStandardMaterial color={COLORS.railing} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* === ESCALERA === */}
      {staircase && (
        <group>
          {/* Peldaños */}
          {staircase.steps.map(step => (
            <mesh key={step.key} position={step.position} castShadow receiveShadow>
              <boxGeometry args={step.size} />
              <meshStandardMaterial color={COLORS.stairs} metalness={0.5} roughness={0.5} />
            </mesh>
          ))}

          {/* Zancas laterales */}
          <mesh 
            position={[largo + 0.15, elevation / 2, ancho / 2]}
            rotation={[Math.atan2(elevation, staircase.depth), 0, 0]}
          >
            <boxGeometry args={[0.1, Math.sqrt(elevation ** 2 + staircase.depth ** 2) * 1.05, 0.2]} />
            <meshStandardMaterial color={COLORS.structureDark} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh 
            position={[largo + staircase.width + 0.45, elevation / 2, ancho / 2]}
            rotation={[Math.atan2(elevation, staircase.depth), 0, 0]}
          >
            <boxGeometry args={[0.1, Math.sqrt(elevation ** 2 + staircase.depth ** 2) * 1.05, 0.2]} />
            <meshStandardMaterial color={COLORS.structureDark} metalness={0.6} roughness={0.4} />
          </mesh>

          {/* Pasamanos amarillo */}
          <mesh 
            position={[largo + 0.1, elevation / 2 + 0.5, ancho / 2]}
            rotation={[Math.atan2(elevation, staircase.depth), 0, 0]}
          >
            <cylinderGeometry args={[0.025, 0.025, Math.sqrt(elevation ** 2 + staircase.depth ** 2) * 1.05, 8]} />
            <meshStandardMaterial color={COLORS.railingYellow} metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh 
            position={[largo + staircase.width + 0.5, elevation / 2 + 0.5, ancho / 2]}
            rotation={[Math.atan2(elevation, staircase.depth), 0, 0]}
          >
            <cylinderGeometry args={[0.025, 0.025, Math.sqrt(elevation ** 2 + staircase.depth ** 2) * 1.05, 8]} />
            <meshStandardMaterial color={COLORS.railingYellow} metalness={0.4} roughness={0.4} />
          </mesh>

          {/* Descansillo */}
          <mesh position={[largo + staircase.width / 2 + 0.3, elevation - 0.05, ancho / 2]}>
            <boxGeometry args={[staircase.width + 0.5, 0.1, staircase.depth + 0.3]} />
            <meshStandardMaterial color={COLORS.stairs} metalness={0.5} roughness={0.5} />
          </mesh>

          {/* Señal escalera */}
          {showLabels && viewMode === '3D' && (
            <Html position={[largo + staircase.width / 2 + 0.3, elevation + 1.2, ancho / 2 - staircase.depth / 2 - 0.5]} center>
              <div style={{
                background: '#22c55e',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                🚶 ↑ ESCALERA
              </div>
            </Html>
          )}
        </group>
      )}

      {/* === ASCENSOR === */}
      {elevator && (
        <group position={elevator.position}>
          {/* Cabina */}
          <mesh position={[0, elevator.size[1] / 2, 0]} castShadow>
            <boxGeometry args={elevator.size} />
            <meshStandardMaterial color={COLORS.elevator} metalness={0.6} roughness={0.3} />
          </mesh>
          
          {/* Puerta */}
          <mesh position={[0, (isMezzanine ? elevation : 0) + 1.1, -elevator.size[2] / 2 - 0.05]}>
            <boxGeometry args={[0.9, 2.1, 0.08]} />
            <meshStandardMaterial color={COLORS.door} metalness={0.7} roughness={0.3} />
          </mesh>
          
          {/* Indicador de planta */}
          <mesh position={[0, (isMezzanine ? elevation : 0) + 2.3, -elevator.size[2] / 2 - 0.06]}>
            <boxGeometry args={[0.3, 0.2, 0.02]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
          </mesh>

          {/* Señal accesibilidad */}
          {showLabels && viewMode === '3D' && (
            <Html position={[0, (isMezzanine ? elevation : 0) + 2.8, -elevator.size[2] / 2]} center>
              <div style={{
                background: '#3b82f6',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                ♿ ASCENSOR
              </div>
            </Html>
          )}
        </group>
      )}

      {/* === MOBILIARIO === */}
      {furniture.map(item => {
        if (item.type === 'desk') {
          return (
            <group key={item.key} position={item.position}>
              {/* Tablero */}
              <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[1.4, 0.04, 0.7]} />
                <meshStandardMaterial color={COLORS.desk} roughness={0.7} />
              </mesh>
              {/* Patas */}
              {[[-0.6, -0.25], [-0.6, 0.25], [0.6, -0.25], [0.6, 0.25]].map(([dx, dz], i) => (
                <mesh key={i} position={[dx, 0.18, dz]}>
                  <boxGeometry args={[0.04, 0.36, 0.04]} />
                  <meshStandardMaterial color={COLORS.chair} metalness={0.6} roughness={0.4} />
                </mesh>
              ))}
              {/* Monitor */}
              <mesh position={[0, 0.55, -0.2]} castShadow>
                <boxGeometry args={[0.5, 0.32, 0.03]} />
                <meshStandardMaterial color={COLORS.computer} metalness={0.4} roughness={0.4} />
              </mesh>
              {/* Base monitor */}
              <mesh position={[0, 0.4, -0.2]}>
                <boxGeometry args={[0.15, 0.02, 0.12]} />
                <meshStandardMaterial color={COLORS.computer} metalness={0.5} roughness={0.4} />
              </mesh>
              {/* Silla */}
              <mesh position={[0, 0.25, 0.55]}>
                <boxGeometry args={[0.45, 0.06, 0.45]} />
                <meshStandardMaterial color={COLORS.chair} />
              </mesh>
              <mesh position={[0, 0.55, 0.75]}>
                <boxGeometry args={[0.45, 0.55, 0.06]} />
                <meshStandardMaterial color={COLORS.chair} />
              </mesh>
            </group>
          )
        }

        if (item.type === 'plant') {
          return (
            <group key={item.key} position={item.position}>
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.15, 0.12, 0.3, 8]} />
                <meshStandardMaterial color="#78350f" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.5, 0]}>
                <sphereGeometry args={[0.28, 8, 8]} />
                <meshStandardMaterial color={COLORS.plant} roughness={0.8} />
              </mesh>
            </group>
          )
        }

        return null
      })}

      {/* === ETIQUETA === */}
      {showLabels && (
        <Html
          position={[largo / 2, (isMezzanine ? elevation : 0) + alto + 0.8, ancho / 2]}
          center
          distanceFactor={15}
        >
          <div style={{
            background: isSelected ? 'rgba(0, 255, 136, 0.95)' : 'rgba(59, 130, 246, 0.95)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '600',
            fontFamily: 'system-ui',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>🏢 {label}</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>
              {(largo * ancho).toFixed(0)} m² · {workers} puestos
            </div>
            <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '2px' }}>
              {isMezzanine ? `Entreplanta +${elevation.toFixed(1)}m` : 'Planta baja'}
              {hasElevator && ' · ♿'}
            </div>
          </div>
        </Html>
      )}

      {/* Highlight selección */}
      {isSelected && (
        <mesh 
          position={[largo / 2, (isMezzanine ? elevation : 0) + 0.03, ancho / 2]} 
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[largo + 1, ancho + 1]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}
