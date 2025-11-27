/**
 * UNITNAVE Designer - Step4Docks
 * Configuración de muelles: cantidad, posición, zona expedición
 * 
 * ARCHIVO: frontend/src/components/wizard/Step4Docks.jsx
 */

import { useState, useEffect } from 'react';
import { 
  Grid, Typography, Box, Slider, Paper, Alert,
  ToggleButton, ToggleButtonGroup, FormControlLabel, Switch, Chip
} from '@mui/material';
import { LocalShipping, Warehouse, Speed } from '@mui/icons-material';

export default function Step4Docks({ data, onChange }) {
  const [dockConfig, setDockConfig] = useState(data.dockConfig || {
    count: 4,
    position: 'front',
    dockWidth: 3.5,
    maneuverDepth: 4.0,
    includeExpedition: true,
    expeditionDepth: 8,
    crossDocking: false
  });

  const warehouseLength = data.length || 80;
  const warehouseWidth = data.width || 40;
  const activityType = data.activityType || 'industrial';

  // Calcular máximo de muelles según fachada
  const facadeLength = dockConfig.position === 'front' || dockConfig.position === 'back' 
    ? warehouseLength 
    : warehouseWidth;
  const maxDocks = Math.floor((facadeLength - 4) / dockConfig.dockWidth);
  const recommendedDocks = Math.max(2, Math.floor(maxDocks * 0.6));

  useEffect(() => {
    onChange({ dockConfig });
  }, [dockConfig]);

  const handleChange = (field, value) => {
    setDockConfig(prev => ({ ...prev, [field]: value }));
  };

  // Ajustar muelles si excede máximo
  useEffect(() => {
    if (dockConfig.count > maxDocks) {
      handleChange('count', maxDocks);
    }
  }, [dockConfig.position, maxDocks]);

  const positionOptions = [
    { 
      value: 'front', 
      label: 'Frontal', 
      description: `Fachada principal (${warehouseLength}m)`,
      icon: '⬆️',
      recommended: true
    },
    { 
      value: 'back', 
      label: 'Trasera', 
      description: `Fachada trasera (${warehouseLength}m)`,
      icon: '⬇️'
    },
    { 
      value: 'left', 
      label: 'Lateral Izq.', 
      description: `Lateral izquierdo (${warehouseWidth}m)`,
      icon: '⬅️'
    },
    { 
      value: 'right', 
      label: 'Lateral Der.', 
      description: `Lateral derecho (${warehouseWidth}m)`,
      icon: '➡️'
    },
    { 
      value: 'both_ends', 
      label: 'Cross-Dock', 
      description: 'Muelles en ambos extremos',
      icon: '↔️',
      crossdock: true
    }
  ];

  const dockWidthOptions = [
    { value: 3.0, label: '3.0m', description: 'Mínimo normativo' },
    { value: 3.5, label: '3.5m', description: 'Estándar', recommended: true },
    { value: 4.0, label: '4.0m', description: 'Cómodo' },
    { value: 4.5, label: '4.5m', description: 'Doble operación' }
  ];

  // Calcular área de expedición
  const expeditionArea = dockConfig.includeExpedition 
    ? warehouseLength * dockConfig.expeditionDepth 
    : 0;

  // Calcular capacidad de carga/descarga
  const trucksPerHour = dockConfig.count * 2; // Estimación: 30 min por camión
  const palletsPerHour = trucksPerHour * 33; // 33 palets por camión

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        🚛 Configuración de Muelles
      </Typography>

      <Grid container spacing={4}>
        {/* CANTIDAD DE MUELLES */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <LocalShipping sx={{ mr: 1, verticalAlign: 'middle' }} />
              Cantidad de Muelles
            </Typography>
            <Box sx={{ mt: 3, px: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Muelles: <strong>{dockConfig.count}</strong> (máx. {maxDocks} en esta fachada)
              </Typography>
              <Slider
                value={dockConfig.count}
                onChange={(_, v) => handleChange('count', v)}
                min={1}
                max={Math.max(1, maxDocks)}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: recommendedDocks, label: `${recommendedDocks} ★` },
                  { value: maxDocks, label: `${maxDocks}` }
                ]}
                valueLabelDisplay="auto"
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>{dockConfig.count} muelles</strong> = capacidad ~{palletsPerHour} palets/hora 
                ({trucksPerHour} camiones/hora)
              </Alert>
            </Box>
          </Paper>
        </Grid>

        {/* ANCHO DE MUELLE */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>📏 Ancho por Muelle</Typography>
            <ToggleButtonGroup
              value={dockConfig.dockWidth}
              exclusive
              onChange={(_, v) => v && handleChange('dockWidth', v)}
              fullWidth
              sx={{ mt: 2 }}
            >
              {dockWidthOptions.map(opt => (
                <ToggleButton 
                  key={opt.value} 
                  value={opt.value}
                  sx={{ 
                    flexDirection: 'column',
                    py: 2,
                    border: opt.recommended ? '2px solid' : '1px solid',
                    borderColor: opt.recommended ? 'success.main' : 'divider',
                    '&.Mui-selected': {
                      bgcolor: 'primary.100'
                    }
                  }}
                >
                  <Typography variant="h6" fontWeight={700}>{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                  {opt.recommended && <Chip label="★" size="small" color="success" sx={{ mt: 0.5 }} />}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Grid>

        {/* POSICIÓN DE MUELLES */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>📍 Posición de Muelles</Typography>
            <ToggleButtonGroup
              value={dockConfig.position}
              exclusive
              onChange={(_, v) => {
                if (v) {
                  handleChange('position', v);
                  if (v === 'both_ends') {
                    handleChange('crossDocking', true);
                  } else {
                    handleChange('crossDocking', false);
                  }
                }
              }}
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1,
                mt: 2,
                '& .MuiToggleButton-root': {
                  flex: '1 1 18%',
                  minWidth: '120px'
                }
              }}
            >
              {positionOptions.map(opt => (
                <ToggleButton 
                  key={opt.value} 
                  value={opt.value}
                  sx={{ 
                    flexDirection: 'column',
                    py: 2,
                    border: opt.recommended ? '2px solid' : '1px solid',
                    borderColor: opt.recommended ? 'success.main' : 'divider',
                    '&.Mui-selected': {
                      bgcolor: opt.crossdock ? 'warning.100' : 'primary.100',
                      borderColor: opt.crossdock ? 'warning.main' : 'primary.main'
                    }
                  }}
                >
                  <Typography variant="h4">{opt.icon}</Typography>
                  <Typography variant="body2" fontWeight={600}>{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                  {opt.recommended && <Chip label="RECOMENDADO" size="small" color="success" sx={{ mt: 1 }} />}
                  {opt.crossdock && <Chip label="CROSS-DOCK" size="small" color="warning" sx={{ mt: 1 }} />}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Grid>

        {/* ZONA DE EXPEDICIÓN */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <FormControlLabel
              control={
                <Switch 
                  checked={dockConfig.includeExpedition}
                  onChange={(e) => handleChange('includeExpedition', e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="h6">
                    <Warehouse sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Zona de Expedición
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Área de preparación junto a muelles
                  </Typography>
                </Box>
              }
            />
            
            {dockConfig.includeExpedition && (
              <Box sx={{ mt: 3, px: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Profundidad: <strong>{dockConfig.expeditionDepth}m</strong>
                </Typography>
                <Slider
                  value={dockConfig.expeditionDepth}
                  onChange={(_, v) => handleChange('expeditionDepth', v)}
                  min={4}
                  max={15}
                  step={1}
                  marks={[
                    { value: 4, label: '4m (mínimo)' },
                    { value: 8, label: '8m ★' },
                    { value: 15, label: '15m' }
                  ]}
                  valueLabelDisplay="auto"
                />
                <Alert severity="info" sx={{ mt: 2 }}>
                  Zona expedición: <strong>{expeditionArea}m²</strong> ({warehouseLength}m × {dockConfig.expeditionDepth}m)
                </Alert>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* ZONA DE MANIOBRA */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
              Zona de Maniobra
            </Typography>
            <Box sx={{ mt: 3, px: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Profundidad: <strong>{dockConfig.maneuverDepth}m</strong>
              </Typography>
              <Slider
                value={dockConfig.maneuverDepth}
                onChange={(_, v) => handleChange('maneuverDepth', v)}
                min={3}
                max={8}
                step={0.5}
                marks={[
                  { value: 3, label: '3m' },
                  { value: 4, label: '4m ★' },
                  { value: 6, label: '6m' },
                  { value: 8, label: '8m' }
                ]}
                valueLabelDisplay="auto"
              />
              <Alert severity="success" sx={{ mt: 2 }}>
                V5 optimizado: <strong>4m</strong> suficiente para retráctiles (vs 12m tradicional).
                Ganas {(12 - dockConfig.maneuverDepth) * warehouseLength}m² de almacenamiento.
              </Alert>
            </Box>
          </Paper>
        </Grid>

        {/* CROSS-DOCKING */}
        {dockConfig.crossDocking && (
          <Grid item xs={12}>
            <Alert severity="warning" icon={<Speed />}>
              <strong>Modo Cross-Docking activado</strong>: Muelles en ambos extremos para flujo continuo de mercancía.
              Ideal para operaciones de tránsito sin almacenamiento.
            </Alert>
          </Grid>
        )}

        {/* RESUMEN */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200' }}>
            <Typography variant="h6" gutterBottom>📊 Resumen de Muelles</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Muelles</Typography>
                <Typography variant="h5" fontWeight={700}>{dockConfig.count}</Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Posición</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {positionOptions.find(p => p.value === dockConfig.position)?.icon}
                </Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Ancho/muelle</Typography>
                <Typography variant="h5" fontWeight={700}>{dockConfig.dockWidth}m</Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Expedición</Typography>
                <Typography variant="h5" fontWeight={700} color={dockConfig.includeExpedition ? 'success.main' : 'text.secondary'}>
                  {dockConfig.includeExpedition ? `${expeditionArea}m²` : 'No'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Capacidad</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {palletsPerHour} pal/h
                </Typography>
              </Grid>
              <Grid item xs={6} md={2}>
                <Typography variant="body2" color="text.secondary">Modo</Typography>
                <Chip 
                  label={dockConfig.crossDocking ? 'Cross-Dock' : 'Estándar'} 
                  color={dockConfig.crossDocking ? 'warning' : 'default'}
                  sx={{ fontWeight: 700 }}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
