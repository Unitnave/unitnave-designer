/**
 * UNITNAVE Designer - Layers Panel V2
 * 
 * Panel de gestión de capas con:
 * - Toggle visibilidad
 * - Bloqueo de capas
 * - Aislamiento de capa
 * - Configuración de Grid/Snap
 * 
 * @version 2.0
 */

import React, { useState } from 'react'
import {
  Paper,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
  FilterCenterFocus,
  ExpandMore,
  Close as CloseIcon,
  // Layer icons
  Inventory2,
  LocalShipping,
  Business,
  Wc,
  Dashboard,
  LinearScale,
  CropSquare,
  Straighten,
  Grid4x4,
  Warning
} from '@mui/icons-material'

import useEditorStore from '../stores/useEditorStore'

// Mapeo de iconos
const LAYER_ICONS = {
  Inventory2,
  LocalShipping,
  Business,
  Wc,
  Dashboard,
  LinearScale,
  CropSquare,
  Straighten,
  Grid4x4,
  Warning
}

export default function LayersPanel() {
  const {
    layers,
    showLayersPanel,
    toggleLayersPanel,
    toggleLayer,
    setLayerLocked,
    isolateLayer,
    showAllLayers,
    hideAllLayers,
    // Grid
    gridConfig,
    setGridSize,
    toggleGrid,
    // Snap
    snapConfig,
    setSnapDistance,
    toggleSnap,
    toggleOrtho
  } = useEditorStore()
  
  const [configExpanded, setConfigExpanded] = useState(false)
  
  if (!showLayersPanel) return null
  
  const visibleCount = Object.values(layers).filter(l => l.visible).length
  const totalCount = Object.keys(layers).length
  
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 60,
        right: 10,
        width: 280,
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'hidden',
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          color: 'white'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Grid4x4 />
          <Typography variant="subtitle1" fontWeight={600}>
            Capas
          </Typography>
          <Chip 
            label={`${visibleCount}/${totalCount}`}
            size="small"
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.2)', 
              color: 'white',
              height: 22,
              '& .MuiChip-label': { px: 1, fontSize: '0.7rem' }
            }}
          />
        </Box>
        <IconButton 
          size="small" 
          onClick={toggleLayersPanel}
          sx={{ color: 'white' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      
      {/* Quick Actions */}
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 1, 
          p: 1, 
          borderBottom: '1px solid #e2e8f0' 
        }}
      >
        <Chip 
          label="Todas"
          size="small"
          onClick={showAllLayers}
          sx={{ flex: 1 }}
        />
        <Chip 
          label="Ninguna"
          size="small"
          onClick={hideAllLayers}
          sx={{ flex: 1 }}
        />
      </Box>
      
      {/* Layers List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List dense sx={{ py: 0 }}>
          {Object.entries(layers).map(([layerId, layer]) => {
            const IconComponent = LAYER_ICONS[layer.icon] || Inventory2
            
            return (
              <ListItem
                key={layerId}
                sx={{
                  borderBottom: '1px solid #f1f5f9',
                  py: 0.5,
                  opacity: layer.visible ? 1 : 0.5,
                  '&:hover': { bgcolor: '#f8fafc' }
                }}
              >
                {/* Color indicator */}
                <Box
                  sx={{
                    width: 4,
                    height: 32,
                    bgcolor: layer.color,
                    borderRadius: 1,
                    mr: 1.5
                  }}
                />
                
                {/* Icon */}
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <IconComponent 
                    fontSize="small" 
                    sx={{ color: layer.visible ? layer.color : '#94a3b8' }}
                  />
                </ListItemIcon>
                
                {/* Name */}
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                      {layer.name}
                    </Typography>
                  }
                />
                
                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  {/* Isolate */}
                  <Tooltip title="Aislar capa" arrow>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => isolateLayer(layerId)}
                        disabled={layer.locked}
                        sx={{ p: 0.5 }}
                      >
                        <FilterCenterFocus fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  
                  {/* Lock */}
                  <Tooltip title={layer.locked ? 'Desbloquear' : 'Bloquear'} arrow>
                    <IconButton
                      size="small"
                      onClick={() => setLayerLocked(layerId, !layer.locked)}
                      sx={{ p: 0.5 }}
                    >
                      {layer.locked ? (
                        <Lock fontSize="small" color="warning" />
                      ) : (
                        <LockOpen fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  
                  {/* Visibility */}
                  <Tooltip title={layer.visible ? 'Ocultar' : 'Mostrar'} arrow>
                    <IconButton
                      size="small"
                      onClick={() => toggleLayer(layerId)}
                      sx={{ p: 0.5 }}
                    >
                      {layer.visible ? (
                        <Visibility fontSize="small" color="primary" />
                      ) : (
                        <VisibilityOff fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItem>
            )
          })}
        </List>
      </Box>
      
      {/* Grid & Snap Configuration */}
      <Accordion 
        expanded={configExpanded}
        onChange={() => setConfigExpanded(!configExpanded)}
        sx={{ 
          boxShadow: 'none',
          '&:before': { display: 'none' },
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2" fontWeight={600}>
            Configuración
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {/* Grid Size */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Tamaño Grid
              </Typography>
              <Typography variant="caption" fontWeight={600}>
                {gridConfig.size}m
              </Typography>
            </Box>
            <Slider
              value={gridConfig.size}
              onChange={(e, val) => setGridSize(val)}
              min={0.25}
              max={5}
              step={0.25}
              size="small"
              marks={[
                { value: 0.5, label: '0.5' },
                { value: 1, label: '1' },
                { value: 2.5, label: '2.5' },
                { value: 5, label: '5' }
              ]}
            />
          </Box>
          
          {/* Snap Distance */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Distancia Snap
              </Typography>
              <Typography variant="caption" fontWeight={600}>
                {snapConfig.snapDistance}m
              </Typography>
            </Box>
            <Slider
              value={snapConfig.snapDistance}
              onChange={(e, val) => setSnapDistance(val)}
              min={0.1}
              max={2}
              step={0.1}
              size="small"
            />
          </Box>
          
          {/* Toggles */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel
              control={
                <Switch 
                  size="small" 
                  checked={gridConfig.visible}
                  onChange={toggleGrid}
                />
              }
              label={<Typography variant="caption">Mostrar Grid</Typography>}
            />
            <FormControlLabel
              control={
                <Switch 
                  size="small" 
                  checked={snapConfig.enabled}
                  onChange={toggleSnap}
                />
              }
              label={<Typography variant="caption">Snap activo</Typography>}
            />
            <FormControlLabel
              control={
                <Switch 
                  size="small" 
                  checked={snapConfig.orthoMode}
                  onChange={toggleOrtho}
                />
              }
              label={<Typography variant="caption">Modo Ortogonal</Typography>}
            />
          </Box>
        </AccordionDetails>
      </Accordion>
      
      {/* Keyboard shortcuts info */}
      <Box 
        sx={{ 
          p: 1, 
          bgcolor: '#f8fafc', 
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          justifyContent: 'center'
        }}
      >
        {[
          { key: 'G', label: 'Grid' },
          { key: 'N', label: 'Snap' },
          { key: 'T', label: 'Ortho' },
          { key: 'L', label: 'Panel' }
        ].map(shortcut => (
          <Chip
            key={shortcut.key}
            label={`${shortcut.key}: ${shortcut.label}`}
            size="small"
            variant="outlined"
            sx={{ 
              height: 20, 
              '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' }
            }}
          />
        ))}
      </Box>
    </Paper>
  )
}
