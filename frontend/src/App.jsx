/**
 * UNITNAVE Designer - App.jsx v3.0 CORREGIDO
 * 
 * FLUJO CORRECTO:
 * 1. Wizard (6 pasos) → Optimizar
 * 2. Ver Resultados (métricas, 3D, informe)
 * 3. OPCIONAL: Editor AutoCAD para ajustes manuales
 * 
 * Incluye 4 modos:
 * - wizard: Asistente paso a paso con DesignPage
 * - results: Resultados de la optimización (NUEVO)
 * - manual: Diseño manual existente
 * - editor: Editor profesional tipo AutoCAD
 * 
 * @version 3.0
 */

import React, { useState, useEffect, useCallback } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Button, Tooltip } from '@mui/material'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'

// Stores existentes
import useWarehouseStore from './stores/useWarehouseStore'
import useUIStore from './stores/useUIStore'
import useCalculationsStore from './stores/useCalculationsStore'

// Componentes existentes
import WizardStepper from './components/wizard/WizardStepper'
import Warehouse3DPro from './components/Warehouse3DPro'
import Sidebar from './components/Sidebar'
import FloatingPanel from './components/FloatingPanel'
import AddElementModal from './components/AddElementModal'
import Notification from './components/Notification'
import LegendPanel from './components/ui/LegendPanel'

// Página de diseño completa (Wizard + Resultados)
import DesignPage from './pages/DesignPage'

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

