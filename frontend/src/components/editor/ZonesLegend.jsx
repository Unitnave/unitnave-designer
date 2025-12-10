/**
 * UNITNAVE Designer - Leyenda de Zonas
 * 
 * Panel lateral con:
 * - Lista de todas las zonas
 * - Dimensiones de cada zona
 * - Interactividad hover (resalta zona en plano)
 * - Agrupación por tipo
 * - Estadísticas de superficie
 * 
 * @version 1.0
 */

import React, { useMemo, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Divider,
  Chip,
  Tooltip,
  LinearProgress
} from '@mui/material'
import {
  Inventory2 as ShelfIcon,
  LocalShipping as DockIcon,
  Business as OfficeIcon,
  Dashboard as ZoneIcon,
  Wc as ServiceIcon,
  ElectricalServices as TechnicalIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Square as ColorSquare,
  CropFree as AreaIcon,
  Straighten as DimensionIcon,
  Info as InfoIcon
} from '@mui/icons-material'

import { ZONE_COLORS, processElementsToZones } from './Warehouse2DView'

// ============================================================
// ICONOS POR TIPO
// ============================================================
const TYPE_ICONS = {
  shelf: ShelfIcon,
  dock: DockIcon,
  dock_maneuver: DockIcon,
  office: OfficeIcon,
  operational_zone: ZoneIcon,
  zone: ZoneIcon,
  receiving: ZoneIcon,
  shipping: ZoneIcon,
  picking: ZoneIcon,
  service_room: ServiceIcon,
  technical_room: TechnicalIcon,
  aisle: DimensionIcon,
  main_aisle: DimensionIcon,
  cross_aisle: DimensionIcon,
  circulation: AreaIcon,
  free_zone: AreaIcon
}

// ============================================================
// AGRUPACIONES DE TIPOS
// ============================================================
const TYPE_GROUPS = {
  storage: {
    label: 'Almacenamiento',
    types: ['shelf'],
    icon: ShelfIcon,
    color: '#3b82f6'
  },
  logistics: {
    label: 'Logística',
    types: ['dock', 'dock_maneuver', 'receiving', 'shipping'],
    icon: DockIcon,
    color: '#22c55e'
  },
  operations: {
    label: 'Operaciones',
    types: ['operational_zone', 'zone', 'picking'],
    icon: ZoneIcon,
    color: '#06b6d4'
  },
  facilities: {
    label: 'Instalaciones',
    types: ['office', 'service_room', 'technical_room'],
    icon: OfficeIcon,
    color: '#a855f7'
  },
  aisles: {
    label: 'Pasillos y Circulación',
    types: ['aisle', 'main_aisle', 'cross_aisle', 'circulation'],
    icon: DimensionIcon,
    color: '#f59e0b'
  }
}

