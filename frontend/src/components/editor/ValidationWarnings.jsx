/**
 * UNITNAVE Designer - Validation Warnings V2
 * 
 * "Inteligencia Logística" en tiempo real
 * Muestra avisos mientras editas:
 * - Pasillos estrechos
 * - Muelles bloqueados
 * - Colisiones
 * - Densidad
 * 
 * @version 2.0
 */

import React, { useEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import { 
  Paper, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Typography,
  Collapse,
  IconButton,
  Badge,
  Chip,
  Box,
  LinearProgress
} from '@mui/material'
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  ExpandLess,
  ExpandMore,
  Close as CloseIcon
} from '@mui/icons-material'

import useEditorStore, { AISLE_WIDTHS } from '../stores/useEditorStore'

// ==================== INDICADORES 3D EN EL CANVAS ====================

/**
 * Marcador visual de warning en la posición 3D
 */
function WarningMarker3D({ warning }) {
  const { layers } = useEditorStore()
  
  if (!layers.warnings.visible) return null
  
  const colorMap = {
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  }
  
  const iconMap = {
    error: '🔴',
    warning: '🟡',
    info: '🔵'
  }
  
  const color = colorMap[warning.severity] || colorMap.warning
  
  return (
    <group position={[warning.position.x, 0.5, warning.position.z]}>
      {/* Círculo pulsante en el suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
        <ringGeometry args={[0.8, 1.2, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      
      {/* Línea vertical indicadora */}
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Etiqueta HTML */}
      <Html
        position={[0, 1.5, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: color,
          color: 'white',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          maxWidth: '200px',
          textAlign: 'center'
        }}>
          {iconMap[warning.severity]} {warning.message}
        </div>
      </Html>
    </group>
  )
}

/**
 * Renderiza todos los marcadores de warning en el canvas 3D
 */
export function ValidationMarkers3D() {
  const { validationWarnings, layers } = useEditorStore()
  
  if (!layers.warnings.visible || validationWarnings.length === 0) {
    return null
  }
  
  return (
    <group name="validation-warnings">
      {validationWarnings.map((warning, index) => (
        <WarningMarker3D 
          key={`warning-${index}-${warning.type}`} 
          warning={warning} 
        />
      ))}
    </group>
  )
}

// ==================== PANEL DE AVISOS UI ====================

/**
 * Panel lateral/inferior con lista de avisos
 */
