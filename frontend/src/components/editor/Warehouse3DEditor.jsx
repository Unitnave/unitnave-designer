/**
 * UNITNAVE Designer - Warehouse 3D Editor V2
 * 
 * Editor principal que integra:
 * - Canvas 3D con React Three Fiber
 * - Sistema de Tools
 * - Layers
 * - Grid con Snap
 * - Cotas automáticas
 * - Validaciones en tiempo real
 * - TransformControls
 * 
 * @version 2.0
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { 
  OrbitControls, 
  PerspectiveCamera, 
  OrthographicCamera,
  ContactShadows,
  Environment
} from '@react-three/drei'
import * as THREE from 'three'

// Stores
import useEditorStore from '../stores/useEditorStore'
// Asumimos que estos stores existen en tu proyecto
// import useWarehouseStore from '../stores/useWarehouseStore'
// import useUIStore from '../stores/useUIStore'

// Editor components
import EditorToolbar, { EditorToolbarMini } from './EditorToolbar'
import LayersPanel from './LayersPanel'
import EditorGrid, { SnapIndicator } from './EditorGrid'
import AutoDimensions from './AutoDimensions'
import TransformableElement from './TransformableElement.jsx'
import { ValidationMarkers3D, ValidationPanel, DensityIndicator } from './ValidationWarnings'

// 3D components (importar desde tu proyecto)
// import DetailedShelf from '../3d/DetailedShelf'
// import DetailedDock from '../3d/DetailedDock'
// import DetailedOffice from '../3d/DetailedOffice'
// import IndustrialFloor from '../3d/IndustrialFloor'

/**
 * Controlador de cámara que maneja modos 2D/3D
 */
function CameraController({ dimensions }) {
  const { cameraMode, cameraPreset } = useEditorStore()
  const { camera, gl } = useThree()
  const controlsRef = useRef()
  
  const { length = 80, width = 40, height = 10 } = dimensions || {}
  
  useEffect(() => {
    if (!camera) return
    
    const centerX = length / 2
    const centerZ = width / 2
    
    if (cameraMode === '2D') {
      // Vista cenital (planta)
      const distance = Math.max(length, width) * 1.2
      camera.position.set(centerX, distance, centerZ)
      camera.lookAt(centerX, 0, centerZ)
      
      if (controlsRef.current) {
        controlsRef.current.target.set(centerX, 0, centerZ)
        controlsRef.current.enableRotate = false
        controlsRef.current.maxPolarAngle = 0
        controlsRef.current.minPolarAngle = 0
      }
    } else {
      // Vista 3D isométrica
      camera.position.set(
        length * 1.2,
        height * 2.5,
        width * 1.2
      )
      camera.lookAt(centerX, 0, centerZ)
      
      if (controlsRef.current) {
        controlsRef.current.target.set(centerX, 0, centerZ)
        controlsRef.current.enableRotate = true
        controlsRef.current.maxPolarAngle = Math.PI / 2.1
      }
    }
  }, [camera, cameraMode, cameraPreset, length, width, height])
  
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={true}
      enableZoom={true}
      enableRotate={cameraMode === '3D'}
      minDistance={10}
      maxDistance={500}
      panSpeed={1}
      zoomSpeed={1}
    />
  )
}

/**
 * Estructura de la nave (paredes, columnas, cubierta)
 */
