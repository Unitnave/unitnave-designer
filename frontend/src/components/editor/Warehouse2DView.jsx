/**
 * UNITNAVE Designer - Vista 2D CAD Profesional
 * 
 * Visualización en planta con todas las zonas definidas:
 * - Estanterías
 * - Muelles y zonas de maniobra
 * - Oficinas
 * - Zonas operativas
 * - Pasillos y zonas libres
 * - Servicios y zonas técnicas
 * 
 * @version 1.0
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Box, Typography } from '@mui/material'

// ============================================================
// COLORES POR TIPO DE ZONA (Estilo CAD profesional)
// ============================================================
const ZONE_COLORS = {
  // Elementos principales
  shelf: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Estanterías' },
  dock: { fill: '#22c55e', stroke: '#15803d', label: 'Muelles' },
  dock_maneuver: { fill: '#86efac', stroke: '#22c55e', label: 'Zona Maniobra' },
  office: { fill: '#a855f7', stroke: '#7c3aed', label: 'Oficinas' },
  
  // Zonas operativas
  operational_zone: { fill: '#06b6d4', stroke: '#0891b2', label: 'Zona Operativa' },
  receiving: { fill: '#fbbf24', stroke: '#d97706', label: 'Recepción' },
  shipping: { fill: '#fb923c', stroke: '#ea580c', label: 'Expedición' },
  picking: { fill: '#f472b6', stroke: '#db2777', label: 'Picking' },
  
  // Servicios
  service_room: { fill: '#f59e0b', stroke: '#b45309', label: 'Servicios' },
  technical_room: { fill: '#ef4444', stroke: '#b91c1c', label: 'Sala Técnica' },
  
  // Estructura
  aisle: { fill: '#e2e8f0', stroke: '#94a3b8', label: 'Pasillo' },
  free_zone: { fill: '#f8fafc', stroke: '#cbd5e1', label: 'Zona Libre' },
  wall: { fill: '#64748b', stroke: '#475569', label: 'Muro' },
  
  // Selección
  selected: { fill: '#fef08a', stroke: '#eab308' },
  hover: { fill: '#bfdbfe', stroke: '#3b82f6' }
}

// ============================================================
// COMPONENTE ZONA INDIVIDUAL
// ============================================================
function Zone2D({ 
  zone, 
  scale, 
  offset, 
  isSelected, 
  isHovered,
  onMouseEnter, 
  onMouseLeave,
  onClick 
}) {
  const { x, y, width, height, type, id, label, rotation = 0 } = zone
  
  // Obtener colores según estado
  const colors = useMemo(() => {
    if (isSelected) return ZONE_COLORS.selected
    if (isHovered) return ZONE_COLORS.hover
    return ZONE_COLORS[type] || ZONE_COLORS.free_zone
  }, [type, isSelected, isHovered])
  
  // Calcular posición en SVG (origen arriba-izquierda, Y invertido)
  const svgX = offset.x + (x * scale)
  const svgY = offset.y + (y * scale)
  const svgWidth = width * scale
  const svgHeight = height * scale
  
  // Centro para rotación
  const centerX = svgX + svgWidth / 2
  const centerY = svgY + svgHeight / 2
  
  return (
    <g
      onMouseEnter={() => onMouseEnter(id)}
      onMouseLeave={onMouseLeave}
      onClick={() => onClick(zone)}
      style={{ cursor: 'pointer' }}
    >
      {/* Rectángulo de la zona */}
      <rect
        x={svgX}
        y={svgY}
        width={svgWidth}
        height={svgHeight}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={isSelected || isHovered ? 3 : 1.5}
        opacity={isSelected || isHovered ? 1 : 0.85}
        rx={2}
        ry={2}
        transform={rotation ? `rotate(${rotation}, ${centerX}, ${centerY})` : undefined}
      />
      
      {/* Patrón de estanterías */}
      {type === 'shelf' && svgWidth > 20 && svgHeight > 10 && (
        <g opacity={0.4}>
          {/* Líneas internas para representar niveles */}
          {[0.25, 0.5, 0.75].map((pct, i) => (
            <line
              key={i}
              x1={svgX + 2}
              y1={svgY + svgHeight * pct}
              x2={svgX + svgWidth - 2}
              y2={svgY + svgHeight * pct}
              stroke={colors.stroke}
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          ))}
        </g>
      )}
      
      {/* Símbolo de muelle (puerta) */}
      {type === 'dock' && (
        <g>
          <rect
            x={svgX + svgWidth * 0.1}
            y={svgY}
            width={svgWidth * 0.8}
            height={3}
            fill="#15803d"
          />
          {/* Flechas de flujo */}
          <path
            d={`M ${centerX} ${svgY + 8} L ${centerX - 5} ${svgY + 15} L ${centerX + 5} ${svgY + 15} Z`}
            fill={colors.stroke}
            opacity={0.6}
          />
        </g>
      )}
      
      {/* Etiqueta de la zona (solo si es lo suficientemente grande) */}
      {svgWidth > 30 && svgHeight > 20 && (
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.min(11, svgWidth / 5)}
          fontFamily="'JetBrains Mono', 'Fira Code', monospace"
          fontWeight={600}
          fill={isSelected || isHovered ? '#1f2937' : colors.stroke}
          pointerEvents="none"
        >
          {label || id}
        </text>
      )}
      
      {/* Dimensiones (mostrar en hover o selección) */}
      {(isHovered || isSelected) && (
        <g pointerEvents="none">
          {/* Ancho arriba */}
          <text
            x={centerX}
            y={svgY - 6}
            textAnchor="middle"
            fontSize={9}
            fontFamily="'JetBrains Mono', monospace"
            fill="#374151"
          >
            {width.toFixed(1)}m
          </text>
          {/* Alto a la derecha */}
          <text
            x={svgX + svgWidth + 6}
            y={centerY}
            textAnchor="start"
            dominantBaseline="middle"
            fontSize={9}
            fontFamily="'JetBrains Mono', monospace"
            fill="#374151"
          >
            {height.toFixed(1)}m
          </text>
        </g>
      )}
    </g>
  )
}

