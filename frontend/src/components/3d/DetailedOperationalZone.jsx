/**
 * UNITNAVE Designer - DetailedOperationalZone
 * 
 * Zona operativa detallada:
 * - Tipos: receiving (recepción), shipping (expedición), picking (preparación), generic
 * - Suelo pintado con color identificativo
 * - Líneas de demarcación
 * - Señalización horizontal
 * - Equipamiento básico (mesas, carros)
 */

import React from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const ZONE_TYPES = {
  receiving: {
    color: '#a7f3d0',
    borderColor: '#10b981',
    icon: '📥',
    name: 'Recepción'
  },
  shipping: {
    color: '#fecaca',
    borderColor: '#ef4444',
    icon: '📤',
    name: 'Expedición'
  },
  picking: {
    color: '#fde68a',
    borderColor: '#f59e0b',
    icon: '🛒',
    name: 'Picking'
  },
  packing: {
    color: '#bfdbfe',
    borderColor: '#3b82f6',
    icon: '📦',
    name: 'Embalaje'
  },
  quality: {
    color: '#ddd6fe',
    borderColor: '#8b5cf6',
    icon: '✓',
    name: 'Control Calidad'
  },
  generic: {
    color: '#e2e8f0',
    borderColor: '#64748b',
    icon: '⚙️',
    name: 'Operativa'
  }
}