// ============================================================
// COMPONENTE ITEM DE ZONA
// ============================================================
function ZoneItem({ 
  zone, 
  isHovered, 
  isSelected,
  onMouseEnter, 
  onMouseLeave, 
  onClick 
}) {
  const colors = ZONE_COLORS[zone.type] || ZONE_COLORS.free_zone
  const Icon = TYPE_ICONS[zone.type] || AreaIcon
  
  return (
    <ListItem
      onMouseEnter={() => onMouseEnter(zone.id)}
      onMouseLeave={onMouseLeave}
      onClick={() => onClick(zone)}
      sx={{
        py: 0.75,
        px: 1.5,
        cursor: 'pointer',
        borderRadius: 1,
        mb: 0.5,
        bgcolor: isHovered 
          ? 'rgba(59, 130, 246, 0.1)' 
          : isSelected 
            ? 'rgba(234, 179, 8, 0.15)'
            : 'transparent',
        border: isSelected 
          ? '2px solid #eab308' 
          : isHovered 
            ? '2px solid #3b82f6'
            : '2px solid transparent',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: 'rgba(59, 130, 246, 0.08)'
        }
      }}
    >
      {/* Indicador de color */}
      <ListItemIcon sx={{ minWidth: 36 }}>
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: 0.5,
            bgcolor: colors.fill,
            border: `2px solid ${colors.stroke}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon sx={{ fontSize: 12, color: 'white' }} />
        </Box>
      </ListItemIcon>
      
      {/* Info de la zona */}
      <ListItemText
        primary={
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: isHovered || isSelected ? 600 : 500,
              fontSize: 12,
              color: '#1f2937',
              lineHeight: 1.2
            }}
          >
            {zone.label}
          </Typography>
        }
        secondary={
          <Box sx={{ display: 'flex', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
            <Typography 
              variant="caption" 
              sx={{ 
                fontFamily: 'monospace',
                color: '#64748b',
                fontSize: 10
              }}
            >
              {zone.width.toFixed(1)}m × {zone.height.toFixed(1)}m
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                fontFamily: 'monospace',
                color: '#94a3b8',
                fontSize: 10
              }}
            >
              = {zone.area.toFixed(1)}m²
            </Typography>
          </Box>
        }
      />
      
      {/* Coordenadas */}
      <Tooltip title={`Posición: X=${zone.x.toFixed(1)}m, Y=${zone.y.toFixed(1)}m`}>
        <Typography 
          variant="caption" 
          sx={{ 
            fontFamily: 'monospace',
            color: '#94a3b8',
            fontSize: 9,
            ml: 1
          }}
        >
          ({zone.x.toFixed(0)}, {zone.y.toFixed(0)})
        </Typography>
      </Tooltip>
    </ListItem>
  )
}

// ============================================================
// COMPONENTE GRUPO DE ZONAS
// ============================================================
function ZoneGroup({ 
  group, 
  zones, 
  expandedGroups, 
  toggleGroup,
  hoveredZone,
  selectedZone,
  onZoneHover,
  onZoneSelect
}) {
  const Icon = group.icon
  const isExpanded = expandedGroups[group.label] !== false // Expandido por defecto
  
  // Calcular estadísticas del grupo
  const totalArea = zones.reduce((sum, z) => sum + z.area, 0)
  const count = zones.length
  
  if (zones.length === 0) return null
  
  return (
    <Box sx={{ mb: 1 }}>
      {/* Header del grupo */}
      <Box
        onClick={() => toggleGroup(group.label)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          px: 1.5,
          cursor: 'pointer',
          borderRadius: 1,
          bgcolor: '#f1f5f9',
          '&:hover': {
            bgcolor: '#e2e8f0'
          }
        }}
      >
        <Icon sx={{ fontSize: 18, color: group.color }} />
        <Typography 
          variant="subtitle2" 
          sx={{ 
            flex: 1, 
            fontWeight: 600,
            fontSize: 12,
            color: '#374151'
          }}
        >
          {group.label}
        </Typography>
        <Chip 
          label={count} 
          size="small" 
          sx={{ 
            height: 20, 
            fontSize: 10,
            bgcolor: group.color,
            color: 'white',
            fontWeight: 600
          }} 
        />
        <Typography 
          variant="caption" 
          sx={{ 
            fontFamily: 'monospace',
            color: '#64748b',
            fontSize: 10,
            ml: 0.5
          }}
        >
          {totalArea.toFixed(0)}m²
        </Typography>
        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>
      
      {/* Lista de zonas */}
      <Collapse in={isExpanded}>
        <List dense disablePadding sx={{ pl: 1 }}>
          {zones.map(zone => (
            <ZoneItem
              key={zone.id}
              zone={zone}
              isHovered={hoveredZone === zone.id}
              isSelected={selectedZone === zone.id}
              onMouseEnter={onZoneHover}
              onMouseLeave={() => onZoneHover(null)}
              onClick={onZoneSelect}
            />
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

// ============================================================
// COMPONENTE RESUMEN DE SUPERFICIES
// ============================================================
function SurfaceSummary({ zones, dimensions }) {
  const totalArea = dimensions.length * dimensions.width
  
  // Calcular áreas por grupo
  const areaByGroup = useMemo(() => {
    const result = {}
    
    Object.entries(TYPE_GROUPS).forEach(([key, group]) => {
      const groupZones = zones.filter(z => group.types.includes(z.type))
      result[key] = {
        ...group,
        area: groupZones.reduce((sum, z) => sum + z.area, 0),
        count: groupZones.length
      }
    })
    
    return result
  }, [zones])
  
  const occupiedArea = Object.values(areaByGroup).reduce((sum, g) => sum + g.area, 0)
  const freeArea = totalArea - occupiedArea
  const efficiency = (occupiedArea / totalArea) * 100
  
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          fontWeight: 700, 
          mb: 1.5,
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5
        }}
      >
        <AreaIcon sx={{ fontSize: 16 }} />
        Resumen de Superficies
      </Typography>
      
      {/* Barra de eficiencia */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Aprovechamiento
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
            {efficiency.toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={efficiency}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: '#e2e8f0',
            '& .MuiLinearProgress-bar': {
              bgcolor: efficiency > 50 ? '#22c55e' : efficiency > 30 ? '#f59e0b' : '#ef4444',
              borderRadius: 4
            }
          }}
        />
      </Box>
      
      {/* Desglose por grupos */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {Object.entries(areaByGroup).map(([key, data]) => (
          data.area > 0 && (
            <Box 
              key={key}
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: 1
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 0.5,
                  bgcolor: data.color
                }}
              />
              <Typography 
                variant="caption" 
                sx={{ flex: 1, color: '#4b5563', fontSize: 11 }}
              >
                {data.label}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: '#1f2937',
                  fontSize: 11
                }}
              >
                {data.area.toFixed(0)}m²
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#94a3b8',
                  fontSize: 10,
                  width: 35,
                  textAlign: 'right'
                }}
              >
                ({((data.area / totalArea) * 100).toFixed(0)}%)
              </Typography>
            </Box>
          )
        ))}
        
        {/* Zona libre */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 1,
            pt: 0.75,
            borderTop: '1px solid #e2e8f0'
          }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: 0.5,
              bgcolor: '#f8fafc',
              border: '1px solid #cbd5e1'
            }}
          />
          <Typography 
            variant="caption" 
            sx={{ flex: 1, color: '#4b5563', fontSize: 11 }}
          >
            Zona Libre
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              fontFamily: 'monospace',
              fontWeight: 600,
              color: '#1f2937',
              fontSize: 11
            }}
          >
            {freeArea.toFixed(0)}m²
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#94a3b8',
              fontSize: 10,
              width: 35,
              textAlign: 'right'
            }}
          >
            ({((freeArea / totalArea) * 100).toFixed(0)}%)
          </Typography>
        </Box>
      </Box>
      
      {/* Total */}
      <Box 
        sx={{ 
          mt: 1.5, 
          pt: 1, 
          borderTop: '2px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
          TOTAL NAVE
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#1f2937'
          }}
        >
          {totalArea.toLocaleString()}m²
        </Typography>
      </Box>
    </Box>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function ZonesLegend({
  dimensions = { length: 80, width: 40, height: 10 },
  elements = [],
  hoveredZoneId,
  selectedZoneId,
  onZoneHover,
  onZoneSelect,
  width = 280,
  externalZones = null  // Zonas precalculadas del backend
}) {
  const [expandedGroups, setExpandedGroups] = useState({})
  
  // Procesar elementos a zonas (local)
  const localZones = useMemo(() => {
    return processElementsToZones(elements, dimensions)
  }, [elements, dimensions])
  
  // Usar zonas externas si disponibles
  const zones = useMemo(() => {
    if (externalZones && externalZones.length > 0) {
      const elementZones = localZones.filter(z => !z.isAutoGenerated)
      return [...elementZones, ...externalZones]
    }
    return localZones
  }, [externalZones, localZones])
  
  // Agrupar zonas por tipo
  const groupedZones = useMemo(() => {
    const result = {}
    
    Object.entries(TYPE_GROUPS).forEach(([key, group]) => {
      result[key] = {
        ...group,
        zones: zones.filter(z => group.types.includes(z.type))
      }
    })
    
    return result
  }, [zones])
  
  // Toggle grupo expandido
  const toggleGroup = (label) => {
    setExpandedGroups(prev => ({
      ...prev,
      [label]: prev[label] === false ? true : false
    }))
  }
  
  return (
    <Paper
      elevation={3}
      sx={{
        width,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
        borderRadius: 0,
        borderLeft: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: '#1e293b',
          color: 'white'
        }}
      >
        <Typography 
          variant="subtitle1" 
          sx={{ 
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 0.5
          }}
        >
          📐 LEYENDA DE ZONAS
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            opacity: 0.8,
            fontSize: 10
          }}
        >
          {zones.length} zonas definidas
        </Typography>
      </Box>
      
      {/* Resumen de superficies */}
      <SurfaceSummary 
        zones={zones} 
        dimensions={dimensions} 
      />
      
      <Divider />
      
      {/* Lista de zonas por grupo */}
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: 1
        }}
      >
        {Object.entries(groupedZones).map(([key, data]) => (
          <ZoneGroup
            key={key}
            group={data}
            zones={data.zones}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            hoveredZone={hoveredZoneId}
            selectedZone={selectedZoneId}
            onZoneHover={onZoneHover}
            onZoneSelect={onZoneSelect}
          />
        ))}
      </Box>
      
      {/* Footer con info */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: '#f8fafc',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#64748b',
            fontSize: 9,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5
          }}
        >
          <InfoIcon sx={{ fontSize: 12 }} />
          Pasa el ratón sobre una zona para resaltarla en el plano
        </Typography>
      </Box>
    </Paper>
  )
}