function WarehouseStructure({ dimensions }) {
  const { layers } = useEditorStore()
  
  if (!layers.walls.visible) return null
  
  const { length = 80, width = 40, height = 10 } = dimensions || {}
  
  // Calcular columnas
  const columnSpacingX = Math.min(length * 0.2, 25)
  const columnSpacingZ = Math.min(width * 0.2, 25)
  const columnsX = Math.floor(length / columnSpacingX) + 1
  const columnsZ = Math.floor(width / columnSpacingZ) + 1
  
  return (
    <group name="warehouse-structure">
      {/* Paredes transparentes */}
      {[
        { pos: [length / 2, height / 2, 0], size: [length, height, 0.2] },
        { pos: [length / 2, height / 2, width], size: [length, height, 0.2] },
        { pos: [0, height / 2, width / 2], size: [0.2, height, width] },
        { pos: [length, height / 2, width / 2], size: [0.2, height, width] }
      ].map((wall, i) => (
        <mesh key={`wall-${i}`} position={wall.pos}>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial 
            color="#94a3b8" 
            transparent 
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      
      {/* Columnas */}
      {Array.from({ length: columnsX }).map((_, i) => 
        Array.from({ length: columnsZ }).map((_, j) => {
          // Solo columnas en bordes o interiores específicas
          if (i > 0 && i < columnsX - 1 && j > 0 && j < columnsZ - 1) return null
          
          return (
            <mesh 
              key={`col-${i}-${j}`}
              position={[i * columnSpacingX, height / 2, j * columnSpacingZ]}
            >
              <boxGeometry args={[0.4, height, 0.4]} />
              <meshStandardMaterial color="#64748b" roughness={0.7} />
            </mesh>
          )
        })
      )}
    </group>
  )
}

/**
 * Suelo industrial básico
 */
function BasicFloor({ dimensions }) {
  const { length = 80, width = 40 } = dimensions || {}
  
  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[length / 2, -0.01, width / 2]}
      receiveShadow
    >
      <planeGeometry args={[length, width]} />
      <meshStandardMaterial 
        color="#e2e8f0"
        roughness={0.8}
      />
    </mesh>
  )
}

/**
 * Contenedor de elementos editables
 */
function ElementsContainer({ 
  elements, 
  dimensions,
  selectedElements,
  onSelectElement,
  onUpdateElement 
}) {
  const { isElementVisible, isElementLocked, currentTool } = useEditorStore()
  
  // Placeholder para elementos - en producción usarías tus componentes 3D
  const renderElement = (element) => {
    const { type, position, dimensions: dims, properties } = element
    
    // Verificar visibilidad de la capa
    if (!isElementVisible(type)) return null
    
    const x = position?.x || 0
    const z = position?.y || position?.z || 0
    const length = dims?.length || dims?.width || 2.7
    const depth = dims?.depth || dims?.width || 1.1
    const height = dims?.height || 1
    
    // Colores por tipo
    const colors = {
      shelf: '#3b82f6',
      dock: '#22c55e',
      office: '#a855f7',
      zone: '#06b6d4',
      service: '#f59e0b'
    }
    
    const isSelected = selectedElements.includes(element.id)
    
    return (
      <group 
        key={element.id}
        position={[x, 0, z]}
        onClick={(e) => {
          e.stopPropagation()
          if (currentTool === 'erase') {
            // Borrar elemento
            // onDeleteElement(element.id)
          } else {
            onSelectElement(element.id)
          }
        }}
      >
        {/* Elemento básico (placeholder) */}
        <mesh position={[length / 2, height / 2, depth / 2]} castShadow>
          <boxGeometry args={[length, height, depth]} />
          <meshStandardMaterial 
            color={colors[type] || '#64748b'}
            transparent
            opacity={isSelected ? 1 : 0.85}
          />
        </mesh>
        
        {/* Indicador de selección */}
        {isSelected && (
          <mesh 
            position={[length / 2, 0.02, depth / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[length + 0.5, depth + 0.5]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.3} />
          </mesh>
        )}
      </group>
    )
  }
  
  return (
    <group name="elements-container">
      {elements.map(element => {
        const isSelected = selectedElements.includes(element.id)
        
        if (isSelected && (currentTool === 'move' || currentTool === 'rotate')) {
          return (
            <TransformableElement
              key={element.id}
              element={element}
              enabled={true}
              updateElement={onUpdateElement}
            >
              {renderElement(element)}
            </TransformableElement>
          )
        }
        
        return renderElement(element)
      })}
    </group>
  )
}

/**
 * Escena principal del editor
 */
function EditorScene({ 
  dimensions, 
  elements,
  selectedElements,
  onSelectElement,
  onUpdateElement 
}) {
  const { cameraMode, validateLayout, machinery } = useEditorStore()
  
  // Validar layout cuando cambian elementos
  useEffect(() => {
    if (elements && dimensions) {
      validateLayout(elements, dimensions)
    }
  }, [elements, dimensions, machinery, validateLayout])
  
  // Encontrar elemento seleccionado
  const selectedElement = useMemo(() => 
    elements?.find(el => selectedElements.includes(el.id)),
    [elements, selectedElements]
  )
  
  return (
    <>
      {/* Luces */}
      <ambientLight intensity={0.6} />
      <directionalLight 
        position={[50, 80, 30]} 
        intensity={0.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight 
        skyColor="#87CEEB" 
        groundColor="#f0f0f0" 
        intensity={0.4} 
      />
      
      {/* Cámara */}
      <CameraController dimensions={dimensions} />
      
      {/* Plano de fondo para deseleccionar */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]}
        position={[dimensions?.length / 2 || 40, -0.5, dimensions?.width / 2 || 20]}
        onClick={() => onSelectElement(null)}
        visible={false}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Suelo */}
      <BasicFloor dimensions={dimensions} />
      
      {/* Grid */}
      <EditorGrid dimensions={dimensions} />
      
      {/* Estructura de la nave */}
      <WarehouseStructure dimensions={dimensions} />
      
      {/* Elementos */}
      <ElementsContainer
        elements={elements || []}
        dimensions={dimensions}
        selectedElements={selectedElements}
        onSelectElement={onSelectElement}
        onUpdateElement={onUpdateElement}
      />
      
      {/* Cotas */}
      <AutoDimensions 
        dimensions={dimensions}
        elements={elements}
        selectedElement={selectedElement}
      />
      
      {/* Markers de validación */}
      <ValidationMarkers3D />
      
      {/* Sombras de contacto (solo 3D) */}
      {cameraMode === '3D' && (
        <ContactShadows
          position={[dimensions?.length / 2 || 40, 0, dimensions?.width / 2 || 20]}
          width={dimensions?.length || 80}
          height={dimensions?.width || 40}
          far={10}
          opacity={0.3}
          blur={2}
        />
      )}
    </>
  )
}

/**
 * Componente principal del Editor
 */
export default function Warehouse3DEditor({
  dimensions = { length: 80, width: 40, height: 10 },
  elements = [],
  machinery = 'retractil',
  onElementsChange,
  onSelectElement: externalSelectElement
}) {
  const {
    cameraMode,
    selectedElements,
    selectElement,
    setMachinery,
    registerKeyboardShortcuts,
    currentTool
  } = useEditorStore()
  
  // Configurar maquinaria
  useEffect(() => {
    setMachinery(machinery)
  }, [machinery, setMachinery])
  
  // Registrar atajos de teclado
  useEffect(() => {
    const unregister = registerKeyboardShortcuts({
      setElements: (newElements) => onElementsChange?.(newElements),
      getElementById: (id) => elements.find(el => el.id === id),
      addElement: (el) => onElementsChange?.([...elements, el]),
      removeElement: (id) => onElementsChange?.(elements.filter(el => el.id !== id))
    })
    
    return unregister
  }, [elements, onElementsChange, registerKeyboardShortcuts])
  
  // Handler de selección
  const handleSelectElement = useCallback((id) => {
    selectElement(id)
    externalSelectElement?.(id)
  }, [selectElement, externalSelectElement])
  
  // Handler de actualización de elemento
  const handleUpdateElement = useCallback((id, updates) => {
    const newElements = elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    )
    onElementsChange?.(newElements)
  }, [elements, onElementsChange])
  
  // Configuración de cámara según modo
  const cameraProps = useMemo(() => {
    if (cameraMode === '2D') {
      return {
        position: [dimensions.length / 2, Math.max(dimensions.length, dimensions.width) * 1.2, dimensions.width / 2],
        fov: 50,
        near: 1,
        far: 1000
      }
    }
    return {
      position: [dimensions.length * 1.2, dimensions.height * 2.5, dimensions.width * 1.2],
      fov: 50,
      near: 0.1,
      far: 2000
    }
  }, [cameraMode, dimensions])
  
  // Cursor según herramienta
  const getCursor = () => {
    const cursors = {
      select: 'default',
      move: 'move',
      rotate: 'crosshair',
      draw_shelf: 'crosshair',
      draw_dock: 'crosshair',
      draw_office: 'crosshair',
      draw_zone: 'crosshair',
      erase: 'not-allowed',
      measure: 'crosshair',
      pan: 'grab'
    }
    return cursors[currentTool] || 'default'
  }
  
  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        cursor: getCursor()
      }}
    >
      {/* Toolbar principal */}
      <EditorToolbar />
      
      {/* Toolbar lateral (opcional) */}
      <EditorToolbarMini />
      
      {/* Panel de capas */}
      <LayersPanel />
      
      {/* Panel de validaciones */}
      <ValidationPanel position="bottom-right" />
      
      {/* Indicador de densidad */}
      <DensityIndicator elements={elements} dimensions={dimensions} />
      
      {/* Canvas 3D */}
      <Canvas
        shadows
        camera={cameraProps}
        style={{
          background: 'linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%)'
        }}
        gl={{ 
          antialias: true,
          preserveDrawingBuffer: true
        }}
      >
        <EditorScene
          dimensions={dimensions}
          elements={elements}
          selectedElements={selectedElements}
          onSelectElement={handleSelectElement}
          onUpdateElement={handleUpdateElement}
        />
      </Canvas>
      
      {/* Indicador de modo */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        left: 10,
        background: cameraMode === '2D' ? '#3b82f6' : '#8b5cf6',
        color: 'white',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        {cameraMode === '2D' ? '📐 Vista 2D' : '🎮 Vista 3D'}
      </div>
      
      {/* Info de dimensiones */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        right: 10,
        background: 'rgba(255,255,255,0.95)',
        padding: '8px 14px',
        borderRadius: '8px',
        fontSize: '11px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '12px'
      }}>
        <span><strong>L:</strong> {dimensions.length}m</span>
        <span><strong>A:</strong> {dimensions.width}m</span>
        <span><strong>H:</strong> {dimensions.height}m</span>
        <span><strong>Sup:</strong> {(dimensions.length * dimensions.width).toLocaleString()}m²</span>
      </div>
    </div>
  )
}