/**
 * UNITNAVE Designer - Interactive Element (V1.0)
 * Elemento interactivo con drag, resize, rotate
 * 
 * Características:
 * - Drag & drop con snap to grid
 * - Resize desde esquinas
 * - Rotación
 * - Ghost preview durante operaciones
 * - Indicador de bloqueo por otros usuarios
 * - Colores por tipo de elemento
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import Moveable from 'react-moveable'
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
  shelf: { 
    fill: '#3b82f6', 
    stroke: '#1d4ed8', 
    label: 'Estantería',
    icon: '📦'
  },
  rack: { 
    fill: '#3b82f6', 
    stroke: '#1d4ed8', 
    label: 'Rack',
    icon: '🗄️'
  },
  dock: { 
    fill: '#22c55e', 
    stroke: '#15803d', 
    label: 'Muelle',
    icon: '🚛'
  },
  office: { 
    fill: '#a855f7', 
    stroke: '#7c3aed', 
    label: 'Oficina',
    icon: '🏢'
  },
  zone: { 
    fill: '#f59e0b', 
    stroke: '#d97706', 
    label: 'Zona',
    icon: '📍'
  },
  service_room: { 
    fill: '#6366f1', 
    stroke: '#4f46e5', 
    label: 'Servicios',
    icon: '🚻'
  },
  technical_room: { 
    fill: '#64748b', 
    stroke: '#475569', 
    label: 'Técnico',
    icon: '⚙️'
  },
  pillar: { 
    fill: '#78716c', 
    stroke: '#57534e', 
    label: 'Pilar',
    icon: '🏛️'
  },
  column: { 
    fill: '#78716c', 
    stroke: '#57534e', 
    label: 'Columna',
    icon: '🏛️'
  },
  charging_station: { 
    fill: '#eab308', 
    stroke: '#ca8a04', 
    label: 'Carga',
    icon: '🔌'
  },
  unknown: { 
    fill: '#94a3b8', 
    stroke: '#64748b', 
    label: 'Elemento',
    icon: '❓'
  }
}

const SNAP_GRID = 0.5  // 0.5m snap

// ============================================================
// HELPERS
// ============================================================

function snapToGrid(value: number, gridSize: number = SNAP_GRID): number {
  return Math.round(value / gridSize) * gridSize
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
  const targetRef = useRef<SVGGElement>(null)
  const frameRef = useRef({ x: 0, y: 0, width: 0, height: 0, rotation: 0 })
  
  // ============================================================
  // STORE
  // ============================================================
  
  const selectedElementId = useLayoutStore((state) => state.selectedElementId)
  const setSelectedElement = useLayoutStore((state) => state.setSelectedElement)
  const isDragging = useLayoutStore((state) => state.isDragging)
  const setDragging = useLayoutStore((state) => state.setDragging)
  const isResizing = useLayoutStore((state) => state.isResizing)
  const setResizing = useLayoutStore((state) => state.setResizing)
  const isRotating = useLayoutStore((state) => state.isRotating)
  const setRotating = useLayoutStore((state) => state.setRotating)
  const clientId = useLayoutStore((state) => state.clientId)
  const onlineUsers = useLayoutStore((state) => state.onlineUsers)
  const lockedElements = useLayoutStore((state) => state.lockedElements)
  
  // ============================================================
  // COMPUTED
  // ============================================================
  
  // Check if locked by another user
  const lockedByOther = useMemo(() => {
    const lockedBy = lockedElements[element.id]
    if (lockedBy && lockedBy !== clientId) return lockedBy
    
    // También chequear si otro usuario lo tiene seleccionado
    const userWithSelection = onlineUsers.find(u => 
      u.selected_element === element.id && u.client_id !== clientId
    )
    return userWithSelection?.client_id || null
  }, [lockedElements, onlineUsers, element.id, clientId])
  
  const isLocked = !!lockedByOther
  const isSelected = selectedElementId === element.id
  const isActive = isSelected && !isLocked
  
  // Get locking user's name
  const lockingUserName = useMemo(() => {
    if (!lockedByOther) return null
    const user = onlineUsers.find(u => u.client_id === lockedByOther)
    return user?.user_name || 'Otro usuario'
  }, [lockedByOther, onlineUsers])
  
  // Colors and styles
  const colors = ELEMENT_COLORS[element.type] || ELEMENT_COLORS.unknown
  
  // Position and dimensions in pixels
  const pos = {
    x: element.position.x * scale,
    y: element.position.y * scale
  }
  
  const dims = {
    width: ((element.dimensions.length || element.dimensions.width) || 2) * scale,
    height: ((element.dimensions.depth || element.dimensions.height) || 2) * scale
  }
  
  const rotation = element.rotation || 0
  
  // ============================================================
  // LOCAL STATE
  // ============================================================
  
  const [ghostPosition, setGhostPosition] = useState<Position | null>(null)
  const [ghostDimensions, setGhostDimensions] = useState<{ width: number; height: number } | null>(null)
  const [ghostRotation, setGhostRotation] = useState<number | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  
  // ============================================================
  // INITIALIZE FRAME
  // ============================================================
  
  useEffect(() => {
    frameRef.current = {
      x: pos.x,
      y: pos.y,
      width: dims.width,
      height: dims.height,
      rotation
    }
  }, [pos.x, pos.y, dims.width, dims.height, rotation])
  
  // ============================================================
  // MOUSE HANDLERS
  // ============================================================
  
  const handleMouseMove = useCallback(
    throttle((e: React.MouseEvent) => {
      if (onCursorMove && targetRef.current) {
        const svg = targetRef.current.ownerSVGElement
        if (!svg) return
        
        const rect = svg.getBoundingClientRect()
        const x = (e.clientX - rect.left) / scale
        const y = (e.clientY - rect.top) / scale
        onCursorMove(x, y)
      }
    }, 100),
    [scale, onCursorMove]
  )
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLocked) {
      setSelectedElement(element.id)
      onSelect(element.id)
    }
  }, [isLocked, element.id, setSelectedElement, onSelect])
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Podría abrir un panel de propiedades
    console.log('Double click on element:', element.id)
  }, [element.id])
  
  // ============================================================
  // DRAG HANDLERS
  // ============================================================
  
  const handleDragStart = useCallback(() => {
    if (isLocked) return false
    
    setDragging(true)
    onLock?.(element.id)
    
    frameRef.current = {
      ...frameRef.current,
      x: pos.x,
      y: pos.y
    }
    
    return true
  }, [isLocked, setDragging, onLock, element.id, pos.x, pos.y])
  
  const handleDrag = useCallback(({ beforeTranslate }: { beforeTranslate: number[] }) => {
    const newX = frameRef.current.x + beforeTranslate[0]
    const newY = frameRef.current.y + beforeTranslate[1]
    
    // Convert to meters and snap
    const snappedX = snapToGrid(newX / scale)
    const snappedY = snapToGrid(newY / scale)
    
    setGhostPosition({ x: snappedX, y: snappedY })
  }, [scale])
  
  const handleDragEnd = useCallback(({ lastEvent }: { lastEvent: any }) => {
    setDragging(false)
    
    if (ghostPosition) {
      onMove(element.id, ghostPosition.x, ghostPosition.y)
    }
    
    setGhostPosition(null)
    onUnlock?.(element.id)
  }, [setDragging, ghostPosition, element.id, onMove, onUnlock])
  
  // ============================================================
  // RESIZE HANDLERS
  // ============================================================
  
  const handleResizeStart = useCallback(() => {
    if (isLocked || !onResize) return false
    
    setResizing(true)
    onLock?.(element.id)
    
    frameRef.current = {
      ...frameRef.current,
      width: dims.width,
      height: dims.height
    }
    
    return true
  }, [isLocked, onResize, setResizing, onLock, element.id, dims.width, dims.height])
  
  const handleResize = useCallback(({ width, height, drag }: { width: number; height: number; drag: { beforeTranslate: number[] } }) => {
    // Convert to meters and snap
    const newWidth = snapToGrid(width / scale)
    const newHeight = snapToGrid(height / scale)
    
    setGhostDimensions({ width: newWidth, height: newHeight })
    
    // Also update position if dragging during resize
    if (drag.beforeTranslate) {
      const newX = snapToGrid((frameRef.current.x + drag.beforeTranslate[0]) / scale)
      const newY = snapToGrid((frameRef.current.y + drag.beforeTranslate[1]) / scale)
      setGhostPosition({ x: newX, y: newY })
    }
  }, [scale])
  
  const handleResizeEnd = useCallback(() => {
    setResizing(false)
    
    if (ghostDimensions && onResize) {
      onResize(element.id, ghostDimensions.width, ghostDimensions.height)
    }
    
    setGhostDimensions(null)
    setGhostPosition(null)
    onUnlock?.(element.id)
  }, [setResizing, ghostDimensions, element.id, onResize, onUnlock])
  
  // ============================================================
  // ROTATE HANDLERS
  // ============================================================
  
  const handleRotateStart = useCallback(() => {
    if (isLocked || !onRotate) return false
    
    setRotating(true)
    onLock?.(element.id)
    
    frameRef.current.rotation = rotation
    
    return true
  }, [isLocked, onRotate, setRotating, onLock, element.id, rotation])
  
  const handleRotate = useCallback(({ beforeRotate }: { beforeRotate: number }) => {
    // Snap to 15 degree increments
    const snappedRotation = Math.round(beforeRotate / 15) * 15
    setGhostRotation(snappedRotation)
  }, [])
  
  const handleRotateEnd = useCallback(() => {
    setRotating(false)
    
    if (ghostRotation !== null && onRotate) {
      onRotate(element.id, ghostRotation)
    }
    
    setGhostRotation(null)
    onUnlock?.(element.id)
  }, [setRotating, ghostRotation, element.id, onRotate, onUnlock])
  
  // ============================================================
  // RENDER: SHELF PATTERN
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
  
  // ============================================================
  // RENDER: DOCK ARROWS
  // ============================================================
  
  const renderDockArrows = useMemo(() => {
    if (element.type !== 'dock') return null
    
    const arrowSize = Math.min(dims.width, dims.height) * 0.3
    const cx = pos.x + dims.width / 2
    const cy = pos.y + dims.height / 2
    
    return (
      <g opacity={0.6}>
        <polygon
          points={`${cx},${cy - arrowSize} ${cx - arrowSize/2},${cy} ${cx + arrowSize/2},${cy}`}
          fill="white"
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy + arrowSize * 0.8}
          stroke="white"
          strokeWidth={arrowSize * 0.15}
        />
      </g>
    )
  }, [element.type, dims, pos])
  
  // ============================================================
  // RENDER
  // ============================================================
  
  const transform = `rotate(${rotation}, ${pos.x + dims.width/2}, ${pos.y + dims.height/2})`
  
  return (
    <>
      {/* Main element group */}
      <g
        ref={targetRef}
        className={`element element-${element.id}`}
        transform={transform}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ 
          cursor: isLocked ? 'not-allowed' : isSelected ? 'move' : 'pointer'
        }}
      >
        {/* Shadow for selected elements */}
        {isSelected && (
          <rect
            x={pos.x - 2}
            y={pos.y - 2}
            width={dims.width + 4}
            height={dims.height + 4}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={4}
            rx={6}
            ry={6}
            opacity={0.5}
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
            <circle
              cx={pos.x + dims.width - 12}
              cy={pos.y + 12}
              r={10}
              fill="#ef4444"
              stroke="white"
              strokeWidth={2}
            />
            <text
              x={pos.x + dims.width - 12}
              y={pos.y + 16}
              textAnchor="middle"
              fill="white"
              fontSize={11}
            >
              🔒
            </text>
            
            {/* Locking user tooltip */}
            {isHovered && lockingUserName && (
              <g transform={`translate(${pos.x + dims.width - 12}, ${pos.y - 5})`}>
                <rect
                  x={-40}
                  y={-18}
                  width={80}
                  height={16}
                  fill="#1e293b"
                  rx={4}
                  ry={4}
                />
                <text
                  x={0}
                  y={-6}
                  textAnchor="middle"
                  fill="white"
                  fontSize={9}
                >
                  {lockingUserName}
                </text>
              </g>
            )}
          </g>
        )}
        
        {/* Dimensions badge when selected */}
        {isSelected && (
          <g transform={`translate(${pos.x}, ${pos.y + dims.height + 5})`}>
            <rect
              x={0}
              y={0}
              width={dims.width}
              height={16}
              fill="rgba(0,0,0,0.7)"
              rx={3}
            />
            <text
              x={dims.width / 2}
              y={12}
              textAnchor="middle"
              fill="white"
              fontSize={10}
              fontFamily="monospace"
            >
              {((element.dimensions.length || element.dimensions.width) || 0).toFixed(1)}m × {((element.dimensions.depth || element.dimensions.height) || 0).toFixed(1)}m
            </text>
          </g>
        )}
      </g>
      
      {/* Ghost during drag */}
      {ghostPosition && (
        <rect
          x={ghostPosition.x * scale}
          y={ghostPosition.y * scale}
          width={ghostDimensions ? ghostDimensions.width * scale : dims.width}
          height={ghostDimensions ? ghostDimensions.height * scale : dims.height}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="8,4"
          opacity={0.7}
          rx={4}
          ry={4}
          style={{ pointerEvents: 'none' }}
          transform={ghostRotation !== null ? `rotate(${ghostRotation}, ${ghostPosition.x * scale + dims.width/2}, ${ghostPosition.y * scale + dims.height/2})` : undefined}
        />
      )}
      
      {/* Moveable controls */}
      {isActive && targetRef.current && (
        // @ts-ignore - react-moveable types issue
        <Moveable
          target={targetRef.current}
          container={null}
          
          // Drag
          draggable={true}
          throttleDrag={1}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          
          // Resize
          resizable={!!onResize}
          throttleResize={1}
          keepRatio={false}
          renderDirections={['nw', 'ne', 'sw', 'se']}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          
          // Rotate
          rotatable={!!onRotate}
          throttleRotate={15}
          onRotateStart={handleRotateStart}
          onRotate={handleRotate}
          onRotateEnd={handleRotateEnd}
          
          // Bounds
          bounds={{
            left: 0,
            top: 0,
            right: 10000,
            bottom: 10000
          }}
          
          // Style
          origin={false}
          edge={false}
        />
      )}
    </>
  )
}
