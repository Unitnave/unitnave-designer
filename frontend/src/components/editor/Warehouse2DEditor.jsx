/**
 * UNITNAVE Designer - Editor 2D CAD Completo
 * 
 * Integra:
 * - Vista 2D en planta (Warehouse2DView)
 * - Leyenda lateral interactiva (ZonesLegend)
 * - Toolbar con controles
 * - Sincronización hover/selección
 * 
 * @version 1.0
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  Chip
} from '@mui/material'
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  GridOn as GridIcon,
  GridOff as GridOffIcon,
  Straighten as DimensionsIcon,
  Download as ExportIcon,
  Fullscreen as FullscreenIcon,
  Print as PrintIcon,
  ViewInAr as View3DIcon,
  Info as InfoIcon
} from '@mui/icons-material'

import Warehouse2DView, { processElementsToZones, ZONE_COLORS } from './Warehouse2DView'
import ZonesLegend from './ZonesLegend'

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
  onZoomChange
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
      {/* Controles de vista */}
      <Tooltip title={showGrid ? 'Ocultar Grid' : 'Mostrar Grid'}>
        <IconButton 
          size="small" 
          onClick={onToggleGrid}
          color={showGrid ? 'primary' : 'default'}
        >
          {showGrid ? <GridIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      
      <Tooltip title={showDimensions ? 'Ocultar Cotas' : 'Mostrar Cotas'}>
        <IconButton 
          size="small" 
          onClick={onToggleDimensions}
          color={showDimensions ? 'primary' : 'default'}
        >
          <DimensionsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      
      {/* Zoom */}
      <Tooltip title="Alejar">
        <IconButton 
          size="small" 
          onClick={() => onZoomChange(Math.max(50, zoom - 10))}
          disabled={zoom <= 50}
        >
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
        <IconButton 
          size="small" 
          onClick={() => onZoomChange(Math.min(200, zoom + 10))}
          disabled={zoom >= 200}
        >
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
      
      {/* Acciones */}
      <Tooltip title="Centrar Vista">
        <IconButton size="small" onClick={onCenter}>
          <CenterIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Exportar PNG">
        <IconButton size="small" onClick={onExport}>
          <ExportIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Imprimir">
        <IconButton size="small" onClick={onPrint}>
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      
      {/* Cambiar a 3D */}
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
    </Paper>
  )
}

// ============================================================
// PANEL INFO ZONA SELECCIONADA
// ============================================================
function SelectedZoneInfo({ zone, dimensions }) {
  if (!zone) return null
  
  const colors = ZONE_COLORS[zone.type] || ZONE_COLORS.free_zone
  const totalArea = dimensions.length * dimensions.width
  const percentage = ((zone.area / totalArea) * 100).toFixed(2)
  
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
        minWidth: 400
      }}
    >
      {/* Indicador de color */}
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
        <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 14 }}>
          {zone.type.charAt(0).toUpperCase()}
        </Typography>
      </Box>
      
      {/* Info principal */}
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1f2937' }}>
          {zone.label}
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          {colors.label || zone.type}
        </Typography>
      </Box>
      
      {/* Dimensiones */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#1e40af',
            lineHeight: 1
          }}
        >
          {zone.width.toFixed(1)}m × {zone.height.toFixed(1)}m
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          Dimensiones
        </Typography>
      </Box>
      
      {/* Área */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#059669',
            lineHeight: 1
          }}
        >
          {zone.area.toFixed(1)}m²
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          Superficie
        </Typography>
      </Box>
      
      {/* Porcentaje */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#7c3aed',
            lineHeight: 1
          }}
        >
          {percentage}%
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          del Total
        </Typography>
      </Box>
      
      {/* Posición */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace',
            fontWeight: 600,
            color: '#374151',
            lineHeight: 1
          }}
        >
          ({zone.x.toFixed(1)}, {zone.y.toFixed(1)})
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b' }}>
          Posición
        </Typography>
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
  // Estado local
  const [hoveredZoneId, setHoveredZoneId] = useState(null)
  const [selectedZone, setSelectedZone] = useState(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [showLegend, setShowLegend] = useState(true)
  
  // Procesar zonas para obtener la seleccionada
  const zones = useMemo(() => {
    return processElementsToZones(elements, dimensions)
  }, [elements, dimensions])
  
  // Obtener zona seleccionada completa
  const selectedZoneData = useMemo(() => {
    if (!selectedZone) return null
    return zones.find(z => z.id === selectedZone.id) || selectedZone
  }, [selectedZone, zones])
  
  // Handlers
  const handleZoneHover = useCallback((id) => {
    setHoveredZoneId(id)
  }, [])
  
  const handleZoneSelect = useCallback((zone) => {
    setSelectedZone(prev => prev?.id === zone.id ? null : zone)
  }, [])
  
  const handleCenter = useCallback(() => {
    setZoom(100)
    // Aquí podríamos añadir lógica para centrar el SVG
  }, [])
  
  const handleExport = useCallback(() => {
    // Exportar a PNG
    const svg = document.querySelector('.warehouse-2d-view svg')
    if (!svg) return
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
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
  
  const handlePrint = useCallback(() => {
    window.print()
  }, [])
  
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
      {/* Área principal - Vista 2D */}
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
        />
        
        {/* Vista 2D */}
        <Box 
          sx={{ 
            width: '100%', 
            height: '100%',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease'
          }}
        >
          <Warehouse2DView
            dimensions={dimensions}
            elements={elements}
            selectedZoneId={selectedZone?.id}
            hoveredZoneId={hoveredZoneId}
            onZoneSelect={handleZoneSelect}
            onZoneHover={handleZoneHover}
          />
        </Box>
        
        {/* Info de zona seleccionada */}
        <SelectedZoneInfo 
          zone={selectedZoneData} 
          dimensions={dimensions}
        />
        
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
          {/* Botón cerrar */}
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
            elements={elements}
            hoveredZoneId={hoveredZoneId}
            selectedZoneId={selectedZone?.id}
            onZoneHover={handleZoneHover}
            onZoneSelect={handleZoneSelect}
            width={280}
          />
        </Box>
      )}
    </Box>
  )
}
