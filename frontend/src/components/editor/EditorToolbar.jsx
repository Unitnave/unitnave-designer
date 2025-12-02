/**
 * UNITNAVE Designer - Editor Toolbar V2
 * 
 * Barra de herramientas profesional con:
 * - Sistema de Tools completo
 * - Indicadores de estado
 * - Atajos de teclado visibles
 * 
 * @version 2.0
 */

import React from 'react'
import {
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  Divider,
  Badge,
  Chip,
  Box,
  Typography
} from '@mui/material'
import {
  // Selection & Transform
  NearMe as SelectIcon,
  OpenWith as MoveIcon,
  RotateRight as RotateIcon,
  // Draw tools
  Inventory2 as ShelfIcon,
  LocalShipping as DockIcon,
  Business as OfficeIcon,
  Dashboard as ZoneIcon,
  // Actions
  Delete as EraseIcon,
  Straighten as MeasureIcon,
  PanTool as PanIcon,
  // View
  ViewInAr as View3DIcon,
  CropSquare as View2DIcon,
  // Grid & Snap
  GridOn as GridIcon,
  GridOff as GridOffIcon,
  MyLocation as SnapIcon,
  SwapHoriz as OrthoIcon,
  // Layers & Dimensions
  Layers as LayersIcon,
  // History
  Undo as UndoIcon,
  Redo as RedoIcon,
  // Camera
  CenterFocusStrong as CenterIcon,
  // Info
  Warning as WarningIcon
} from '@mui/icons-material'

import useEditorStore from '../../stores/useEditorStore'