export default function DetailedOperationalZone({
  element,
  isSelected = false,
  showLabels = true,
  viewMode = '3d'
}) {
  const { position, dimensions, properties } = element
  
  const largo = dimensions?.largo || dimensions?.length || 10
  const ancho = dimensions?.ancho || dimensions?.width || 8
  const type = properties?.zone_type || 'generic'
  const label = properties?.label || ZONE_TYPES[type]?.name || 'Zona Operativa'
  
  const zoneConfig = ZONE_TYPES[type] || ZONE_TYPES.generic
  
  // Vista planta: solo rectángulo con borde
  if (viewMode === 'planta') {
    return (
      <group position={[position?.x || 0, 0.01, position?.y || 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[largo, ancho]} />
          <meshStandardMaterial 
            color={isSelected ? '#00ff88' : zoneConfig.color} 
            transparent 
            opacity={0.5} 
          />
        </mesh>
        
        {showLabels && (
          <Html position={[largo / 2, 0.5, ancho / 2]} center>
            <div style={{
              background: 'rgba(255,255,255,0.9)',
              color: '#334155',
              padding: '3px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              border: `2px solid ${zoneConfig.borderColor}`
            }}>
              {zoneConfig.icon} {label}
            </div>
          </Html>
        )}
      </group>
    )
  }
  
  // Vista 3D completa
  return (
    <group position={[position?.x || 0, 0, position?.y || 0]}>
      {/* ========== SUELO PINTADO ========== */}
      
      <mesh 
        position={[largo / 2, 0.01, ancho / 2]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[largo, ancho]} />
        <meshStandardMaterial 
          color={isSelected ? '#00ff88' : zoneConfig.color} 
          transparent 
          opacity={0.4}
          roughness={0.9}
        />
      </mesh>
      
      {/* ========== DEMARCACIÓN ========== */}
      
      {/* Borde continuo amarillo */}
      <group position={[largo / 2, 0.02, ancho / 2]}>
        {/* Líneas del perímetro */}
        {[
          { pos: [0, -ancho/2], rot: 0, len: largo },           // Norte
          { pos: [0, ancho/2], rot: 0, len: largo },            // Sur
          { pos: [-largo/2, 0], rot: Math.PI/2, len: ancho },   // Oeste
          { pos: [largo/2, 0], rot: Math.PI/2, len: ancho }     // Este
        ].map((line, i) => (
          <mesh 
            key={`border-${i}`} 
            position={[line.pos[0], 0, line.pos[1]]} 
            rotation={[-Math.PI / 2, 0, line.rot]}
          >
            <planeGeometry args={[line.len, 0.1]} />
            <meshStandardMaterial color={zoneConfig.borderColor} />
          </mesh>
        ))}
      </group>
      
      {/* Líneas internas de zona */}
      <group position={[0, 0.02, 0]}>
        {/* Líneas paralelas cada 2 metros */}
        {Array.from({ length: Math.floor(ancho / 2) }).map((_, i) => {
          const z = (i + 1) * 2
          if (z >= ancho - 0.5) return null
          return (
            <mesh 
              key={`line-${i}`}
              position={[largo / 2, 0, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[largo - 0.4, 0.05]} />
              <meshStandardMaterial 
                color={zoneConfig.borderColor} 
                transparent 
                opacity={0.3} 
              />
            </mesh>
          )
        })}
      </group>
      
      {/* ========== SEÑALIZACIÓN HORIZONTAL ========== */}
      
      {/* Flecha direccional (según tipo de zona) */}
      {(type === 'receiving' || type === 'shipping') && (
        <group position={[largo / 2, 0.03, ancho / 2]}>
          {/* Cuerpo de la flecha */}
          <mesh rotation={[-Math.PI / 2, 0, type === 'shipping' ? 0 : Math.PI]}>
            <planeGeometry args={[0.8, 2]} />
            <meshStandardMaterial color="white" transparent opacity={0.9} />
          </mesh>
          
          {/* Punta de la flecha */}
          <mesh 
            position={[0, 0, type === 'shipping' ? -1.2 : 1.2]} 
            rotation={[-Math.PI / 2, 0, type === 'shipping' ? 0 : Math.PI]}
          >
            <coneGeometry args={[0.6, 0.8, 3]} />
            <meshStandardMaterial color="white" transparent opacity={0.9} />
          </mesh>
        </group>
      )}
      
      {/* Texto en el suelo */}
      <Html position={[largo / 2, 0.05, ancho - 1]} center>
        <div style={{
          background: zoneConfig.borderColor,
          color: 'white',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          transform: 'rotateX(90deg)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          {ZONE_TYPES[type]?.name || 'ZONA'}
        </div>
      </Html>
      
      {/* ========== EQUIPAMIENTO BÁSICO ========== */}
      
      {/* Mesas de trabajo (si es zona de picking/packing) */}
      {(type === 'picking' || type === 'packing') && (
        <group>
          {[1, 2].map((i) => {
            const x = largo * (i / 3)
            return (
              <group key={`table-${i}`} position={[x, 0, ancho / 2]}>
                {/* Tablero */}
                <mesh position={[0, 0.75, 0]}>
                  <boxGeometry args={[1.5, 0.05, 0.8]} />
                  <meshStandardMaterial color="#8b7355" roughness={0.8} />
                </mesh>
                
                {/* Patas */}
                {[
                  [-0.65, 0, -0.35],
                  [0.65, 0, -0.35],
                  [-0.65, 0, 0.35],
                  [0.65, 0, 0.35]
                ].map((pos, j) => (
                  <mesh key={`leg-${j}`} position={pos}>
                    <cylinderGeometry args={[0.04, 0.04, 0.75, 8]} />
                    <meshStandardMaterial color="#4a5568" roughness={0.6} />
                  </mesh>
                ))}
              </group>
            )
          })}
        </group>
      )}
      
      {/* Carros de transporte (si es zona de shipping/receiving) */}
      {(type === 'shipping' || type === 'receiving') && (
        <group>
          {[1, 2, 3].map((i) => {
            const x = largo * (i / 4)
            const z = i % 2 === 0 ? 2 : ancho - 2
            return (
              <group key={`cart-${i}`} position={[x, 0, z]}>
                {/* Plataforma */}
                <mesh position={[0, 0.4, 0]}>
                  <boxGeometry args={[0.8, 0.05, 1.2]} />
                  <meshStandardMaterial color="#f59e0b" roughness={0.5} />
                </mesh>
                
                {/* Ruedas */}
                {[
                  [-0.3, 0, -0.5],
                  [0.3, 0, -0.5],
                  [-0.3, 0, 0.5],
                  [0.3, 0, 0.5]
                ].map((pos, j) => (
                  <mesh key={`wheel-${j}`} position={pos} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
                    <meshStandardMaterial color="#1f2937" roughness={0.7} />
                  </mesh>
                ))}
                
                {/* Manillar */}
                <mesh position={[0, 0.9, 0.6]}>
                  <boxGeometry args={[0.6, 0.05, 0.05]} />
                  <meshStandardMaterial color="#374151" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.65, 0.6]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
                  <meshStandardMaterial color="#374151" roughness={0.4} />
                </mesh>
              </group>
            )
          })}
        </group>
      )}
      
      {/* ========== INDICADOR DE SELECCIÓN ========== */}
      
      {isSelected && (
        <mesh position={[largo / 2, 0.02, ancho / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[largo + 0.5, ancho + 0.5]} />
          <meshStandardMaterial color="#00ff88" transparent opacity={0.3} />
        </mesh>
      )}
      
      {/* ========== ETIQUETA ========== */}
      
      {showLabels && (
        <Html position={[largo / 2, 2, ancho / 2]} center>
          <div style={{
            background: `${zoneConfig.borderColor}dd`,
            color: 'white',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '16px' }}>{zoneConfig.icon}</span>
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

// Exportar tipos disponibles
export { ZONE_TYPES }
