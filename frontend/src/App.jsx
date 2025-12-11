/**
 * UNITNAVE Designer - App.jsx v3.4 PRODUCCIÓN
 * 
 * INTEGRACIÓN WEBSOCKET EN MODO EDITOR - PRESERVA TODAS LAS FUNCIONALIDADES
 * 
 * CORRECCIONES v3.4:
 * - WebSocket URL apunta al backend Railway: unitnave-designer-production.up.railway.app
 * - Estado de conexión visible en header del Editor
 * - SessionId persistente en localStorage
 * - UserName configurable en el header
 * - Desconexión limpia al salir del modo Editor
 * - Botón de guardar deshabilitado cuando no hay conexión
 * - Mantiene Wizard, Manual y todos los modos originales
 * - Conversión de elementos completa preservada
 * @version 3.4
 */

import React, { useState, useEffect, useCallback } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Button, Tooltip, Chip, TextField, Alert } from '@mui/material'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'

// Stores existentes
import useWarehouseStore from './stores/useWarehouseStore'
import useUIStore from './stores/useUIStore'
import useCalculationsStore from './stores/useCalculationsStore'
import useLayoutStore from './store/useLayoutStore'

// Componentes existentes
import WizardStepper from './components/wizard/WizardStepper'
import Warehouse3DPro from './components/Warehouse3DPro'
import Sidebar from './components/Sidebar'
import FloatingPanel from './components/FloatingPanel'
import AddElementModal from './components/AddElementModal'
import Notification from './components/Notification'
import LegendPanel from './components/ui/LegendPanel'
import DesignPage from './pages/DesignPage'
import { WarehouseEditorWithToggle } from './components/editor'

// WebSocket Manager
import wsManager from './services/WebSocketManager'

// ============================================================
// ✅ CONFIGURACIÓN WEBSOCKET CON TU DOMINIO REAL DE RAILWAY
// ============================================================
const WS_BACKEND_URL = 'wss://unitnave-designer-production.up.railway.app/realtime'

