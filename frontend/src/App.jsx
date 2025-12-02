/**
 * UNITNAVE Designer - App.jsx MODIFICADO
 * 
 * Incluye 3 modos:
 * - wizard: Asistente paso a paso
 * - manual: Diseño manual existente
 * - editor: Editor profesional tipo AutoCAD (NUEVO)
 * 
 * @version 2.0
 */

import React, { useState, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Button, Tooltip } from '@mui/material'

// Stores existentes
import useWarehouseStore from './stores/useWarehouseStore'
import useUIStore from './stores/useUIStore'
import useCalculationsStore from './stores/useCalculationsStore'

// Componentes existentes
import WizardStepper from './components/wizard/WizardStepper'
import ManualDesignMode from './components/ManualDesignMode'  // Tu componente existente

// NUEVO: Editor profesional
import { Warehouse3DEditor } from './components/editor'

// Tema de Material UI
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1e40af',
      light: '#3b82f6',
      dark: '#1e3a8a'
    },
    secondary: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706'
    },
    success: {
      main: '#22c55e'
    },
    error: {
      main: '#ef4444'
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
  },
  shape: {
    borderRadius: 8
  }
})

function App() {
  // Estado del modo actual: 'wizard' | 'manual' | 'editor'
  const [mode, setMode] = useState('wizard')
  
  // Datos del warehouse store
  const { 
    dimensions,
    elements,
    setElements,
    optimizationResult,
    machinery
  } = useWarehouseStore()
  
  // Convertir resultado de optimización a elementos editables
  const [editableElements, setEditableElements] = useState([])
  
  useEffect(() => {
    if (optimizationResult?.layout) {
      // Convertir layout del backend a formato del editor
      const converted = convertLayoutToElements(optimizationResult.layout)
      setEditableElements(converted)
    }
  }, [optimizationResult])
  
  // Función para convertir layout del backend a elementos del editor
  const convertLayoutToElements = (layout) => {
    const elements = []
    
    // Convertir estanterías
    if (layout.shelves) {
      layout.shelves.forEach((shelf, index) => {
        elements.push({
          id: shelf.id || `shelf-${index}`,
          type: 'shelf',
          position: {
            x: shelf.position?.x || shelf.x || 0,
            y: shelf.position?.y || shelf.y || 0,
            z: shelf.position?.z || 0
          },
          dimensions: {
            length: shelf.dimensions?.length || shelf.length || 2.7,
            depth: shelf.dimensions?.depth || shelf.depth || 1.1,
            height: shelf.dimensions?.height || shelf.height || 10
          },
          properties: {
            levels: shelf.levels || 5,
            positions: shelf.positions_per_level || 3,
            zone: shelf.zone || 'A',
            label: shelf.label || `Rack ${index + 1}`
          }
        })
      })
    }
    
    // Convertir muelles
    if (layout.docks) {
      layout.docks.forEach((dock, index) => {
        elements.push({
          id: dock.id || `dock-${index}`,
          type: 'dock',
          position: {
            x: dock.position?.x || dock.x || 0,
            y: dock.position?.y || dock.y || 0,
            z: 0
          },
          dimensions: {
            width: dock.dimensions?.width || dock.width || 3.5,
            depth: dock.dimensions?.depth || 0.3,
            height: dock.dimensions?.height || 4.5
          },
          properties: {
            type: dock.type || 'carga',
            label: dock.label || `Muelle ${index + 1}`
          }
        })
      })
    }
    
    // Convertir oficinas
    if (layout.offices) {
      layout.offices.forEach((office, index) => {
        elements.push({
          id: office.id || `office-${index}`,
          type: 'office',
          position: {
            x: office.position?.x || office.x || 0,
            y: office.position?.y || office.y || 0,
            z: 0
          },
          dimensions: {
            length: office.dimensions?.length || office.length || 12,
            width: office.dimensions?.width || office.width || 8,
            height: office.dimensions?.height || 3
          },
          properties: {
            label: office.label || 'Oficina'
          }
        })
      })
    }
    
    // Convertir zonas operativas
    if (layout.operational_zones) {
      layout.operational_zones.forEach((zone, index) => {
        elements.push({
          id: zone.id || `zone-${index}`,
          type: 'zone',
          position: {
            x: zone.position?.x || zone.x || 0,
            y: zone.position?.y || zone.y || 0,
            z: 0
          },
          dimensions: {
            length: zone.dimensions?.length || zone.length || 10,
            width: zone.dimensions?.width || zone.width || 10
          },
          properties: {
            zoneType: zone.type || zone.zone_type || 'picking',
            label: zone.label || zone.name || `Zona ${index + 1}`
          }
        })
      })
    }
    
    return elements
  }
  
  // Handler cuando cambian elementos en el editor
  const handleElementsChange = (newElements) => {
    setEditableElements(newElements)
    // Opcional: sincronizar con warehouse store
    // setElements(newElements)
  }
  
  // Handler para guardar cambios del editor al store
  const handleSaveEditorChanges = () => {
    // Convertir elementos del editor de vuelta al formato del backend
    const layout = {
      shelves: editableElements.filter(el => el.type === 'shelf').map(el => ({
        id: el.id,
        position: { x: el.position.x, y: el.position.y },
        dimensions: el.dimensions,
        levels: el.properties?.levels || 5,
        positions_per_level: el.properties?.positions || 3,
        zone: el.properties?.zone || 'A'
      })),
      docks: editableElements.filter(el => el.type === 'dock').map(el => ({
        id: el.id,
        position: { x: el.position.x, y: el.position.y },
        dimensions: el.dimensions,
        type: el.properties?.type || 'carga'
      })),
      offices: editableElements.filter(el => el.type === 'office').map(el => ({
        id: el.id,
        position: { x: el.position.x, y: el.position.y },
        dimensions: el.dimensions
      })),
      operational_zones: editableElements.filter(el => el.type === 'zone').map(el => ({
        id: el.id,
        position: { x: el.position.x, y: el.position.y },
        dimensions: el.dimensions,
        type: el.properties?.zoneType
      }))
    }
    
    // Actualizar store
    if (optimizationResult) {
      useWarehouseStore.setState({
        optimizationResult: {
          ...optimizationResult,
          layout
        }
      })
    }
    
    console.log('Layout guardado:', layout)
  }
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      <Box sx={{ 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden',
        position: 'relative'
      }}>
        
        {/* ========== MODO WIZARD ========== */}
        {mode === 'wizard' && (
          <>
            <WizardStepper 
              onComplete={() => setMode('editor')} // Ir al editor al completar
            />
            
            {/* Botones flotantes para cambiar de modo */}
            <Box sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              display: 'flex',
              gap: 1,
              zIndex: 1000
            }}>
              <Tooltip title="Abrir Editor Profesional">
                <Button
                  variant="contained"
                  onClick={() => setMode('editor')}
                  sx={{
                    bgcolor: '#3b82f6',
                    '&:hover': { bgcolor: '#2563eb' }
                  }}
                >
                  📐 Editor
                </Button>
              </Tooltip>
              
              <Tooltip title="Modo Manual (legacy)">
                <Button
                  variant="outlined"
                  onClick={() => setMode('manual')}
                  sx={{
                    borderColor: '#f59e0b',
                    color: '#f59e0b',
                    '&:hover': { 
                      borderColor: '#d97706',
                      bgcolor: 'rgba(245, 158, 11, 0.1)'
                    }
                  }}
                >
                  ✏️ Manual
                </Button>
              </Tooltip>
            </Box>
          </>
        )}
        
        {/* ========== MODO EDITOR (NUEVO) ========== */}
        {mode === 'editor' && (
          <>
            <Warehouse3DEditor
              dimensions={{
                length: dimensions?.length || 80,
                width: dimensions?.width || 40,
                height: dimensions?.height || 10
              }}
              elements={editableElements}
              machinery={machinery || 'retractil'}
              onElementsChange={handleElementsChange}
            />
            
            {/* Botones flotantes */}
            <Box sx={{
              position: 'fixed',
              top: 70,
              right: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              zIndex: 1001
            }}>
              <Tooltip title="Volver al Wizard" placement="left">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setMode('wizard')}
                  sx={{
                    bgcolor: '#22c55e',
                    '&:hover': { bgcolor: '#16a34a' }
                  }}
                >
                  ← Wizard
                </Button>
              </Tooltip>
              
              <Tooltip title="Guardar Cambios" placement="left">
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveEditorChanges}
                  sx={{
                    bgcolor: '#3b82f6',
                    '&:hover': { bgcolor: '#2563eb' }
                  }}
                >
                  💾 Guardar
                </Button>
              </Tooltip>
              
              <Tooltip title="Modo Manual (legacy)" placement="left">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setMode('manual')}
                  sx={{
                    borderColor: '#f59e0b',
                    color: '#f59e0b',
                    bgcolor: 'white',
                    '&:hover': { 
                      borderColor: '#d97706',
                      bgcolor: 'rgba(245, 158, 11, 0.1)'
                    }
                  }}
                >
                  ✏️ Manual
                </Button>
              </Tooltip>
            </Box>
          </>
        )}
        
        {/* ========== MODO MANUAL (LEGACY) ========== */}
        {mode === 'manual' && (
          <>
            <ManualDesignMode 
              onSwitchToEditor={() => setMode('editor')}
            />
            
            {/* Botones flotantes */}
            <Box sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              display: 'flex',
              gap: 1,
              zIndex: 1000
            }}>
              <Tooltip title="Volver al Wizard">
                <Button
                  variant="contained"
                  onClick={() => setMode('wizard')}
                  sx={{
                    bgcolor: '#22c55e',
                    '&:hover': { bgcolor: '#16a34a' }
                  }}
                >
                  ← Wizard
                </Button>
              </Tooltip>
              
              <Tooltip title="Abrir Editor Profesional">
                <Button
                  variant="contained"
                  onClick={() => setMode('editor')}
                  sx={{
                    bgcolor: '#3b82f6',
                    '&:hover': { bgcolor: '#2563eb' }
                  }}
                >
                  📐 Editor
                </Button>
              </Tooltip>
            </Box>
          </>
        )}
        
      </Box>
    </ThemeProvider>
  )
}

export default App