export default function EditorToolbar() {
  const {
    // Tools
    currentTool,
    setTool,
    tools,
    // Layers
    layers,
    showLayersPanel,
    toggleLayersPanel,
    // Grid & Snap
    gridConfig,
    snapConfig,
    toggleGrid,
    toggleSnap,
    toggleOrtho,
    // Camera
    cameraMode,
    toggleCameraMode,
    setCameraPreset,
    // History
    canUndo,
    canRedo,
    undo,
    redo,
    // Validations
    validationWarnings,
    // Dimensions
    dimensionsConfig,
    toggleDimensions
  } = useEditorStore()

  // Contar capas ocultas
  const hiddenLayersCount = Object.values(layers).filter(l => !l.visible && !['walls', 'grid'].includes(l.id)).length

  // Contar errores vs warnings
  const errorCount = validationWarnings.filter(w => w.severity === 'error').length
  const warningCount = validationWarnings.filter(w => w.severity === 'warning').length

  const toolGroups = [
    {
      name: 'select',
      tools: ['select', 'move', 'rotate'],
      icons: { select: SelectIcon, move: MoveIcon, rotate: RotateIcon }
    },
    {
      name: 'draw',
      tools: ['draw_shelf', 'draw_dock', 'draw_office', 'draw_zone'],
      icons: { draw_shelf: ShelfIcon, draw_dock: DockIcon, draw_office: OfficeIcon, draw_zone: ZoneIcon }
    },
    {
      name: 'actions',
      tools: ['erase', 'measure', 'pan'],
      icons: { erase: EraseIcon, measure: MeasureIcon, pan: PanIcon }
    }
  ]

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 0.75,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        zIndex: 1000,
        maxWidth: '95vw',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}
    >
      {/* ========== TOOLS GROUPS ========== */}
      {toolGroups.map((group, groupIndex) => (
        <React.Fragment key={group.name}>
          <ToggleButtonGroup
            value={currentTool}
            exclusive
            onChange={(e, value) => value && setTool(value)}
            size="small"
            sx={{ 
              '& .MuiToggleButton-root': { 
                px: 1.5,
                py: 0.75,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' }
                }
              }
            }}
          >
            {group.tools.map(toolId => {
              const tool = tools[toolId]
              const Icon = group.icons[toolId]
              return (
                <ToggleButton key={toolId} value={toolId}>
                  <Tooltip 
                    title={
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2">{tool.label}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                          Tecla: {tool.key}
                        </Typography>
                      </Box>
                    }
                    arrow
                  >
                    <Icon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              )
            })}
          </ToggleButtonGroup>
          {groupIndex < toolGroups.length - 1 && (
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          )}
        </React.Fragment>
      ))}

      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

      {/* ========== VIEW 2D/3D ========== */}
      <Tooltip title={`Vista ${cameraMode === '2D' ? '3D' : '2D'} (C)`}>
        <IconButton 
          onClick={toggleCameraMode}
          color={cameraMode === '2D' ? 'primary' : 'default'}
          size="small"
        >
          {cameraMode === '2D' ? <View2DIcon /> : <View3DIcon />}
        </IconButton>
      </Tooltip>

      {/* ========== GRID / SNAP / ORTHO ========== */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title={`Grid ${gridConfig.visible ? 'ON' : 'OFF'} (G)`}>
          <IconButton 
            onClick={toggleGrid}
            color={gridConfig.visible ? 'primary' : 'default'}
            size="small"
          >
            {gridConfig.visible ? <GridIcon /> : <GridOffIcon />}
          </IconButton>
        </Tooltip>

        <Tooltip title={`Snap ${snapConfig.enabled ? 'ON' : 'OFF'} (N)`}>
          <IconButton 
            onClick={toggleSnap}
            color={snapConfig.enabled ? 'primary' : 'default'}
            size="small"
          >
            <Badge 
              color="success" 
              variant="dot" 
              invisible={!snapConfig.enabled}
            >
              <SnapIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title={`Ortho ${snapConfig.orthoMode ? 'ON' : 'OFF'} (T)`}>
          <IconButton 
            onClick={toggleOrtho}
            color={snapConfig.orthoMode ? 'primary' : 'default'}
            size="small"
          >
            <OrthoIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* ========== DIMENSIONS ========== */}
      <Tooltip title="Mostrar Cotas">
        <IconButton 
          onClick={() => toggleDimensions('showElementDimensions')}
          color={dimensionsConfig.showElementDimensions ? 'primary' : 'default'}
          size="small"
        >
          <MeasureIcon />
        </IconButton>
      </Tooltip>

      {/* ========== LAYERS ========== */}
      <Tooltip title={`Capas (L) - ${hiddenLayersCount} ocultas`}>
        <IconButton 
          onClick={toggleLayersPanel}
          color={showLayersPanel ? 'primary' : 'default'}
          size="small"
        >
          <Badge 
            badgeContent={hiddenLayersCount} 
            color="warning"
            max={9}
          >
            <LayersIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* ========== WARNINGS ========== */}
      {(errorCount > 0 || warningCount > 0) && (
        <Tooltip 
          title={
            <Box>
              {errorCount > 0 && <Typography variant="body2">🔴 {errorCount} errores</Typography>}
              {warningCount > 0 && <Typography variant="body2">🟡 {warningCount} avisos</Typography>}
            </Box>
          }
        >
          <IconButton 
            color={errorCount > 0 ? 'error' : 'warning'}
            size="small"
          >
            <Badge 
              badgeContent={errorCount + warningCount} 
              color={errorCount > 0 ? 'error' : 'warning'}
            >
              <WarningIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* ========== CAMERA RESET ========== */}
      <Tooltip title="Centrar Vista">
        <IconButton 
          onClick={() => setCameraPreset('default')}
          size="small"
        >
          <CenterIcon />
        </IconButton>
      </Tooltip>

      {/* ========== UNDO / REDO ========== */}
      <Box sx={{ display: 'flex', gap: 0.25 }}>
        <Tooltip title="Deshacer (Ctrl+Z)">
          <span>
            <IconButton 
              onClick={undo}
              disabled={!canUndo()}
              size="small"
            >
              <UndoIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Rehacer (Ctrl+Y)">
          <span>
            <IconButton 
              onClick={redo}
              disabled={!canRedo()}
              size="small"
            >
              <RedoIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* ========== STATUS CHIPS ========== */}
      <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
        {snapConfig.enabled && (
          <Chip 
            label={`Snap ${snapConfig.snapDistance}m`} 
            size="small" 
            color="primary"
            variant="outlined"
            sx={{ height: 24, fontSize: '0.7rem' }}
          />
        )}
        {gridConfig.visible && (
          <Chip 
            label={`Grid ${gridConfig.size}m`} 
            size="small" 
            variant="outlined"
            sx={{ height: 24, fontSize: '0.7rem' }}
          />
        )}
        <Chip 
          label={tools[currentTool]?.label || currentTool} 
          size="small" 
          color="secondary"
          sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600 }}
        />
      </Box>
    </Paper>
  )
}

/**
 * Mini toolbar para acceso rápido (opcional - para lateral)
 */
export function EditorToolbarMini() {
  const { currentTool, setTool, tools } = useEditorStore()
  
  const mainTools = ['select', 'move', 'rotate', 'draw_shelf', 'erase']
  
  const getIcon = (toolId) => {
    const icons = {
      select: SelectIcon,
      move: MoveIcon,
      rotate: RotateIcon,
      draw_shelf: ShelfIcon,
      draw_dock: DockIcon,
      draw_office: OfficeIcon,
      draw_zone: ZoneIcon,
      erase: EraseIcon,
      measure: MeasureIcon,
      pan: PanIcon
    }
    return icons[toolId] || SelectIcon
  }
  
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        left: 10,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 0.5,
        borderRadius: 2,
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000
      }}
    >
      {mainTools.map(toolId => {
        const Icon = getIcon(toolId)
        const tool = tools[toolId]
        return (
          <Tooltip key={toolId} title={`${tool.label} (${tool.key})`} placement="right">
            <IconButton
              onClick={() => setTool(toolId)}
              color={currentTool === toolId ? 'primary' : 'default'}
              size="small"
              sx={{
                bgcolor: currentTool === toolId ? 'primary.light' : 'transparent',
                '&:hover': { bgcolor: currentTool === toolId ? 'primary.light' : 'action.hover' }
              }}
            >
              <Icon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      })}
    </Paper>
  )
}
