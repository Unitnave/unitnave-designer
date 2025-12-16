/**
 * UNITNAVE Designer - Smart Warehouse Editor (Profesional)
 *
 * Motor CAD con:
 * - SVG exacto (polígonos reales del backend, no rectángulos aproximados)
 * - DPI awareness (escala correcta en cualquier monitor)
 * - Undo/Redo con Ctrl+Z / Ctrl+Y
 * - Drag & drop  inteligente (react-moveable)  ✅ FIX SVG
 * - Optimización automática (OR-Tools backend)
 * - Validación normativa ERP
 * - Export DXF profesional
 *
 * @version 2.1 - FIX Drag SVG Moveable
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Moveable from 'react-moveable'
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Divider,
  Snackbar,
  LinearProgress,
  Badge
} from '@mui/material'
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  GridOn as GridIcon,
  GridOff as GridOffIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  History as HistoryIcon
} from '@mui/icons-material'

import { useUndoRedo } from '../../hooks/useUndoRedo.js'


// ============================================================
// CONFIGURACIÓN
// ============================================================
const API_URL = import.meta.env.VITE_API_URL || 'https://unitnave-designer-production.up.railway.app'
const GRID_SIZE = 0.5 // Grid de 0.5m

// Calcular escala con DPI awareness
const getBaseScale = () => {
  const dpi = window.devicePixelRatio || 1
  // Base: 10px por metro, ajustado por DPI
  return 10 * Math.min(dpi, 2) // Cap at 2x para no ser excesivo
}

// Colores por tipo de elemento
const ELEMENT_COLORS = {
  shelf: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Estantería' },
  dock: { fill: '#22c55e', stroke: '#15803d', label: 'Muelle' },
  office: { fill: '#a855f7', stroke: '#7c3aed', label: 'Oficina' },
  zone: { fill: '#f59e0b', stroke: '#d97706', label: 'Zona' },
  default: { fill: '#6b7280', stroke: '#374151', label: 'Elemento' }
}

// Colores por tipo de zona auto-detectada
const ZONE_COLORS = {
  main_aisle: { fill: 'rgba(254, 243, 199, 0.6)', stroke: '#f59e0b', label: 'Pasillo Principal' },
  cross_aisle: { fill: 'rgba(219, 234, 254, 0.6)', stroke: '#3b82f6', label: 'Pasillo Transversal' },
  aisle: { fill: 'rgba(226, 232, 240, 0.6)', stroke: '#94a3b8', label: 'Pasillo Operativo' },
  circulation: { fill: 'rgba(220, 252, 231, 0.6)', stroke: '#22c55e', label: 'Circulación' },
  free_zone: { fill: 'rgba(241, 245, 249, 0.5)', stroke: '#cbd5e1', label: 'Zona Libre' },
  dock_maneuver: { fill: 'rgba(254, 226, 226, 0.5)', stroke: '#f87171', label: 'Maniobra' }
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Hook para comunicación con el backend
 */
function useLayoutAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyzeLayout = useCallback(async (dimensions, elements) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/layout/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions, elements })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      setError(err.message)
      console.error('API Error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const optimizeLayout = useCallback(async (dimensions, elements, movedId, movedPos) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/layout/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions,
          elements,
          moved_element_id: movedId,
          moved_position: movedPos
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const fullAnalysis = useCallback(async (dimensions, elements, movedId = null, movedPos = null) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/layout/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions,
          elements,
          moved_element_id: movedId,
          moved_position: movedPos,
          optimize: !!movedId
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const exportDXF = useCallback(async (dimensions, elements, zones) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/layout/export/dxf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions, elements, zones })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plano_nave_${dimensions.length}x${dimensions.width}.dxf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, analyzeLayout, optimizeLayout, fullAnalysis, exportDXF, setError }
}

// ============================================================
// COMPONENTES SVG
// ============================================================

/**
 * Dibuja un polígono exacto del backend
 */
function SVGPolygon({
  points,
  fill,
  stroke,
  strokeWidth = 1,
  strokeDasharray = null,
  opacity = 1,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
  style
}) {
  if (!points || points.length < 3) return null

  const pointsString = points.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <polygon
      points={pointsString}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      opacity={opacity}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={className}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    />
  )
}

/**
 * Dibuja un elemento (estantería, muelle, etc.) como polígono SVG
 * ⚠️ Renombrado para no chocar con window.SVGElement
 */
