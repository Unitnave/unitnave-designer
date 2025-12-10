/**
 * UNITNAVE Designer - Editor con Toggle 2D/3D
 * 
 * Componente wrapper que permite alternar entre:
 * - Vista 2D CAD (planta con zonas y leyenda)
 * - Vista 3D interactiva
 * 
 * @version 1.0
 */

import React, { useState, useCallback } from 'react'
import { Box, ToggleButtonGroup, ToggleButton, Paper, Tooltip, Typography } from '@mui/material'
import {
  ViewInAr as View3DIcon,
  CropFree as View2DIcon,
  Map as MapIcon
} from '@mui/icons-material'

// Componentes
import Warehouse3DEditor from './Warehouse3DEditor'
import Warehouse2DEditor from './Warehouse2DEditor'

// ============================================================
// SELECTOR DE MODO
// ============================================================
function ViewModeSelector({ mode, onChange }) {
  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 1100,
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, newMode) => newMode && onChange(newMode)}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            px: 2,
            py: 1,
            border: 'none',
            borderRadius: 0,
            '&.Mui-selected': {
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }
          }
        }}
      >
        <ToggleButton value="2d">
          <Tooltip title="Vista 2D - Plano de Planta">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <View2DIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                2D CAD
              </Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value="3d">
          <Tooltip title="Vista 3D - Modelo Interactivo">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <View3DIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                3D
              </Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Paper>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function WarehouseEditorWithToggle({
  dimensions = { length: 80, width: 40, height: 10 },
  elements = [],
  machinery = 'retractil',
  onElementsChange,
  initialMode = '2d' // Por defecto empezamos en 2D como pidió Pablo
}) {
  const [viewMode, setViewMode] = useState(initialMode)
  
  // Handler para cambiar de modo
  const handleModeChange = useCallback((newMode) => {
    setViewMode(newMode)
  }, [])
  
  // Switch desde 2D a 3D (callback para el botón en toolbar 2D)
  const handleSwitch3D = useCallback(() => {
    setViewMode('3d')
  }, [])
  
  // Switch desde 3D a 2D
  const handleSwitch2D = useCallback(() => {
    setViewMode('2d')
  }, [])
  
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Selector de modo */}
      <ViewModeSelector mode={viewMode} onChange={handleModeChange} />
      
      {/* Vista según modo */}
      {viewMode === '2d' ? (
        <Warehouse2DEditor
          dimensions={dimensions}
          elements={elements}
          onSwitch3D={handleSwitch3D}
          onElementsChange={onElementsChange}
        />
      ) : (
        <Warehouse3DEditor
          dimensions={dimensions}
          elements={elements}
          machinery={machinery}
          onElementsChange={onElementsChange}
        />
      )}
      
      {/* Indicador de modo actual (esquina inferior izquierda) */}
      <Paper
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          px: 2,
          py: 0.75,
          borderRadius: 1,
          bgcolor: viewMode === '2d' ? 'primary.main' : 'secondary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          zIndex: 100
        }}
      >
        {viewMode === '2d' ? <View2DIcon fontSize="small" /> : <View3DIcon fontSize="small" />}
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          MODO {viewMode.toUpperCase()}
        </Typography>
      </Paper>
    </Box>
  )
}

// Re-exportar componentes individuales
export { Warehouse2DEditor, Warehouse3DEditor }
