/**
 * UNITNAVE Designer - Transformable Element V2
 * 
 * Wrapper que permite mover y rotar elementos 3D con:
 * - TransformControls de drei
 * - Snap integrado
 * - Límites de movimiento
 * - Feedback visual durante drag
 * - Integración con Undo/Redo
 * 
 * @version 2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { TransformControls } from '@react-three/drei'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

import useEditorStore from '../../stores/useEditorStore'

export default function TransformableElement({
  children,
  element,
  enabled = true,
  onTransformEnd,
  updateElement  // Función para actualizar el elemento en el store
}) {
  const transformRef = useRef()
  const groupRef = useRef()
  
  const {
    currentTool,
    snapConfig,
    snapPosition,
    gridConfig,
    isElementLocked,
    pushToHistory,
    setIsTransforming,
    selectedElements,
    // Nuevos para guías dinámicas
    setDragOrigin,
    clearDragOrigin,
    calculateGuides,
    shiftPressed
  } = useEditorStore()
  
  const [isDragging, setIsDragging] = useState(false)
  const [previewPosition, setPreviewPosition] = useState(null)
  const [initialState, setInitialState] = useState(null)
  
  // Verificar si este elemento está seleccionado
  const isSelected = selectedElements.includes(element?.id)
  
  // Verificar si la capa está bloqueada
  const isLocked = element ? isElementLocked(element.type) : false
  
  // Determinar modo de transformación según herramienta actual
  const transformMode = currentTool === 'rotate' ? 'rotate' : 'translate'
  
  // Solo habilitar si está seleccionado y no bloqueado
  const isTransformEnabled = enabled && isSelected && !isLocked && 
    (currentTool === 'move' || currentTool === 'rotate' || currentTool === 'select')
  
  // Obtener dimensiones de la nave del contexto (pasadas como prop o del store)
  const getDimensions = useCallback(() => {
    // Asumimos que las dimensiones vienen del warehouse store
    return { length: 80, width: 40 } // Default, debería venir de props
  }, [])
  
  // Handler cuando empieza el drag
  const handleDragStart = useCallback(() => {
    if (!element) return
    
    setIsDragging(true)
    setIsTransforming(true)
    
    // Guardar origen para modo ortogonal
    const initialX = element.position?.x || 0
    const initialZ = element.position?.y ?? element.position?.z ?? 0
    setDragOrigin({ x: initialX, z: initialZ })
    
    // Guardar estado inicial para undo
    setInitialState({
      position: { ...element.position },
      rotation: element.rotation || 0
    })
  }, [element, setIsTransforming, setDragOrigin])
  
  // Handler durante el drag
  const handleDrag = useCallback(() => {
    if (!groupRef.current || !element) return
    
    const pos = groupRef.current.position
    const dimensions = getDimensions()
    
    // Obtener dimensiones del elemento para guías
    const elWidth = element.dimensions?.length || 2.7
    const elDepth = element.dimensions?.depth || 1.1
    
    // Calcular guías dinámicas (alineación con otros elementos)
    // TODO: Pasar lista de elementos reales
    calculateGuides(pos.x, pos.z, elWidth, elDepth, [], element.id)
    
    // Aplicar snap (ahora incluye ortho con SHIFT y guías)
    const snapped = snapPosition(pos.x, pos.z, [], dimensions, element.id)
    
    setPreviewPosition({
      x: snapped.x,
      z: snapped.z,
      snappedTo: snapped.snappedTo
    })
    
    // Actualizar posición visual con snap
    if (snapConfig.enabled && snapped.snappedTo) {
      groupRef.current.position.x = snapped.x
      groupRef.current.position.z = snapped.z
    }
  }, [element, snapPosition, snapConfig.enabled, getDimensions, calculateGuides])
  
  // Handler cuando termina el drag
  const handleDragEnd = useCallback(() => {
    if (!groupRef.current || !element) return
    
    setIsDragging(false)
    setIsTransforming(false)
    setPreviewPosition(null)
    
    // Limpiar guías y origen
    clearDragOrigin()
    
    const pos = groupRef.current.position
    const rot = groupRef.current.rotation
    const dimensions = getDimensions()
    
    // Aplicar snap final
    const snapped = snapPosition(pos.x, pos.z, [], dimensions)
    
    // Aplicar límites (mantener dentro de la nave)
    const elLength = element.dimensions?.length || 2.7
    const elDepth = element.dimensions?.depth || 1.1
    
    const finalX = Math.max(0, Math.min(snapped.x, dimensions.length - elLength))
    const finalZ = Math.max(0, Math.min(snapped.z, dimensions.width - elDepth))
    
    // Calcular rotación en grados
    const rotationDeg = Math.round((rot.y * 180) / Math.PI)
    
    // Actualizar elemento
    const updatedPosition = {
      x: Math.round(finalX * 100) / 100,
      y: Math.round(finalZ * 100) / 100,  // y es Z en el modelo 2D
      z: element.position?.z || 0
    }
    
    if (updateElement) {
      updateElement(element.id, {
        position: updatedPosition,
        rotation: rotationDeg
      })
    }
    
    // Registrar en historial para undo
    if (initialState && onTransformEnd) {
      onTransformEnd({
        elementId: element.id,
        before: initialState,
        after: {
          position: updatedPosition,
          rotation: rotationDeg
        }
      })
    }
    
    // Push to history
    pushToHistory({
      type: 'transform',
      elementId: element.id,
      before: initialState,
      after: {
        position: updatedPosition,
        rotation: rotationDeg
      },
      description: `${transformMode === 'rotate' ? 'Rotar' : 'Mover'} ${element.type}`
    })
    
    setInitialState(null)
  }, [
    element, 
    getDimensions, 
    snapPosition, 
    updateElement, 
    onTransformEnd, 
    initialState,
    pushToHistory,
    setIsTransforming,
    transformMode,
    clearDragOrigin
  ])
  
  // Configurar eventos de TransformControls
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    
    controls.addEventListener('dragging-changed', (event) => {
      if (event.value) {
        handleDragStart()
      } else {
        handleDragEnd()
      }
    })
    
    controls.addEventListener('change', handleDrag)
    
    return () => {
      controls.removeEventListener('dragging-changed', handleDragStart)
      controls.removeEventListener('change', handleDrag)
    }
  }, [handleDragStart, handleDragEnd, handleDrag])
  
  // Si no está habilitado o no está seleccionado, renderizar solo children
  if (!isTransformEnabled) {
    return (
      <group ref={groupRef}>
        {children}
      </group>
    )
  }
  
  return (
    <group>
      <TransformControls
        ref={transformRef}
        object={groupRef.current}
        mode={transformMode}
        size={0.8}
        showX={transformMode === 'translate'}
        showY={false}  // No permitir mover en Y (altura)
        showZ={transformMode === 'translate'}
        translationSnap={snapConfig.enabled ? snapConfig.snapDistance : null}
        rotationSnap={
          snapConfig.orthoMode 
            ? Math.PI / 2  // 90 grados
            : snapConfig.enabled 
              ? Math.PI / 12  // 15 grados
              : null
        }
        space="world"
      />
      
      <group ref={groupRef}>
        {children}
        
        {/* Indicador de posición durante drag */}
        {isDragging && previewPosition && (
          <Html
            position={[0, 2, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: '#3b82f6',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              X: {previewPosition.x.toFixed(2)}m | Z: {previewPosition.z.toFixed(2)}m
              {previewPosition.snappedTo && (
                <span style={{ 
                  marginLeft: '8px', 
                  background: '#22c55e',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px'
                }}>
                  SNAP: {previewPosition.snappedTo}
                </span>
              )}
            </div>
          </Html>
        )}
        
        {/* Indicador de herramienta activa cuando está seleccionado */}
        {!isDragging && (
          <Html
            position={[0, -0.5, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: transformMode === 'rotate' ? '#a855f7' : '#3b82f6',
              color: 'white',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {transformMode === 'rotate' ? '↻ Rotar' : '✥ Mover'}
            </div>
          </Html>
        )}
      </group>
      
      {/* Preview de posición final con snap */}
      {isDragging && previewPosition && snapConfig.enabled && previewPosition.snappedTo && (
        <mesh 
          position={[previewPosition.x, 0.02, previewPosition.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[
            element?.dimensions?.length || 2.7,
            element?.dimensions?.depth || 1.1
          ]} />
          <meshBasicMaterial 
            color="#22c55e" 
            transparent 
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  )
}

/**
 * Hook para usar TransformControls con un elemento
 */
export function useTransformControls(elementId) {
  const {
    currentTool,
    setTool,
    selectedElements,
    selectElement,
    isTransforming,
    setIsTransforming
  } = useEditorStore()
  
  const isSelected = selectedElements.includes(elementId)
  const transformMode = currentTool === 'rotate' ? 'rotate' : 'translate'
  
  return {
    transformMode,
    setTransformMode: (mode) => setTool(mode === 'rotate' ? 'rotate' : 'move'),
    isSelected,
    isTransforming,
    selectForTransform: () => selectElement(elementId),
    deselectFromTransform: () => selectElement(null)
  }
}
