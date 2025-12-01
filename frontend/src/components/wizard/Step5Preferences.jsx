/**
 * UNITNAVE Designer - Step5Preferences
 * Preferencias de diseño: qué incluir, prioridad, tipo de almacén
 * 
 * ARCHIVO: frontend/src/components/wizard/Step5Preferences.jsx
 * ACCIÓN: CREAR NUEVO
 */

import { useState, useEffect } from 'react';
import { 
  Grid, Typography, Box, Switch, FormControlLabel, Slider,
  ToggleButton, ToggleButtonGroup, Alert, Paper, Chip,
  Accordion, AccordionSummary, AccordionDetails, Tooltip
} from '@mui/material';
import { 
  ExpandMore, Settings, Speed, Balance, Inventory,
  Warehouse, LocalShipping, ShoppingCart, AcUnit, Layers, Info
} from '@mui/icons-material';

export default function Step5Preferences({ data, onChange }) {
  const [preferences, setPreferences] = useState(data.preferences || {
    include_offices: true,
    include_services: true,
    include_docks: true,
    include_technical: true,
    
    priority: 'balance',
    warehouse_type: data.activity_type || 'industrial',
    layout_complexity: 'medio',
    
    // ABC Zoning (NUEVO)
    enable_abc_zones: false,
    abc_zone_a_pct: 0.20,
    abc_zone_b_pct: 0.40,
    abc_zone_c_pct: 0.40,
    
    high_rotation_pct: 0.20
  });

  useEffect(() => {
    onChange({ preferences });
  }, [preferences]);

  const handleChange = (field, value) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  const priorityOptions = [
    { 
      value: 'capacity', 
      label: 'Máxima Capacidad', 
      icon: <Inventory />,
      description: 'Prioriza palets sobre todo lo demás',
      weights: 'Palets 60% | Distancia 15% | Accesibilidad 10%'
    },
    { 
      value: 'balance', 
      label: 'Equilibrado', 
      icon: <Balance />,
      description: 'Balance entre capacidad y operativa',
      recommended: true,
      weights: 'Palets 40% | Distancia 25% | Accesibilidad 20%'
    },
    { 
      value: 'operations', 
      label: 'Operativa Rápida', 
      icon: <Speed />,
      description: 'Minimiza distancias y tiempos',
      weights: 'Palets 25% | Distancia 35% | Accesibilidad 25%'
    }
  ];

  const warehouseTypes = [
    { value: 'industrial', label: 'Industrial', icon: <Warehouse />, description: 'Almacén general' },
    { value: 'ecommerce', label: 'E-commerce', icon: <ShoppingCart />, description: 'Alto picking' },
    { value: '3pl', label: '3PL', icon: <LocalShipping />, description: 'Operador logístico' },
    { value: 'almacen_masivo', label: 'Almacén Masivo', icon: <Inventory />, description: 'Stock puro' },
    { value: 'crossdock', label: 'Cross-dock', icon: <LocalShipping />, description: 'Tránsito rápido' },
    { value: 'frio', label: 'Cámara Fría', icon: <AcUnit />, description: 'Refrigerado' }
  ];

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        ⚙️ Preferencias de Diseño
      </Typography>

      <Grid container spacing={4}>
        {/* QUÉ INCLUIR */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
              ¿Qué incluir en el diseño?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Desmarca elementos que ya existan o no necesites
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={preferences.include_offices}
                    onChange={(e) => handleChange('include_offices', e.target.checked)}
                  />
                }
                label="🏢 Oficinas"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={preferences.include_services}
                    onChange={(e) => handleChange('include_services', e.target.checked)}
                  />
                }
                label="🚿 Servicios (vestuarios, baños, comedor)"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={preferences.include_docks}
                    onChange={(e) => handleChange('include_docks', e.target.checked)}
                  />
                }
                label="🚛 Muelles de carga"
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={preferences.include_technical}
                    onChange={(e) => handleChange('include_technical', e.target.checked)}
                  />
                }
                label="⚡ Salas técnicas"
              />
            </Box>
            
            {!preferences.include_offices && !preferences.include_services && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Modo "solo almacenamiento" - Máxima área para racks
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* PRIORIDAD */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>🎯 Prioridad de Optimización</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Esto determina cómo el optimizador puntúa los escenarios
            </Typography>
            
            <ToggleButtonGroup
              value={preferences.priority}
              exclusive
              onChange={(_, v) => v && handleChange('priority', v)}
              orientation="vertical"
              fullWidth
            >
              {priorityOptions.map(opt => (
                <ToggleButton 
                  key={opt.value} 
                  value={opt.value}
                  sx={{ 
                    justifyContent: 'flex-start', 
                    py: 2,
                    border: opt.recommended ? '2px solid' : '1px solid',
                    borderColor: opt.recommended ? 'success.main' : 'divider'
                  }}
                >
                  <Box sx={{ mr: 2, color: 'primary.main' }}>{opt.icon}</Box>
                  <Box sx={{ textAlign: 'left', flex: 1 }}>
                    <Typography variant="body1" fontWeight={600}>
                      {opt.label}
                      {opt.recommended && <Chip label="★" size="small" color="success" sx={{ ml: 1 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {opt.description}
                    </Typography>
                    <Typography variant="caption" color="primary.main">
                      {opt.weights}
                    </Typography>
                  </Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Grid>

        {/* TIPO DE ALMACÉN */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>🏭 Tipo de Almacén</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Esto afecta a los escenarios que el optimizador evaluará (orientaciones, pasillos, etc.)
            </Typography>
            
            <ToggleButtonGroup
              value={preferences.warehouse_type}
              exclusive
              onChange={(_, v) => v && handleChange('warehouse_type', v)}
              sx={{ flexWrap: 'wrap', gap: 1 }}
            >
              {warehouseTypes.map(type => (
                <ToggleButton 
                  key={type.value} 
                  value={type.value}
                  sx={{ 
                    flexDirection: 'column', 
                    py: 2, 
                    px: 3,
                    minWidth: 120
                  }}
                >
                  <Box sx={{ color: 'primary.main', mb: 0.5 }}>{type.icon}</Box>
                  <Typography variant="body2" fontWeight={600}>{type.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{type.description}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Grid>

        {/* ABC ZONING - AHORA VISIBLE DIRECTAMENTE */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ 
            p: 3, 
            bgcolor: preferences.enable_abc_zones ? 'success.50' : 'grey.50', 
            border: '3px solid', 
            borderColor: preferences.enable_abc_zones ? 'success.main' : 'grey.300' 
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Layers color={preferences.enable_abc_zones ? 'success' : 'disabled'} sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6">🎯 Optimización por Zonas ABC</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Divide el almacén en 3 zonas con diferentes estrategias según rotación de productos
                  </Typography>
                </Box>
              </Box>
              <FormControlLabel
                control={
                  <Switch 
                    checked={preferences.enable_abc_zones}
                    onChange={(e) => handleChange('enable_abc_zones', e.target.checked)}
                    color="success"
                    size="medium"
                  />
                }
                label={
                  <Typography variant="body1" fontWeight={700} color={preferences.enable_abc_zones ? 'success.main' : 'text.secondary'}>
                    {preferences.enable_abc_zones ? "✓ ACTIVADO" : "DESACTIVADO"}
                  </Typography>
                }
              />
            </Box>
            
            {preferences.enable_abc_zones && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Distribución de zonas (% de profundidad desde muelles)
                </Typography>
                
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.50', border: '2px solid', borderColor: 'error.200' }}>
                      <Typography variant="h6" color="error.main">Zona A</Typography>
                      <Typography variant="body2" color="text.secondary">Alta rotación</Typography>
                      <Typography variant="h4" fontWeight={700}>{(preferences.abc_zone_a_pct * 100).toFixed(0)}%</Typography>
                      <Slider
                        value={preferences.abc_zone_a_pct * 100}
                        onChange={(_, v) => {
                          const newA = v / 100;
                          const remaining = 1 - newA;
                          handleChange('abc_zone_a_pct', newA);
                          handleChange('abc_zone_b_pct', remaining * 0.5);
                          handleChange('abc_zone_c_pct', remaining * 0.5);
                        }}
                        min={10}
                        max={40}
                        size="small"
                      />
                      <Typography variant="caption">Pasillos anchos, acceso rápido</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50', border: '2px solid', borderColor: 'warning.200' }}>
                      <Typography variant="h6" color="warning.main">Zona B</Typography>
                      <Typography variant="body2" color="text.secondary">Media rotación</Typography>
                      <Typography variant="h4" fontWeight={700}>{(preferences.abc_zone_b_pct * 100).toFixed(0)}%</Typography>
                      <Slider
                        value={preferences.abc_zone_b_pct * 100}
                        onChange={(_, v) => {
                          const newB = v / 100;
                          const usedByA = preferences.abc_zone_a_pct;
                          const newC = Math.max(0.1, 1 - usedByA - newB);
                          handleChange('abc_zone_b_pct', newB);
                          handleChange('abc_zone_c_pct', newC);
                        }}
                        min={20}
                        max={60}
                        size="small"
                      />
                      <Typography variant="caption">Equilibrio capacidad/acceso</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.50', border: '2px solid', borderColor: 'info.200' }}>
                      <Typography variant="h6" color="info.main">Zona C</Typography>
                      <Typography variant="body2" color="text.secondary">Baja rotación</Typography>
                      <Typography variant="h4" fontWeight={700}>{(preferences.abc_zone_c_pct * 100).toFixed(0)}%</Typography>
                      <Typography variant="caption">VNA + doble profundidad</Typography>
                    </Paper>
                  </Grid>
                </Grid>
                
                <Alert severity="success" sx={{ mt: 2 }}>
                  <strong>Ventaja ABC:</strong> Los pasillos se alinean automáticamente entre zonas para circulación fluida. 
                  Zona C puede ganar +20% capacidad con racks doble profundidad.
                </Alert>
              </Box>
            )}
            
            {!preferences.enable_abc_zones && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <strong>Modo uniforme:</strong> Misma configuración en todo el almacén. Activa ABC para optimizar por zonas de rotación.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* OPCIONES AVANZADAS */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">🔧 Opciones Avanzadas</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" gutterBottom>
                    Complejidad del layout
                  </Typography>
                  <ToggleButtonGroup
                    value={preferences.layout_complexity}
                    exclusive
                    onChange={(_, v) => v && handleChange('layout_complexity', v)}
                    fullWidth
                  >
                    <ToggleButton value="simple">Simple</ToggleButton>
                    <ToggleButton value="medio">Medio</ToggleButton>
                    <ToggleButton value="avanzado">Avanzado</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary">
                    Mayor complejidad = más escenarios evaluados
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" gutterBottom>
                    % Alta rotación esperada: <strong>{(preferences.high_rotation_pct * 100).toFixed(0)}%</strong>
                  </Typography>
                  <Slider
                    value={preferences.high_rotation_pct * 100}
                    onChange={(_, v) => handleChange('high_rotation_pct', v / 100)}
                    min={5}
                    max={50}
                    marks={[
                      { value: 10, label: '10%' },
                      { value: 20, label: '20%' },
                      { value: 35, label: '35%' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Productos que salen en menos de 48h (afecta dimensionado zona A)
                  </Typography>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* RESUMEN */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: preferences.enable_abc_zones ? 'success.50' : 'primary.50', border: '2px solid', borderColor: preferences.enable_abc_zones ? 'success.200' : 'primary.200' }}>
            <Typography variant="h6" gutterBottom>📊 Configuración Seleccionada</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Prioridad</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {priorityOptions.find(p => p.value === preferences.priority)?.label}
                </Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Tipo</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {warehouseTypes.find(t => t.value === preferences.warehouse_type)?.label}
                </Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Elementos</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {[
                    preferences.include_offices && '🏢',
                    preferences.include_services && '🚿',
                    preferences.include_docks && '🚛',
                    preferences.include_technical && '⚡'
                  ].filter(Boolean).join(' ') || 'Solo almacén'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Modo Optimización</Typography>
                <Typography variant="h6" fontWeight={700} color={preferences.enable_abc_zones ? 'success.main' : 'text.primary'}>
                  {preferences.enable_abc_zones ? '🎯 ABC Zoning' : '📦 Uniforme'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Escenarios</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {preferences.enable_abc_zones ? '15-20 (ABC)' : '5-8'} auto
                </Typography>
              </Grid>
            </Grid>
            
            {preferences.enable_abc_zones ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                <strong>Optimización ABC activa:</strong> Zona A ({(preferences.abc_zone_a_pct * 100).toFixed(0)}%) para alta rotación, 
                Zona B ({(preferences.abc_zone_b_pct * 100).toFixed(0)}%) equilibrada, 
                Zona C ({(preferences.abc_zone_c_pct * 100).toFixed(0)}%) densificada. Los pasillos se alinearán automáticamente.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                El optimizador generará múltiples escenarios y seleccionará el mejor según tus preferencias
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
