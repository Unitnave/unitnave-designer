/**
 * UNITNAVE Designer - Step4Docks
 * Configuración de muelles: cantidad, posición, zona manipulación
 * 
 * ARCHIVO: frontend/src/components/wizard/Step4Docks.jsx
 * ACCIÓN: CREAR NUEVO
 */

import { useState, useEffect } from 'react';
import { 
  Grid, Typography, Box, Slider, 
  ToggleButton, ToggleButtonGroup, Alert, Paper, Chip
} from '@mui/material';
import { LocalShipping, Straighten, SpaceBar } from '@mui/icons-material';

export default function Step4Docks({ data, onChange }) {
  const [dockConfig, setDockConfig] = useState(data.dockConfig || {
    count: data.n_docks || 4,
    position: 'center',
    maneuverZone: 4.0,
    dockWidth: 3.5,
    dockDepth: 4.0
  });

  const totalArea = data.length * data.width;
  const recommendedDocks = Math.max(2, Math.floor(totalArea / 500));

  useEffect(() => {
    onChange({ dockConfig, n_docks: dockConfig.count });
  }, [dockConfig]);

  const handleChange = (field, value) => {
    setDockConfig(prev => ({ ...prev, [field]: value }));
  };

  const positionOptions = [
    { value: 'center', label: 'Centrados', icon: '⬛⬛⬛', recommended: true },
    { value: 'left', label: 'Izquierda', icon: '⬛⬛⬛▫▫' },
    { value: 'right', label: 'Derecha', icon: '▫▫⬛⬛⬛' },
    { value: 'distributed', label: 'Distribuidos', icon: '⬛▫⬛▫⬛' }
  ];

  // Cálculos
  const totalDockWidth = dockConfig.count * (dockConfig.dockWidth + 1);
  const dockAreaPerUnit = dockConfig.dockWidth * (dockConfig.dockDepth + dockConfig.maneuverZone);
  const totalDockArea = dockConfig.count * dockAreaPerUnit;
  const dockFitsInLength = totalDockWidth <= data.length;

  // Vista previa visual
  const previewWidth = 300;
  const scale = previewWidth / data.length;
  const dockVisualWidth = dockConfig.dockWidth * scale;
  const dockVisualDepth = Math.min(40, (dockConfig.dockDepth + dockConfig.maneuverZone) * scale);

  const getDockPositions = () => {
    const positions = [];
    const gap = 1 * scale;
    const totalW = dockConfig.count * dockVisualWidth + (dockConfig.count - 1) * gap;
    
    let startX;
    if (dockConfig.position === 'left') startX = 10;
    else if (dockConfig.position === 'right') startX = previewWidth - totalW - 10;
    else if (dockConfig.position === 'distributed') {
      const spacing = (previewWidth - dockConfig.count * dockVisualWidth) / (dockConfig.count + 1);
      for (let i = 0; i < dockConfig.count; i++) {
        positions.push(spacing + i * (dockVisualWidth + spacing));
      }
      return positions;
    } else startX = (previewWidth - totalW) / 2;

    for (let i = 0; i < dockConfig.count; i++) {
      positions.push(startX + i * (dockVisualWidth + gap));
    }
    return positions;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        🚛 Configuración de Muelles
      </Typography>

      <Grid container spacing={4}>
        {/* CANTIDAD */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <LocalShipping sx={{ mr: 1, verticalAlign: 'middle' }} />
              Número de Muelles
            </Typography>
            <Box sx={{ mt: 3, px: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Cantidad: <strong>{dockConfig.count} muelles</strong>
              </Typography>
              <Slider
                value={dockConfig.count}
                onChange={(_, v) => handleChange('count', v)}
                min={1}
                max={Math.min(12, Math.floor(data.length / 5))}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: recommendedDocks, label: `${recommendedDocks} ★` },
                  { value: Math.min(12, Math.floor(data.length / 5)), label: 'Max' }
                ]}
                valueLabelDisplay="auto"
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                Recomendado: <strong>{recommendedDocks} muelles</strong> (1 cada 500m²)
              </Alert>
            </Box>
          </Paper>
        </Grid>

        {/* ZONA MANIPULACIÓN */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <SpaceBar sx={{ mr: 1, verticalAlign: 'middle' }} />
              Zona de Manipulación
            </Typography>
            <Box sx={{ mt: 3, px: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Profundidad: <strong>{dockConfig.maneuverZone}m</strong>
              </Typography>
              <Slider
                value={dockConfig.maneuverZone}
                onChange={(_, v) => handleChange('maneuverZone', v)}
                min={3.0}
                max={6.0}
                step={0.5}
                marks={[
                  { value: 3.0, label: '3m' },
                  { value: 4.0, label: '4m ★' },
                  { value: 6.0, label: '6m' }
                ]}
                valueLabelDisplay="auto"
              />
              <Alert severity="success" sx={{ mt: 2 }}>
                Zona reducida (4m vs 12m estándar) <strong>maximiza almacenamiento</strong>
              </Alert>
            </Box>
          </Paper>
        </Grid>

        {/* DIMENSIONES MUELLE */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Straighten sx={{ mr: 1, verticalAlign: 'middle' }} />
              Dimensiones del Muelle
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Ancho: <strong>{dockConfig.dockWidth}m</strong>
                </Typography>
                <Slider
                  value={dockConfig.dockWidth}
                  onChange={(_, v) => handleChange('dockWidth', v)}
                  min={3.0}
                  max={5.0}
                  step={0.5}
                  size="small"
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Profundidad: <strong>{dockConfig.dockDepth}m</strong>
                </Typography>
                <Slider
                  value={dockConfig.dockDepth}
                  onChange={(_, v) => handleChange('dockDepth', v)}
                  min={3.0}
                  max={5.0}
                  step={0.5}
                  size="small"
                  valueLabelDisplay="auto"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* POSICIÓN */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>📍 Posición en Fachada</Typography>
            <ToggleButtonGroup
              value={dockConfig.position}
              exclusive
              onChange={(_, v) => v && handleChange('position', v)}
              fullWidth
              sx={{ mt: 2 }}
            >
              {positionOptions.map(opt => (
                <ToggleButton key={opt.value} value={opt.value} sx={{ py: 1.5, flexDirection: 'column' }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{opt.icon}</Typography>
                  <Typography variant="caption" fontWeight={600}>{opt.label}</Typography>
                  {opt.recommended && <Chip label="★" size="small" color="success" sx={{ mt: 0.5, height: 16 }} />}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Grid>

        {/* VISTA PREVIA */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>👁️ Vista Previa Fachada</Typography>
            <Box sx={{ 
              width: previewWidth, 
              height: 80, 
              bgcolor: 'grey.200', 
              borderRadius: 1, 
              position: 'relative',
              mx: 'auto',
              mt: 2,
              border: '2px solid',
              borderColor: dockFitsInLength ? 'success.main' : 'error.main'
            }}>
              {/* Fachada */}
              <Box sx={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: 10, 
                bgcolor: 'grey.400',
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4
              }} />
              
              {/* Muelles */}
              {getDockPositions().map((x, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    left: x,
                    bottom: 10,
                    width: dockVisualWidth,
                    height: dockVisualDepth,
                    bgcolor: 'primary.main',
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Typography variant="caption" color="white" fontWeight={700}>
                    {i + 1}
                  </Typography>
                </Box>
              ))}
              
              {/* Zona maniobra */}
              <Box sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 10 + dockVisualDepth,
                height: Math.min(20, dockConfig.maneuverZone * scale),
                bgcolor: 'warning.light',
                opacity: 0.5
              }} />
            </Box>
            
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
              Fachada: {data.length}m | Muelles: {totalDockWidth.toFixed(1)}m
            </Typography>
            
            {!dockFitsInLength && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Los muelles no caben en la fachada. Reduce cantidad o ancho.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* RESUMEN */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200' }}>
            <Typography variant="h6" gutterBottom>📊 Resumen</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Muelles</Typography>
                <Typography variant="h5" fontWeight={700}>{dockConfig.count}</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Área por muelle</Typography>
                <Typography variant="h5" fontWeight={700}>{dockAreaPerUnit.toFixed(1)}m²</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Área total muelles</Typography>
                <Typography variant="h5" fontWeight={700}>{totalDockArea.toFixed(0)}m²</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">% de nave</Typography>
                <Typography variant="h5" fontWeight={700}>{(totalDockArea / totalArea * 100).toFixed(1)}%</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
