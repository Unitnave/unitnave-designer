/**
 * UNITNAVE Designer - Editor 2D CAD Completo
 *
 * Integra:
 * - Vista 2D en planta (Warehouse2DView) con cotas
 * - Leyenda lateral interactiva (ZonesLegend)
 * - Toolbar con controles
 * - Sincronización hover/selección
 * - Cálculo exacto de zonas via backend (Shapely) /analyze
 * - ✅ Drag real + re-optimización (OR-Tools backend) /full
 *
 * @version 2.3.1 - FIX: skipNextPropsSyncRef para evitar que props-change pise el drag
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Divider,
  Slider,
  Chip,
  CircularProgress
} from '@mui/material'
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  GridOn as GridIcon,
  GridOff as GridOffIcon,
  Straighten as DimensionsIcon,
  Download as ExportIcon,
  Print as PrintIcon,
  ViewInAr as View3DIcon,
  Info as InfoIcon
} from '@mui/icons-material'

import Warehouse2DView, { processElementsToZones, ZONE_COLORS } from './Warehouse2DView'
import ZonesLegend from './ZonesLegend'

// ============================================================
// DEBUG
// ============================================================
const DEBUG_2D = typeof window !== 'undefined' && window.localStorage?.getItem('UN_DEBUG_2D') === '1'
const dlog = (...args) => DEBUG_2D && console.log(...args)
const dwarn = (...args) => DEBUG_2D && console.warn(...args)
const derr = (...args) => DEBUG_2D && console.error(...args)

// ============================================================
// API CONFIGURATION
// ============================================================
const API_URL = import.meta.env.VITE_API_URL || 'https://unitnave-designer-production.up.railway.app'

// ============================================================
// Helpers saneado
// ============================================================
const isFiniteNumber = (v) => Number.isFinite(v)
const toPosNumber = (v, fallback) => (isFiniteNumber(v) && v > 0 ? v : fallback)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function getElementWH(el) {
  const type = el?.type
  // ⚠️ OJO: esto debe seguir la misma lógica que processElementsToZones del View
  // para que clamp sea coherente.
  if (!el) return { w: 1, h: 1 }

  switch (type) {
    case 'shelf':
      return {
        w: toPosNumber(el.dimensions?.length, 2.7),
        h: toPosNumber(el.dimensions?.depth, 1.1)
      }
    case 'dock':
      return {
        w: toPosNumber(el.dimensions?.width, 3.5),
        h: toPosNumber(el.dimensions?.depth, 0.5)
      }
    case 'office':
      return {
        w: toPosNumber(el.dimensions?.length ?? el.dimensions?.largo, 12),
        h: toPosNumber(el.dimensions?.width ?? el.dimensions?.ancho, 8)
      }
    case 'operational_zone':
    case 'zone':
    case 'receiving':
    case 'shipping':
    case 'picking':
      return {
        w: toPosNumber(el.dimensions?.length ?? el.dimensions?.largo, 10),
        h: toPosNumber(el.dimensions?.width ?? el.dimensions?.ancho, 10)
      }
    case 'service_room':
    case 'technical_room':
      return {
        w: toPosNumber(el.dimensions?.length ?? el.dimensions?.largo, 5),
        h: toPosNumber(el.dimensions?.width ?? el.dimensions?.ancho, 4)
      }
    default:
      return {
        w: toPosNumber(el.dimensions?.length, 3),
        h: toPosNumber(el.dimensions?.depth ?? el.dimensions?.width, 3)
      }
  }
}

function sanitizeElements(rawElements, dimensions, reason = 'unknown') {
  const length = toPosNumber(dimensions?.length, 80)
  const width = toPosNumber(dimensions?.width, 40)

  const input = Array.isArray(rawElements) ? rawElements : []
  const out = []
  const problems = []

  for (const el of input) {
    if (!el?.id) continue

    const { w, h } = getElementWH(el)

    const x0 = isFiniteNumber(el.position?.x) ? el.position.x : 0
    const y0raw = isFiniteNumber(el.position?.y) ? el.position.y : (isFiniteNumber(el.position?.z) ? el.position.z : 0)

    // Clamp en metros dentro del perímetro
    const x1 = clamp(x0, 0, Math.max(0, length - w))
    const y1 = clamp(y0raw, 0, Math.max(0, width - h))

    const hadIssue =
      (!isFiniteNumber(x0) || !isFiniteNumber(y0raw)) ||
      w <= 0 || h <= 0 ||
      x0 !== x1 || y0raw !== y1 ||
      x0 < 0 || y0raw < 0 ||
      (x0 + w) > length || (y0raw + h) > width

    if (hadIssue) {
      problems.push({
        id: el.id,
        type: el.type,
        x: x0, y: y0raw, w, h,
        length, width,
        fixedX: x1, fixedY: y1,
        reason
      })
    }

    out.push({
      ...el,
      position: {
        ...(el.position || {}),
        x: x1,
        y: y1
      }
    })
  }

  if (problems.length) {
    dwarn('[2DEditor][sanitize] elementos con problemas -> corregidos:', problems.slice(0, 10), problems.length > 10 ? `(+${problems.length - 10} más)` : '')
  } else {
    dlog('[2DEditor][sanitize] OK (sin problemas)', { count: out.length, reason })
  }

  return out
}

// ============================================================
// HOOK PARA OBTENER ZONAS DEL BACKEND (Geometría Exacta)
// - pause=true => no llama (útil mientras arrastras)
// ============================================================
function useBackendZones(dimensions, elements, pause = false) {
  const [backendZones, setBackendZones] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (pause) return

    if (!elements || elements.length === 0) {
      setBackendZones(null)
      setMetrics(null)
      return
    }

    const fetchZones = async () => {
      setLoading(true)
      setError(null)

      try {
        dlog('[2DEditor][analyze] POST', `${API_URL}/api/layout/analyze`, { elements: elements.length })
        const response = await fetch(`${API_URL}/api/layout/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dimensions: { length: dimensions.length, width: dimensions.width },
            elements
          })
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        dlog('[2DEditor][analyze] OK zones:', data?.zones?.length ?? 0)

        const convertedZones = (data.zones || []).map(zone => ({
          ...zone,
          originalId: zone.id,
          rotation: 0,
          isAutoGenerated: true
        }))

        setBackendZones(convertedZones)
        setMetrics(data.metrics || null)
      } catch (err) {
        derr('[2DEditor][analyze] ERROR:', err)
        setError(err?.message || 'Analyze error')
        setBackendZones(null)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchZones, 250)
    return () => clearTimeout(timeoutId)
  }, [dimensions.length, dimensions.width, elements, pause])

  return { backendZones, metrics, loading, error }
}

// ============================================================
// HOOK FULL (OPTIMIZA AL MOVER) - OR-TOOLS
// ============================================================
function useLayoutFullAPI() {
  const [optimizing, setOptimizing] = useState(false)
  const [optError, setOptError] = useState(null)

  const full = useCallback(async (dimensions, elements, movedId = null, movedPos = null) => {
    setOptimizing(true)
    setOptError(null)

    try {
      dlog('[2DEditor][full] POST', `${API_URL}/api/layout/full`, { movedId, movedPos, count: elements?.length })
      const response = await fetch(`${API_URL}/api/layout/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: { length: dimensions.length, width: dimensions.width },
          elements,
          moved_element_id: movedId,
          moved_position: movedPos,
          optimize: !!movedId
        })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      dlog('[2DEditor][full] OK', { elements: json?.elements?.length ?? null })
      return json
    } catch (err) {
      derr('[2DEditor][full] ERROR:', err)
      setOptError(err?.message || 'Full error')
      return null
    } finally {
      setOptimizing(false)
    }
  }, [])

  return { optimizing, optError, full }
}

// ============================================================
// TOOLBAR 2D
// ============================================================
function Toolbar2D({
  showGrid,
  onToggleGrid,
  showDimensions,
  onToggleDimensions,
  onCenter,
  onExport,
  onPrint,
  onSwitch3D,
  zoom,
  onZoomChange,
  loadingAny
}) {
  return (
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
        px: 1.5,
        py: 0.75,
        borderRadius: 2,
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        zIndex: 100
      }}
    >
      <Tooltip title={showGrid ? 'Ocultar Grid' : 'Mostrar Grid'}>
        <IconButton size="small" onClick={onToggleGrid} color={showGrid ? 'primary' : 'default'}>
          {showGrid ? <GridIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Tooltip title={showDimensions ? 'Ocultar Cotas' : 'Mostrar Cotas'}>
        <IconButton size="small" onClick={onToggleDimensions} color={showDimensions ? 'primary' : 'default'}>
          <DimensionsIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Alejar">
        <IconButton size="small" onClick={() => onZoomChange(Math.max(50, zoom - 10))} disabled={zoom <= 50}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ width: 80, mx: 1 }}>
        <Slider
          value={zoom}
          onChange={(_, v) => onZoomChange(v)}
          min={50}
          max={200}
          step={10}
          size="small"
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}%`}
        />
      </Box>

      <Tooltip title="Acercar">
        <IconButton size="small" onClick={() => onZoomChange(Math.min(200, zoom + 10))} disabled={zoom >= 200}>
          <ZoomInIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Chip
        label={`${zoom}%`}
        size="small"
        variant="outlined"
        sx={{ height: 24, fontSize: 10, fontFamily: 'monospace' }}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Centrar Vista">
        <IconButton size="small" onClick={onCenter}>
          <CenterIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Exportar PNG">
        <IconButton size="small" onClick={onExport} disabled={loadingAny}>
          <ExportIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title="Imprimir">
        <IconButton size="small" onClick={onPrint}>
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Cambiar a Vista 3D">
        <IconButton
          size="small"
          onClick={onSwitch3D}
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': { bgcolor: 'primary.dark' }
          }}
        >
          <View3DIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {loadingAny && <CircularProgress size={18} sx={{ ml: 1 }} />}
    </Paper>
  )
}

// ============================================================
// PANEL INFO ZONA SELECCIONADA
// ============================================================
function SelectedZoneInfo({ zone, dimensions }) {
  if (!zone) return null

  const colors = ZONE_COLORS?.[zone.type] || ZONE_COLORS?.free_zone || { fill: '#94a3b8', stroke: '#475569' }
  const totalArea = dimensions.length * dimensions.width
  const percentage = totalArea > 0 ? ((zone.area / totalArea) * 100).toFixed(2) : '0.00'

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        px: 3,
        py: 1.5,
        borderRadius: 2,
        bgcolor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        minWidth: 420
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1,
          bgcolor: colors.fill,
          border: `3px solid ${colors.stroke}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Typography sx={{ color: 'white', fontWeight: 800, fontSize: 14 }}>
          {zone.type?.charAt(0)?.toUpperCase?.() || '?'}
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1f2937' }}>
          {zone.label || zone.id}
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          {colors.label || zone.type}
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#1e40af', lineHeight: 1 }}>
          {Number(zone.width || 0).toFixed(1)}m × {Number(zone.height || 0).toFixed(1)}m
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Dimensiones</Typography>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#059669', lineHeight: 1 }}>
          {Number(zone.area || 0).toFixed(1)}m²
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Superficie</Typography>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>
          {percentage}%
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>del Total</Typography>
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#374151', lineHeight: 1 }}>
          ({Number(zone.x || 0).toFixed(1)}, {Number(zone.y || 0).toFixed(1)})
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>Posición</Typography>
      </Box>
    </Paper>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Warehouse2DEditor({
  dimensions = { length: 80, width: 40, height: 10 },
  elements = [],
  onSwitch3D,
  onElementsChange
}) {
  // ✅ ÚNICA fuente de verdad en el editor
  const [localElements, setLocalElements] = useState(() => sanitizeElements(elements || [], dimensions, 'init'))
  const elementsRef = useRef(localElements)

  // ✅ REF para evitar que props-change pise el drag
  const skipNextPropsSyncRef = useRef(false)

  // ✅ Sincronización con props externas (respetando el skip)
  useEffect(() => {
    if (skipNextPropsSyncRef.current) {
      dlog('[2DEditor][props-change] SKIPPED (skipNextPropsSyncRef=true)')
      skipNextPropsSyncRef.current = false
      return
    }
    const next = sanitizeElements(elements || [], dimensions, 'props-change')
    setLocalElements(next)
  }, [elements, dimensions.length, dimensions.width])

  useEffect(() => {
    elementsRef.current = localElements
    dlog('[2DEditor][state] localElements:', localElements.length)
  }, [localElements])

  // Estado UI
  const [hoveredZoneId, setHoveredZoneId] = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [showLegend, setShowLegend] = useState(true)
  const [isDraggingElement, setIsDraggingElement] = useState(false)

  // Backend: full (OR-Tools)
  const { optimizing, optError, full } = useLayoutFullAPI()

  // Backend: analyze (Shapely) -> pausamos mientras arrastras
  const { backendZones, metrics, loading: loadingAnalyze, error } =
    useBackendZones(dimensions, localElements, isDraggingElement)

  // Local zones (fallback / para elementos reales)
  const localZones = useMemo(() => {
    return processElementsToZones(localElements, dimensions)
  }, [localElements, dimensions])

  // Zonas a mostrar (combina elementos reales + backend auto-zones)
  const zones = useMemo(() => {
    if (backendZones && backendZones.length > 0) {
      const elementZones = localZones.filter(z => !z.isAutoGenerated)
      return [...elementZones, ...backendZones]
    }
    return localZones
  }, [backendZones, localZones])

  // Métricas
  const displayMetrics = useMemo(() => {
    if (metrics) return metrics
    const totalArea = dimensions.length * dimensions.width
    const occupiedArea = localZones.occupiedArea || 0
    const freeArea = localZones.freeArea ?? (totalArea - occupiedArea)
    const efficiency = totalArea > 0 ? ((occupiedArea / totalArea) * 100).toFixed(1) : '0.0'
    return { totalArea, occupiedArea, freeArea, efficiency }
  }, [metrics, localZones, dimensions])

  // Zona seleccionada completa
  const selectedZoneData = useMemo(() => {
    if (!selectedZone) return null
    return zones.find(z => z.id === selectedZone.id) || selectedZone
  }, [selectedZone, zones])

  // Handlers hover/selección
  const handleZoneHover = useCallback((id) => setHoveredZoneId(id), [])
  const handleZoneSelect = useCallback((zone) => {
    setSelectedZone(prev => (prev?.id === zone.id ? null : zone))
  }, [])

  // Center
  const handleCenter = useCallback(() => setZoom(100), [])

  // Export
  const handleExport = useCallback(() => {
    const svg = document.querySelector('.warehouse-2d-view svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = new XMLSerializer().serializeToString(svg)
    const img = new Image()

    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const link = document.createElement('a')
      link.download = `plano-nave-${dimensions.length}x${dimensions.width}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)))
  }, [dimensions])

  // Print
  const handlePrint = useCallback(() => window.print(), [])

  // ============================================================
  // ✅ PUNTO CLAVE: AL SOLTAR UN ELEMENTO -> ORTOOLS
  // (Warehouse2DView llama a onElementMoveEnd(id, x, y))
  // ============================================================
  const handleElementMoveEnd = useCallback(async (elementId, newX, newY) => {
    // ✅ LOG para confirmar que llega
    dlog('[2DEditor][onElementMoveEnd] recibido:', elementId, { x: newX, y: newY })

    const current = elementsRef.current || []
    const moved = current.find(e => e.id === elementId)
    if (!moved) {
      dwarn('[2DEditor][onElementMoveEnd] elementId no encontrado en current:', elementId)
      return
    }

    // Clamp final defensivo
    const { w, h } = getElementWH(moved)
    const safeX = clamp(newX, 0, Math.max(0, dimensions.length - w))
    const safeY = clamp(newY, 0, Math.max(0, dimensions.width - h))
    if (safeX !== newX || safeY !== newY) {
      dwarn('[2DEditor][onElementMoveEnd] clamp aplicado:', { from: { x: newX, y: newY }, to: { x: safeX, y: safeY }, w, h })
    }

    // 1) Optimistic local update (feedback inmediato)
    const optimistic = current.map(e =>
      e.id === elementId ? { ...e, position: { ...(e.position || {}), x: safeX, y: safeY } } : e
    )

    // ✅ Marcar skip ANTES de setLocalElements para que el useEffect no lo pise
    skipNextPropsSyncRef.current = true
    setLocalElements(optimistic)
    dlog('[2DEditor][onElementMoveEnd] optimistic update aplicado, skipNextPropsSyncRef=true')

    // 2) Backend solver
    const result = await full(dimensions, optimistic, elementId, { x: safeX, y: safeY })
    if (!result || !result.elements) {
      dwarn('[2DEditor][full] result null o sin elements. Se mantiene optimistic.')
      return
    }

    // 3) Saneamos también lo que venga del backend
    const sanitizedFromBackend = sanitizeElements(result.elements, dimensions, 'backend-full')

    // ✅ Marcar skip de nuevo antes de aplicar resultado del backend
    skipNextPropsSyncRef.current = true
    setLocalElements(sanitizedFromBackend)
    dlog('[2DEditor][onElementMoveEnd] backend result aplicado, skipNextPropsSyncRef=true')

    onElementsChange?.(sanitizedFromBackend)
  }, [dimensions, full, onElementsChange])

  const loadingAny = loadingAnalyze || optimizing

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        bgcolor: '#f8fafc'
      }}
    >
      {/* Área principal */}
      <Box
        className="warehouse-2d-view"
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Toolbar */}
        <Toolbar2D
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(p => !p)}
          showDimensions={showDimensions}
          onToggleDimensions={() => setShowDimensions(p => !p)}
          onCenter={handleCenter}
          onExport={handleExport}
          onPrint={handlePrint}
          onSwitch3D={onSwitch3D}
          zoom={zoom}
          onZoomChange={setZoom}
          loadingAny={loadingAny}
        />

        {/* Loading overlay */}
        {loadingAny && (
          <Box
            sx={{
              position: 'absolute',
              top: 70,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'rgba(255,255,255,0.92)',
              px: 2,
              py: 0.75,
              borderRadius: 1
            }}
          >
            <CircularProgress size={16} />
            <Typography variant="caption">
              {optimizing ? 'Optimizando (OR-Tools)...' : 'Calculando geometría exacta...'}
            </Typography>
          </Box>
        )}

        {/* Vista 2D con zoom visual */}
        <Box
          sx={{
            width: '100%',
            height: '100%',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease'
          }}
        >
          <Warehouse2DView
            dimensions={dimensions}
            elements={localElements}
            selectedZoneId={selectedZone?.id}
            hoveredZoneId={hoveredZoneId}
            onZoneSelect={handleZoneSelect}
            onZoneHover={handleZoneHover}
            externalZones={backendZones}
            showGrid={showGrid}
            showDimensions={showDimensions}
            zoom={zoom}

            // ✅ DRAG REAL
            onElementMoveEnd={handleElementMoveEnd}

            // ✅ pausa analyze mientras arrastras
            onDraggingChange={setIsDraggingElement}
          />
        </Box>

        {/* Chips de estado */}
        {backendZones && (
          <Chip
            label="📐 Geometría Exacta"
            size="small"
            color="success"
            sx={{ position: 'absolute', top: 60, left: 12, zIndex: 100, fontSize: '11px' }}
          />
        )}

        {error && !backendZones && (
          <Chip
            label="⚠️ Modo Local"
            size="small"
            color="warning"
            sx={{ position: 'absolute', top: 60, left: 12, zIndex: 100, fontSize: '11px' }}
          />
        )}

        {optError && (
          <Chip
            label={`❌ Optimizer: ${optError}`}
            size="small"
            color="error"
            sx={{ position: 'absolute', top: 84, left: 12, zIndex: 100, fontSize: '11px' }}
          />
        )}

        {/* Métricas resumen */}
        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            px: 2,
            py: 1,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.92)',
            fontFamily: 'monospace',
            zIndex: 120
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151' }}>
            Total: {Number(displayMetrics.totalArea || 0).toFixed(0)}m² | Ocupado: {Number(displayMetrics.occupiedArea || 0).toFixed(0)}m² | Libre: {Number(displayMetrics.freeArea || 0).toFixed(0)}m² | Eficiencia: {displayMetrics.efficiency || '0.0'}%
          </Typography>
        </Paper>

        {/* Info de zona seleccionada */}
        <SelectedZoneInfo zone={selectedZoneData} dimensions={dimensions} />

        {/* Toggle leyenda */}
        {!showLegend && (
          <Tooltip title="Mostrar Leyenda">
            <IconButton
              onClick={() => setShowLegend(true)}
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                bgcolor: 'white',
                boxShadow: 2,
                '&:hover': { bgcolor: '#f1f5f9' }
              }}
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Leyenda lateral */}
      {showLegend && (
        <Box sx={{ position: 'relative' }}>
          <IconButton
            size="small"
            onClick={() => setShowLegend(false)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.3)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' }
            }}
          >
            ×
          </IconButton>

          <ZonesLegend
            dimensions={dimensions}
            elements={localElements}
            hoveredZoneId={hoveredZoneId}
            selectedZoneId={selectedZone?.id}
            onZoneHover={handleZoneHover}
            onZoneSelect={handleZoneSelect}
            width={280}
            externalZones={backendZones}
          />
        </Box>
      )}
    </Box>
  )
}
