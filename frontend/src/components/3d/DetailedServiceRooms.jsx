/**
 * UNITNAVE Designer - DetailedServiceRooms
 * 
 * Sala de servicios detallada:
 * - Vestuarios
 * - Aseos / Baños
 * - Comedor / Cantina
 * - Enfermería
 * - Estructura con paredes, puertas, ventanas
 * - Mobiliario básico según tipo
 */

import React from 'react'
import { Html } from '@react-three/drei'

const SERVICE_TYPES = {
  vestuarios: {
    color: '#93c5fd',
    icon: '🚿',
    name: 'Vestuarios',
    doorColor: '#3b82f6'
  },
  aseos: {
    color: '#bfdbfe',
    icon: '🚻',
    name: 'Aseos',
    doorColor: '#60a5fa'
  },
  comedor: {
    color: '#fcd34d',
    icon: '🍽️',
    name: 'Comedor',
    doorColor: '#f59e0b'
  },
  enfermeria: {
    color: '#fca5a5',
    icon: '⚕️',
    name: 'Enfermería',
    doorColor: '#ef4444'
  },
  sala_descanso: {
    color: '#d8b4fe',
    icon: '☕',
    name: 'Sala Descanso',
    doorColor: '#a855f7'
  },
  generic: {
    color: '#e2e8f0',
    icon: '🏢',
    name: 'Servicios',
    doorColor: '#64748b'
  }
}

const COLORS = {
  wall: '#f1f5f9',
  wallDark: '#cbd5e1',
  floor: '#e2e8f0',
  ceiling: '#ffffff',
  window: '#93c5fd',
  door: '#64748b',
  locker: '#374151',
  bench: '#8b7355',
  sink: '#cbd5e1',
  toilet: '#f1f5f9'
}