// ============================================================
// COMPONENTE COTAS/DIMENSIONES
// ============================================================
function DimensionLines({ dimensions, scale, offset }) {
  const { length, width } = dimensions
  
  const svgLength = length * scale
  const svgWidth = width * scale
  
  return (
    <g className="dimension-lines" pointerEvents="none">
      {/* Cota horizontal (largo) - abajo */}
      <g>
        <line
          x1={offset.x}
          y1={offset.y + svgWidth + 25}
          x2={offset.x + svgLength}
          y2={offset.y + svgWidth + 25}
          stroke="#1e40af"
          strokeWidth={1}
          markerStart="url(#arrow-start)"
          markerEnd="url(#arrow-end)"
        />
        <text
          x={offset.x + svgLength / 2}
          y={offset.y + svgWidth + 40}
          textAnchor="middle"
          fontSize={12}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={600}
          fill="#1e40af"
        >
          {length.toFixed(1)} m
        </text>
      </g>
      
      {/* Cota vertical (ancho) - derecha */}
      <g>
        <line
          x1={offset.x + svgLength + 25}
          y1={offset.y}
          x2={offset.x + svgLength + 25}
          y2={offset.y + svgWidth}
          stroke="#1e40af"
          strokeWidth={1}
          markerStart="url(#arrow-start)"
          markerEnd="url(#arrow-end)"
        />
        <text
          x={offset.x + svgLength + 40}
          y={offset.y + svgWidth / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={600}
          fill="#1e40af"
          transform={`rotate(90, ${offset.x + svgLength + 40}, ${offset.y + svgWidth / 2})`}
        >
          {width.toFixed(1)} m
        </text>
      </g>
    </g>
  )
}

// ============================================================
// COMPONENTE GRID
// ============================================================
function Grid2D({ dimensions, scale, offset, gridSize = 5 }) {
  const { length, width } = dimensions
  
  const lines = useMemo(() => {
    const result = []
    
    // Líneas verticales
    for (let x = 0; x <= length; x += gridSize) {
      result.push({
        key: `v-${x}`,
        x1: offset.x + x * scale,
        y1: offset.y,
        x2: offset.x + x * scale,
        y2: offset.y + width * scale,
        major: x % (gridSize * 2) === 0
      })
    }
    
    // Líneas horizontales
    for (let y = 0; y <= width; y += gridSize) {
      result.push({
        key: `h-${y}`,
        x1: offset.x,
        y1: offset.y + y * scale,
        x2: offset.x + length * scale,
        y2: offset.y + y * scale,
        major: y % (gridSize * 2) === 0
      })
    }
    
    return result
  }, [dimensions, scale, offset, gridSize])
  
  return (
    <g className="grid-2d" pointerEvents="none">
      {lines.map(line => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={line.major ? '#d1d5db' : '#e5e7eb'}
          strokeWidth={line.major ? 0.8 : 0.4}
        />
      ))}
    </g>
  )
}

