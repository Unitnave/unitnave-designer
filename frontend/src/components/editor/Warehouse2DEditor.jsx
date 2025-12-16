/**
 * UNITNAVE Designer - Editor 2D CAD Completo
 *
 * Integra:
 * - Vista 2D en planta (Warehouse2DView) con cotas
 * - Leyenda lateral interactiva (ZonesLegend)
 * - Toolbar con controles
 * - Sincronización hover/selección
 * - Cálculo exacto de zonas via backend (Shapely) /analyze
 * - ✅ RE-OPTIMIZACIÓN INTELIGENTE con zonas prohibidas /reoptimize_smart
 *
 * @version 4.0.0 - NUEVO: Usa /api/layout/reoptimize_smart con forbidden zones
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
// Helpers
// ============================================================
const isFiniteNumber = (v) => Number.isFinite(v)
const toPosNumber = (v, fallback) => (isFiniteNumber(v) && v > 0 ? v : fallback)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function getElementWH(el) {
  const type = el?.type
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

  for (const el of input) {
    if (!el?.id) continue

    const { w, h } = getElementWH(el)

    const x0 = isFiniteNumber(el.position?.x) ? el.position.x : 0
    const y0raw = isFiniteNumber(el.position?.y) ? el.position.y : (isFiniteNumber(el.position?.z) ? el.position.z : 0)

    const x1 = clamp(x0, 0, Math.max(0, length - w))
    const y1 = clamp(y0raw, 0, Math.max(0, width - h))

    out.push({
      ...el,
      position: {
        ...(el.position || {}),
        x: x1,
        y: y1
      }
    })
  }

  return out
}

// ============================================================
// HOOK PARA OBTENER ZONAS DEL BACKEND (Geometría Exacta)
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
// ✅ NUEVO: HOOK PARA RE-OPTIMIZACIÓN INTELIGENTE CON ZONAS PROHIBIDAS
// ============================================================
function useLayoutReoptimizeSmart() {
  const [optimizing, setOptimizing] = useState(false)
  const [optError, setOptError] = useState(null)

  const reoptimize = useCallback(async (config, currentElements, movedId, movedPos, forbiddenZones) => {
    setOptimizing(true)
    setOptError(null)

    try {
      console.log('🧠 [2DEditor][reoptimize_smart] POST', `${API_URL}/api/layout/reoptimize_smart`)
      console.log('🧠 [2DEditor][reoptimize_smart] Moved:', movedId, movedPos)
      console.log('🧠 [2DEditor][reoptimize_smart] Forbidden zones:', forbiddenZones.length)
      
      const response = await fetch(`${API_URL}/api/layout/reoptimize_smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moved_element_id: movedId,
          moved_position: movedPos,
          originalConfig: config,
          currentElements: currentElements,
          forbiddenZones: forbiddenZones
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errText}`)
      }

      const json = await response.json()
      console.log('✅ [2DEditor][reoptimize_smart] OK', { 
        elements: json?.elements?.length,
        solve_time_ms: json?.solve_time_ms 
      })
      return json
    } catch (err) {
      console.error('❌ [2DEditor][reoptimize_smart] ERROR:', err)
      setOptError(err?.message || 'Reoptimize error')
      return null
    } finally {
      setOptimizing(false)
    }
  }, [])

  return { optimizing, optError, reoptimize }
}

// ============================================================
// ✅ HELPER: Crear caja de zona prohibida
// ============================================================
function box(el, type) {
  const pos = el.position || {}
  const dims = el.dimensions || {}
  
  return {
    id: el.id,
    type: type,
    x: pos.x ?? el.x ?? 0,
    y: pos.y ?? el.y ?? 0,
    width: dims.length ?? dims.width ?? dims.largo ?? el.width ?? 5,
    height: dims.depth ?? dims.height ?? dims.ancho ?? el.height ?? 5
  }
}

// ============================================================
// ✅ FUNCIÓN HÍBRIDA: ZONAS PROHIBIDAS INTELIGENTES
// ============================================================
// - Muelles, oficinas → SIEMPRE prohibidos
// - Zonas de maniobra ≥ 4m → prohibidas (críticas)
// - Pasillos principales (≥ 2.5m) → prohibidos
// - Pasillos secundarios (< 2.5m) → se recalculan automáticamente
// ============================================================
function extractForbiddenZones(elements, backendZones) {
  const forbidden = []

  // 1. Muelles (SIEMPRE fijos - no se pueden pisar)
  elements.filter(el => el.type === 'dock').forEach(el => {
    forbidden.push(box(el, 'dock'))
  })

  // 2. Oficinas (SIEMPRE fijas - no se pueden pisar)
  elements.filter(el => el.type === 'office').forEach(el => {
    forbidden.push(box(el, 'office'))
  })

  // 3. Zonas de maniobra GRANDES (≥ 4m) → críticas para operación
  elements.filter(el => {
    if (el.type !== 'operational_zone' && el.type !== 'zone') return false
    if (el.properties?.type === 'maneuver' || el.properties?.type === 'maniobra') {
      const w = el.dimensions?.length ?? el.dimensions?.width ?? 0
      const h = el.dimensions?.depth ?? el.dimensions?.height ?? 0
      return w >= 4 || h >= 4
    }
    return false
  }).forEach(el => {
    forbidden.push(box(el, 'maneuver'))
  })

  // 4. Pasillos PRINCIPALES (ancho ≥ 2.5m) → prohibidos
  //    Pasillos secundarios (< 2.5m) → NO se incluyen, se recalculan
  if (backendZones && backendZones.length > 0) {
    backendZones
      .filter(z => {
        const isAisle = z.type === 'aisle' || 
                        z.type === 'pasillo' || 
                        z.label?.toLowerCase().includes('pasillo')
        if (!isAisle) return false
        
        // Solo pasillos principales (≥ 2.5m en alguna dimensión)
        const w = z.width ?? z.dimensions?.length ?? 0
        const h = z.height ?? z.dimensions?.width ?? 0
        return w >= 2.5 || h >= 2.5
      })
      .forEach(z => {
        forbidden.push({
          id: z.id,
          type: 'main_aisle',
          x: z.x ?? z.position?.x ?? 0,
          y: z.y ?? z.position?.y ?? 0,
          width: z.width ?? z.dimensions?.length ?? 3,
          height: z.height ?? z.dimensions?.width ?? 3
        })
      })
  }

  // 5. Salas técnicas/servicios GRANDES (> 20m²) → fijas
  elements.filter(el => {
    if (el.type !== 'service_room' && el.type !== 'technical_room') return false
    const w = el.dimensions?.length ?? el.dimensions?.largo ?? 0
    const h = el.dimensions?.width ?? el.dimensions?.ancho ?? 0
    return (w * h) > 20  // Solo si son grandes
  }).forEach(el => {
    forbidden.push(box(el, 'service'))
  })

  console.log('🚫 [extractForbiddenZones] Híbrido:', forbidden.length, 'zonas prohibidas')
  console.log('   - Muelles:', forbidden.filter(z => z.type === 'dock').length)
  console.log('   - Oficinas:', forbidden.filter(z => z.type === 'office').length)
  console.log('   - Maniobra:', forbidden.filter(z => z.type === 'maneuver').length)
  console.log('   - Pasillos principales:', forbidden.filter(z => z.type === 'main_aisle').length)
  console.log('   - Servicios:', forbidden.filter(z => z.type === 'service').length)
  
  return forbidden
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
  onElementsChange,
  originalConfig = null
}) {
  // Estado local de elementos
  const [localElements, setLocalElements] = useState(() => sanitizeElements(elements || [], dimensions, 'init'))
  const elementsRef = useRef(localElements)
  const skipNextPropsSyncRef = useRef(false)
  
  // Guardar posición original antes del drag
  const originalPositionRef = useRef(null)

  // Sincronización con props
  useEffect(() => {
    if (skipNextPropsSyncRef.current) {
      skipNextPropsSyncRef.current = false
      return
    }
    const next = sanitizeElements(elements || [], dimensions, 'props-change')
    setLocalElements(next)
  }, [elements, dimensions.length, dimensions.width])

  useEffect(() => {
    elementsRef.current = localElements
  }, [localElements])

  // Estado UI
  const [hoveredZoneId, setHoveredZoneId] = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [showLegend, setShowLegend] = useState(true)
  const [isDraggingElement, setIsDraggingElement] = useState(false)

  // ✅ Hook de re-optimización inteligente
  const { optimizing, optError, reoptimize } = useLayoutReoptimizeSmart()

  // Backend: analyze (Shapely)
  const { backendZones, metrics, loading: loadingAnalyze, error } =
    useBackendZones(dimensions, localElements, isDraggingElement)

  // Local zones
  const localZones = useMemo(() => {
    return processElementsToZones(localElements, dimensions)
  }, [localElements, dimensions])

  // Zonas combinadas
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

  // Zona seleccionada
  const selectedZoneData = useMemo(() => {
    if (!selectedZone) return null
    return zones.find(z => z.id === selectedZone.id) || selectedZone
  }, [selectedZone, zones])

  // Handlers
  const handleZoneHover = useCallback((id) => setHoveredZoneId(id), [])
  const handleZoneSelect = useCallback((zone) => {
    setSelectedZone(prev => (prev?.id === zone.id ? null : zone))
  }, [])
  const handleCenter = useCallback(() => setZoom(100), [])
  const handlePrint = useCallback(() => window.print(), [])

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

  // ============================================================
  // ✅ GUARDAR POSICIÓN ORIGINAL AL EMPEZAR A ARRASTRAR
  // ============================================================
  const handleDragStart = useCallback((elementId) => {
    const current = elementsRef.current || []
    const el = current.find(e => e.id === elementId)
    if (el) {
      originalPositionRef.current = {
        id: elementId,
        x: el.position?.x || 0,
        y: el.position?.y || 0
      }
      console.log('📍 [2DEditor][dragStart] Posición original guardada:', originalPositionRef.current)
    }
  }, [])

  // ============================================================
  // ✅ AL SOLTAR UN ELEMENTO -> RE-OPTIMIZAR CON ZONAS PROHIBIDAS
  // ============================================================
  const handleElementMoveEnd = useCallback(async (elementId, newX, newY) => {
    console.log('🎯 [2DEditor][onElementMoveEnd] recibido:', elementId, { x: newX, y: newY })

    const current = elementsRef.current || []
    const moved = current.find(e => e.id === elementId)
    if (!moved) {
      console.warn('[2DEditor][onElementMoveEnd] elementId no encontrado:', elementId)
      return
    }

    // Clamp
    const { w, h } = getElementWH(moved)
    const safeX = clamp(newX, 0, Math.max(0, dimensions.length - w))
    const safeY = clamp(newY, 0, Math.max(0, dimensions.width - h))

    // 1) Optimistic update
    const optimistic = current.map(e =>
      e.id === elementId ? { ...e, position: { ...(e.position || {}), x: safeX, y: safeY } } : e
    )

    skipNextPropsSyncRef.current = true
    setLocalElements(optimistic)
    console.log('🎯 [2DEditor][onElementMoveEnd] optimistic update aplicado')

    // 2) Construir configuración
    const config = originalConfig || {
      length: dimensions.length,
      width: dimensions.width,
      height: dimensions.height || 10,
      machinery: 'retractil'
    }

    // 3) Extraer zonas prohibidas (muelles, oficinas, pasillos, zonas de maniobra)
    const forbiddenZones = extractForbiddenZones(current, backendZones)

    console.log('🧠 [2DEditor][onElementMoveEnd] Llamando a /api/layout/reoptimize_smart...')
    console.log('🧠 [2DEditor][onElementMoveEnd] Zonas prohibidas:', forbiddenZones.length)

    // 4) Llamar al backend para re-optimizar
    const result = await reoptimize(config, current, elementId, { x: safeX, y: safeY }, forbiddenZones)

    if (!result || result.status !== 'success') {
      console.warn('⚠️ [2DEditor][reoptimize_smart] Sin resultado válido. Volviendo a posición original.')
      
      // Volver a la posición original
      if (originalPositionRef.current && originalPositionRef.current.id === elementId) {
        const revert = current.map(e =>
          e.id === elementId 
            ? { ...e, position: { ...(e.position || {}), x: originalPositionRef.current.x, y: originalPositionRef.current.y } } 
            : e
        )
        skipNextPropsSyncRef.current = true
        setLocalElements(revert)
        console.log('↩️ [2DEditor] Elemento devuelto a posición original')
      }
      return
    }

    // 5) Aplicar resultado del backend
    const sanitizedFromBackend = sanitizeElements(result.elements, dimensions, 'backend-reoptimize')
    
    skipNextPropsSyncRef.current = true
    setLocalElements(sanitizedFromBackend)
    console.log('✅ [2DEditor][onElementMoveEnd] Nuevo layout aplicado:', sanitizedFromBackend.length, 'elementos')
    console.log('⏱️ [2DEditor] Tiempo de solve:', result.solve_time_ms, 'ms')

    onElementsChange?.(sanitizedFromBackend)
  }, [dimensions, reoptimize, onElementsChange, originalConfig, backendZones])

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
              {optimizing ? '🧠 Re-optimizando con OR-Tools...' : 'Calculando geometría exacta...'}
            </Typography>
          </Box>
        )}

        {/* Vista 2D */}
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
            onElementMoveEnd={handleElementMoveEnd}
            onDraggingChange={setIsDraggingElement}
            onDragStart={handleDragStart}
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
            label={`❌ ${optError.substring(0, 30)}...`}
            size="small"
            color="error"
            sx={{ position: 'absolute', top: 84, left: 12, zIndex: 100, fontSize: '11px' }}
          />
        )}

        {/* Métricas */}
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
            Total: {Number(displayMetrics.totalArea || 0).toFixed(0)}m² | 
            Ocupado: {Number(displayMetrics.occupiedArea || 0).toFixed(0)}m² | 
            Libre: {Number(displayMetrics.freeArea || 0).toFixed(0)}m² | 
            Eficiencia: {displayMetrics.efficiency || '0.0'}%
          </Typography>
        </Paper>

        {/* Info zona seleccionada */}
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
