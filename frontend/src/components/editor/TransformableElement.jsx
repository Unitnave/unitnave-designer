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
 * @version 2.0 (FIXED)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { TransformControls } from '@react-three/drei'
import { Html } from '@react-three/drei'

import useEditorStore from '../../stores/useEditorStore'

export default function TransformableElement({
  children,
  element,
  enabled = true,
  onTransformEnd,
  updateElement,          // Función para actualizar el elemento en el store

  // ✅ NUEVO (opcional, compatible): para no hardcodear 80x40 y para snap/guías reales
  warehouseDimensions,    // { length, width }
  allElements = []        // lista de elementos para snapping/alineación (si no la pasas, queda sin snap a otros)
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
  const isTransformEnabled =
    enabled &&
    isSelected &&
    !isLocked &&
    (currentTool === 'move' || currentTool === 'rotate' || currentTool === 'select')

  // ✅ Dimensiones reales: primero props, si no, fallback (mantiene tu comportamiento actual)
  const getDimensions = useCallback(() => {
    if (warehouseDimensions?.length && warehouseDimensions?.width) {
      return { length: warehouseDimensions.length, width: warehouseDimensions.width }
    }
    // TODO: idealmente leerlas de tu warehouse store si existe
    return { length: 80, width: 40 }
  }, [warehouseDimensions])

  // Helper tamaños del elemento (para clamp y guías)
  const getElementSize = useCallback(() => {
    const elLength = element?.dimensions?.length || 2.7
    const elDepth = element?.dimensions?.depth || 1.1
    return { elLength, elDepth }
  }, [element])

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
    const { elLength, elDepth } = getElementSize()

    // ✅ Calcular guías dinámicas (alineación con otros elementos)
    // Antes pasabas [], así que nunca funcionaría. Ahora usa allElements.
    calculateGuides(pos.x, pos.z, elLength, elDepth, allElements, element.id)

    // ✅ Aplicar snap (ahora con lista real de elementos y dims reales)
    const snapped = snapPosition(pos.x, pos.z, allElements, dimensions, element.id)

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
  }, [
    element,
    snapPosition,
    snapConfig.enabled,
    getDimensions,
    calculateGuides,
    allElements,
    getElementSize
  ])

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

    // ✅ Aplicar snap final (antes NO pasabas element.id y pasabas [] => inconsistente)
    const snapped = snapPosition(pos.x, pos.z, allElements, dimensions, element.id)

    // Aplicar límites (mantener dentro de la nave) usando tamaño del elemento
    const { elLength, elDepth } = getElementSize()

    const finalX = Math.max(0, Math.min(snapped.x, dimensions.length - elLength))
    const finalZ = Math.max(0, Math.min(snapped.z, dimensions.width - elDepth))

    // Calcular rotación en grados
    const rotationDeg = Math.round((rot.y * 180) / Math.PI)

    // Actualizar elemento
    const updatedPosition = {
      x: Math.round(finalX * 100) / 100,
      y: Math.round(finalZ * 100) / 100, // y es Z en el modelo 2D
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
    clearDragOrigin,
    allElements,
    getElementSize
  ])

  // ✅ Configurar eventos de TransformControls (FIX: listeners removidos correctamente)
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return

    // IMPORTANTE: guardar referencias a handlers para poder removerlos.
    const onDraggingChanged = (event) => {
      if (event.value) handleDragStart()
      else handleDragEnd()
    }

    const onChange = () => {
      handleDrag()
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    controls.addEventListener('change', onChange)

    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
      controls.removeEventListener('change', onChange)
    }
  }, [handleDragStart, handleDragEnd, handleDrag])

  // Si no está habilitado o no está seleccionado, renderizar solo children
  if (!isTransformEnabled) {
    return <group ref={groupRef}>{children}</group>
  }

  return (
    <group>
      {/* ✅ FIX: TransformControls “wrappea” el group controlado.
          Así evitamos estados raros por object={groupRef.current} cuando todavía es null. */}
      <TransformControls
        ref={transformRef}
        mode={transformMode}
        size={0.8}
        showX={transformMode === 'translate'}
        showY={false} // No permitir mover en Y (altura)
        showZ={transformMode === 'translate'}
        translationSnap={snapConfig.enabled ? snapConfig.snapDistance : null}
        rotationSnap={
          snapConfig.orthoMode
            ? Math.PI / 2 // 90 grados
            : snapConfig.enabled
              ? Math.PI / 12 // 15 grados
              : null
        }
        space="world"
      >
        <group ref={groupRef}>
          {children}

          {/* Indicador de posición durante drag */}
          {isDragging && previewPosition && (
            <Html position={[0, 2, 0]} center style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                X: {previewPosition.x.toFixed(2)}m | Z: {previewPosition.z.toFixed(2)}m
                {previewPosition.snappedTo && (
                  <span
                    style={{
                      marginLeft: '8px',
                      background: '#22c55e',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px'
                    }}
                  >
                    SNAP: {previewPosition.snappedTo}
                  </span>
                )}
              </div>
            </Html>
          )}

          {/* Indicador de herramienta activa cuando está seleccionado */}
          {!isDragging && (
            <Html position={[0, -0.5, 0]} center style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: transformMode === 'rotate' ? '#a855f7' : '#3b82f6',
                  color: 'white',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {transformMode === 'rotate' ? '↻ Rotar' : '✥ Mover'}
              </div>
            </Html>
          )}
        </group>
      </TransformControls>

      {/* Preview de posición final con snap */}
      {isDragging && previewPosition && snapConfig.enabled && previewPosition.snappedTo && (
        <mesh
          position={[previewPosition.x, 0.02, previewPosition.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry
            args={[element?.dimensions?.length || 2.7, element?.dimensions?.depth || 1.1]}
          />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
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