// ============================================================
// FUNCIÓN PARA PROCESAR ELEMENTOS A ZONAS
// ============================================================
function processElementsToZones(elements, dimensions) {
  const zones = []
  
  elements.forEach((el, index) => {
    const type = el.type
    const x = el.position?.x ?? 0
    const y = el.position?.y ?? el.position?.z ?? 0
    const rotation = el.rotation || 0
    
    // Determinar dimensiones según tipo
    let width, height
    
    switch (type) {
      case 'shelf':
        width = el.dimensions?.length ?? 2.7
        height = el.dimensions?.depth ?? 1.1
        break
      case 'dock':
        width = el.dimensions?.width ?? 3.5
        height = el.dimensions?.depth ?? 0.5
        break
      case 'office':
        width = el.dimensions?.length ?? el.dimensions?.largo ?? 12
        height = el.dimensions?.width ?? el.dimensions?.ancho ?? 8
        break
      case 'operational_zone':
      case 'zone':
        width = el.dimensions?.length ?? el.dimensions?.largo ?? 10
        height = el.dimensions?.width ?? el.dimensions?.ancho ?? 10
        break
      case 'service_room':
      case 'technical_room':
        width = el.dimensions?.length ?? el.dimensions?.largo ?? 5
        height = el.dimensions?.width ?? el.dimensions?.ancho ?? 4
        break
      default:
        width = el.dimensions?.length ?? 3
        height = el.dimensions?.depth ?? el.dimensions?.width ?? 3
    }
    
    // Zona principal del elemento
    zones.push({
      id: el.id,
      originalId: el.id,
      type,
      x,
      y,
      width,
      height,
      rotation,
      label: el.properties?.label || `${type.charAt(0).toUpperCase()}${type.slice(1)} ${index + 1}`,
      area: width * height,
      element: el
    })
    
    // Añadir zona de maniobra para muelles
    if (type === 'dock') {
      const maneuverZone = el.dimensions?.maneuverZone ?? 4
      zones.push({
        id: `${el.id}-maneuver`,
        originalId: el.id,
        type: 'dock_maneuver',
        x: x,
        y: y + (el.dimensions?.depth ?? 0.5),
        width: width,
        height: maneuverZone,
        rotation: 0,
        label: 'Zona Maniobra',
        area: width * maneuverZone,
        element: el
      })
    }
  })
  
  // Calcular zonas libres (simplificado - espacio no ocupado)
  const totalArea = dimensions.length * dimensions.width
  const occupiedArea = zones.reduce((sum, z) => sum + z.area, 0)
  const freeArea = totalArea - occupiedArea
  
  // Añadir información de zona libre como metadata
  zones.freeArea = freeArea
  zones.totalArea = totalArea
  zones.occupiedArea = occupiedArea
  
  return zones
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Warehouse2DView({ 
  dimensions = { length: 80, width: 40, height: 10 }, 
  elements = [],
  onZoneSelect,
  onZoneHover,
  selectedZoneId,
  hoveredZoneId
}) {
  const containerRef = useRef(null)
  const [viewBox, setViewBox] = useState({ width: 800, height: 500 })
  const [internalHover, setInternalHover] = useState(null)
  const [internalSelected, setInternalSelected] = useState(null)
  
  // Usar hover/selected externos si están disponibles, sino internos
  const effectiveHover = hoveredZoneId ?? internalHover
  const effectiveSelected = selectedZoneId ?? internalSelected
  
  // Procesar elementos a zonas
  const zones = useMemo(() => {
    return processElementsToZones(elements, dimensions)
  }, [elements, dimensions])
  
  // Calcular escala y offset para centrar
  const { scale, offset } = useMemo(() => {
    const padding = 80
    const availableWidth = viewBox.width - padding * 2
    const availableHeight = viewBox.height - padding * 2
    
    const scaleX = availableWidth / dimensions.length
    const scaleY = availableHeight / dimensions.width
    const scale = Math.min(scaleX, scaleY)
    
    const offsetX = (viewBox.width - dimensions.length * scale) / 2
    const offsetY = (viewBox.height - dimensions.width * scale) / 2
    
    return { 
      scale, 
      offset: { x: offsetX, y: offsetY } 
    }
  }, [viewBox, dimensions])
  
  // Ajustar viewBox al contenedor
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setViewBox({
          width: rect.width || 800,
          height: rect.height || 500
        })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])
  
  // Handlers
  const handleZoneMouseEnter = useCallback((id) => {
    setInternalHover(id)
    onZoneHover?.(id)
  }, [onZoneHover])
  
  const handleZoneMouseLeave = useCallback(() => {
    setInternalHover(null)
    onZoneHover?.(null)
  }, [onZoneHover])
  
  const handleZoneClick = useCallback((zone) => {
    setInternalSelected(zone.id)
    onZoneSelect?.(zone)
  }, [onZoneSelect])
  
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%', 
        height: '100%', 
        bgcolor: '#fafafa',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        style={{ 
          fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace"
        }}
      >
        {/* Definiciones (markers para cotas) */}
        <defs>
          <marker
            id="arrow-start"
            markerWidth="8"
            markerHeight="8"
            refX="0"
            refY="4"
            orient="auto"
          >
            <path d="M8,0 L0,4 L8,8" fill="none" stroke="#1e40af" strokeWidth="1" />
          </marker>
          <marker
            id="arrow-end"
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8" fill="none" stroke="#1e40af" strokeWidth="1" />
          </marker>
          
          {/* Patrón de sombra suave */}
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>
        
        {/* Fondo */}
        <rect 
          x={0} 
          y={0} 
          width={viewBox.width} 
          height={viewBox.height} 
          fill="#fafafa" 
        />
        
        {/* Grid */}
        <Grid2D 
          dimensions={dimensions} 
          scale={scale} 
          offset={offset} 
          gridSize={5}
        />
        
        {/* Perímetro de la nave */}
        <rect
          x={offset.x}
          y={offset.y}
          width={dimensions.length * scale}
          height={dimensions.width * scale}
          fill="#ffffff"
          stroke="#374151"
          strokeWidth={3}
          filter="url(#shadow)"
        />
        
        {/* Zonas - ordenadas por tipo para que las importantes estén arriba */}
        <g className="zones">
          {/* Primero zonas de maniobra (fondo) */}
          {zones.filter(z => z.type === 'dock_maneuver').map(zone => (
            <Zone2D
              key={zone.id}
              zone={zone}
              scale={scale}
              offset={offset}
              isSelected={effectiveSelected === zone.id || effectiveSelected === zone.originalId}
              isHovered={effectiveHover === zone.id || effectiveHover === zone.originalId}
              onMouseEnter={handleZoneMouseEnter}
              onMouseLeave={handleZoneMouseLeave}
              onClick={handleZoneClick}
            />
          ))}
          
          {/* Zonas operativas */}
          {zones.filter(z => ['operational_zone', 'zone', 'receiving', 'shipping', 'picking'].includes(z.type)).map(zone => (
            <Zone2D
              key={zone.id}
              zone={zone}
              scale={scale}
              offset={offset}
              isSelected={effectiveSelected === zone.id}
              isHovered={effectiveHover === zone.id}
              onMouseEnter={handleZoneMouseEnter}
              onMouseLeave={handleZoneMouseLeave}
              onClick={handleZoneClick}
            />
          ))}
          
          {/* Oficinas y servicios */}
          {zones.filter(z => ['office', 'service_room', 'technical_room'].includes(z.type)).map(zone => (
            <Zone2D
              key={zone.id}
              zone={zone}
              scale={scale}
              offset={offset}
              isSelected={effectiveSelected === zone.id}
              isHovered={effectiveHover === zone.id}
              onMouseEnter={handleZoneMouseEnter}
              onMouseLeave={handleZoneMouseLeave}
              onClick={handleZoneClick}
            />
          ))}
          
          {/* Estanterías */}
          {zones.filter(z => z.type === 'shelf').map(zone => (
            <Zone2D
              key={zone.id}
              zone={zone}
              scale={scale}
              offset={offset}
              isSelected={effectiveSelected === zone.id}
              isHovered={effectiveHover === zone.id}
              onMouseEnter={handleZoneMouseEnter}
              onMouseLeave={handleZoneMouseLeave}
              onClick={handleZoneClick}
            />
          ))}
          
          {/* Muelles (arriba de todo) */}
          {zones.filter(z => z.type === 'dock').map(zone => (
            <Zone2D
              key={zone.id}
              zone={zone}
              scale={scale}
              offset={offset}
              isSelected={effectiveSelected === zone.id}
              isHovered={effectiveHover === zone.id}
              onMouseEnter={handleZoneMouseEnter}
              onMouseLeave={handleZoneMouseLeave}
              onClick={handleZoneClick}
            />
          ))}
        </g>
        
        {/* Cotas generales */}
        <DimensionLines 
          dimensions={dimensions} 
          scale={scale} 
          offset={offset} 
        />
        
        {/* Norte indicator */}
        <g transform={`translate(${viewBox.width - 50}, 50)`}>
          <circle cx={0} cy={0} r={20} fill="#f1f5f9" stroke="#64748b" strokeWidth={1} />
          <path d="M0,-15 L5,10 L0,5 L-5,10 Z" fill="#374151" />
          <text x={0} y={-22} textAnchor="middle" fontSize={10} fontWeight={600} fill="#374151">N</text>
        </g>
        
        {/* Escala gráfica */}
        <g transform={`translate(${offset.x}, ${offset.y + dimensions.width * scale + 60})`}>
          <rect x={0} y={0} width={10 * scale} height={6} fill="#374151" />
          <rect x={10 * scale} y={0} width={10 * scale} height={6} fill="#94a3b8" />
          <text x={0} y={18} fontSize={9} fill="#64748b">0</text>
          <text x={10 * scale} y={18} fontSize={9} fill="#64748b" textAnchor="middle">10m</text>
          <text x={20 * scale} y={18} fontSize={9} fill="#64748b" textAnchor="middle">20m</text>
        </g>
        
        {/* Título */}
        <text 
          x={viewBox.width / 2} 
          y={25} 
          textAnchor="middle" 
          fontSize={14}
          fontWeight={700}
          fill="#1f2937"
        >
          PLANO DE PLANTA - {dimensions.length}m × {dimensions.width}m ({(dimensions.length * dimensions.width).toLocaleString()}m²)
        </text>
      </svg>
      
      {/* Info overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          bgcolor: 'rgba(255,255,255,0.95)',
          borderRadius: 1,
          px: 2,
          py: 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontFamily: 'monospace',
          fontSize: 11
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
          Zonas: {zones.length} | 
          Ocupado: {zones.occupiedArea?.toFixed(0) || 0}m² | 
          Libre: {zones.freeArea?.toFixed(0) || 0}m²
        </Typography>
      </Box>
    </Box>
  )
}

// Exportar función de procesamiento para uso en leyenda
export { processElementsToZones, ZONE_COLORS }
