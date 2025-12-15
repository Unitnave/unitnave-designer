/**
 * UNITNAVE Designer - Interactive Element V2.1 DEBUG
 * 
 * ⚠️ VERSIÓN CON LOGS DE DIAGNÓSTICO
 * Cada acción tiene console.error para que sea MUY visible
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { throttle } from 'lodash'
import { useLayoutStore } from '../store/useLayoutStore'

// ============================================================
// DEBUG FLAG - Cambiar a false para producción
// ============================================================
const DEBUG = true

function log(...args: any[]) {
  if (DEBUG) {
    console.error('🔴 [InteractiveElement]', ...args)
  }
}

// ============================================================
// TYPES
// ============================================================

interface Position {
  x: number
  y: number
}

interface Dimensions {
  length?: number
  width?: number
  depth?: number
  height?: number
}

interface WarehouseElement {
  id: string
  type: string
  position: Position
  dimensions: Dimensions
  rotation?: number
  label?: string
  properties?: Record<string, any>
  layer?: string
}

interface InteractiveElementProps {
  element: WarehouseElement
  scale: number
  onMove: (elementId: string, x: number, y: number) => void
  onSelect: (elementId: string) => void
  onResize?: (elementId: string, width: number, height: number) => void
  onRotate?: (elementId: string, rotation: number) => void
  onCursorMove?: (x: number, y: number) => void
  onLock?: (elementId: string) => void
  onUnlock?: (elementId: string) => void
}

// ============================================================
// CONSTANTS
// ============================================================

const ELEMENT_COLORS: Record<string, { fill: string; stroke: string; label: string; icon: string }> = {
  shelf: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Estantería', icon: '📦' },
  rack: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Rack', icon: '🗄️' },
  dock: { fill: '#22c55e', stroke: '#15803d', label: 'Muelle', icon: '🚛' },
  office: { fill: '#a855f7', stroke: '#7c3aed', label: 'Oficina', icon: '🏢' },
  zone: { fill: '#f59e0b', stroke: '#d97706', label: 'Zona', icon: '📍' },
  service_room: { fill: '#6366f1', stroke: '#4f46e5', label: 'Servicios', icon: '🚻' },
  technical_room: { fill: '#64748b', stroke: '#475569', label: 'Técnico', icon: '⚙️' },
  pillar: { fill: '#78716c', stroke: '#57534e', label: 'Pilar', icon: '🏛️' },
  column: { fill: '#78716c', stroke: '#57534e', label: 'Columna', icon: '🏛️' },
  charging_station: { fill: '#eab308', stroke: '#ca8a04', label: 'Carga', icon: '🔌' },
  unknown: { fill: '#94a3b8', stroke: '#64748b', label: 'Elemento', icon: '❓' }
}

const SNAP_GRID = 0.5

// ============================================================
// HELPERS
// ============================================================

function snapToGrid(value: number, gridSize: number = SNAP_GRID): number {
  return Math.round(value / gridSize) * gridSize
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ============================================================
// COMPONENT
// ============================================================

export default function InteractiveElement({
  element,
  scale,
  onMove,
  onSelect,
  onResize,
  onRotate,
  onCursorMove,
  onLock,
  onUnlock
}: InteractiveElementProps) {
  
  // 🔴 LOG: Componente se renderiza
  log('RENDER - elemento:', element.id, 'scale:', scale)
  
  const elementRef = useRef<SVGGElement>(null)
  
  // ============================================================
  // LOCAL STATE
  // ============================================================
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ mouseX: number; mouseY: number; elemX: number; elemY: number } | null>(null)
  const [ghostPosition, setGhostPosition] = useState<Position | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  // ============================================================
  // STORE
  // ============================================================
  const selectedElementId = useLayoutStore((state) => state.selectedElementId)
  const setSelectedElement = useLayoutStore((state) => state.setSelectedElement)
  const setDragging = useLayoutStore((state) => state.setDragging)
  const clientId = useLayoutStore((state) => state.clientId)
  const onlineUsers = useLayoutStore((state) => state.onlineUsers)
  const lockedElements = useLayoutStore((state) => state.lockedElements)
  const dimensions = useLayoutStore((state) => state.dimensions)

  // 🔴 LOG: Estado del store
  log('STORE - selectedElementId:', selectedElementId, 'clientId:', clientId, 'dimensions:', dimensions)

  // ============================================================
  // COMPUTED
  // ============================================================

  const lockedByOther = useMemo(() => {
    const lockedBy = lockedElements[element.id]
    if (lockedBy && lockedBy !== clientId) return lockedBy
    const userWithSelection = onlineUsers.find(
      (u) => u.selected_element === element.id && u.client_id !== clientId
    )
    return userWithSelection?.client_id || null
  }, [lockedElements, onlineUsers, element.id, clientId])

  const isLocked = !!lockedByOther
  const isSelected = selectedElementId === element.id
  const colors = ELEMENT_COLORS[element.type] || ELEMENT_COLORS.unknown

  // 🔴 LOG: Estado computado
  log('COMPUTED - isSelected:', isSelected, 'isLocked:', isLocked, 'isDragging:', isDragging)

  // Position in pixels
  const pos = {
    x: element.position.x * scale,
    y: element.position.y * scale
  }

  // Dimensions in pixels
  const dims = {
    width: ((element.dimensions.length || element.dimensions.width) || 2) * scale,
    height: ((element.dimensions.depth || element.dimensions.height) || 2) * scale
  }

  // Element size in meters
  const sizeMeters = {
    width: (element.dimensions.length || element.dimensions.width) || 2,
    height: (element.dimensions.depth || element.dimensions.height) || 2
  }

  const rotation = element.rotation || 0

  const lockingUserName = useMemo(() => {
    if (!lockedByOther) return null
    const user = onlineUsers.find((u) => u.client_id === lockedByOther)
    return user?.user_name || 'Otro usuario'
  }, [lockedByOther, onlineUsers])

  // ============================================================
  // CLICK HANDLER
  // ============================================================
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    log('🖱️ CLICK DETECTADO en', element.id)
    e.stopPropagation()
    
    if (isDragging) {
      log('⚠️ Click ignorado porque isDragging=true')
      return
    }
    
    if (isLocked) {
      log('🔒 Click ignorado porque isLocked=true')
      return
    }
    
    log('✅ Llamando setSelectedElement y onSelect para', element.id)
    setSelectedElement(element.id)
    onSelect(element.id)
  }, [isLocked, isDragging, element.id, setSelectedElement, onSelect])

  // ============================================================
  // MOUSE DOWN - INICIO DE DRAG
  // ============================================================

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGGElement>) => {
    log('🖱️ MOUSEDOWN DETECTADO en', element.id, 'button:', e.button)
    
    if (e.button !== 0) {
      log('⚠️ MouseDown ignorado - no es botón izquierdo')
      return
    }
    
    e.stopPropagation()
    e.preventDefault()
    
    if (isLocked) {
      log('🔒 MouseDown ignorado - elemento bloqueado')
      return
    }

    // Seleccionar si no está seleccionado
    if (!isSelected) {
      log('📌 Seleccionando elemento', element.id)
      setSelectedElement(element.id)
      onSelect(element.id)
    }

    // Iniciar drag
    log('🚀 INICIANDO DRAG para', element.id)
    log('   - Posición elemento:', element.position.x, element.position.y)
    log('   - Posición mouse:', e.clientX, e.clientY)
    
    setIsDragging(true)
    setDragging(true)
    
    if (onLock) {
      log('🔐 Llamando onLock')
      onLock(element.id)
    }
    
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      elemX: element.position.x,
      elemY: element.position.y
    })
    
    log('✅ Drag iniciado - dragStart configurado')
  }, [isLocked, isSelected, element.id, element.position.x, element.position.y, 
      setSelectedElement, onSelect, setDragging, onLock])

  // ============================================================
  // GLOBAL MOUSE EVENTS
  // ============================================================
  useEffect(() => {
    if (!isDragging || !dragStart) {
      return
    }
    
    log('🎯 useEffect DRAG ACTIVO - añadiendo listeners globales')

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragStart.mouseX) / scale
      const deltaY = (e.clientY - dragStart.mouseY) / scale

      let newX = snapToGrid(dragStart.elemX + deltaX)
      let newY = snapToGrid(dragStart.elemY + deltaY)

      // Clamp
      if (dimensions) {
        newX = clamp(newX, 0, dimensions.length - sizeMeters.width)
        newY = clamp(newY, 0, dimensions.width - sizeMeters.height)
      }

      log('🔄 MouseMove - nueva posición:', newX.toFixed(1), newY.toFixed(1))
      setGhostPosition({ x: newX, y: newY })
    }

    const handleMouseUp = (e: MouseEvent) => {
      log('🖱️ MOUSEUP DETECTADO')
      log('   - ghostPosition:', ghostPosition)
      
      if (ghostPosition) {
        log('📦 LLAMANDO onMove:', element.id, ghostPosition.x, ghostPosition.y)
        onMove(element.id, ghostPosition.x, ghostPosition.y)
      } else {
        log('⚠️ No hay ghostPosition - no se llama onMove')
      }

      log('🧹 Limpiando estado de drag')
      setIsDragging(false)
      setDragging(false)
      setDragStart(null)
      setGhostPosition(null)
      
      if (onUnlock) {
        log('🔓 Llamando onUnlock')
        onUnlock(element.id)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    log('✅ Listeners globales añadidos')

    return () => {
      log('🧹 Removiendo listeners globales')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, ghostPosition, scale, dimensions, 
      sizeMeters, element.id, onMove, setDragging, onUnlock])

  // ============================================================
  // CURSOR MOVE
  // ============================================================
  
  const throttledCursorMove = useMemo(() => {
    return throttle((e: React.MouseEvent) => {
      if (onCursorMove && elementRef.current) {
        const svg = elementRef.current.ownerSVGElement
        if (!svg) return
        const rect = svg.getBoundingClientRect()
        const x = (e.clientX - rect.left) / scale
        const y = (e.clientY - rect.top) / scale
        onCursorMove(x, y)
      }
    }, 100)
  }, [scale, onCursorMove])

  useEffect(() => {
    return () => throttledCursorMove.cancel()
  }, [throttledCursorMove])

  // ============================================================
  // RENDER
  // ============================================================

  const transform = `rotate(${rotation}, ${pos.x + dims.width / 2}, ${pos.y + dims.height / 2})`

  return (
    <>
      <g
        ref={elementRef}
        className={`element element-${element.id}`}
        transform={transform}
        onMouseMove={(e) => throttledCursorMove(e)}
        onMouseEnter={() => {
          log('🔵 MouseEnter', element.id)
          setIsHovered(true)
        }}
        onMouseLeave={() => {
          log('🔵 MouseLeave', element.id)
          setIsHovered(false)
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        style={{
          cursor: isLocked ? 'not-allowed' : isDragging ? 'grabbing' : isSelected ? 'grab' : 'pointer',
          userSelect: 'none'
        }}
      >
        {/* Selection highlight */}
        {isSelected && (
          <rect
            x={pos.x - 4}
            y={pos.y - 4}
            width={dims.width + 8}
            height={dims.height + 8}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={5}
            rx={8}
            ry={8}
            opacity={0.9}
          />
        )}

        {/* Main rectangle */}
        <rect
          x={pos.x}
          y={pos.y}
          width={dims.width}
          height={dims.height}
          fill={colors.fill}
          stroke={isSelected ? '#fbbf24' : isHovered ? '#60a5fa' : colors.stroke}
          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
          opacity={isLocked ? 0.5 : 1}
          rx={4}
          ry={4}
        />

        {/* Label */}
        {dims.width > 50 && dims.height > 18 && (
          <text
            x={pos.x + dims.width / 2}
            y={pos.y + dims.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={Math.min(11, dims.height * 0.35)}
            fontWeight={600}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {element.label || element.id}
          </text>
        )}

        {/* Lock indicator */}
        {isLocked && (
          <g>
            <circle cx={pos.x + dims.width - 12} cy={pos.y + 12} r={10} fill="#ef4444" stroke="white" strokeWidth={2} />
            <text x={pos.x + dims.width - 12} y={pos.y + 16} textAnchor="middle" fill="white" fontSize={11}>
              🔒
            </text>
          </g>
        )}

        {/* Dimensions badge when selected */}
        {isSelected && !isDragging && (
          <g transform={`translate(${pos.x}, ${pos.y + dims.height + 5})`}>
            <rect x={0} y={0} width={dims.width} height={16} fill="rgba(0,0,0,0.8)" rx={3} />
            <text x={dims.width / 2} y={12} textAnchor="middle" fill="white" fontSize={10} fontFamily="monospace">
              {sizeMeters.width.toFixed(1)}m × {sizeMeters.height.toFixed(1)}m
            </text>
          </g>
        )}

        {/* Drag instructions */}
        {isSelected && !isDragging && (
          <g transform={`translate(${pos.x + dims.width / 2}, ${pos.y - 15})`}>
            <rect x={-50} y={-12} width={100} height={18} fill="#22c55e" rx={4} />
            <text x={0} y={2} textAnchor="middle" fill="white" fontSize={10} fontWeight={600}>
              ✋ Arrastra para mover
            </text>
          </g>
        )}

        {/* DEBUG: Versión del componente */}
        <text
          x={pos.x + 2}
          y={pos.y + 10}
          fill="red"
          fontSize={8}
          style={{ pointerEvents: 'none' }}
        >
          V2.1-DEBUG
        </text>
      </g>

      {/* Ghost during drag */}
      {isDragging && ghostPosition && (
        <>
          <rect
            x={ghostPosition.x * scale}
            y={ghostPosition.y * scale}
            width={dims.width}
            height={dims.height}
            fill="rgba(34, 197, 94, 0.2)"
            stroke="#22c55e"
            strokeWidth={3}
            strokeDasharray="8,4"
            rx={4}
            ry={4}
            style={{ pointerEvents: 'none' }}
          />
          
          <g transform={`translate(${ghostPosition.x * scale + dims.width / 2}, ${ghostPosition.y * scale - 25})`}>
            <rect x={-55} y={-14} width={110} height={22} fill="#22c55e" rx={4} />
            <text x={0} y={2} textAnchor="middle" fill="white" fontSize={12} fontWeight={700} fontFamily="monospace">
              X:{ghostPosition.x.toFixed(1)} Y:{ghostPosition.y.toFixed(1)}
            </text>
          </g>
        </>
      )}
    </>
  )
}
