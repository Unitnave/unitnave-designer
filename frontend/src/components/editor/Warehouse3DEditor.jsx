/**
 * UNITNAVE Designer - Warehouse 3D Editor V3
 * 
 * CORREGIDO:
 * - TransformControls funciona correctamente
 * - Arrastrar elementos directamente
 * - OrbitControls se desactiva al arrastrar
 * 
 * @version 3.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { 
  OrbitControls, 
  TransformControls,
  PerspectiveCamera,
  Html,
  Grid
} from '@react-three/drei'
import * as THREE from 'three'

// Stores
import useEditorStore from '../../stores/useEditorStore'

// Editor components
import EditorToolbar from './EditorToolbar'
import LayersPanel from './LayersPanel'
import { ValidationMarkers3D, ValidationPanel, DensityIndicator } from './ValidationWarnings'

// ============================================================
// COLORES POR TIPO DE ELEMENTO
// ============================================================
const ELEMENT_COLORS = {
  shelf: '#3b82f6',      // Azul
  dock: '#22c55e',       // Verde
  office: '#a855f7',     // Morado
  zone: '#06b6d4',       // Cyan
  operational_zone: '#06b6d4',
  service_room: '#f59e0b', // Naranja
  technical_room: '#ef4444' // Rojo
}

// ============================================================
// COMPONENTE ELEMENTO INDIVIDUAL CON TRANSFORM
// ============================================================
function EditableElement({ 
  element, 
  isSelected, 
  onSelect, 
  onUpdate,
  orbitControlsRef,
  dimensions
}) {
  const meshRef = useRef()
  const transformRef = useRef()
  const [isHovered, setIsHovered] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const { currentTool, snapConfig, layers } = useEditorStore()
  
  // Marcar como montado después del primer render
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Extraer propiedades del elemento
  const type = element.type || 'unknown'
  const x = element.position?.x ?? 0
  const z = element.position?.y ?? element.position?.z ?? 0
  const rotation = (element.rotation || 0) * Math.PI / 180
  
  // Dimensiones según tipo
  let width, depth, height
  if (type === 'shelf') {
    width = element.dimensions?.length ?? 2.7
    depth = element.dimensions?.depth ?? 1.1
    height = element.dimensions?.height ?? 10
  } else if (type === 'dock') {
    width = element.dimensions?.width ?? 3.5
    depth = element.dimensions?.depth ?? 0.5
    height = element.dimensions?.height ?? 4
  } else if (type === 'office') {
    width = element.dimensions?.length ?? element.dimensions?.largo ?? 12
    depth = element.dimensions?.width ?? element.dimensions?.ancho ?? 8
    height = element.dimensions?.height ?? 3
  } else if (type === 'zone' || type === 'operational_zone') {
    width = element.dimensions?.length ?? element.dimensions?.largo ?? 10
    depth = element.dimensions?.width ?? element.dimensions?.ancho ?? 10
    height = 0.3
  } else {
    width = element.dimensions?.length ?? 3
    depth = element.dimensions?.width ?? element.dimensions?.depth ?? 3
    height = element.dimensions?.height ?? 3
  }
  
  // Verificar visibilidad de capa
  const layerKey = type === 'shelf' ? 'shelves' : 
                   type === 'dock' ? 'docks' : 
                   type === 'office' ? 'offices' : 
                   'zones'
  const isVisible = layers[layerKey]?.visible !== false
  
  if (!isVisible) return null
  
  const color = ELEMENT_COLORS[type] || '#64748b'
  
  // Determinar modo de transformación
  const transformMode = currentTool === 'rotate' ? 'rotate' : 'translate'
  const showTransform = isSelected && (currentTool === 'move' || currentTool === 'rotate' || currentTool === 'select')
  
  // Handler cuando termina el drag
  const handleTransformEnd = useCallback(() => {
    if (!meshRef.current) return
    
    const pos = meshRef.current.position
    const rot = meshRef.current.rotation
    
    // Aplicar snap si está activo
    let finalX = pos.x - width/2  // Restar offset del centro
    let finalZ = pos.z - depth/2
    
    if (snapConfig?.enabled) {
      const snapSize = snapConfig.snapDistance || 0.5
      finalX = Math.round(finalX / snapSize) * snapSize
      finalZ = Math.round(finalZ / snapSize) * snapSize
    }
    
    // Limitar a los bordes de la nave
    finalX = Math.max(0, Math.min(finalX, (dimensions?.length || 80) - width))
    finalZ = Math.max(0, Math.min(finalZ, (dimensions?.width || 40) - depth))
    
    // Actualizar posición en el mesh (con offset del centro)
    meshRef.current.position.x = finalX + width/2
    meshRef.current.position.z = finalZ + depth/2
    
    // Calcular rotación en grados
    const rotationDeg = Math.round((rot.y * 180) / Math.PI)
    
    // Notificar cambio
    onUpdate(element.id, {
      position: {
        x: Math.round(finalX * 100) / 100,
        y: Math.round(finalZ * 100) / 100,
        z: 0
      },
      rotation: rotationDeg
    })
  }, [element.id, onUpdate, snapConfig, dimensions, width, depth])
  
  // Desactivar OrbitControls mientras arrastramos
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    
    const handleDraggingChanged = (event) => {
      if (orbitControlsRef?.current) {
        orbitControlsRef.current.enabled = !event.value
      }
    }
    
    controls.addEventListener('dragging-changed', handleDraggingChanged)
    
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged)
    }
  }, [orbitControlsRef])
  
  return (
    <group>
      {/* El elemento 3D - PRIMERO para que meshRef tenga valor */}
      <mesh
        ref={meshRef}
        position={[x + width/2, height/2, z + depth/2]}
        rotation={[0, rotation, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(element.id)
        }}
        onPointerOver={() => setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial 
          color={color}
          transparent
          opacity={isSelected ? 1 : (isHovered ? 0.9 : 0.8)}
          emissive={isSelected ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      
      {/* TransformControls DESPUÉS de que el mesh existe */}
      {showTransform && mounted && meshRef.current && (
        <TransformControls
          ref={transformRef}
          object={meshRef.current}
          mode={transformMode}
          size={0.7}
          showX={transformMode === 'translate'}
          showY={false}
          showZ={transformMode === 'translate'}
          space="world"
          translationSnap={snapConfig?.enabled ? (snapConfig.snapDistance || 0.5) : null}
          rotationSnap={Math.PI / 12}
          onMouseUp={handleTransformEnd}
        />
      )}
      
      {/* Outline de selección */}
      {isSelected && (
        <mesh
          position={[x + width/2, height/2, z + depth/2]}
          rotation={[0, rotation, 0]}
        >
          <boxGeometry args={[width + 0.3, height + 0.3, depth + 0.3]} />
          <meshBasicMaterial 
            color="#ffff00"
            transparent
            opacity={0.3}
            side={THREE.BackSide}
          />
        </mesh>
      )}
      
      {/* Etiqueta */}
      {(isSelected || isHovered) && (
        <Html
          position={[x + width/2, height + 1, z + depth/2]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: isSelected ? '#3b82f6' : 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}>
            {element.properties?.label || element.id}
            <br/>
            <span style={{ fontSize: '9px', opacity: 0.8 }}>
              {width.toFixed(1)}m × {depth.toFixed(1)}m
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

// ============================================================
// ESCENA PRINCIPAL
// ============================================================
function EditorScene({ 
  dimensions, 
  elements, 
  selectedId, 
  onSelectElement, 
  onUpdateElement 
}) {
  const orbitControlsRef = useRef()
  const { validateLayout, machinery } = useEditorStore()
  
  const { length = 80, width = 40, height = 10 } = dimensions || {}
  
  // Validar layout cuando cambian elementos
  useEffect(() => {
    if (elements && dimensions) {
      validateLayout(elements, dimensions)
    }
  }, [elements, dimensions, machinery, validateLayout])
  
  return (
    <>
      {/* Cámara */}
      <PerspectiveCamera 
        makeDefault 
        position={[length * 0.8, height * 3, width * 1.2]}
        fov={50}
      />
      
      {/* Controles de órbita */}
      <OrbitControls
        ref={orbitControlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2.1}
        target={[length / 2, 0, width / 2]}
      />
      
      {/* Luces */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 80, 30]} intensity={0.8} castShadow />
      <hemisphereLight skyColor="#87CEEB" groundColor="#f0f0f0" intensity={0.4} />
      
      {/* Grid */}
      <Grid
        args={[length, width]}
        position={[length / 2, 0.01, width / 2]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#e0e0e0"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#bdbdbd"
        fadeDistance={200}
        infiniteGrid={false}
      />
      
      {/* Suelo */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[length / 2, 0, width / 2]}
        onClick={() => onSelectElement(null)}
        receiveShadow
      >
        <planeGeometry args={[length, width]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      
      {/* Paredes (wireframe) */}
      <group>
        {/* Pared frontal */}
        <mesh position={[length / 2, height / 2, 0]}>
          <boxGeometry args={[length, height, 0.1]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.3} />
        </mesh>
        {/* Pared trasera */}
        <mesh position={[length / 2, height / 2, width]}>
          <boxGeometry args={[length, height, 0.1]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.3} />
        </mesh>
        {/* Pared izquierda */}
        <mesh position={[0, height / 2, width / 2]}>
          <boxGeometry args={[0.1, height, width]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.3} />
        </mesh>
        {/* Pared derecha */}
        <mesh position={[length, height / 2, width / 2]}>
          <boxGeometry args={[0.1, height, width]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.3} />
        </mesh>
      </group>
      
      {/* Elementos editables */}
      {elements.map(element => (
        <EditableElement
          key={element.id}
          element={element}
          isSelected={selectedId === element.id}
          onSelect={onSelectElement}
          onUpdate={onUpdateElement}
          orbitControlsRef={orbitControlsRef}
          dimensions={dimensions}
        />
      ))}
      
      {/* Marcadores de validación */}
      <ValidationMarkers3D elements={elements} dimensions={dimensions} />
    </>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL DEL EDITOR
// ============================================================
export default function Warehouse3DEditor({ 
  dimensions, 
  elements: initialElements, 
  machinery,
  onElementsChange 
}) {
  const [elements, setElements] = useState(initialElements || [])
  const [selectedId, setSelectedId] = useState(null)
  
  const { 
    showLayersPanel, 
    validationErrors,
    setMachinery 
  } = useEditorStore()
  
  // Sincronizar elementos externos
  useEffect(() => {
    if (initialElements && initialElements.length > 0) {
      console.log('📦 Editor recibió elementos:', initialElements.length)
      setElements(initialElements)
    }
  }, [initialElements])
  
  // Sincronizar maquinaria
  useEffect(() => {
    if (machinery) {
      setMachinery(machinery)
    }
  }, [machinery, setMachinery])
  
  // Handler de selección
  const handleSelectElement = useCallback((id) => {
    setSelectedId(id)
    console.log('🎯 Seleccionado:', id)
  }, [])
  
  // Handler de actualización
  const handleUpdateElement = useCallback((id, updates) => {
    console.log('📝 Actualizando elemento:', id, updates)
    
    setElements(prev => {
      const updated = prev.map(el => {
        if (el.id === id) {
          return {
            ...el,
            position: updates.position || el.position,
            rotation: updates.rotation !== undefined ? updates.rotation : el.rotation
          }
        }
        return el
      })
      
      // Notificar al padre
      if (onElementsChange) {
        onElementsChange(updated)
      }
      
      return updated
    })
  }, [onElementsChange])
  
  // Handler para eliminar elemento
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return
    
    setElements(prev => {
      const updated = prev.filter(el => el.id !== selectedId)
      if (onElementsChange) {
        onElementsChange(updated)
      }
      return updated
    })
    setSelectedId(null)
  }, [selectedId, onElementsChange])
  
  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected()
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDeleteSelected])
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Toolbar */}
      <EditorToolbar />
      
      {/* Canvas 3D */}
      <Canvas
        style={{ background: '#f8fafc' }}
        shadows
        gl={{ 
          antialias: true,
          preserveDrawingBuffer: true 
        }}
      >
        <EditorScene
          dimensions={dimensions}
          elements={elements}
          selectedId={selectedId}
          onSelectElement={handleSelectElement}
          onUpdateElement={handleUpdateElement}
        />
      </Canvas>
      
      {/* Panel de capas */}
      {showLayersPanel && <LayersPanel />}
      
      {/* Panel de validación */}
      <ValidationPanel />
      
      {/* Indicador de densidad */}
      <DensityIndicator elements={elements} dimensions={dimensions} />
      
      {/* Info de dimensiones */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(255,255,255,0.95)',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        fontFamily: 'monospace',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <strong>L:</strong> {dimensions?.length || 80}m &nbsp;
        <strong>A:</strong> {dimensions?.width || 40}m &nbsp;
        <strong>H:</strong> {dimensions?.height || 10}m &nbsp;
        <strong>Sup:</strong> {((dimensions?.length || 80) * (dimensions?.width || 40)).toLocaleString()}m²
      </div>
      
      {/* Instrucciones */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        right: 20,
        background: 'rgba(59, 130, 246, 0.9)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        maxWidth: '200px'
      }}>
        <strong>Controles:</strong><br/>
        • Click = Seleccionar<br/>
        • Flechas rojas/azules = Mover<br/>
        • Delete = Eliminar seleccionado<br/>
        • Scroll = Zoom<br/>
        • Click derecho = Rotar vista
      </div>
    </div>
  )
}

// Re-exportar para compatibilidad
export { Warehouse3DEditor }