function SVGLayoutElement({
  element,
  scale,
  isSelected,
  isHovered,
  onSelect,
  onHover
}) {
  const colors = ELEMENT_COLORS[element.type] || ELEMENT_COLORS.default

  // Usar polygon_points si existen, sino crear rectángulo desde bounds
  let points = element.polygon_points

  if (!points || points.length === 0) {
    // Fallback: crear rectángulo
    const x = element.x || 0
    const y = element.y || 0
    const w = element.width || 1
    const h = element.height || 1

    points = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ]
  }

  // Escalar puntos
  const scaledPoints = points.map(([x, y]) => [x * scale, y * scale])

  return (
    <g className={`element-${element.id}`}>
      <SVGPolygon
        points={scaledPoints}
        fill={colors.fill}
        stroke={isSelected ? '#eab308' : isHovered ? '#60a5fa' : colors.stroke}
        strokeWidth={isSelected ? 3 : isHovered ? 2 : 1.5}
        onClick={() => onSelect?.(element)}
        onMouseEnter={() => onHover?.(element.id)}
        onMouseLeave={() => onHover?.(null)}
      />
      {/* Etiqueta del elemento */}
      {(element.width || 0) * scale > 40 && (element.height || 0) * scale > 20 && (
        <text
          x={element.centroid_x ? element.centroid_x * scale : ((element.x || 0) + (element.width || 1) / 2) * scale}
          y={element.centroid_y ? element.centroid_y * scale : ((element.y || 0) + (element.height || 1) / 2) * scale}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={Math.min((element.width || 1) * scale, (element.height || 1) * scale) > 50 ? 10 : 8}
          fontWeight="600"
          style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {element.id}
        </text>
      )}
    </g>
  )
}

/**
 * Dibuja una zona auto-detectada (pasillo, circulación, etc.)
 */
function SVGZone({ zone, scale }) {
  const colors = ZONE_COLORS[zone.type] || ZONE_COLORS.free_zone

  // Usar polygon_points si existen
  let points = zone.polygon_points

  if (!points || points.length === 0) {
    // Fallback: crear rectángulo
    points = [
      [zone.x, zone.y],
      [zone.x + zone.width, zone.y],
      [zone.x + zone.width, zone.y + zone.height],
      [zone.x, zone.y + zone.height]
    ]
  }

  // Escalar puntos
  const scaledPoints = points.map(([x, y]) => [x * scale, y * scale])

  return (
    <g className={`zone-${zone.id}`}>
      <SVGPolygon
        points={scaledPoints}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1}
        strokeDasharray="4,2"
        opacity={0.8}
      />
      {/* Etiqueta solo si hay espacio */}
      {(zone.width || 0) * scale > 60 && (zone.height || 0) * scale > 25 && (
        <text
          x={(zone.centroid_x || zone.x + zone.width / 2) * scale}
          y={(zone.centroid_y || zone.y + zone.height / 2) * scale}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.stroke}
          fontSize={9}
          fontWeight="500"
          style={{ pointerEvents: 'none' }}
        >
          {zone.label}
        </text>
      )}
    </g>
  )
}

/**
 * Grid SVG
 */
function SVGGrid({ width, height, gridSize, scale }) {
  const lines = []
  const gridSizeScaled = gridSize * scale

  // Líneas verticales
  for (let x = 0; x <= width; x += gridSizeScaled) {
    lines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke="#e2e8f0"
        strokeWidth={0.5}
      />
    )
  }

  // Líneas horizontales
  for (let y = 0; y <= height; y += gridSizeScaled) {
    lines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke="#e2e8f0"
        strokeWidth={0.5}
      />
    )
  }

  return <g className="grid">{lines}</g>
}

// ============================================================
// PANELES UI
// ============================================================

function WarningsPanel({ warnings }) {
  if (!warnings || warnings.length === 0) return null

  const errors = warnings.filter(w => w.severity === 'error')
  const warns = warnings.filter(w => w.severity === 'warning')

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 70,
        right: 20,
        width: 320,
        maxHeight: 250,
        overflow: 'auto',
        zIndex: 200
      }}
    >
      <Box sx={{
        p: 1.5,
        bgcolor: errors.length > 0 ? '#fef2f2' : '#fffbeb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          {errors.length > 0 ? (
            <><ErrorIcon color="error" fontSize="small" /> {errors.length} Errores</>
          ) : (
            <><WarningIcon color="warning" fontSize="small" /> {warns.length} Avisos</>
          )}
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ p: 1 }}>
        {warnings.slice(0, 5).map((w, i) => (
          <Alert
            key={i}
            severity={w.severity === 'error' ? 'error' : 'warning'}
            sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { fontSize: 11 } }}
          >
            {w.message}
          </Alert>
        ))}
        {warnings.length > 5 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
            +{warnings.length - 5} más...
          </Typography>
        )}
      </Box>
    </Paper>
  )
}