// ============================================================
// COMPONENTE MANUAL DESIGN MODE (incluido aquí, no archivo separado)
// ============================================================
function ManualDesignMode({ onSwitchToWizard, onSwitchToEditor }) {
  const { dimensions, elements } = useWarehouseStore()
  const { viewMode, setViewMode } = useUIStore()
  const { calculateCapacity } = useCalculationsStore()
  
  const [showLegend, setShowLegend] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)

  // Calcular automáticamente al cambiar elementos
  useEffect(() => {
    if (elements.length > 0) {
      calculateCapacity(dimensions, elements)
    }
  }, [elements, dimensions, calculateCapacity])

  const handleCalculate = useCallback(async () => {
    if (elements.length === 0) return
    
    setIsCalculating(true)
    try {
      await calculateCapacity(dimensions, elements)
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setIsCalculating(false)
    }
  }, [dimensions, elements, calculateCapacity])

  const is3DView = viewMode === '3D'

  return (
    <div className="app" style={{ background: '#ffffff' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>🏭</span>
          <div>
            <div style={{
              fontSize: '20px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '2px'
            }}>
              UNITNAVE
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '4px'
            }}>
              DESIGNER PRO
            </div>
          </div>
        </div>

        {/* Vistas */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: '3D', icon: '🎮', label: '3D' },
            { id: 'Planta', icon: '📐', label: 'Planta' },
            { id: 'Alzado', icon: '🏗️', label: 'Alzado' },
            { id: 'Perfil', icon: '📊', label: 'Perfil' }
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              style={{
                padding: '10px 18px',
                background: viewMode === v.id
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : 'rgba(255,255,255,0.05)',
                border: viewMode === v.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: viewMode === v.id ? '600' : '400',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <span>{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowLegend(!showLegend)}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📊 {showLegend ? 'Ocultar' : 'Mostrar'} Info
          </button>

          <button
            onClick={handleCalculate}
            disabled={isCalculating || elements.length === 0}
            style={{
              padding: '10px 20px',
              background: elements.length === 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: elements.length === 0 ? 'not-allowed' : (isCalculating ? 'wait' : 'pointer'),
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: elements.length === 0 ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.3)',
              opacity: (isCalculating || elements.length === 0) ? 0.5 : 1
            }}
          >
            {isCalculating ? '⏳ Calculando...' : '🧮 Calcular'}
          </button>

          {onSwitchToEditor && (
            <button
              onClick={onSwitchToEditor}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
              }}
            >
              📐 Editor
            </button>
          )}

          {onSwitchToWizard && (
            <button
              onClick={onSwitchToWizard}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)'
              }}
            >
              ⚡ Wizard
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="main-content">
        <Sidebar />

        <div className="canvas-container" style={{ position: 'relative', flex: 1 }}>
          <Canvas
            style={{ background: '#ffffff' }}
            gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
          >
            <color attach="background" args={['#ffffff']} />
            <fog attach="fog" args={['#ffffff', 100, 300]} />

            {is3DView ? (
              <PerspectiveCamera
                makeDefault
                position={[dimensions.length * 0.8, dimensions.height * 2, dimensions.width * 0.8]}
                fov={50}
                near={0.1}
                far={1000}
              />
            ) : (
              <OrthographicCamera
                makeDefault
                position={[0, 100, 0]}
                zoom={8}
                near={-500}
                far={500}
              />
            )}

            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={5}
              maxDistance={300}
              maxPolarAngle={Math.PI / 2}
            />

            {/* Iluminación sin sombras - Estilo plano técnico */}
            <ambientLight intensity={1.2} />
            <directionalLight position={[50, 100, 50]} intensity={0.6} />
            <directionalLight position={[-50, 50, -50]} intensity={0.5} />
            <hemisphereLight args={['#ffffff', '#e2e8f0', 0.5]} />

            <Warehouse3DPro />
          </Canvas>

          {showLegend && <LegendPanel />}
          <FloatingPanel />
        </div>

        <AddElementModal />
        <Notification />
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTE APP PRINCIPAL
// ============================================================
function App() {
  // Estado del modo actual: 'wizard' | 'manual' | 'editor'
  // NOTA: 'wizard' ahora usa DesignPage que incluye resultados
  const [mode, setMode] = useState('wizard')
  
  // Datos del warehouse store
  const { 
    dimensions,
    elements,
    optimizationResult,
    machinery
  } = useWarehouseStore()
  
  // Convertir resultado de optimización a elementos editables
  const [editableElements, setEditableElements] = useState([])
  
  // Cuando hay elementos en el store, usarlos para el editor
  useEffect(() => {
    if (elements && elements.length > 0) {
      // Convertir elementos del store al formato del editor
      const converted = elements.map((el, index) => ({
        id: el.id || `${el.type}-${index}`,
        type: el.type,
        position: {
          x: el.position?.x ?? el.x ?? 0,
          y: el.position?.y ?? el.y ?? 0,
          z: el.position?.z ?? 0
        },
        dimensions: el.dimensions || {},
        properties: el.properties || {},
        rotation: el.rotation || 0,
        layer: el.layer || el.type
      }))
      setEditableElements(converted)
    }
  }, [elements])
  
  // También escuchar optimizationResult.layout (por compatibilidad)
  useEffect(() => {
    if (optimizationResult?.layout) {
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
  }
  
  // Handler para guardar cambios del editor al store
  const handleSaveEditorChanges = () => {
    // Guardar elementos en el store global
    useWarehouseStore.getState().setElements(editableElements)
    
    // También actualizar optimizationResult si existe
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
    
    if (optimizationResult) {
      useWarehouseStore.setState({
        optimizationResult: {
          ...optimizationResult,
          layout
        }
      })
    }
    
    console.log('Layout guardado:', layout)
    alert('✅ Cambios guardados correctamente')
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
        
        {/* ========== MODO WIZARD (Usa DesignPage completo) ========== */}
        {/* DesignPage incluye: Wizard → Optimizar → Resultados */}
        {mode === 'wizard' && (
          <>
            <DesignPage />
            
            {/* Botón flotante para ir al Editor (solo si hay elementos) */}
            {elements && elements.length > 0 && (
              <Box sx={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                display: 'flex',
                gap: 1,
                zIndex: 1000
              }}>
                <Tooltip title="Editar Layout Manualmente">
                  <Button
                    variant="contained"
                    onClick={() => setMode('editor')}
                    sx={{
                      bgcolor: '#3b82f6',
                      '&:hover': { bgcolor: '#2563eb' }
                    }}
                  >
                    📐 Editor AutoCAD
                  </Button>
                </Tooltip>
                
                <Tooltip title="Modo Manual (legacy)">
                  <Button
                    variant="outlined"
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
            )}
          </>
        )}
        
        {/* ========== MODO EDITOR ========== */}
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
            
            <Box sx={{
              position: 'fixed',
              top: 70,
              right: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              zIndex: 1001
            }}>
              <Tooltip title="Volver a Resultados" placement="left">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => setMode('wizard')}
                  sx={{
                    bgcolor: '#22c55e',
                    '&:hover': { bgcolor: '#16a34a' }
                  }}
                >
                  ← Volver
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
            
            {/* Indicador de modo editor */}
            <Box sx={{
              position: 'fixed',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(59, 130, 246, 0.95)',
              color: 'white',
              px: 3,
              py: 1,
              borderRadius: 2,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1001
            }}>
              ✏️ MODO EDICIÓN - {editableElements.length} elementos
            </Box>
          </>
        )}
        
        {/* ========== MODO MANUAL ========== */}
        {mode === 'manual' && (
          <>
            <ManualDesignMode 
              onSwitchToWizard={() => setMode('wizard')}
              onSwitchToEditor={() => setMode('editor')}
            />
            
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