const getWebSocketUrl = () => {
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1') {
    return `ws://localhost:8000/realtime`
  }
  return WS_BACKEND_URL
}

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
// COMPONENTE MANUAL DESIGN MODE (PRESERVADO COMPLETO)
// ============================================================
function ManualDesignMode({ onSwitchToWizard, onSwitchToEditor }) {
  const { dimensions, elements } = useWarehouseStore()
  const { viewMode, setViewMode } = useUIStore()
  const { calculateCapacity } = useCalculationsStore()
  
  const [showLegend, setShowLegend] = useState(true)
  const [isCalculating, setIsCalculating] = useState(false)

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
      <header style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
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
// APP PRINCIPAL (COMPLETO - 850 LÍNEAS)
// ============================================================
function App() {
  const [mode, setMode] = useState('wizard')
  const [userName, setUserName] = useState('Usuario')
  
  const { 
    dimensions,
    elements,
    optimizationResult,
    machinery
  } = useWarehouseStore()
  
  const { 
    isConnected, 
    lastError, 
    onlineUsers,
    clientId 
  } = useLayoutStore()
  
  const [editableElements, setEditableElements] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [connectionBanner, setConnectionBanner] = useState('')

  // ============================================================
  // SESSION ID PERSISTENTE
  // ============================================================
  useEffect(() => {
    const stored = localStorage.getItem('unitnave_session')
    if (stored) {
      setSessionId(stored)
    } else {
      const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('unitnave_session', newId)
      setSessionId(newId)
    }
  }, [])

  // ============================================================
  // CONVERTIR ELEMENTOS DEL STORE (PRESERVADO COMPLETO)
  // ============================================================
  useEffect(() => {
    if (elements && elements.length > 0) {
      console.log('📦 Elementos del store:', elements.length, elements)
      
      const converted = elements.map((el, index) => {
        const type = el.type || 'unknown'
        
        const position = {
          x: el.position?.x ?? el.x ?? 0,
          y: el.position?.y ?? el.y ?? 0,
          z: el.position?.z ?? 0
        }
        
        let dims = {}
        if (type === 'shelf') {
          dims = {
            length: el.dimensions?.length ?? el.length ?? 2.7,
            depth: el.dimensions?.depth ?? el.depth ?? 1.1,
            height: el.dimensions?.height ?? el.height ?? 10
          }
        } else if (type === 'dock') {
          dims = {
            width: el.dimensions?.width ?? el.width ?? 3.5,
            depth: el.dimensions?.depth ?? 0.3,
            height: el.dimensions?.height ?? 4.5
          }
        } else if (type === 'office') {
          dims = {
            length: el.dimensions?.length ?? el.dimensions?.largo ?? el.largo ?? 12,
            width: el.dimensions?.width ?? el.dimensions?.ancho ?? el.ancho ?? 8,
            height: el.dimensions?.height ?? 3
          }
        } else if (type === 'zone' || type === 'operational_zone') {
          dims = {
            length: el.dimensions?.length ?? el.dimensions?.largo ?? el.largo ?? 10,
            width: el.dimensions?.width ?? el.dimensions?.ancho ?? el.ancho ?? 10,
            height: 0.1
          }
        } else if (type === 'service_room' || type === 'technical_room') {
          dims = {
            length: el.dimensions?.length ?? el.dimensions?.largo ?? 6,
            width: el.dimensions?.width ?? el.dimensions?.ancho ?? 4,
            height: el.dimensions?.height ?? 3
          }
        } else {
          dims = el.dimensions || { length: 2, width: 2, height: 2 }
        }
        
        return {
          id: el.id || `${type}-${index}`,
          type: type,
          position: position,
          dimensions: dims,
          properties: el.properties || {},
          rotation: el.rotation || 0,
          layer: type === 'shelf' ? 'shelves' : 
                 type === 'dock' ? 'docks' : 
                 type === 'office' ? 'offices' : 
                 type === 'zone' || type === 'operational_zone' ? 'zones' : 'other'
        }
      })
      
      console.log('✅ Elementos convertidos:', converted.length, converted)
      setEditableElements(converted)
    }
  }, [elements])
  
  // ============================================================
  // CONVERTIR LAYOUT DEL BACKEND (PRESERVADO COMPLETO)
  // ============================================================
  useEffect(() => {
    if (optimizationResult?.layout) {
      console.log('📊 Layout del optimizador:', optimizationResult.layout)
      const converted = convertLayoutToElements(optimizationResult.layout)
      console.log('✅ Layout convertido:', converted.length, converted)
      setEditableElements(converted)
    }
  }, [optimizationResult])
  
  const convertLayoutToElements = useCallback((layout) => {
    const elements = []
    
    if (layout.shelves && layout.shelves.length > 0) {
      layout.shelves.forEach((shelf, index) => {
        elements.push({
          id: shelf.id || `shelf-${index}`,
          type: 'shelf',
          position: {
            x: shelf.position?.x || shelf.x || 0,
            y: shelf.position?.y || shelf.y || 0,
            z: 0
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
          },
          layer: 'shelves'
        })
      })
    }
    
    if (layout.docks && layout.docks.length > 0) {
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
            depth: dock.dimensions?.depth || dock.depth || 0.3,
            height: dock.dimensions?.height || dock.height || 4.5
          },
          properties: {
            type: dock.type || 'carga',
            label: dock.label || `Muelle ${index + 1}`
          },
          layer: 'docks'
        })
      })
    }
    
    if (layout.offices && layout.offices.length > 0) {
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
            length: office.dimensions?.length || office.length || office.largo || 12,
            width: office.dimensions?.width || office.width || office.ancho || 8,
            height: office.dimensions?.height || 3
          },
          properties: {
            label: office.label || 'Oficina',
            floor: office.floor || 'ground'
          },
          layer: 'offices'
        })
      })
    }
    
    if (layout.operational_zones && layout.operational_zones.length > 0) {
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
            length: zone.dimensions?.length || zone.length || zone.largo || 10,
            width: zone.dimensions?.width || zone.width || zone.ancho || 10,
            height: 0.1
          },
          properties: {
            zoneType: zone.type || zone.zone_type || 'picking',
            label: zone.label || zone.name || `Zona ${index + 1}`
          },
          layer: 'zones'
        })
      })
    }
    
    if (layout.service_rooms && layout.service_rooms.length > 0) {
      layout.service_rooms.forEach((room, index) => {
        elements.push({
          id: room.id || `service-${index}`,
          type: 'service_room',
          position: {
            x: room.position?.x || room.x || 0,
            y: room.position?.y || room.y || 0,
            z: 0
          },
          dimensions: {
            length: room.dimensions?.length || room.length || 6,
            width: room.dimensions?.width || room.width || 4,
            height: room.dimensions?.height || 3
          },
          properties: {
            roomType: room.type || 'vestuarios',
            label: room.label || room.name || `Servicio ${index + 1}`
          },
          layer: 'services'
        })
      })
    }
    
    if (layout.technical_room) {
      const room = layout.technical_room
      elements.push({
        id: room.id || 'technical-room',
        type: 'technical_room',
        position: {
          x: room.position?.x || room.x || 0,
          y: room.position?.y || room.y || 0,
          z: 0
        },
        dimensions: {
          length: room.dimensions?.length || room.length || 8,
          width: room.dimensions?.width || room.width || 6,
          height: room.dimensions?.height || 4
        },
        properties: {
          label: 'Sala Técnica'
        },
        layer: 'services'
      })
    }
    
    console.log('🔄 Elementos convertidos del layout:', {
      shelves: layout.shelves?.length || 0,
      docks: layout.docks?.length || 0,
      offices: layout.offices?.length || 0,
      zones: layout.operational_zones?.length || 0,
      services: layout.service_rooms?.length || 0,
      total: elements.length
    })
    
    return elements
  }, [])
  
  // ============================================================
  // HANDLERS (PRESERVADOS COMPLETOS)
  // ============================================================
  const handleElementsChange = useCallback((newElements) => {
    setEditableElements(newElements)
  }, [])
  
  const handleSaveEditorChanges = useCallback(() => {
    useWarehouseStore.getState().setElements(editableElements)
    
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
      })),
      service_rooms: editableElements.filter(el => el.type === 'service_room').map(el => ({
        id: el.id,
        position: { x: el.position.x, y: el.position.y },
        dimensions: el.dimensions,
        type: el.properties?.roomType
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
    
    console.log('💾 Layout guardado:', layout)
    alert('✅ Cambios guardados correctamente')
  }, [editableElements, optimizationResult])
  
  // ============================================================
  // ✅ CONEXIÓN WEBSOCKET CON URL CORRECTA
  // ============================================================
  useEffect(() => {
    if (mode === 'editor' && sessionId) {
      const wsUrl = getWebSocketUrl()
      
      console.log('🔗 [PRODUCCIÓN] Conectando WebSocket:', {
        sessionId,
        userName,
        wsUrl: wsUrl,
        hostname: window.location.hostname
      })
      
      setConnectionBanner('Conectando...')
      
      wsManager.connect(sessionId, userName, wsUrl)
      
      return () => {
        console.log('🔌 Desconectando WebSocket')
        setConnectionBanner('')
        wsManager.disconnect()
      }
    }
  }, [mode, sessionId, userName])
  
  // Mostrar errores de conexión
  useEffect(() => {
    if (lastError && mode === 'editor') {
      setConnectionBanner(`Error: ${lastError}`)
      setTimeout(() => setConnectionBanner(''), 5000)
    }
  }, [lastError, mode])
  
  // Actualizar banner cuando conecta
  useEffect(() => {
    if (mode === 'editor') {
      setConnectionBanner(isConnected ? 'Conectado' : 'Desconectado')
    }
  }, [isConnected, mode])

  // ============================================================
  // RENDER PRINCIPAL (PRESERVADO CON WEBSOCKET AÑADIDO)
  // ============================================================
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      {/* ========== MODO WIZARD (PRESERVADO COMPLETO) ========== */}
      {mode === 'wizard' && (
        <Box sx={{ 
          width: '100vw', 
          minHeight: '100vh',
          overflow: 'auto',
          position: 'relative',
          bgcolor: 'background.default'
        }}>
          <DesignPage />
          
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
                  📡 Editor Colaborativo
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
        </Box>
      )}
      
      {/* ========== MODO EDITOR CON WEBSOCKET (COMPLETO) ========== */}
      {mode === 'editor' && (
        <Box sx={{ 
          width: '100vw', 
          height: '100vh', 
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* Header con estado de conexión WebSocket */}
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            bgcolor: 'rgba(30, 41, 59, 0.95)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            zIndex: 1001
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: '24px' }}>📐</span>
              <span style={{ fontWeight: 600 }}>Editor Colaborativo 2D/3D</span>
              <Chip 
                label={isConnected ? 'Conectado' : 'Desconectado'}
                color={isConnected ? 'success' : 'error'}
                size="small"
                icon={<span>{isConnected ? '🟢' : '🔴'}</span>}
              />
              {onlineUsers.length > 0 && (
                <Chip 
                  label={`${onlineUsers.length} usuario(s)`}
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
                />
              )}
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                size="small"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Nombre de usuario"
                sx={{ 
                  input: { color: 'white', fontSize: '14px' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }
                }}
              />
              <span style={{ fontSize: '12px', opacity: 0.8 }}>
                Sesión: {sessionId?.substring(0, 8)}...
              </span>
            </Box>
          </Box>
          
          {/* Alerta en caso de error de conexión */}
          {!isConnected && lastError && (
            <Alert 
              severity="error" 
              sx={{ 
                position: 'absolute', 
                top: 65, 
                left: 10, 
                right: 10,
                zIndex: 1000 
              }}
            >
              Error de conexión: {lastError}. Reconectando...
            </Alert>
          )}
          
          {/* Editor principal */}
          <Box sx={{ width: '100%', height: '100%', pt: '60px' }}>
            <WarehouseEditorWithToggle
              dimensions={{
                length: dimensions?.length || 80,
                width: dimensions?.width || 40,
                height: dimensions?.height || 10
              }}
              elements={editableElements}
              machinery={machinery || 'retractil'}
              onElementsChange={handleElementsChange}
              initialMode="2d"
              sessionId={sessionId}
              userName={userName}
            />
          </Box>
          
          {/* Botones de navegación */}
          <Box sx={{
            position: 'fixed',
            top: 70,
            right: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            zIndex: 1002
          }}>
            <Tooltip title="Volver a Resultados" placement="left">
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  wsManager.disconnect()
                  setMode('wizard')
                }}
                sx={{ bgcolor: '#22c55e' }}
              >
                ← Volver
              </Button>
            </Tooltip>
            
            <Tooltip title="Guardar Cambios" placement="left">
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveEditorChanges}
                disabled={!isConnected}
                sx={{ bgcolor: '#3b82f6' }}
              >
                {isConnected ? '💾 Guardar' : '⏸️ Desconectado'}
              </Button>
            </Tooltip>
          </Box>
          
          {/* Banner de estado */}
          <Box sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            bgcolor: isConnected ? 'rgba(59, 130, 246, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 2,
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 999,
            maxWidth: '300px'
          }}>
            {connectionBanner || (isConnected ? '✏️ MODO EDICIÓN' : '❌ SIN CONEXIÓN')}
            {onlineUsers.length > 0 && isConnected && (
              <Box sx={{ mt: 0.5, fontSize: '11px', opacity: 0.9 }}>
                Usuarios: {onlineUsers.map(u => u.user_name).join(', ')}
              </Box>
            )}
          </Box>
        </Box>
      )}
      
      {/* ========== MODO MANUAL (PRESERVADO COMPLETO) ========== */}
      {mode === 'manual' && (
        <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <ManualDesignMode 
            onSwitchToWizard={() => setMode('wizard')}
            onSwitchToEditor={() => setMode('editor')}
          />
        </Box>
      )}
      
      <Notification />
    </ThemeProvider>
  )
}

export default App