export function ValidationPanel({ position = 'bottom-right' }) {
  const { 
    validationWarnings, 
    machinery,
    layers,
    setLayerVisibility
  } = useEditorStore()
  
  const [expanded, setExpanded] = React.useState(true)
  const [dismissed, setDismissed] = React.useState(new Set())
  
  // Filtrar warnings no descartados
  const activeWarnings = useMemo(() => 
    validationWarnings.filter((_, i) => !dismissed.has(i)),
    [validationWarnings, dismissed]
  )
  
  // Contar por severidad
  const counts = useMemo(() => ({
    error: activeWarnings.filter(w => w.severity === 'error').length,
    warning: activeWarnings.filter(w => w.severity === 'warning').length,
    info: activeWarnings.filter(w => w.severity === 'info').length
  }), [activeWarnings])
  
  const totalCount = counts.error + counts.warning + counts.info
  
  // Si no hay avisos, mostrar estado OK
  if (totalCount === 0) {
    return (
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          ...(position === 'bottom-right' && { bottom: 10, right: 10 }),
          ...(position === 'bottom-left' && { bottom: 10, left: 10 }),
          p: 1.5,
          borderRadius: 2,
          background: 'rgba(34, 197, 94, 0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <CheckIcon sx={{ color: 'white' }} />
        <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
          Layout válido ✓
        </Typography>
      </Paper>
    )
  }
  
  // Determinar color del header según severidad más alta
  const headerColor = counts.error > 0 ? '#ef4444' : counts.warning > 0 ? '#f59e0b' : '#3b82f6'
  
  const getIcon = (severity) => {
    switch (severity) {
      case 'error': return <ErrorIcon sx={{ color: '#ef4444' }} />
      case 'warning': return <WarningIcon sx={{ color: '#f59e0b' }} />
      case 'info': return <InfoIcon sx={{ color: '#3b82f6' }} />
      default: return <InfoIcon />
    }
  }
  
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        ...(position === 'bottom-right' && { bottom: 10, right: 10 }),
        ...(position === 'bottom-left' && { bottom: 10, left: 10 }),
        width: 320,
        maxHeight: expanded ? 300 : 48,
        overflow: 'hidden',
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(10px)',
        zIndex: 999,
        transition: 'max-height 0.3s ease'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          background: headerColor,
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: 'white', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
            Validación del Layout
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {counts.error > 0 && (
            <Chip 
              label={counts.error} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                height: 20,
                '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
              }} 
            />
          )}
          {counts.warning > 0 && (
            <Chip 
              label={counts.warning} 
              size="small" 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                height: 20,
                '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
              }} 
            />
          )}
          <IconButton size="small" sx={{ color: 'white', p: 0.25 }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>
      
      {/* Lista de avisos */}
      <Collapse in={expanded}>
        <Box sx={{ maxHeight: 220, overflow: 'auto' }}>
          {/* Info de maquinaria */}
          <Box sx={{ px: 1.5, py: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Typography variant="caption" color="text.secondary">
              Maquinaria: <strong>{machinery}</strong> 
              {' '} • Pasillo mín: <strong>{AISLE_WIDTHS[machinery]}m</strong>
            </Typography>
          </Box>
          
          <List dense sx={{ py: 0 }}>
            {activeWarnings.map((warning, index) => (
              <ListItem
                key={`${warning.type}-${index}`}
                sx={{
                  borderBottom: '1px solid #f1f5f9',
                  '&:hover': { bgcolor: '#f8fafc' },
                  py: 0.75
                }}
                secondaryAction={
                  <IconButton 
                    edge="end" 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDismissed(prev => new Set([...prev, index]))
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {getIcon(warning.severity)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
                      {warning.message}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {warning.type.replace('_', ' ')}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
        
        {/* Toggle visibilidad markers 3D */}
        <Box 
          sx={{ 
            p: 1, 
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Mostrar en 3D
          </Typography>
          <Chip
            label={layers.warnings.visible ? 'ON' : 'OFF'}
            size="small"
            color={layers.warnings.visible ? 'primary' : 'default'}
            onClick={() => setLayerVisibility('warnings', !layers.warnings.visible)}
            sx={{ height: 22 }}
          />
        </Box>
      </Collapse>
    </Paper>
  )
}

// ==================== INDICADOR DE DENSIDAD ====================

/**
 * Mini indicador de densidad del layout
 */
export function DensityIndicator({ elements, dimensions }) {
  const density = useMemo(() => {
    if (!elements || !dimensions) return 0
    
    const shelves = elements.filter(el => el.type === 'shelf')
    const totalShelfArea = shelves.reduce((sum, s) => {
      const length = s.dimensions?.length || 2.7
      const depth = s.dimensions?.depth || 1.1
      return sum + (length * depth)
    }, 0)
    
    const totalArea = dimensions.length * dimensions.width
    return totalArea > 0 ? (totalShelfArea / totalArea) * 100 : 0
  }, [elements, dimensions])
  
  // Color según densidad
  const getColor = (d) => {
    if (d < 15) return '#ef4444'  // Muy baja
    if (d < 25) return '#f59e0b'  // Baja
    if (d > 55) return '#f59e0b'  // Alta
    if (d > 65) return '#ef4444'  // Muy alta
    return '#22c55e'              // Óptima
  }
  
  const getLabel = (d) => {
    if (d < 15) return 'Muy baja'
    if (d < 25) return 'Baja'
    if (d > 55) return 'Alta'
    if (d > 65) return 'Muy alta'
    return 'Óptima'
  }
  
  return (
    <Paper
      elevation={2}
      sx={{
        position: 'absolute',
        bottom: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 0.75,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        zIndex: 998
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Densidad:
      </Typography>
      
      <Box sx={{ width: 80 }}>
        <LinearProgress 
          variant="determinate" 
          value={Math.min(density, 100)}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: '#e2e8f0',
            '& .MuiLinearProgress-bar': {
              bgcolor: getColor(density),
              borderRadius: 4
            }
          }}
        />
      </Box>
      
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: 600, 
          color: getColor(density),
          minWidth: 40,
          textAlign: 'right'
        }}
      >
        {density.toFixed(1)}%
      </Typography>
      
      <Chip 
        label={getLabel(density)}
        size="small"
        sx={{ 
          height: 20,
          bgcolor: getColor(density),
          color: 'white',
          '& .MuiChip-label': { px: 1, fontSize: '0.65rem', fontWeight: 600 }
        }}
      />
    </Paper>
  )
}

// ==================== EXPORTS ====================

export default {
  ValidationMarkers3D,
  ValidationPanel,
  DensityIndicator
}
