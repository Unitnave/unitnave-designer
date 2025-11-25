/**
 * UNITNAVE Designer - DetailedDock
 * 
 * Muelle de carga detallado:
 * - Plataforma de carga
 * - Rampa niveladora
 * - Puertas seccionales
 * - Zona de maniobra marcada
 * - Señalización de seguridad
 */

import React from 'react'
import { Html } from '@react-three/drei'

const COLORS = {
  platform: '#4b5563',      // Gris plataforma
  ramp: '#6b7280',          // Gris rampa
  door: '#1e293b',          // Gris oscuro puerta
  doorFrame: '#f59e0b',     // Naranja marco
  maneuverZone: '#ef4444',  // Rojo zona maniobra
  stripes: '#fbbf24',       // Amarillo rayas
  bumper: '#1f2937'         // Negro parachoques
}

export default function DetailedDock({
  element,
  isSelected = false,
  showLabels = true,
  viewMode = '3d'
}) {
  const { position, dimensions, properties } = element
  
  const width = dimensions?.width || 3.5
  const depth = dimensions?.depth || 4
  const height = dimensions?.height || 4.5
  const maneuverZone = dimensions?.maneuverZone || 12
  
  // Vista planta: solo rectángulo
  if (viewMode === 'planta') {
    return (
      <group position={[position?.x || 0, 0.01, position?.y || 0]}>
        {/* Plataforma */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color={isSelected ? '#3b82f6' : COLORS.platform} transparent opacity={0.7} />
        </mesh>
        
        {/* Zona de maniobra */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, depth + maneuverZone / 2]}>
          <planeGeometry args={[width, maneuverZone]} />
          <meshStandardMaterial color={COLORS.maneuverZone} transparent opacity={0.3} />
        </mesh>
        
        {showLabels && (
          <Html position={[width / 2, 0.5, depth / 2]} center>
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
  
  // Vista 3D completa
  return (
    <group position={[position?.x || 0, 0, position?.y || 0]}>
      {/* ========== PLATAFORMA DE CARGA ========== */}
      
      {/* Base de la plataforma */}
      <mesh position={[width / 2, 0.6, depth / 2]}>
        <boxGeometry args={[width, 1.2, depth]} />
        <meshStandardMaterial color={COLORS.platform} roughness={0.8} />
      </mesh>
      
      {/* Superficie de la plataforma */}
      <mesh position={[width / 2, 1.21, depth / 2]}>
        <boxGeometry args={[width, 0.02, depth]} />
        <meshStandardMaterial color="#5a6270" roughness={0.6} metalness={0.3} />
      </mesh>
      
      {/* Parachoques laterales */}
      {[0, width].map((x, i) => (
        <mesh key={`bumper-${i}`} position={[x, 1.3, 0.2]}>
          <boxGeometry args={[0.3, 0.4, 0.4]} />
          <meshStandardMaterial color={COLORS.bumper} roughness={0.7} />
        </mesh>
      ))}
      
      {/* ========== RAMPA NIVELADORA ========== */}
      
      <group position={[width / 2, 1.22, -0.3]}>
        {/* Placa de la rampa */}
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[width - 0.6, 0.05, 0.8]} />
          <meshStandardMaterial color={COLORS.ramp} roughness={0.5} metalness={0.5} />
        </mesh>
        
        {/* Bisagras */}
        {[-0.8, 0, 0.8].map((x, i) => (
          <mesh key={`hinge-${i}`} position={[x, 0, 0.4]}>
            <cylinderGeometry args={[0.05, 0.05, 0.15, 8]} />
            <meshStandardMaterial color="#2d3748" roughness={0.3} metalness={0.7} />
          </mesh>
        ))}
        
        {/* Superficie antideslizante (textura) */}
        <mesh position={[0, 0.026, 0]}>
          <boxGeometry args={[width - 0.65, 0.01, 0.75]} />
          <meshStandardMaterial color="#3d4451" roughness={0.9} />
        </mesh>
      </group>
      
      {/* ========== ESTRUCTURA Y PUERTA ========== */}
      
      {/* Marco de la puerta */}
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
      
      {/* Puerta seccional (cerrada) */}
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
      
      {/* ========== ZONA DE MANIOBRA ========== */}
      
      {/* Suelo de zona de maniobra con rayas */}
      <group position={[width / 2, 0.01, depth + maneuverZone / 2]}>
        {/* Base roja */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 1, maneuverZone]} />
          <meshStandardMaterial color={COLORS.maneuverZone} transparent opacity={0.6} />
        </mesh>
        
        {/* Rayas diagonales amarillas */}
        {Array.from({ length: 15 }).map((_, i) => (
          <mesh key={`stripe-${i}`} position={[-width / 2 + i * 0.8, 0.005, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
            <planeGeometry args={[0.2, maneuverZone * 1.5]} />
            <meshStandardMaterial color={COLORS.stripes} transparent opacity={0.8} />
          </mesh>
        ))}
        
        {/* Borde de zona */}
        <mesh position={[0, 0.01, maneuverZone / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 1, 0.15]} />
          <meshStandardMaterial color={COLORS.stripes} />
        </mesh>
      </group>
      
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
      
      {/* ========== INDICADOR DE SELECCIÓN ========== */}
      
      {isSelected && (
        <mesh position={[width / 2, 0.02, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 1, depth + 1]} />
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
