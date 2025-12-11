/**
 * UNITNAVE Designer - Interactive Layout Editor (V1.1)
 * Editor 2D interactivo con WebSocket para colaboración en tiempo real
 * 
 * Características:
 * - Drag & drop de elementos
 * - Zoom y pan
 * - Grid con snap
 * - Colaboración en tiempo real
 * - Visualización de otros usuarios
 * - Undo/Redo
 * - Keyboard shortcuts
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { 
  Box, 
  Paper, 
  Alert, 
  Snackbar, 
  IconButton, 
  Tooltip, 
  Chip,
  CircularProgress,
  Fab,
  Zoom as MuiZoom,
  Badge
} from '@mui/material'
import { throttle } from 'lodash'
import { useLayoutStore } from '../store/useLayoutStore'
import wsManager from '../services/WebSocketManager'
import InteractiveElement from './InteractiveElement'

// ============================================================
// TYPES
// ============================================================

interface Dimensions {
  length: number
  width: number
  height?: number
}

interface InteractiveLayoutEditorProps {
  dimensions: Dimensions
  initialElements: any[]
  sessionId?: string
  userName?: string
  onSwitch3D?: () => void
  onExportDXF?: () => void
  onSave?: () => void
}

// ============================================================
// ZONE STYLES
// ============================================================

const ZONE_STYLES: Record<string, { fill: string; stroke: string; label: string }> = {
  main_aisle: { fill: 'rgba(254, 243, 199, 0.5)', stroke: '#f59e0b', label: 'Pasillo Principal' },
  cross_aisle: { fill: 'rgba(219, 234, 254, 0.5)', stroke: '#3b82f6', label: 'Pasillo Transversal' },
  secondary_aisle: { fill: 'rgba(191, 219, 254, 0.4)', stroke: '#60a5fa', label: 'Pasillo Secundario' },
  operational: { fill: 'rgba(220, 252, 231, 0.5)', stroke: '#22c55e', label: 'Zona Operacional' },
  circulation: { fill: 'rgba(254, 226, 226, 0.4)', stroke: '#f87171', label: 'Circulación' },
  circulation_north: { fill: 'rgba(254, 226, 226, 0.4)', stroke: '#f87171', label: 'Circulación Norte' },
  circulation_south: { fill: 'rgba(254, 226, 226, 0.4)', stroke: '#f87171', label: 'Circulación Sur' },
  free_zone: { fill: 'rgba(241, 245, 249, 0.3)', stroke: '#cbd5e1', label: 'Zona Libre' },
  dock_area: { fill: 'rgba(187, 247, 208, 0.5)', stroke: '#4ade80', label: 'Área de Muelles' },
  storage: { fill: 'rgba(199, 210, 254, 0.5)', stroke: '#818cf8', label: 'Almacenamiento' }
}

// ============================================================
// USER COLORS
// ============================================================

const USER_COLORS = [
  '#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
]

function getUserColor(index: number): string {
  return USER_COLORS[index % USER_COLORS.length]
}

// ============================================================
// COMPONENT
// ============================================================

export default function InteractiveLayoutEditor({ 
  dimensions, 
  initialElements, 
  sessionId: propSessionId,
  userName = 'Anónimo',
  onSwitch3D,
  onExportDXF,
  onSave
}: InteractiveLayoutEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // ============================================================
  // STORE - State
  // ============================================================
  
  const elements = useLayoutStore((state) => state.elements)
  const zones = useLayoutStore((state) => state.zones)
  const metrics = useLayoutStore((state) => state.metrics)
  const warnings = useLayoutStore((state) => state.warnings)
  const isConnected = useLayoutStore((state) => state.isConnected)
  const isInitializing = useLayoutStore((state) => state.isInitializing)
  const isProcessing = useLayoutStore((state) => state.isProcessing)
  const selectedElementId = useLayoutStore((state) => state.selectedElementId)
  const onlineUsers = useLayoutStore((state) => state.onlineUsers)
  const clientId = useLayoutStore((state) => state.clientId)
  const lastError = useLayoutStore((state) => state.lastError)
  const canUndo = useLayoutStore((state) => state.canUndo)
  const canRedo = useLayoutStore((state) => state.canRedo)
  const reconnectAttempts = useLayoutStore((state) => state.reconnectAttempts)
  
  // ============================================================
  // STORE - Actions
  // ============================================================
  
  const setDimensions = useLayoutStore((state) => state.setDimensions)
  const setElements = useLayoutStore((state) => state.setElements)
  const setZones = useLayoutStore((state) => state.setZones)
  const setMetrics = useLayoutStore((state) => state.setMetrics)
  const setWarnings = useLayoutStore((state) => state.setWarnings)
  const setSelectedElement = useLayoutStore((state) => state.setSelectedElement)
  const setConnected = useLayoutStore((state) => state.setConnected)
  const setInitializing = useLayoutStore((state) => state.setInitializing)
  const setProcessing = useLayoutStore((state) => state.setProcessing)
  const setError = useLayoutStore((state) => state.setError)
  const setSession = useLayoutStore((state) => state.setSession)
  const setOnlineUsers = useLayoutStore((state) => state.setOnlineUsers)
  const addOnlineUser = useLayoutStore((state) => state.addOnlineUser)
  const removeOnlineUser = useLayoutStore((state) => state.removeOnlineUser)
  const updateUserCursor = useLayoutStore((state) => state.updateUserCursor)
  const updateUserSelection = useLayoutStore((state) => state.updateUserSelection)
  const moveElementOptimistic = useLayoutStore((state) => state.moveElementOptimistic)
  const addElement = useLayoutStore((state) => state.addElement)
  const deleteElement = useLayoutStore((state) => state.deleteElement)
  const lockElement = useLayoutStore((state) => state.lockElement)
  const unlockElement = useLayoutStore((state) => state.unlockElement)
  const setLockedElements = useLayoutStore((state) => state.setLockedElements)
  const setCanUndo = useLayoutStore((state) => state.setCanUndo)
  const setCanRedo = useLayoutStore((state) => state.setCanRedo)
  const incrementReconnectAttempts = useLayoutStore((state) => state.incrementReconnectAttempts)
  const resetReconnectAttempts = useLayoutStore((state) => state.resetReconnectAttempts)
  
  // ============================================================
  // LOCAL STATE
  // ============================================================
  
  const [showGrid, setShowGrid] = useState(true)
  const [showZones, setShowZones] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [showCursors, setShowCursors] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  
  const [sessionId] = useState(() => 
    propSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  )
  
  // ============================================================
  // COMPUTED VALUES
  // ============================================================
  
  const scale = useMemo(() => 10 * (zoom / 100), [zoom])
  const svgWidth = dimensions.length * scale
  const svgHeight = dimensions.width * scale
  
  const selectedElement = useMemo(() => 
    elements.find(el => el.id === selectedElementId),
    [elements, selectedElementId]
  )
  
  const otherUsers = useMemo(() => 
    onlineUsers.filter(u => u.client_id !== clientId),
    [onlineUsers, clientId]
  )
  
  // ============================================================
  // WEBSOCKET STORE UPDATER
  // ============================================================
  
  const processMessage = useCallback((data: any) => {
    logger.info(`📨 Procesando mensaje WS: ${data.type}`)
    
    switch (data.type) {
      case 'connected':
        setSession(data.session_id, data.client_id)
        if (data.online_users) setOnlineUsers(data.online_users)
        if (data.locked_elements) setLockedElements(data.locked_elements)
        resetReconnectAttempts()
        break
      
      case 'initialized':
        setZones(data.zones || [])
        setMetrics(data.metrics)
        setWarnings(data.warnings || [])
        setCanUndo(data.can_undo || false)
        setCanRedo(data.can_redo || false)
        setInitializing(false)
        break
      
      // ================================================
      // CORRECCIÓN CRÍTICA: Ahora procesa move_ack
      // ================================================
      case 'move_ack':
        logger.info("✅ Move confirmado por backend")
        setProcessing(false)
        if (data.zones) setZones(data.zones)
        if (data.metrics) setMetrics(data.metrics)
        if (data.warnings) setWarnings(data.warnings)
        setCanUndo(data.can_undo ?? canUndo)
        setCanRedo(data.can_redo ?? canRedo)
        break
      
      case 'element_moved':
        // Solo procesar si NO soy el que lo movió
        if (data.by_client !== clientId) {
          logger.info(`📦 Elemento movido por OTRO cliente: ${data.element_id}`)
          if (data.element_id && data.position) {
            moveElementOptimistic(data.element_id, data.position.x, data.position.y)
          }
        }
        if (data.zones) setZones(data.zones)
        if (data.metrics) setMetrics(data.metrics)
        break
      
      case 'resize_ack':
      case 'rotate_ack':
        setProcessing(false)
        if (data.zones) setZones(data.zones)
        if (data.metrics) setMetrics(data.metrics)
        if (data.warnings) setWarnings(data.warnings)
        setCanUndo(data.can_undo ?? canUndo)
        setCanRedo(data.can_redo ?? canRedo)
        break
      
      case 'element_added':
        if (data.by_client !== clientId && data.element) {
          addElement(data.element)
        }
        if (data.zones) setZones(data.zones)
        if (data.metrics) setMetrics(data.metrics)
        break
      
      case 'element_deleted':
        if (data.by_client !== clientId && data.element_id) {
          deleteElement(data.element_id)
        }
        if (data.zones) setZones(data.zones)
        if (data.metrics) setMetrics(data.metrics)
        break
      
      case 'undo_ack':
      case 'redo_ack':
        if (data.zones) setZones(data.zones)
        if (data.metrics) setMetrics(data.metrics)
        if (data.elements) setElements(data.elements)
        setCanUndo(data.can_undo || false)
        setCanRedo(data.can_redo || false)
        break
      
      case 'undo_applied':
      case 'redo_applied':
        if (data.by_client !== clientId) {
          if (data.zones) setZones(data.zones)
          if (data.metrics) setMetrics(data.metrics)
          if (data.elements) setElements(data.elements)
        }
        break
      
      case 'user_joined':
        if (data.user) addOnlineUser(data.user)
        if (data.online_users) setOnlineUsers(data.online_users)
        break
      
      case 'user_left':
        removeOnlineUser(data.client_id)
        break
      
      case 'cursor_move':
        if (data.client_id && data.position) {
          updateUserCursor(data.client_id, data.position)
        }
        break
      
      case 'selection_change':
        if (data.client_id) {
          updateUserSelection(data.client_id, data.new_element)
        }
        break
      
      case 'element_locked':
        lockElement(data.element_id, data.client_id)
        break
      
      case 'element_unlocked':
        unlockElement(data.element_id)
        break
      
      case 'layout_reset':
        if (data.elements) setElements(data.elements)
        if (data.zones) setZones(data.zones)
        if (data.metrics) setMetrics(data.metrics)
        break
      
      case 'error':
        logger.error(`❌ Error del servidor: ${data.message}`)
        setError(data.message)
        setProcessing(false)
        break
    }
  }, [clientId, canUndo, canRedo])
  
  // ============================================================
  // WEBSOCKET CONNECTION
  // ============================================================
  
  useEffect(() => {
    // Registrar el procesador de mensajes
    wsManager.setStoreUpdater(processMessage)
    
    wsManager.setOnConnected(() => {
      logger.info("✅ WebSocket conectado")
      setConnected(true)
      setInitializing(true)
      // Inicializar después de conectar
      wsManager.initialize(initialElements, dimensions)
    })
    
    wsManager.setOnDisconnected(() => {
      logger.warn("🔌 WebSocket desconectado")
      setConnected(false)
    })
    
    wsManager.setOnReconnecting((attempt) => {
      logger.info(`🔄 Reconectando... intento ${attempt}`)
      incrementReconnectAttempts()
    })
    
    // Inicializar store local
    setDimensions(dimensions)
    setElements(initialElements)
    
    // Conectar
    logger.info(`🔌 Conectando WebSocket: session=${sessionId}, user=${userName}`)
    wsManager.connect(sessionId, userName)
    
    return () => {
      logger.info("🔌 Desconectando WebSocket")
      wsManager.disconnect()
    }
  }, [sessionId, userName, dimensions, initialElements, processMessage])
  
  // ============================================================
  // ELEMENT HANDLERS
  // ============================================================
  
  // ================================================
  // CORRECCIÓN CRÍTICA: Ahora envía movimientos al backend
  // ================================================
  const handleElementMove = useCallback((elementId: string, x: number, y: number) => {
    // 1. Update optimista INMEDIATO (para responsiveness)
    logger.info(`📦 Move optimista: ${elementId} → (${x}, ${y})`)
    moveElementOptimistic(elementId, x, y)
    setProcessing(true)
    
    // 2. Enviar al backend usando wsManager directamente
    // ESTO ES LO QUE FALTABA - antes no se enviaba nada
    logger.info(`📦 Enviando move al backend: ${elementId} → (${x}, ${y})`)
    wsManager.send({
      action: 'move',
      element_id: elementId,
      position: { x, y }
    })
  }, [moveElementOptimistic, setProcessing])
  
  const handleElementSelect = useCallback((elementId: string) => {
    logger.info(`🔒 Seleccionando elemento: ${elementId}`)
    wsManager.selectElement(elementId)
  }, [])
  
  const handleCursorMove = useCallback(
    throttle((x: number, y: number) => {
      logger.debug(`👆 Cursor move: (${x}, ${y})`)
      wsManager.updateCursor(x, y)
    }, 100),
    []
  )
  
  const handleLock = useCallback((elementId: string) => {
    logger.info(`🔒 Lock request: ${elementId}`)
    wsManager.lockElement(elementId)
  }, [])
  
  const handleUnlock = useCallback((elementId: string) => {
    logger.info(`🔓 Unlock request: ${elementId}`)
    wsManager.unlockElement(elementId)
  }, [])
  
  // ============================================================
  // CANVAS HANDLERS
  // ============================================================
  
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      logger.info("🖱️ Canvas click - deseleccionando")
      setSelectedElement(null)
      wsManager.selectElement(null)
    }
  }, [setSelectedElement])
  
  const handleCanvasMouseMove = useCallback(
    throttle((e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return
      
      const rect = svgRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const y = (e.clientY - rect.top) / scale
      
      wsManager.updateCursor(x, y)
    }, 100),
    [scale]
  )
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -10 : 10
      const newZoom = Math.max(25, Math.min(300, zoom + delta))
      logger.info(`🔍 Zoom: ${zoom}% → ${newZoom}%`)
      setZoom(newZoom)
    }
  }, [zoom])
  
  // Pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      logger.info("✋ Iniciando pan")
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }, [])
  
  const handlePanMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.x
      const dy = e.clientY - lastPanPoint.y
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }, [isPanning, lastPanPoint])
  
  const handlePanEnd = useCallback(() => {
    if (isPanning) {
      logger.info("✋ Fin pan")
      setIsPanning(false)
    }
  }, [isPanning])
  
  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si estamos en un input
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      
      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) {
          logger.info("⌨️ Undo solicitado")
          wsManager.undo()
        }
      }
      
      // Ctrl+Y / Ctrl+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) {
          logger.info("⌨️ Redo solicitado")
          wsManager.redo()
        }
      }
      
      // Delete / Backspace - Eliminar elemento seleccionado
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        e.preventDefault()
        logger.info(`🗑️ Delete elemento: ${selectedElementId}`)
        wsManager.deleteElement(selectedElementId)
        setSelectedElement(null)
      }
      
      // Escape - Deseleccionar
      if (e.key === 'Escape') {
        logger.info("⎇ Escape - deseleccionando")
        setSelectedElement(null)
        wsManager.selectElement(null)
      }
      
      // + / - Zoom
      if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(300, prev + 10))
      }
      if (e.key === '-') {
        setZoom(prev => Math.max(25, prev - 10))
      }
      
      // 0 - Reset zoom
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        logger.info("🔍 Reset zoom")
        setZoom(100)
        setPanOffset({ x: 0, y: 0 })
      }
      
      // G - Toggle grid
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        logger.info("📐 Toggle grid")
        setShowGrid(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElementId, canUndo, canRedo, setSelectedElement])
  
  // ============================================================
  // RENDER: GRID
  // ============================================================
  
  const renderGrid = useMemo(() => {
    if (!showGrid) return null
    
    const lines = []
    const step = 0.5 * scale  // 0.5m grid
    const majorStep = 5 * scale  // 5m major grid
    
    // Vertical lines
    for (let x = 0; x <= svgWidth; x += step) {
      const isMajor = Math.abs(x % majorStep) < 0.1
      lines.push(
        <line
          key={`v-${x}`}
          x1={x} y1={0} x2={x} y2={svgHeight}
          stroke="#e2e8f0"
          strokeWidth={isMajor ? 1 : 0.5}
          opacity={isMajor ? 0.8 : 0.4}
        />
      )
    }
    
    // Horizontal lines
    for (let y = 0; y <= svgHeight; y += step) {
      const isMajor = Math.abs(y % majorStep) < 0.1
      lines.push(
        <line
          key={`h-${y}`}
          x1={0} y1={y} x2={svgWidth} y2={y}
          stroke="#e2e8f0"
          strokeWidth={isMajor ? 1 : 0.5}
          opacity={isMajor ? 0.8 : 0.4}
        />
      )
    }
    
    return <g className="grid-layer">{lines}</g>
  }, [showGrid, scale, svgWidth, svgHeight])
  
  // ============================================================
  // RENDER: ZONES
  // ============================================================
  
  const renderZones = useMemo(() => {
    if (!showZones) return null
    
    return zones.map((zone: any) => {
      const style = ZONE_STYLES[zone.type] || ZONE_STYLES.free_zone
      
      const points = zone.polygon_points?.map(([x, y]: [number, number]) => 
        `${x * scale},${y * scale}`
      ).join(' ')
      
      return (
        <g key={zone.id} className="zone">
          {points ? (
            <polygon
              points={points}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={1}
              strokeDasharray="4,2"
            />
          ) : (
            <rect
              x={zone.x * scale}
              y={zone.y * scale}
              width={zone.width * scale}
              height={zone.height * scale}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={1}
              strokeDasharray="4,2"
            />
          )}
          
          {showLabels && zone.width > 3 && zone.height > 1 && (
            <text
              x={zone.centroid_x * scale}
              y={zone.centroid_y * scale}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={style.stroke}
              fontSize={9}
              fontWeight={500}
              opacity={0.8}
              style={{ pointerEvents: 'none' }}
            >
              {zone.label}
            </text>
          )}
        </g>
      )
    })
  }, [zones, showZones, showLabels, scale])
  
  // ============================================================
  // RENDER: OTHER USERS' CURSORS
  // ============================================================
  
  const renderOtherCursors = useMemo(() => {
    if (!showCursors) return null
    
    return otherUsers
      .filter(u => u.cursor_position)
      .map((user, index) => {
        const color = getUserColor(index)
        return (
          <g key={user.client_id} className="cursor">
            <circle
              cx={user.cursor_position!.x * scale}
              cy={user.cursor_position!.y * scale}
              r={6}
              fill={color}
              stroke="white"
              strokeWidth={2}
              opacity={0.9}
            />
            <g transform={`translate(${user.cursor_position!.x * scale + 10}, ${user.cursor_position!.y * scale - 5})`}>
              <rect
                x={-2} y={-10}
                width={user.user_name.length * 7 + 8}
                height={16}
                fill={color}
                rx={3} ry={3}
                opacity={0.9}
              />
              <text
                fill="white"
                fontSize={10}
                fontWeight={600}
              >
                {user.user_name}
              </text>
            </g>
          </g>
        )
      })
  }, [otherUsers, showCursors, scale])
  
  // ============================================================
  // RENDER: DIMENSIONS
  // ============================================================
  
  const renderDimensions = useMemo(() => (
    <g className="dimensions-layer" opacity={0.6}>
      <text
        x={svgWidth / 2}
        y={-8}
        textAnchor="middle"
        fill="#64748b"
        fontSize={12}
        fontWeight={600}
      >
        {dimensions.length}m
      </text>
      
      <text
        x={-8}
        y={svgHeight / 2}
        textAnchor="middle"
        fill="#64748b"
        fontSize={12}
        fontWeight={600}
        transform={`rotate(-90, -8, ${svgHeight / 2})`}
      >
        {dimensions.width}m
      </text>
    </g>
  ), [svgWidth, svgHeight, dimensions])
  
  // ============================================================
  // RENDER
  // ============================================================
  
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%', 
        height: '100vh', 
        position: 'relative', 
        bgcolor: '#f8fafc',
        overflow: 'hidden'
      }}
      onMouseUp={handlePanEnd}
      onMouseLeave={handlePanEnd}
    >
      
      {/* ==================== TOOLBAR ==================== */}
      <Paper
        elevation={2}
        sx={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 100
        }}
      >
        {/* Zoom controls */}
        <Tooltip title="Alejar (-)">
          <IconButton 
            size="small" 
            onClick={() => setZoom(Math.max(25, zoom - 10))}
            disabled={zoom <= 25}
          >
            ➖
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Click para resetear">
          <Chip
            label={`${zoom}%`}
            size="small"
            onClick={() => { setZoom(100); setPanOffset({ x: 0, y: 0 }) }}
            sx={{ minWidth: 60, fontFamily: 'monospace' }}
          />
        </Tooltip>
        
        <Tooltip title="Acercar (+)">
          <IconButton 
            size="small" 
            onClick={() => setZoom(Math.min(300, zoom + 10))}
            disabled={zoom >= 300}
          >
            ➕
          </IconButton>
        </Tooltip>
        
        <Box sx={{ width: 1, height: 24, bgcolor: '#e2e8f0', mx: 1 }} />
        
        {/* Toggle buttons */}
        <Tooltip title={`Grid (G) - ${showGrid ? 'ON' : 'OFF'}`}>
          <IconButton 
            size="small" 
            onClick={() => setShowGrid(prev => !prev)}
            color={showGrid ? 'primary' : 'default'}
          >
            📐
          </IconButton>
        </Tooltip>
        
        <Tooltip title={`Zonas - ${showZones ? 'ON' : 'OFF'}`}>
          <IconButton 
            size="small" 
            onClick={() => setShowZones(prev => !prev)}
            color={showZones ? 'primary' : 'default'}
          >
            🗺️
          </IconButton>
        </Tooltip>
        
        <Tooltip title={`Cursores - ${showCursors ? 'ON' : 'OFF'}`}>
          <IconButton 
            size="small" 
            onClick={() => setShowCursors(prev => !prev)}
            color={showCursors ? 'primary' : 'default'}
          >
            👆
          </IconButton>
        </Tooltip>
        
        <Box sx={{ width: 1, height: 24, bgcolor: '#e2e8f0', mx: 1 }} />
        
        {/* Undo/Redo */}
        <Tooltip title="Deshacer (Ctrl+Z)">
          <span>
            <IconButton 
              size="small" 
              onClick={() => wsManager.undo()}
              disabled={!canUndo}
            >
              ↩️
            </IconButton>
          </span>
        </Tooltip>
        
        <Tooltip title="Rehacer (Ctrl+Y)">
          <span>
            <IconButton 
              size="small" 
              onClick={() => wsManager.redo()}
              disabled={!canRedo}
            >
              ↪️
            </IconButton>
          </span>
        </Tooltip>
        
        {/* Extra actions */}
        {(onSwitch3D || onExportDXF || onSave) && (
          <>
            <Box sx={{ width: 1, height: 24, bgcolor: '#e2e8f0', mx: 1 }} />
            
            {onSave && (
              <Tooltip title="Guardar">
                <IconButton size="small" onClick={onSave} color="primary">
                  💾
                </IconButton>
              </Tooltip>
            )}
            
            {onExportDXF && (
              <Tooltip title="Exportar DXF">
                <IconButton size="small" onClick={onExportDXF}>
                  📄
                </IconButton>
              </Tooltip>
            )}
            
            {onSwitch3D && (
              <Tooltip title="Vista 3D">
                <IconButton 
                  size="small" 
                  onClick={onSwitch3D}
                  sx={{ 
                    bgcolor: 'primary.main', 
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  🎮
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </Paper>
      
      {/* ==================== SVG CANVAS ==================== */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          cursor: isPanning ? 'grabbing' : 'default'
        }}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
      >
        <Paper 
          elevation={4} 
          sx={{ 
            borderRadius: 2, 
            overflow: 'hidden',
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`
          }}
        >
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{
              display: 'block',
              background: '#ffffff',
              cursor: isPanning ? 'grabbing' : 'crosshair'
            }}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onWheel={handleWheel}
          >
            {/* Warehouse border */}
            <rect
              x={0} y={0}
              width={svgWidth}
              height={svgHeight}
              fill="none"
              stroke="#1e293b"
              strokeWidth={3}
            />
            
            {/* Grid */}
            <g className="grid-layer">{renderGrid}</g>
            
            {/* Zones */}
            <g className="zones-layer">{renderZones}</g>
            
            {/* Other users' cursors */}
            <g className="cursors-layer">{renderOtherCursors}</g>
            
            {/* Elements */}
            <g className="elements-layer">
              {elements.map((el: any) => (
                <InteractiveElement
                  key={el.id}
                  element={el}
                  scale={scale}
                  onMove={handleElementMove}
                  onSelect={handleElementSelect}
                  onCursorMove={handleCursorMove}
                  onLock={handleLock}
                  onUnlock={handleUnlock}
                />
              ))}
            </g>
            
            {/* Dimensions */}
            {renderDimensions}
          </svg>
        </Paper>
      </Box>
      
      {/* ==================== STATUS BAR ==================== */}
      <Paper
        elevation={1}
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 100
        }}
      >
        {/* Left: Connection status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title={isConnected ? 'Conectado' : reconnectAttempts > 0 ? `Reconectando... (${reconnectAttempts})` : 'Desconectado'}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {isConnected ? (
                <span style={{ fontSize: 16 }}>🟢</span>
              ) : reconnectAttempts > 0 ? (
                <CircularProgress size={16} />
              ) : (
                <span style={{ fontSize: 16 }}>🔴</span>
              )}
            </Box>
          </Tooltip>
          
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {onlineUsers.length} usuario{onlineUsers.length !== 1 ? 's' : ''}
          </span>
          
          {/* User avatars */}
          {onlineUsers.length > 0 && (
            <Box sx={{ display: 'flex', ml: 1 }}>
              {onlineUsers.slice(0, 5).map((user, i) => (
                <Tooltip key={user.client_id} title={user.user_name}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: getUserColor(i),
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      ml: i > 0 ? -0.5 : 0,
                      border: '2px solid white',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                  >
                    {user.user_name.charAt(0).toUpperCase()}
                  </Box>
                </Tooltip>
              ))}
              {onlineUsers.length > 5 && (
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: '#94a3b8',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    ml: -0.5,
                    border: '2px solid white'
                  }}
                >
                  +{onlineUsers.length - 5}
                </Box>
              )}
            </Box>
          )}
        </Box>
        
        {/* Center: Selected element */}
        {selectedElement && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={selectedElement.label || selectedElement.id}
              size="small"
              color="primary"
              onDelete={() => {
                logger.info(`🗑️ Delete desde chip: ${selectedElement.id}`)
                setSelectedElement(null)
                wsManager.selectElement(null)
              }}
            />
          </Box>
        )}
        
        {/* Right: Metrics */}
        {metrics && (
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Tooltip title="Área total">
              <span style={{ fontSize: 13, color: '#64748b' }}>
                📐 <strong style={{ color: '#1e293b' }}>{metrics.total_area?.toFixed(0)}m²</strong>
              </span>
            </Tooltip>
            <Tooltip title="Eficiencia">
              <span style={{ fontSize: 13, color: '#64748b' }}>
                📊 <strong style={{ color: '#1e293b' }}>{metrics.efficiency?.toFixed(1)}%</strong>
              </span>
            </Tooltip>
            <Tooltip title="Elementos">
              <span style={{ fontSize: 13, color: '#64748b' }}>
                📦 <strong style={{ color: '#1e293b' }}>{metrics.element_count}</strong>
              </span>
            </Tooltip>
          </Box>
        )}
      </Paper>
      
      {/* ==================== LOADING OVERLAY ==================== */}
      {isInitializing && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            zIndex: 200
          }}
        >
          <CircularProgress size={48} />
          <Box sx={{ mt: 2, color: '#64748b' }}>Inicializando editor...</Box>
        </Box>
      )}
      
      {/* ==================== PROCESSING INDICATOR ==================== */}
      <MuiZoom in={isProcessing}>
        <Fab
          size="small"
          sx={{
            position: 'absolute',
            top: 80,
            right: 20,
            bgcolor: 'white'
          }}
        >
          <CircularProgress size={24} />
        </Fab>
      </MuiZoom>
      
      {/* ==================== WARNINGS ==================== */}
      {warnings.length > 0 && (
        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            top: 70,
            left: 12,
            maxWidth: 300,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'rgba(254, 243, 199, 0.95)',
            border: '1px solid #f59e0b',
            zIndex: 100
          }}
        >
          <Box sx={{ fontSize: 12, fontWeight: 600, color: '#92400e', mb: 0.5 }}>
            ⚠️ Advertencias
          </Box>
          {warnings.slice(0, 3).map((w, i) => (
            <Box key={i} sx={{ fontSize: 11, color: '#78350f' }}>
              • {w.message}
            </Box>
          ))}
          {warnings.length > 3 && (
            <Box sx={{ fontSize: 11, color: '#92400e', mt: 0.5 }}>
              +{warnings.length - 3} más
            </Box>
          )}
        </Paper>
      )}
      
      {/* ==================== ERROR SNACKBAR ==================== */}
      <Snackbar
        open={!!lastError}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ width: '100%' }}
        >
          {lastError}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// Logger helper
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`%c[INFO] ${msg}`, 'color: #3b82f6', ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.debug(`[DEBUG] ${msg}`, ...args)
}