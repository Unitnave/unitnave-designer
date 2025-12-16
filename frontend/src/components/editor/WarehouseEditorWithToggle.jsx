/**
 * UNITNAVE Designer - Editor con Toggle 2D/3D
 *
 * - 2D: Warehouse2DEditor (con re-optimización completa)
 * - 3D: Warehouse3DEditor
 *
 * @version 3.0 - Pasa originalConfig para re-optimización
 */

import React, { useState, useCallback } from 'react'
import { Box, ToggleButtonGroup, ToggleButton, Paper, Tooltip, Typography } from '@mui/material'
import {
  ViewInAr as View3DIcon,
  CropFree as View2DIcon,
} from '@mui/icons-material'

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
          <Tooltip title="Vista 2D - CAD con Cotas + Drag + Re-Optimización">
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
  initialMode = '2d',
  // ✅ NUEVO: Parámetros originales del wizard para re-optimización completa
  originalConfig = null
}) {
  const [viewMode, setViewMode] = useState(initialMode)

  const handleModeChange = useCallback((newMode) => {
    setViewMode(newMode)
  }, [])

  const handleSwitch3D = useCallback(() => setViewMode('3d'), [])
  const handleSwitch2D = useCallback(() => setViewMode('2d'), [])

  // Construir config por defecto si no se proporciona
  const effectiveConfig = originalConfig || {
    dimensions,
    machinery,
    n_docks: 4,
    pallet_type: 'EUR',
    pallet_height: 1.5,
    activity_type: 'industrial',
    preferences: {
      include_offices: true,
      include_services: true,
      include_docks: true,
      include_technical: true,
      priority: 'balance',
      warehouse_type: 'industrial',
      enable_abc_zones: false
    }
  }

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <ViewModeSelector mode={viewMode} onChange={handleModeChange} />

      {viewMode === '2d' ? (
        <Warehouse2DEditor
          dimensions={dimensions}
          elements={elements}
          onSwitch3D={handleSwitch3D}
          onElementsChange={onElementsChange}
          // ✅ NUEVO: Pasar config para re-optimización
          originalConfig={effectiveConfig}
        />
      ) : (
        <Warehouse3DEditor
          dimensions={dimensions}
          elements={elements}
          machinery={machinery}
          onElementsChange={onElementsChange}
          onSwitch2D={handleSwitch2D}
        />
      )}

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
          zIndex: 1200
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

export { Warehouse3DEditor, Warehouse2DEditor }
