/**
 * UNITNAVE Designer - Step3Offices
 * Configuración de oficinas con múltiples plantas
 * 
 * V6.0 Cambios:
 * - Largo y ancho configurables (prioridad sobre m²)
 * - Altura libre calculada automáticamente desde el techo
 * - Acceso vertical automático (siempre escalera + ascensor con oficinas)
 * 
 * ARCHIVO: frontend/src/components/wizard/Step3Offices.jsx
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Grid, Typography, Box, Slider, 
  ToggleButton, ToggleButtonGroup, Alert, Paper, Switch, FormControlLabel,
  Divider, TextField, InputAdornment
} from '@mui/material';
import { Business, Layers } from '@mui/icons-material';

export default function Step3Offices({ data, onChange }) {
  // Altura de la nave
  const warehouseHeight = data.height || 12;
  const warehouseLength = data.length || 80;
  const warehouseWidth = data.width || 40;
  
  // Calcular máximo de superficie por planta (25% de la nave)
  const totalArea = warehouseLength * warehouseWidth;
  const maxAreaPerFloor = Math.min(500, Math.floor(totalArea * 0.25));
  
  const [officeConfig, setOfficeConfig] = useState(data.officeConfig || {
    include: true,
    floor: 'mezzanine',           // ground, mezzanine, both
    position: 'front_left',
    
    // Dimensiones configurables (NUEVO)
    office_length: 12,            // Largo de oficina (m)
    office_width: 8,              // Ancho de oficina (m)
    
    // Altura por planta y número de plantas
    floor_height: 3.0,            // Altura de cada planta de oficina
    num_floors: 1,                // Número de plantas
    area_per_floor: 96            // m² por planta (calculado de largo x ancho)
  });

  // Calcular área desde largo x ancho (prioridad)
  const calculatedArea = officeConfig.office_length * officeConfig.office_width;
  
  // Calcular altura libre automáticamente (oficina pegada al techo)
  const autoHeightUnder = useMemo(() => {
    if (officeConfig.floor === 'ground') return 0;
    const totalOfficeHeight = officeConfig.num_floors * officeConfig.floor_height;
    const heightUnder = warehouseHeight - totalOfficeHeight;
    return Math.max(3.0, heightUnder); // Mínimo 3m para carretillas
  }, [warehouseHeight, officeConfig.num_floors, officeConfig.floor_height, officeConfig.floor]);

  // Calcular máximo de plantas según espacio disponible
  const maxFloors = useMemo(() => {
    if (officeConfig.floor === 'ground') {
      return Math.floor(warehouseHeight / officeConfig.floor_height);
    } else {
      // En entresuelo, mínimo 3m libres debajo
      const availableHeight = warehouseHeight - 3.0;
      return Math.max(1, Math.floor(availableHeight / officeConfig.floor_height));
    }
  }, [warehouseHeight, officeConfig.floor, officeConfig.floor_height]);

  // Calcular altura total usada
  const totalHeightUsed = useMemo(() => {
    if (officeConfig.floor === 'ground') {
      return officeConfig.num_floors * officeConfig.floor_height;
    } else {
      return autoHeightUnder + (officeConfig.num_floors * officeConfig.floor_height);
    }
  }, [officeConfig, autoHeightUnder]);

  // Calcular superficie total
  const totalOfficeArea = calculatedArea * officeConfig.num_floors;

  // Ajustar num_floors si excede el máximo
  useEffect(() => {
    if (officeConfig.num_floors > maxFloors) {
      handleChange('num_floors', maxFloors);
    }
  }, [maxFloors]);

  // Actualizar area_per_floor cuando cambian largo o ancho
  useEffect(() => {
    if (officeConfig.area_per_floor !== calculatedArea) {
      setOfficeConfig(prev => ({ ...prev, area_per_floor: calculatedArea }));
    }
  }, [calculatedArea]);

  useEffect(() => {
    // Incluir height_under calculado automáticamente
    onChange({ 
      officeConfig: {
        ...officeConfig,
        height_under: autoHeightUnder,
        hasElevator: true,  // Siempre automático
        hasStairs: true     // Siempre automático
      }
    });
  }, [officeConfig, autoHeightUnder]);

  const handleChange = (field, value) => {
    setOfficeConfig(prev => ({ ...prev, [field]: value }));
  };

  const floorOptions = [
    { value: 'ground', label: 'Planta Baja', description: 'Ocupa superficie de almacén', icon: '🏠' },
    { value: 'mezzanine', label: 'Entresuelo', description: 'NO ocupa suelo almacén', icon: '🏢', recommended: true },
    { value: 'both', label: 'Ambas', description: 'Planta baja + entresuelo', icon: '🏗️' }
  ];

  const positionOptions = [
    { value: 'front_left', label: 'Frontal Izq.', icon: '↖️' },
    { value: 'front_right', label: 'Frontal Der.', icon: '↗️' },
    { value: 'front_center', label: 'Frontal Centro', icon: '⬆️' },
    { value: 'back_left', label: 'Trasera Izq.', icon: '↙️' },
    { value: 'back_right', label: 'Trasera Der.', icon: '↘️' }
  ];

  // Impacto en almacén
  const impactOnStorage = !officeConfig.include ? 0 :
    officeConfig.floor === 'mezzanine' 
      ? 0 
      : officeConfig.floor === 'ground' 
        ? calculatedArea 
        : calculatedArea * 0.5;

  // Validación de altura
  const heightWarning = totalHeightUsed > warehouseHeight;

  // Validación de dimensiones
  const dimensionWarning = officeConfig.office_length > warehouseLength * 0.4 || 
                           officeConfig.office_width > warehouseWidth * 0.3;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        🏢 Configuración de Oficinas
      </Typography>

      <Grid container spacing={4}>
        {/* INCLUIR OFICINAS */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <FormControlLabel
              control={
                <Switch 
                  checked={officeConfig.include}
                  onChange={(e) => handleChange('include', e.target.checked)}
                  color="primary"
                  size="medium"
                />
              }
              label={
                <Box>
                  <Typography variant="h6">Incluir zona de oficinas</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Espacio para administración, vestuarios y servicios. Incluye escalera y ascensor automáticamente.
                  </Typography>
                </Box>
              }
            />
          </Paper>
        </Grid>

        {officeConfig.include && (
          <>
            {/* UBICACIÓN VERTICAL */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>📍 Ubicación Vertical</Typography>
                <ToggleButtonGroup
                  value={officeConfig.floor}
                  exclusive
                  onChange={(_, v) => v && handleChange('floor', v)}
                  orientation="vertical"
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  {floorOptions.map(opt => (
                    <ToggleButton 
                      key={opt.value} 
                      value={opt.value}
                      sx={{ 
                        justifyContent: 'flex-start', 
                        py: 2,
                        border: opt.recommended ? '2px solid' : '1px solid',
                        borderColor: opt.recommended ? 'success.main' : 'divider',
                        '&.Mui-selected': { borderColor: 'primary.main' }
                      }}
                    >
                      <Typography variant="h5" sx={{ mr: 2 }}>{opt.icon}</Typography>
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="body1" fontWeight={600}>
                          {opt.label}
                          {opt.recommended && (
                            <Typography component="span" color="success.main" sx={{ ml: 1 }}>★ RECOMENDADO</Typography>
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                      </Box>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Paper>
            </Grid>

            {/* POSICIÓN HORIZONTAL */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>🧭 Posición en Planta</Typography>
                <ToggleButtonGroup
                  value={officeConfig.position}
                  exclusive
                  onChange={(_, v) => v && handleChange('position', v)}
                  sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 1,
                    mt: 2,
                    '& .MuiToggleButton-root': { flex: '1 1 30%', minWidth: '100px' }
                  }}
                >
                  {positionOptions.map(opt => (
                    <ToggleButton 
                      key={opt.value} 
                      value={opt.value}
                      sx={{ 
                        flexDirection: 'column',
                        py: 1.5,
                        '&.Mui-selected': { bgcolor: 'primary.100' }
                      }}
                    >
                      <Typography variant="h5">{opt.icon}</Typography>
                      <Typography variant="caption">{opt.label}</Typography>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Paper>
            </Grid>

            {/* DIMENSIONES DE OFICINA (LARGO x ANCHO) */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200' }}>
                <Typography variant="h6" gutterBottom>
                  <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                  📐 Dimensiones de Oficina
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Define largo y ancho en metros. Los m² se calculan automáticamente.
                </Typography>
                
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Largo"
                      value={officeConfig.office_length}
                      onChange={(e) => handleChange('office_length', parseFloat(e.target.value) || 5)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">m</InputAdornment>,
                      }}
                      inputProps={{ min: 5, max: warehouseLength * 0.4, step: 0.5 }}
                      helperText={`Máx: ${(warehouseLength * 0.4).toFixed(0)}m`}
                    />
                  </Grid>
                  <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                    <Typography variant="h5">×</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Ancho"
                      value={officeConfig.office_width}
                      onChange={(e) => handleChange('office_width', parseFloat(e.target.value) || 5)}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">m</InputAdornment>,
                      }}
                      inputProps={{ min: 5, max: warehouseWidth * 0.3, step: 0.5 }}
                      helperText={`Máx: ${(warehouseWidth * 0.3).toFixed(0)}m`}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.100' }}>
                      <Typography variant="body2" color="text.secondary">Por planta</Typography>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {calculatedArea} m²
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {dimensionWarning && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Las dimensiones son muy grandes. Considera reducirlas para dejar más espacio de almacenamiento.
                  </Alert>
                )}
              </Paper>
            </Grid>

            {/* ALTURA POR PLANTA */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <Layers sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Altura por Planta
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Altura de cada piso de oficina
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Altura: <strong>{officeConfig.floor_height} m</strong>
                  </Typography>
                  <Slider
                    value={officeConfig.floor_height}
                    onChange={(_, v) => handleChange('floor_height', v)}
                    min={2.5}
                    max={4.0}
                    step={0.25}
                    marks={[
                      { value: 2.5, label: '2.5m' },
                      { value: 3.0, label: '3m ★' },
                      { value: 3.5, label: '3.5m' },
                      { value: 4.0, label: '4m' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Box>
              </Paper>
            </Grid>

            {/* NÚMERO DE PLANTAS */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, bgcolor: 'primary.50' }}>
                <Typography variant="h6" gutterBottom>
                  🏗️ Número de Plantas
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Máximo disponible: {maxFloors} plantas (según altura nave)
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Plantas: <strong>{officeConfig.num_floors}</strong>
                  </Typography>
                  <Slider
                    value={officeConfig.num_floors}
                    onChange={(_, v) => handleChange('num_floors', v)}
                    min={1}
                    max={Math.max(1, maxFloors)}
                    step={1}
                    marks={Array.from({ length: Math.min(maxFloors, 6) }, (_, i) => ({
                      value: i + 1,
                      label: `${i + 1}`
                    }))}
                    valueLabelDisplay="auto"
                    disabled={maxFloors <= 1}
                  />
                </Box>
              </Paper>
            </Grid>

            {/* DIAGRAMA VISUAL */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3, bgcolor: 'grey.100' }}>
                <Typography variant="h6" gutterBottom>📐 Diagrama de Alturas (Automático)</Typography>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'flex-end', 
                  justifyContent: 'center',
                  height: 200,
                  mt: 2,
                  position: 'relative'
                }}>
                  {/* Nave completa */}
                  <Box sx={{ 
                    width: 300, 
                    height: `${(warehouseHeight / warehouseHeight) * 180}px`,
                    border: '3px solid #333',
                    borderBottom: '5px solid #333',
                    position: 'relative',
                    bgcolor: 'white'
                  }}>
                    {/* Altura libre bajo oficina - CALCULADA AUTOMÁTICAMENTE */}
                    {officeConfig.floor !== 'ground' && (
                      <Box sx={{ 
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${(autoHeightUnder / warehouseHeight) * 100}%`,
                        bgcolor: 'success.100',
                        borderTop: '2px dashed #4caf50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Typography variant="caption" fontWeight={600}>
                          Almacén: {autoHeightUnder.toFixed(1)}m (auto)
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Plantas de oficina */}
                    {Array.from({ length: officeConfig.num_floors }).map((_, i) => {
                      const bottomOffset = officeConfig.floor === 'ground' 
                        ? (i * officeConfig.floor_height / warehouseHeight) * 100
                        : ((autoHeightUnder + i * officeConfig.floor_height) / warehouseHeight) * 100;
                      const plantHeight = (officeConfig.floor_height / warehouseHeight) * 100;
                      
                      return (
                        <Box key={i} sx={{ 
                          position: 'absolute',
                          bottom: `${bottomOffset}%`,
                          left: '10%',
                          width: '40%',
                          height: `${plantHeight}%`,
                          bgcolor: 'primary.200',
                          border: '1px solid',
                          borderColor: 'primary.400',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Typography variant="caption" fontWeight={600}>
                            P{i + 1}: {officeConfig.floor_height}m
                          </Typography>
                        </Box>
                      );
                    })}
                    
                    {/* Etiqueta altura nave */}
                    <Box sx={{ 
                      position: 'absolute', 
                      right: -60, 
                      top: '50%', 
                      transform: 'translateY(-50%) rotate(-90deg)',
                      whiteSpace: 'nowrap'
                    }}>
                      <Typography variant="caption" color="text.secondary">
                        Nave: {warehouseHeight}m
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  📍 La altura libre bajo oficina ({autoHeightUnder.toFixed(1)}m) se calcula automáticamente desde el techo.
                  Escalera y ascensor incluidos automáticamente.
                </Alert>
                
                {heightWarning && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    ⚠️ La suma de alturas ({totalHeightUsed.toFixed(1)}m) excede la altura de la nave ({warehouseHeight}m)
                  </Alert>
                )}
              </Paper>
            </Grid>
          </>
        )}

        {/* RESUMEN */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ 
            p: 3, 
            bgcolor: heightWarning ? 'error.50' : 'primary.50', 
            border: '2px solid', 
            borderColor: heightWarning ? 'error.200' : 'primary.200' 
          }}>
            <Typography variant="h6" gutterBottom>📊 Resumen de Oficinas</Typography>
            {officeConfig.include ? (
              <Grid container spacing={2}>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Ubicación</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {officeConfig.floor === 'mezzanine' ? 'Entresuelo' : officeConfig.floor === 'ground' ? 'Planta Baja' : 'Ambas'}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Dimensiones</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {officeConfig.office_length}×{officeConfig.office_width}m
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Plantas</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {officeConfig.num_floors}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Superficie TOTAL</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {totalOfficeArea} m²
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Altura Libre (auto)</Typography>
                  <Typography variant="h6" fontWeight={700} color={heightWarning ? 'error.main' : 'text.primary'}>
                    {autoHeightUnder.toFixed(1)} m
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Impacto en almacén</Typography>
                  <Typography variant="h6" fontWeight={700} color={impactOnStorage === 0 ? 'success.main' : 'warning.main'}>
                    {impactOnStorage === 0 ? 'Ninguno' : `-${impactOnStorage}m²`}
                  </Typography>
                </Grid>
              </Grid>
            ) : (
              <Alert severity="warning">
                Sin zona de oficinas. El almacén se optimizará al 100% para almacenamiento.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
