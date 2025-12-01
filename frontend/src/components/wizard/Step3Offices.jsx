/**
 * UNITNAVE Designer - Step3Offices
 * Configuración de oficinas con múltiples plantas
 * 
 * V5.1: Nuevo modelo con:
 * - Altura libre bajo oficina (si entresuelo)
 * - Altura por planta configurable
 * - Número de plantas dinámico según espacio
 * - Superficie por planta
 * 
 * ARCHIVO: frontend/src/components/wizard/Step3Offices.jsx
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Grid, Typography, Box, Slider, 
  ToggleButton, ToggleButtonGroup, Alert, Paper, Switch, FormControlLabel,
  Divider
} from '@mui/material';
import { Business, Stairs, Elevator, Layers, Height } from '@mui/icons-material';

export default function Step3Offices({ data, onChange }) {
  // Altura de la nave
  const warehouseHeight = data.height || 12;
  
  // Calcular máximo de superficie por planta (25% de la nave)
  const totalArea = (data.length || 80) * (data.width || 40);
  const maxAreaPerFloor = Math.min(500, Math.floor(totalArea * 0.25));
  
  const [officeConfig, setOfficeConfig] = useState(data.officeConfig || {
    include: true,
    floor: 'mezzanine',           // ground, mezzanine, both
    position: 'front_left',
    
    // Nuevo modelo de alturas
    height_under: 4.0,            // Altura libre bajo oficina (si entresuelo)
    floor_height: 3.0,            // Altura de cada planta de oficina
    num_floors: 1,                // Número de plantas
    area_per_floor: 100,          // m² por planta
    
    // Accesos
    hasElevator: true,
    hasStairs: true
  });

  // Calcular máximo de plantas según espacio disponible
  const maxFloors = useMemo(() => {
    if (officeConfig.floor === 'ground') {
      // En planta baja, todas las plantas hasta el techo
      return Math.floor(warehouseHeight / officeConfig.floor_height);
    } else {
      // En entresuelo, descontar altura libre
      const availableHeight = warehouseHeight - officeConfig.height_under;
      return Math.max(1, Math.floor(availableHeight / officeConfig.floor_height));
    }
  }, [warehouseHeight, officeConfig.floor, officeConfig.height_under, officeConfig.floor_height]);

  // Calcular altura total usada
  const totalHeightUsed = useMemo(() => {
    if (officeConfig.floor === 'ground') {
      return officeConfig.num_floors * officeConfig.floor_height;
    } else {
      return officeConfig.height_under + (officeConfig.num_floors * officeConfig.floor_height);
    }
  }, [officeConfig]);

  // Calcular superficie total
  const totalOfficeArea = officeConfig.area_per_floor * officeConfig.num_floors;

  // Trabajadores estimados
  const workers = data.workers || Math.max(10, Math.floor(totalArea / 80));
  const recommendedAreaPerFloor = Math.ceil(workers * 2 / Math.max(1, officeConfig.num_floors));

  // Ajustar num_floors si excede el máximo
  useEffect(() => {
    if (officeConfig.num_floors > maxFloors) {
      handleChange('num_floors', maxFloors);
    }
  }, [maxFloors]);

  useEffect(() => {
    onChange({ officeConfig });
  }, [officeConfig]);

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
        ? officeConfig.area_per_floor 
        : officeConfig.area_per_floor * 0.5;

  // Validación de altura
  const heightWarning = totalHeightUsed > warehouseHeight;

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
                    Espacio para administración, vestuarios y servicios
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

            {/* ALTURA LIBRE BAJO OFICINA (solo si entresuelo) */}
            {officeConfig.floor !== 'ground' && (
              <Grid item xs={12} md={6}>
                <Paper elevation={2} sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    <Height sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Altura Libre Bajo Oficina
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Espacio para almacenamiento o circulación debajo del entresuelo
                  </Typography>
                  <Box sx={{ px: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Altura libre: <strong>{officeConfig.height_under} m</strong>
                    </Typography>
                    <Slider
                      value={officeConfig.height_under}
                      onChange={(_, v) => handleChange('height_under', v)}
                      min={2.5}
                      max={Math.min(8, warehouseHeight - 3)}
                      step={0.5}
                      marks={[
                        { value: 2.5, label: '2.5m' },
                        { value: 4, label: '4m ★' },
                        { value: 6, label: '6m' }
                      ]}
                      valueLabelDisplay="auto"
                    />
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Recomendado: 3.5-4m para carretillas retráctiles
                    </Alert>
                  </Box>
                </Paper>
              </Grid>
            )}

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
                  Máximo disponible: {maxFloors} plantas (según alturas configuradas)
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

            {/* SUPERFICIE POR PLANTA */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Superficie por Planta
                </Typography>
                <Box sx={{ mt: 2, px: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Área por planta: <strong>{officeConfig.area_per_floor} m²</strong>
                  </Typography>
                  <Slider
                    value={officeConfig.area_per_floor}
                    onChange={(_, v) => handleChange('area_per_floor', v)}
                    min={30}
                    max={maxAreaPerFloor}
                    step={10}
                    marks={[
                      { value: 50, label: '50m²' },
                      { value: Math.min(recommendedAreaPerFloor, maxAreaPerFloor), label: `${Math.min(recommendedAreaPerFloor, maxAreaPerFloor)}m² ★` },
                      { value: maxAreaPerFloor, label: `${maxAreaPerFloor}m²` }
                    ]}
                    valueLabelDisplay="auto"
                  />
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Recomendado: ~{recommendedAreaPerFloor}m²/planta para {workers} trabajadores
                  </Alert>
                </Box>
              </Paper>
            </Grid>

            {/* ACCESO VERTICAL */}
            {(officeConfig.floor !== 'ground' || officeConfig.num_floors > 1) && (
              <Grid item xs={12} md={6}>
                <Paper elevation={2} sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>🚪 Acceso Vertical</Typography>
                  <Box sx={{ mt: 2 }}>
                    <FormControlLabel
                      control={<Switch checked={true} disabled />}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Stairs color="primary" />
                          <Typography>Escalera (obligatoria)</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch 
                          checked={officeConfig.hasElevator}
                          onChange={(e) => handleChange('hasElevator', e.target.checked)}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Elevator color={officeConfig.hasElevator ? 'primary' : 'disabled'} />
                          <Typography>Ascensor</Typography>
                        </Box>
                      }
                    />
                    {officeConfig.num_floors >= 2 && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        Con {officeConfig.num_floors} plantas, se recomienda ascensor
                      </Alert>
                    )}
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* DIAGRAMA VISUAL */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3, bgcolor: 'grey.100' }}>
                <Typography variant="h6" gutterBottom>📐 Diagrama de Alturas</Typography>
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
                    {/* Altura libre bajo oficina */}
                    {officeConfig.floor !== 'ground' && (
                      <Box sx={{ 
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${(officeConfig.height_under / warehouseHeight) * 100}%`,
                        bgcolor: 'success.100',
                        borderTop: '2px dashed #4caf50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Typography variant="caption" fontWeight={600}>
                          Almacén: {officeConfig.height_under}m
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Plantas de oficina */}
                    {Array.from({ length: officeConfig.num_floors }).map((_, i) => {
                      const bottomOffset = officeConfig.floor === 'ground' 
                        ? (i * officeConfig.floor_height / warehouseHeight) * 100
                        : ((officeConfig.height_under + i * officeConfig.floor_height) / warehouseHeight) * 100;
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
                  <Typography variant="body2" color="text.secondary">Plantas</Typography>
                  <Typography variant="h5" fontWeight={700} color="primary.main">
                    {officeConfig.num_floors}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">m² / Planta</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {officeConfig.area_per_floor} m²
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Superficie TOTAL</Typography>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {totalOfficeArea} m²
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <Typography variant="body2" color="text.secondary">Altura Total Usada</Typography>
                  <Typography variant="h6" fontWeight={700} color={heightWarning ? 'error.main' : 'text.primary'}>
                    {totalHeightUsed.toFixed(1)} m
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
