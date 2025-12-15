/**
 * UNITNAVE Designer - Interactive Element V2.0 (SVG NATIVE DRAG)
 * 
 * ⚠️ PROBLEMA RESUELTO: react-moveable NO funciona con elementos SVG <g>
 * ✅ SOLUCIÓN: Usar eventos nativos de mouse que SÍ funcionan en SVG
 *
 * Características:
 * - Drag & drop NATIVO con mouse events (funciona en SVG)
 * - Snap to grid (0.5m)
 * - Ghost preview durante drag
 * - Indicador de bloqueo por otros usuarios
 * - Colores por tipo de elemento
 * - Límites del almacén respetados
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { throttle } from 'lodash'
import { useLayoutStore } from '../store/useLayoutStore'

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

const SNAP_GRID = 0.5 // metros

// ============================================================
// HELPERS
// ============================================================

function snapToGrid(value: number, gridSize: number = SNAP_GRID): number {
  return Math.round(value / gridSize) * gridSize
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Logger
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`%c[ELEMENT] ${msg}`, 'color: #3b82f6', ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[ELEMENT] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ELEMENT] ${msg}`, ...args)
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
  const {
    selectedElementId,
    setSelectedElement,
    setDragging: setStoreDragging,
    clientId,
    onlineUsers,
    lockedElements,
    dimensions: warehouseDimensions
  } = useLayoutStore()

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

  // Element size in meters (for bounds checking)
  const sizeMeters = {
    width: (element.dimensions.length || element.dimensions.width) || 2,
    height: (element.dimensions.depth || element.dimensions.height) || 2
  }

  const rotation = element.rotation || 0

  // Locking user's name
  const lockingUserName = useMemo(() => {
    if (!lockedByOther) return null
    const user = onlineUsers.find((u) => u.client_id === lockedByOther)
    return user?.user_name || 'Otro usuario'
  }, [lockedByOther, onlineUsers])

  // ============================================================
  // CLICK HANDLER - SELECCIÓN
  // ============================================================
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    
    // No procesar click si acabamos de hacer drag
    if (isDragging) return
    
    if (!isLocked) {
      logger.info(`🖱️ Click → Seleccionando: ${element.id}`)
      setSelectedElement(element.id)
      onSelect(element.id)
    }
  }, [isLocked, isDragging, element.id, setSelectedElement, onSelect])

  // ============================================================
  // DRAG HANDLERS - NATIVOS SVG (NO MOVEABLE)
  // ============================================================

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGGElement>) => {
    // Solo botón izquierdo
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    
    if (isLocked) {
      logger.warn(`🔒 Elemento bloqueado por otro usuario: ${element.id}`)
      return
    }

    // Primero seleccionar si no está seleccionado
    if (!isSelected) {
      logger.info(`🖱️ MouseDown → Seleccionando: ${element.id}`)
      setSelectedElement(element.id)
      onSelect(element.id)
    }

    // Iniciar drag
    logger.info(`🖱️ MouseDown → Iniciando DRAG: ${element.id}`)
    setIsDragging(true)
    setStoreDragging(true)
    onLock?.(element.id)
    
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      elemX: element.position.x,
      elemY: element.position.y
    })
  }, [isLocked, isSelected, element.id, element.position.x, element.position.y, 
      setSelectedElement, onSelect, setStoreDragging, onLock])

  // ============================================================
  // GLOBAL MOUSE EVENTS (window) para capturar fuera del elemento
  // ============================================================
  useEffect(() => {
    if (!isDragging || !dragStart) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - dragStart.mouseX) / scale
      const deltaY = (e.clientY - dragStart.mouseY) / scale

      let newX = snapToGrid(dragStart.elemX + deltaX)
      let newY = snapToGrid(dragStart.elemY + deltaY)

      // Clamp dentro de los límites del almacén
      newX = clamp(newX, 0, warehouseDimensions.length - sizeMeters.width)
      newY = clamp(newY, 0, warehouseDimensions.width - sizeMeters.height)

      setGhostPosition({ x: newX, y: newY })
    }

    const handleMouseUp = (e: MouseEvent) => {
      logger.info(`🖱️ MouseUp → Fin DRAG: ${element.id}`)
      
      if (ghostPosition) {
        logger.info(`📦 MOVIENDO ${element.id} → (${ghostPosition.x.toFixed(1)}, ${ghostPosition.y.toFixed(1)})`)
        onMove(element.id, ghostPosition.x, ghostPosition.y)
      }

      // Reset state
      setIsDragging(false)
      setStoreDragging(false)
      setDragStart(null)
      setGhostPosition(null)
      onUnlock?.(element.id)
    }

    // Agregar listeners globales
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, ghostPosition, scale, warehouseDimensions, 
      sizeMeters, element.id, onMove, setStoreDragging, onUnlock])

  // ============================================================
  // CURSOR MOVE (throttled)
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
  // RENDER HELPERS
  // ============================================================

  const renderShelfPattern = useMemo(() => {
    if (element.type !== 'shelf' && element.type !== 'rack') return null
    if (dims.width < 40) return null

    const moduleCount = Math.floor(dims.width / 30)
    return Array.from({ length: moduleCount }).map((_, i) => (
      <line
        key={`mod-${i}`}
        x1={pos.x + (i + 1) * 30}
        y1={pos.y + 2}
        x2={pos.x + (i + 1) * 30}
        y2={pos.y + dims.height - 2}
        stroke={colors.stroke}
        strokeWidth={1}
        opacity={0.3}
      />
    ))
  }, [element.type, dims.width, dims.height, pos.x, pos.y, colors.stroke])

  const renderDockArrows = useMemo(() => {
    if (element.type !== 'dock') return null

    const arrowSize = Math.min(dims.width, dims.height) * 0.3
    const cx = pos.x + dims.width / 2
    const cy = pos.y + dims.height / 2

    return (
      <g opacity={0.6}>
        <polygon
          points={`${cx},${cy - arrowSize} ${cx - arrowSize / 2},${cy} ${cx + arrowSize / 2},${cy}`}
          fill="white"
        />
        <line
          x1={cx} y1={cy}
          x2={cx} y2={cy + arrowSize * 0.8}
          stroke="white"
          strokeWidth={arrowSize * 0.15}
        />
      </g>
    )
  }, [element.type, dims, pos])

  // ============================================================
  // RENDER
  // ============================================================

  const transform = `rotate(${rotation}, ${pos.x + dims.width / 2}, ${pos.y + dims.height / 2})`

  return (
    <>
      {/* Main element group */}
      <g
        ref={elementRef}
        className={`element element-${element.id}`}
        transform={transform}
        onMouseMove={(e) => throttledCursorMove(e)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        style={{
          cursor: isLocked ? 'not-allowed' : isDragging ? 'grabbing' : isSelected ? 'grab' : 'pointer',
          userSelect: 'none'
        }}
      >
        {/* Selection highlight (yellow border) - STRONGER */}
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

        {/* Type-specific patterns */}
        {renderShelfPattern}
        {renderDockArrows}

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

        {/* Small icon for small elements */}
        {dims.width <= 50 && dims.height > 15 && (
          <text
            x={pos.x + dims.width / 2}
            y={pos.y + dims.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            style={{ pointerEvents: 'none' }}
          >
            {colors.icon}
          </text>
        )}

        {/* Lock indicator */}
        {isLocked && (
          <g>
            <circle cx={pos.x + dims.width - 12} cy={pos.y + 12} r={10} fill="#ef4444" stroke="white" strokeWidth={2} />
            <text x={pos.x + dims.width - 12} y={pos.y + 16} textAnchor="middle" fill="white" fontSize={11}>
              🔒
            </text>
            {isHovered && lockingUserName && (
              <g transform={`translate(${pos.x + dims.width - 12}, ${pos.y - 5})`}>
                <rect x={-40} y={-18} width={80} height={16} fill="#1e293b" rx={4} ry={4} />
                <text x={0} y={-6} textAnchor="middle" fill="white" fontSize={9}>
                  {lockingUserName}
                </text>
              </g>
            )}
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

        {/* Drag instructions when selected (NOT dragging) */}
        {isSelected && !isDragging && (
          <g transform={`translate(${pos.x + dims.width / 2}, ${pos.y - 15})`}>
            <rect x={-50} y={-12} width={100} height={18} fill="#22c55e" rx={4} />
            <text x={0} y={2} textAnchor="middle" fill="white" fontSize={10} fontWeight={600}>
              ✋ Arrastra para mover
            </text>
          </g>
        )}
      </g>

      {/* Ghost preview during drag */}
      {isDragging && ghostPosition && (
        <>
          {/* Ghost rectangle */}
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
          
          {/* Position indicator */}
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