export default function DetailedServiceRooms({
  element,
  isSelected = false,
  showLabels = true,
  showInterior = true,
  viewMode = '3d'
}) {
  const { position, dimensions, properties } = element
  
  const largo = dimensions?.largo || dimensions?.length || 8
  const ancho = dimensions?.ancho || dimensions?.width || 6
  const alto = dimensions?.alto || dimensions?.height || 3
  const subtype = properties?.subtype || 'generic'
  const label = properties?.label || SERVICE_TYPES[subtype]?.name || 'Servicios'
  
  const config = SERVICE_TYPES[subtype] || SERVICE_TYPES.generic
  
  // Vista planta: solo rectángulo
  if (viewMode === 'planta') {
    return (
      <group position={[position?.x || 0, 0.01, position?.y || 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[largo, ancho]} />
          <meshStandardMaterial 
            color={isSelected ? config.doorColor : config.color} 
            transparent 
            opacity={0.7} 
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
              border: `2px solid ${config.doorColor}`
            }}>
              {config.icon} {label}
            </div>
          </Html>
        )}
      </group>
    )
  }
  
  // Vista 3D completa
  return (
    <group position={[position?.x || 0, 0, position?.y || 0]}>
      {/* ========== ESTRUCTURA ========== */}
      
      {/* Suelo */}
      <mesh position={[largo / 2, 0.01, ancho / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[largo, ancho]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.8} />
      </mesh>
      
      {/* Paredes */}
      <group>
        {/* Pared trasera (norte) */}
        <mesh position={[largo / 2, alto / 2, 0]} castShadow>
          <boxGeometry args={[largo, alto, 0.15]} />
          <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
        </mesh>
        
        {/* Pared frontal (sur) - con puerta */}
        <group position={[0, 0, ancho]}>
          {/* Sección izquierda */}
          <mesh position={[largo * 0.25, alto / 2, 0]} castShadow>
            <boxGeometry args={[largo * 0.5 - 0.5, alto, 0.15]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
          </mesh>
          
          {/* Sección derecha */}
          <mesh position={[largo * 0.75, alto / 2, 0]} castShadow>
            <boxGeometry args={[largo * 0.5 - 0.5, alto, 0.15]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
          </mesh>
          
          {/* Dintel sobre puerta */}
          <mesh position={[largo / 2, alto - 0.3, 0]} castShadow>
            <boxGeometry args={[1.2, 0.6, 0.15]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
          </mesh>
        </group>
        
        {/* Pared lateral oeste */}
        <mesh position={[0, alto / 2, ancho / 2]} castShadow>
          <boxGeometry args={[0.15, alto, ancho]} />
          <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
        </mesh>
        
        {/* Pared lateral este - con ventana */}
        <group position={[largo, 0, ancho / 2]}>
          {/* Parte inferior */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[0.15, 1.2, ancho]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
          </mesh>
          
          {/* Parte superior */}
          <mesh position={[0, alto - 0.4, 0]} castShadow>
            <boxGeometry args={[0.15, 0.8, ancho]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
          </mesh>
          
          {/* Secciones laterales ventana */}
          <mesh position={[0, alto / 2, -ancho / 2 + 0.8]} castShadow>
            <boxGeometry args={[0.15, alto, 1.6]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
          </mesh>
          <mesh position={[0, alto / 2, ancho / 2 - 0.8]} castShadow>
            <boxGeometry args={[0.15, alto, 1.6]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.7} />
          </mesh>
        </group>
      </group>
      
      {/* Ventana */}
      <mesh position={[largo, alto / 2, ancho / 2]}>
        <boxGeometry args={[0.05, 1.2, ancho - 1.6]} />
        <meshStandardMaterial 
          color={COLORS.window} 
          transparent 
          opacity={0.6} 
          roughness={0.1}
        />
      </mesh>
      
      {/* Puerta */}
      <group position={[largo / 2, 0, ancho - 0.05]}>
        {/* Hoja de puerta */}
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[0.9, 2.2, 0.08]} />
          <meshStandardMaterial color={config.doorColor} roughness={0.4} />
        </mesh>
        
        {/* Marco */}
        <mesh position={[0, 1.1, -0.08]}>
          <boxGeometry args={[1.0, 2.3, 0.05]} />
          <meshStandardMaterial color={COLORS.wallDark} roughness={0.6} />
        </mesh>
        
        {/* Manija */}
        <mesh position={[0.35, 1, 0.06]}>
          <cylinderGeometry args={[0.03, 0.03, 0.15, 16]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.8} />
        </mesh>
        
        {/* Señal en puerta */}
        <mesh position={[0, 1.6, 0.05]}>
          <boxGeometry args={[0.4, 0.3, 0.01]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      
      {/* Techo */}
      <mesh position={[largo / 2, alto, ancho / 2]} castShadow>
        <boxGeometry args={[largo, 0.1, ancho]} />
        <meshStandardMaterial color={COLORS.ceiling} roughness={0.5} />
      </mesh>
      
      {/* ========== MOBILIARIO INTERIOR ========== */}
      
      {showInterior && (
        <group>
          {/* VESTUARIOS */}
          {subtype === 'vestuarios' && (
            <group>
              {/* Taquillas */}
              <group position={[0.5, 0, 0.5]}>
                {Array.from({ length: Math.min(8, Math.floor(largo / 0.6)) }).map((_, i) => (
                  <group key={`locker-${i}`} position={[i * 0.5, 0, 0]}>
                    {/* Cuerpo taquilla */}
                    <mesh position={[0, 0.9, 0]}>
                      <boxGeometry args={[0.45, 1.8, 0.45]} />
                      <meshStandardMaterial color={COLORS.locker} roughness={0.6} />
                    </mesh>
                    {/* Puerta */}
                    <mesh position={[0, 0.9, 0.23]}>
                      <boxGeometry args={[0.44, 1.78, 0.02]} />
                      <meshStandardMaterial color="#4b5563" roughness={0.5} />
                    </mesh>
                    {/* Cerradura */}
                    <mesh position={[0.15, 0.9, 0.25]}>
                      <cylinderGeometry args={[0.02, 0.02, 0.03, 8]} />
                      <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
                    </mesh>
                  </group>
                ))}
              </group>
              
              {/* Bancos */}
              <group position={[largo / 2, 0, ancho - 1.5]}>
                {[0, 2].map((offset) => (
                  <group key={`bench-${offset}`} position={[offset - 1, 0, 0]}>
                    {/* Asiento */}
                    <mesh position={[0, 0.45, 0]}>
                      <boxGeometry args={[1.5, 0.05, 0.35]} />
                      <meshStandardMaterial color={COLORS.bench} roughness={0.8} />
                    </mesh>
                    {/* Patas */}
                    {[-0.6, 0.6].map((x) => (
                      <mesh key={`leg-${x}`} position={[x, 0.225, 0]}>
                        <boxGeometry args={[0.05, 0.45, 0.3]} />
                        <meshStandardMaterial color={COLORS.bench} roughness={0.8} />
                      </mesh>
                    ))}
                  </group>
                ))}
              </group>
            </group>
          )}
          
          {/* ASEOS */}
          {subtype === 'aseos' && (
            <group>
              {/* Lavabos */}
              <group position={[0.6, 0, ancho - 0.8]}>
                {[0, 1.2, 2.4].map((offset, i) => (
                  <group key={`sink-${i}`} position={[offset, 0, 0]}>
                    {/* Lavabo */}
                    <mesh position={[0, 0.8, 0]}>
                      <cylinderGeometry args={[0.25, 0.2, 0.15, 16]} />
                      <meshStandardMaterial color={COLORS.sink} roughness={0.3} />
                    </mesh>
                    {/* Pedestal */}
                    <mesh position={[0, 0.4, 0]}>
                      <cylinderGeometry args={[0.1, 0.15, 0.8, 16]} />
                      <meshStandardMaterial color={COLORS.sink} roughness={0.3} />
                    </mesh>
                    {/* Grifo */}
                    <mesh position={[0, 0.95, -0.15]}>
                      <cylinderGeometry args={[0.02, 0.02, 0.15, 8]} />
                      <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.8} />
                    </mesh>
                  </group>
                ))}
              </group>
              
              {/* Cabinas WC */}
              <group position={[0.5, 0, 1]}>
                {[0, 1.5].map((offset, i) => (
                  <group key={`toilet-${i}`} position={[offset, 0, 0]}>
                    {/* Paredes cabina */}
                    <mesh position={[0, 1, -0.5]}>
                      <boxGeometry args={[1.2, 2, 0.05]} />
                      <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
                    </mesh>
                    <mesh position={[-0.575, 1, 0]}>
                      <boxGeometry args={[0.05, 2, 1]} />
                      <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
                    </mesh>
                    <mesh position={[0.575, 1, 0]}>
                      <boxGeometry args={[0.05, 2, 1]} />
                      <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
                    </mesh>
                    {/* Puerta */}
                    <mesh position={[0, 1, 0.5]}>
                      <boxGeometry args={[0.9, 1.8, 0.05]} />
                      <meshStandardMaterial color="#94a3b8" roughness={0.5} />
                    </mesh>
                    {/* Inodoro */}
                    <mesh position={[0, 0.2, -0.2]}>
                      <boxGeometry args={[0.4, 0.4, 0.5]} />
                      <meshStandardMaterial color={COLORS.toilet} roughness={0.3} />
                    </mesh>
                  </group>
                ))}
              </group>
            </group>
          )}
          
          {/* COMEDOR */}
          {subtype === 'comedor' && (
            <group>
              {/* Mesas */}
              {Array.from({ length: Math.min(3, Math.floor(largo / 3)) }).map((_, row) => (
                <group key={`table-row-${row}`} position={[1 + row * 2.5, 0, ancho / 2]}>
                  {/* Mesa */}
                  <mesh position={[0, 0.75, 0]}>
                    <boxGeometry args={[2, 0.05, 1]} />
                    <meshStandardMaterial color={COLORS.bench} roughness={0.7} />
                  </mesh>
                  {/* Patas */}
                  {[[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]].map(([x, z], i) => (
                    <mesh key={`leg-${i}`} position={[x, 0.375, z]}>
                      <cylinderGeometry args={[0.04, 0.04, 0.75, 8]} />
                      <meshStandardMaterial color="#4a5568" roughness={0.6} />
                    </mesh>
                  ))}
                  {/* Sillas */}
                  {[[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.8], [0.6, 0.8]].map(([x, z], i) => (
                    <group key={`chair-${i}`} position={[x, 0, z]}>
                      {/* Asiento */}
                      <mesh position={[0, 0.45, 0]}>
                        <boxGeometry args={[0.4, 0.05, 0.4]} />
                        <meshStandardMaterial color="#3b82f6" roughness={0.6} />
                      </mesh>
                      {/* Respaldo */}
                      <mesh position={[0, 0.75, z > 0 ? 0.2 : -0.2]}>
                        <boxGeometry args={[0.4, 0.6, 0.05]} />
                        <meshStandardMaterial color="#3b82f6" roughness={0.6} />
                      </mesh>
                      {/* Patas */}
                      {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map(([px, pz], j) => (
                        <mesh key={`chair-leg-${j}`} position={[px, 0.225, pz]}>
                          <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
                          <meshStandardMaterial color="#1e40af" roughness={0.6} />
                        </mesh>
                      ))}
                    </group>
                  ))}
                </group>
              ))}
              
              {/* Microondas en encimera */}
              <group position={[largo - 1, 0, 0.5]}>
                {/* Encimera */}
                <mesh position={[0, 0.9, 0]}>
                  <boxGeometry args={[1.5, 0.05, 0.6]} />
                  <meshStandardMaterial color="#64748b" roughness={0.5} />
                </mesh>
                {/* Microondas */}
                <mesh position={[0, 1.15, 0]}>
                  <boxGeometry args={[0.5, 0.4, 0.4]} />
                  <meshStandardMaterial color="#1f2937" roughness={0.4} />
                </mesh>
              </group>
            </group>
          )}
          
          {/* ENFERMERÍA */}
          {subtype === 'enfermeria' && (
            <group>
              {/* Camilla */}
              <group position={[largo / 2, 0, ancho / 2]}>
                <mesh position={[0, 0.7, 0]}>
                  <boxGeometry args={[1.8, 0.1, 0.8]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.3} />
                </mesh>
                {/* Patas con ruedas */}
                {[[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]].map(([x, z], i) => (
                  <group key={`bed-leg-${i}`} position={[x, 0, z]}>
                    <mesh position={[0, 0.35, 0]}>
                      <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
                      <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.6} />
                    </mesh>
                    <mesh position={[0, 0.05, 0]}>
                      <cylinderGeometry args={[0.06, 0.06, 0.1, 16]} />
                      <meshStandardMaterial color="#1f2937" roughness={0.7} />
                    </mesh>
                  </group>
                ))}
              </group>
              
              {/* Armario medicamentos */}
              <group position={[0.5, 0, 0.5]}>
                <mesh position={[0, 1, 0]}>
                  <boxGeometry args={[0.8, 2, 0.4]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.3} />
                </mesh>
                {/* Puerta con cruz roja */}
                <mesh position={[0, 1, 0.21]}>
                  <boxGeometry args={[0.78, 1.98, 0.02]} />
                  <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
                </mesh>
                <mesh position={[0, 1.2, 0.22]}>
                  <boxGeometry args={[0.15, 0.4, 0.01]} />
                  <meshStandardMaterial color="#ef4444" />
                </mesh>
                <mesh position={[0, 1.2, 0.22]}>
                  <boxGeometry args={[0.4, 0.15, 0.01]} />
                  <meshStandardMaterial color="#ef4444" />
                </mesh>
              </group>
            </group>
          )}
        </group>
      )}
      
      {/* ========== ILUMINACIÓN ========== */}
      
      {/* Luces de techo */}
      {Array.from({ length: Math.max(2, Math.floor(largo / 3)) }).map((_, i) => (
        <group key={`light-${i}`} position={[1 + i * (largo / Math.max(2, Math.floor(largo / 3))), alto - 0.15, ancho / 2]}>
          <mesh>
            <boxGeometry args={[0.6, 0.05, 0.3]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          <pointLight intensity={0.3} distance={5} decay={2} color="#fff5e6" />
        </group>
      ))}
      
      {/* ========== INDICADOR DE SELECCIÓN ========== */}
      
      {isSelected && (
        <mesh position={[largo / 2, 0.02, ancho / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[largo + 0.5, ancho + 0.5]} />
          <meshStandardMaterial color={config.doorColor} transparent opacity={0.3} />
        </mesh>
      )}
      
      {/* ========== ETIQUETA ========== */}
      
      {showLabels && (
        <Html position={[largo / 2, alto + 0.5, ancho / 2]} center>
          <div style={{
            background: `${config.doorColor}dd`,
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
            <span style={{ fontSize: '16px' }}>{config.icon}</span>
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

// Exportar tipos disponibles
export { SERVICE_TYPES }