function MetricsPanel({ metrics, dimensions }) {
  if (!metrics) return null

  const totalArea = dimensions.length * dimensions.width

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 260,
        zIndex: 200
      }}
    >
      <Box sx={{ p: 1.5, bgcolor: '#f0fdf4' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          📊 Métricas Exactas
        </Typography>
      </Box>
      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption">Eficiencia</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {metrics.efficiency?.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(metrics.efficiency || 0, 100)}
            sx={{ height: 6, borderRadius: 3 }}
            color={metrics.efficiency > 50 ? 'success' : 'warning'}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
              {totalArea.toLocaleString()}m²
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Ocupada</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
              {metrics.occupied_area?.toFixed(1)}m²
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Pasillos</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
              {metrics.aisle_area?.toFixed(1)}m²
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Almacenaje</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
              {metrics.storage_area?.toFixed(1)}m²
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function SmartWarehouse({
  dimensions = { length: 80, width: 40 },
  initialElements = [],
  onElementsChange
}) {
  // Estado principal
  const [elements, setElements] = useState(initialElements)
  const [zones, setZones] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [selectedElement, setSelectedElement] = useState(null)
  const [hoveredElement, setHoveredElement] = useState(null)
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' })

  // Refs
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const moveableRef = useRef(null)

  // Guardar elementos actuales para evitar “stale closures” al optimizar
  const elementsRef = useRef(elements)
  useEffect(() => { elementsRef.current = elements }, [elements])

  // API
  const { loading, error, fullAnalysis, exportDXF, setError } = useLayoutAPI()

  // Undo/Redo
  const {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    stateInfo
  } = useUndoRedo(null, {
    onStateRestored: (state) => {
      if (state) {
        setElements(state.elements || [])
        setZones(state.zones || [])
        setMetrics(state.metrics || null)
        setWarnings(state.warnings || [])
        setSnackbar({
          open: true,
          message: state === 'undo' ? '↩️ Deshecho' : '↪️ Rehecho',
          severity: 'info'
        })
      }
    }
  })

  // Escala con DPI awareness y zoom
  const baseScale = useMemo(() => getBaseScale(), [])
  const effectiveScale = baseScale * (zoom / 100)

  // Dimensiones del SVG
  const svgWidth = dimensions.length * effectiveScale
  const svgHeight = dimensions.width * effectiveScale

  // Sincronizar elementos externos
  useEffect(() => {
    if (Array.isArray(initialElements)) {
      setElements(initialElements)
    }
  }, [initialElements])

  // Mantener selección consistente cuando cambian los elementos (después de optimizar)
  useEffect(() => {
    if (!selectedElement) return
    const updated = elements.find(e => e.id === selectedElement.id)
    if (updated && updated !== selectedElement) {
      setSelectedElement(updated)
    }
  }, [elements, selectedElement])

  // Análisis inicial (funciona aunque initialElements lleguen tarde)
  const didInitialAnalyze = useRef(false)
  useEffect(() => {
    if (didInitialAnalyze.current) return
    if (!elements || elements.length === 0) return

    didInitialAnalyze.current = true

    const run = async () => {
      const result = await fullAnalysis(dimensions, elements)
      if (result) {
        const autoZones = result.zones?.filter(z => z.is_auto_generated) || []
        setZones(autoZones)
        setMetrics(result.metrics)
        setWarnings(result.warnings || [])

        // Guardar estado inicial
        saveState({
          elements,
          zones: autoZones,
          metrics: result.metrics,
          warnings: result.warnings
        }, 'initial_load')
      }
    }

    const t = setTimeout(run, 150)
    return () => clearTimeout(t)
  }, [elements, dimensions, fullAnalysis, saveState])

  // Re-analizar cuando cambian elementos (con debounce)
  useEffect(() => {
    if (!elements || elements.length === 0) return

    const analyze = async () => {
      const result = await fullAnalysis(dimensions, elements)
      if (result) {
        setZones(result.zones?.filter(z => z.is_auto_generated) || [])
        setMetrics(result.metrics)
        setWarnings(result.warnings || [])
      }
    }

    const timer = setTimeout(analyze, 500)
    return () => clearTimeout(timer)
  }, [elements, dimensions, fullAnalysis])

  // Handler para fin de drag (optimización OR-Tools)
  const handleDragEnd = useCallback(async (elementId, newX, newY) => {
    console.log(`📍 Movido ${elementId} a (${newX.toFixed(2)}, ${newY.toFixed(2)})`)

    const currentElements = elementsRef.current

    const result = await fullAnalysis(
      dimensions,
      currentElements,
      elementId,
      { x: newX, y: newY }
    )

    if (result && result.elements) {
      const newElements = result.elements
      const newZones = result.zones?.filter(z => z.is_auto_generated) || []

      setElements(newElements)
      setZones(newZones)
      setMetrics(result.metrics)
      setWarnings(result.warnings || [])

      // Guardar en historial
      saveState({
        elements: newElements,
        zones: newZones,
        metrics: result.metrics,
        warnings: result.warnings
      }, 'element_moved')

      // Notificar cambio
      onElementsChange?.(newElements)

      // Feedback
      if (result.optimization?.success) {
        setSnackbar({
          open: true,
          message: `✅ Optimizado (${result.optimization.solve_time_ms?.toFixed(0)}ms)`,
          severity: 'success'
        })
      }
    }
  }, [dimensions, fullAnalysis, onElementsChange, saveState])

  // Exportar DXF
  const handleExportDXF = useCallback(async () => {
    const success = await exportDXF(dimensions, elements, zones)
    setSnackbar({
      open: true,
      message: success ? '✅ Plano DXF descargado' : '❌ Error al exportar DXF',
      severity: success ? 'success' : 'error'
    })
  }, [dimensions, elements, zones, exportDXF])

  // Undo / Redo
  const handleUndo = useCallback(() => {
    const state = undo()
    if (state) onElementsChange?.(state.elements)
  }, [undo, onElementsChange])

  const handleRedo = useCallback(() => {
    const state = redo()
    if (state) onElementsChange?.(state.elements)
  }, [redo, onElementsChange])

  // Elementos del DOM seleccionados para Moveable
  const selectedTarget = useMemo(() => {
    if (!selectedElement || !svgRef.current) return null
    return svgRef.current.querySelector(`.element-${selectedElement.id}`)
  }, [selectedElement])

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: '#f8fafc' }}>
      {/* Toolbar */}
      <Paper
        elevation={2}
        sx={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 2,
          py: 1,
          borderRadius: 2,
          zIndex: 300
        }}
      >
        {/* Undo/Redo */}
        <Tooltip title="Deshacer (Ctrl+Z)">
          <span>
            <IconButton size="small" onClick={handleUndo} disabled={!canUndo}>
              <UndoIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Rehacer (Ctrl+Y)">
          <span>
            <IconButton size="small" onClick={handleRedo} disabled={!canRedo}>
              <RedoIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Chip
          icon={<HistoryIcon sx={{ fontSize: 14 }} />}
          label={`${stateInfo.current}/${stateInfo.total}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Zoom */}
        <Tooltip title="Alejar">
          <IconButton size="small" onClick={() => setZoom(z => Math.max(50, z - 10))}>
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>

        <Chip label={`${zoom}%`} size="small" sx={{ minWidth: 50 }} />

        <Tooltip title="Acercar">
          <IconButton size="small" onClick={() => setZoom(z => Math.min(200, z + 10))}>
            <ZoomInIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Restablecer">
          <IconButton size="small" onClick={() => setZoom(100)}>
            <CenterIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Grid */}
        <Tooltip title={showGrid ? 'Ocultar Grid' : 'Mostrar Grid'}>
          <IconButton size="small" onClick={() => setShowGrid(g => !g)}>
            {showGrid ? <GridIcon /> : <GridOffIcon />}
          </IconButton>
        </Tooltip>

        {/* Export */}
        <Tooltip title="Exportar DXF (AutoCAD)">
          <IconButton size="small" onClick={handleExportDXF} disabled={loading}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>

        {loading && <CircularProgress size={20} sx={{ ml: 1 }} />}
      </Paper>

      {/* Indicadores de estado */}
      <Box sx={{ position: 'absolute', top: 70, left: 12, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Chip
          icon={<CheckIcon sx={{ fontSize: 14 }} />}
          label="Geometría Exacta (Shapely)"
          size="small"
          color="success"
          sx={{ fontSize: 10, height: 24 }}
        />
        <Chip
          icon={<CheckIcon sx={{ fontSize: 14 }} />}
          label="Optimizador (OR-Tools)"
          size="small"
          color="primary"
          sx={{ fontSize: 10, height: 24 }}
        />
        {warnings.length > 0 && (
          <Badge badgeContent={warnings.length} color="warning">
            <Chip
              icon={<WarningIcon sx={{ fontSize: 14 }} />}
              label="Validación ERP"
              size="small"
              color="warning"
              sx={{ fontSize: 10, height: 24 }}
            />
          </Badge>
        )}
      </Box>

      {/* Área de trabajo SVG */}
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4
        }}
      >
        <Paper
          elevation={4}
          sx={{
            position: 'relative',
            borderRadius: 1,
            overflow: 'hidden'
          }}
        >
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: 'block', background: '#ffffff' }}
          >
            {/* Borde de la nave */}
            <rect
              x={0}
              y={0}
              width={svgWidth}
              height={svgHeight}
              fill="none"
              stroke="#1e293b"
              strokeWidth={3}
            />

            {/* Grid */}
            {showGrid && (
              <SVGGrid
                width={svgWidth}
                height={svgHeight}
                gridSize={GRID_SIZE}
                scale={effectiveScale}
              />
            )}

            {/* Zonas auto-detectadas (fondo) */}
            <g className="zones-layer">
              {zones.map(zone => (
                <SVGZone key={zone.id} zone={zone} scale={effectiveScale} />
              ))}
            </g>

            {/* Elementos (encima) */}
            <g className="elements-layer">
              {elements.map(element => (
                <SVGLayoutElement
                  key={element.id}
                  element={element}
                  scale={effectiveScale}
                  isSelected={selectedElement?.id === element.id}
                  isHovered={hoveredElement === element.id}
                  onSelect={setSelectedElement}
                  onHover={setHoveredElement}
                />
              ))}
            </g>
          </svg>
        </Paper>
      </Box>

      {/* Moveable para drag & drop (FIX SVG) */}
      {selectedElement && selectedTarget && (
        <Moveable
          ref={moveableRef}
          target={selectedTarget}
          draggable={true}
          origin={false}
          snappable={true}
          snapGridWidth={GRID_SIZE * effectiveScale}
          snapGridHeight={GRID_SIZE * effectiveScale}
          bounds={{
            left: 0,
            top: 0,
            right: svgWidth,
            bottom: svgHeight
          }}

          // ✅ SVG: mover con atributo transform, NO con style.transform
          onDrag={({ target, beforeTranslate }) => {
            const [tx, ty] = beforeTranslate
            if (target && target.setAttribute) {
              target.setAttribute('transform', `translate(${tx} ${ty})`)
            }
          }}

          // ✅ SVG: usar lastEvent.beforeTranslate (números), sin regex
          onDragEnd={({ target, lastEvent }) => {
            if (!lastEvent) return
            const [tx, ty] = lastEvent.beforeTranslate

            const baseX = selectedElement.x ?? 0
            const baseY = selectedElement.y ?? 0

            const dxM = tx / effectiveScale
            const dyM = ty / effectiveScale

            const newX = baseX + dxM
            const newY = baseY + dyM

            // Limpiar transform temporal antes de aplicar resultado del backend
            if (target && target.removeAttribute) {
              target.removeAttribute('transform')
            }

            // (Opcional, pero ayuda): update optimista para que no “salte”
            setElements(prev => prev.map(el => {
              if (el.id !== selectedElement.id) return el
              const next = { ...el, x: newX, y: newY }

              if (Array.isArray(el.polygon_points) && el.polygon_points.length > 0) {
                next.polygon_points = el.polygon_points.map(([x, y]) => [x + dxM, y + dyM])
              }
              if (typeof el.centroid_x === 'number') next.centroid_x = el.centroid_x + dxM
              if (typeof el.centroid_y === 'number') next.centroid_y = el.centroid_y + dyM

              return next
            }))

            handleDragEnd(selectedElement.id, newX, newY)
          }}
        />
      )}

      {/* Panel de warnings */}
      <WarningsPanel warnings={warnings} />

      {/* Panel de métricas */}
      <MetricsPanel metrics={metrics} dimensions={dimensions} />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          sx={{ minWidth: 200 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Error global */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ position: 'absolute', bottom: 20, left: 20, zIndex: 200, maxWidth: 300 }}
        >
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}
    </Box>
  )
}