/**
 * UNITNAVE Designer - DetailedDock
 * 
 * V6.0: Solo puerta de muelle (sin caja ni zona de maniobra)
 * - Puerta seccional industrial
 * - Marco y señalización
 * - Sin ocupar espacio interno de la nave
 */

import React from 'react'
import { Html } from '@react-three/drei'

const COLORS = {
  door: '#1e293b',          // Gris oscuro puerta
  doorFrame: '#f59e0b',     // Naranja marco
  stripes: '#fbbf24',       // Amarillo rayas
}

export default function DetailedDock({
  element,
  isSelected = false,
  showLabels = true,
  viewMode = '3d'
}) {
  const { position, dimensions, properties } = element
  
  const width = dimensions?.width || 3.5
  const height = dimensions?.height || 4.5
  
  // Vista planta: solo línea de puerta (no ocupa espacio)
  if (viewMode === 'planta') {
    return (
      <group position={[position?.x || 0, 0.01, position?.y || 0]}>
        {/* Línea de puerta */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, 0.3]} />
          <meshStandardMaterial color={isSelected ? '#3b82f6' : COLORS.doorFrame} />
        </mesh>
        
        {showLabels && (
          <Html position={[width / 2, 0.5, 0]} center>
            <div style={{
              background: 'rgba(59, 130, 246, 0.9)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              whiteSpace: 'nowrap'
            }}>
              {properties?.label || 'Muelle'}
            </div>
          </Html>
        )}
      </group>
    )
  }
  
  // Vista 3D: Solo puerta (sin plataforma ni zona de maniobra)
  return (
    <group position={[position?.x || 0, 0, position?.y || 0]}>
      
      {/* ========== MARCO DE LA PUERTA ========== */}
      <group position={[width / 2, height / 2, 0]}>
        {/* Dintel superior */}
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width + 0.2, 0.3, 0.2]} />
          <meshStandardMaterial color={COLORS.doorFrame} roughness={0.4} />
        </mesh>
        
        {/* Jambas laterales */}
        {[-width / 2 - 0.1, width / 2 + 0.1].map((x, i) => (
          <mesh key={`jamb-${i}`} position={[x, 0, 0]}>
            <boxGeometry args={[0.2, height, 0.2]} />
            <meshStandardMaterial color={COLORS.doorFrame} roughness={0.4} />
          </mesh>
        ))}
      </group>
      
      {/* ========== PUERTA SECCIONAL ========== */}
      <group position={[width / 2, 2, -0.05]}>
        {/* Paneles de la puerta */}
        {Array.from({ length: 6 }).map((_, i) => {
          const panelHeight = (height - 1.5) / 6
          const y = i * panelHeight
          
          return (
            <group key={`panel-${i}`} position={[0, y, 0]}>
              {/* Panel principal */}
              <mesh>
                <boxGeometry args={[width - 0.4, panelHeight - 0.05, 0.08]} />
                <meshStandardMaterial color={COLORS.door} roughness={0.6} />
              </mesh>
              
              {/* Nervadura horizontal */}
              <mesh position={[0, panelHeight / 2 - 0.025, 0.041]}>
                <boxGeometry args={[width - 0.4, 0.02, 0.01]} />
                <meshStandardMaterial color="#0f172a" roughness={0.5} />
              </mesh>
            </group>
          )
        })}
        
        {/* Ventanas superiores */}
        {[-width / 4, width / 4].map((x, i) => (
          <mesh key={`window-${i}`} position={[x, height - 2, 0.05]}>
            <boxGeometry args={[0.5, 0.4, 0.02]} />
            <meshStandardMaterial 
              color="#64748b" 
              transparent 
              opacity={0.6} 
              roughness={0.1}
              metalness={0.3}
            />
          </mesh>
        ))}
        
        {/* Manija */}
        <mesh position={[width / 2 - 0.5, 1, 0.06]}>
          <boxGeometry args={[0.15, 0.6, 0.08]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.5} />
        </mesh>
      </group>
      
      {/* Guías laterales de la puerta */}
      {[-width / 2, width / 2].map((x, i) => (
        <mesh key={`guide-${i}`} position={[x, height / 2, -0.1]}>
          <boxGeometry args={[0.1, height, 0.15]} />
          <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      
      {/* ========== SEÑALIZACIÓN ========== */}
      
      {/* Señal de "CARGA/DESCARGA" */}
      <mesh position={[width / 2, height - 0.5, 0.1]}>
        <boxGeometry args={[1.5, 0.3, 0.05]} />
        <meshStandardMaterial color="#1e293b" emissive="#f59e0b" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Luces de señalización */}
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={`light-${i}`} position={[width / 2 + x, height + 0.3, 0.1]}>
          <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
          <meshStandardMaterial 
            color={i === 0 ? '#ef4444' : '#22c55e'} 
            emissive={i === 0 ? '#ef4444' : '#22c55e'}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
      
      {/* Rayas amarillas en el suelo (indicación de zona) */}
      <mesh position={[width / 2, 0.01, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, 0.15]} />
        <meshStandardMaterial color={COLORS.stripes} />
      </mesh>
      
      {/* ========== INDICADOR DE SELECCIÓN ========== */}
      {isSelected && (
        <mesh position={[width / 2, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.5, 1]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.3} />
        </mesh>
      )}
      
      {/* ========== ETIQUETA ========== */}
      {showLabels && (
        <Html position={[width / 2, height + 0.8, 0]} center>
          <div style={{
            background: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            🚛 {properties?.label || 'Muelle'}
          </div>
        </Html>
      )}
    </group>
  )
}
