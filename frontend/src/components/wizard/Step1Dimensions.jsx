/**
 * UNITNAVE Designer - Step1Dimensions
 * Configuración de dimensiones: largo, ancho, alto + altura palet
 * 
 * V5.4: Añadido cubicaje del palet configurable
 * 
 * ARCHIVO: frontend/src/components/wizard/Step1Dimensions.jsx
 */

import { useState, useEffect } from 'react';
import { 
  Grid, Typography, Box, TextField, Slider, 
  Paper, Alert, InputAdornment, Chip, Divider
} from '@mui/material';
import { Straighten, Height, AspectRatio, Info, Inventory } from '@mui/icons-material';

export default function Step1Dimensions({ data, onChange }) {
  const [dimensions, setDimensions] = useState({
    length: data.length || 80,
    width: data.width || 40,
    height: data.height || 10,
    palletHeight: data.palletHeight || 1.5  // V5.4: Altura del palet configurable
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    onChange(dimensions);
  }, [dimensions]);

  const handleChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    
    // Validaciones
    const newErrors = { ...errors };
    if (field === 'length' && (numValue < 20 || numValue > 500)) {
      newErrors.length = 'Largo debe estar entre 20m y 500m';
    } else if (field === 'width' && (numValue < 15 || numValue > 200)) {
      newErrors.width = 'Ancho debe estar entre 15m y 200m';
    } else if (field === 'height' && (numValue < 6 || numValue > 18)) {
      newErrors.height = 'Alto debe estar entre 6m y 18m';
    } else if (field === 'palletHeight' && (numValue < 0.5 || numValue > 2.5)) {
      newErrors.palletHeight = 'Altura de palet debe estar entre 0.5m y 2.5m';
    } else {
      delete newErrors[field];
    }
    setErrors(newErrors);

    setDimensions(prev => ({ ...prev, [field]: numValue }));
  };

  const totalArea = dimensions.length * dimensions.width;
  const totalVolume = totalArea * dimensions.height;
  const aspectRatio = (dimensions.length / dimensions.width).toFixed(2);

  // Clasificación de nave
  const getWarehouseClass = () => {
    if (totalArea < 500) return { label: 'Pequeña', color: 'info' };
    if (totalArea < 2000) return { label: 'Mediana', color: 'success' };
    if (totalArea < 10000) return { label: 'Grande', color: 'warning' };
    return { label: 'Macro-nave', color: 'error' };
  };

  const warehouseClass = getWarehouseClass();

  // V5.4: Estimaciones con altura de palet CONFIGURABLE
  // Altura por nivel: palet + beam (0.15m) + margen (0.15m)
  const BEAM_HEIGHT = 0.15;
  const LEVEL_MARGIN = 0.15;
  const levelHeight = dimensions.palletHeight + BEAM_HEIGHT + LEVEL_MARGIN;
  
  const SECURITY_MARGIN = 1.0; // Margen de seguridad bajo techo
  const usableHeight = Math.max(0, dimensions.height - SECURITY_MARGIN);
  const estimatedLevels = Math.max(1, Math.floor(usableHeight / levelHeight));
  
  // Área de almacenamiento efectiva (~60% del total después de pasillos, muelles, etc.)
  const STORAGE_EFFICIENCY = 0.60;
  const storageArea = totalArea * STORAGE_EFFICIENCY;
  
  // M² por posición de palet (palet + separación)
  const M2_PER_PALLET_POSITION = 1.4;
  
  // Palets = posiciones en suelo × niveles
  const estimatedPallets = Math.floor((storageArea / M2_PER_PALLET_POSITION) * estimatedLevels);

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        📐 Dimensiones de la Nave
      </Typography>

      <Grid container spacing={4}>
        {/* LARGO */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Straighten color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Largo (Fachada)</Typography>
            </Box>
            <TextField
              fullWidth
              type="number"
              value={dimensions.length}
              onChange={(e) => handleChange('length', e.target.value)}
              error={!!errors.length}
              helperText={errors.length || 'Paralelo a muelles de carga'}
              InputProps={{
                endAdornment: <InputAdornment position="end">metros</InputAdornment>,
              }}
              sx={{ mb: 2 }}
            />
            <Slider
              value={dimensions.length}
              onChange={(_, v) => handleChange('length', v)}
              min={20}
              max={300}
              step={5}
              marks={[
                { value: 20, label: '20m' },
                { value: 80, label: '80m' },
                { value: 150, label: '150m' },
                { value: 300, label: '300m' }
              ]}
              valueLabelDisplay="auto"
            />
          </Paper>
        </Grid>

        {/* ANCHO */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AspectRatio color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Ancho (Fondo)</Typography>
            </Box>
            <TextField
              fullWidth
              type="number"
              value={dimensions.width}
              onChange={(e) => handleChange('width', e.target.value)}
              error={!!errors.width}
              helperText={errors.width || 'Profundidad desde muelles'}
              InputProps={{
                endAdornment: <InputAdornment position="end">metros</InputAdornment>,
              }}
              sx={{ mb: 2 }}
            />
            <Slider
              value={dimensions.width}
              onChange={(_, v) => handleChange('width', v)}
              min={15}
              max={150}
              step={5}
              marks={[
                { value: 15, label: '15m' },
                { value: 40, label: '40m' },
                { value: 80, label: '80m' },
                { value: 150, label: '150m' }
              ]}
              valueLabelDisplay="auto"
            />
          </Paper>
        </Grid>

        {/* ALTO */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Height color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Alto Libre</Typography>
            </Box>
            <TextField
              fullWidth
              type="number"
              value={dimensions.height}
              onChange={(e) => handleChange('height', e.target.value)}
              error={!!errors.height}
              helperText={errors.height || 'Altura bajo cercha/viga'}
              InputProps={{
                endAdornment: <InputAdornment position="end">metros</InputAdornment>,
              }}
              sx={{ mb: 2 }}
            />
            <Slider
              value={dimensions.height}
              onChange={(_, v) => handleChange('height', v)}
              min={6}
              max={18}
              step={0.5}
              marks={[
                { value: 6, label: '6m' },
                { value: 10, label: '10m' },
                { value: 14, label: '14m' },
                { value: 18, label: '18m' }
              ]}
              valueLabelDisplay="auto"
            />
          </Paper>
        </Grid>

        {/* V5.4: ALTURA DEL PALET (CUBICAJE) */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Inventory color="warning" sx={{ mr: 1 }} />
              <Typography variant="h6">📦 Altura del Palet (Cubicaje)</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Define la altura total del palet CON CARGA. Esto determina cuántos niveles caben en la nave.
            </Typography>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  value={dimensions.palletHeight}
                  onChange={(e) => handleChange('palletHeight', e.target.value)}
                  error={!!errors.palletHeight}
                  helperText={errors.palletHeight || 'Altura palet + mercancía'}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">metros</InputAdornment>,
                  }}
                  inputProps={{ step: 0.1, min: 0.5, max: 2.5 }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <Slider
                  value={dimensions.palletHeight}
                  onChange={(_, v) => handleChange('palletHeight', v)}
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  marks={[
                    { value: 0.5, label: '0.5m' },
                    { value: 1.0, label: '1.0m' },
                    { value: 1.5, label: '1.5m (estándar)' },
                    { value: 2.0, label: '2.0m' },
                    { value: 2.5, label: '2.5m' }
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}m`}
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="body2">
                Con palet de <strong>{dimensions.palletHeight}m</strong> y nave de <strong>{dimensions.height}m</strong>:
              </Typography>
              <Typography variant="h6" color="primary.main">
                ➜ Caben <strong>{estimatedLevels} niveles</strong> de estanterías
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* RESUMEN VISUAL */}
        <Grid item xs={12}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              bgcolor: 'primary.50', 
              border: '2px solid', 
              borderColor: 'primary.200' 
            }}
          >
            <Typography variant="h6" gutterBottom>
              📊 Resumen de Dimensiones
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="body2" color="text.secondary">Superficie</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {totalArea.toLocaleString()}m²
                </Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="body2" color="text.secondary">Volumen</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {totalVolume.toLocaleString()}m³
                </Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="body2" color="text.secondary">Niveles (est.)</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {estimatedLevels}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="body2" color="text.secondary">Clasificación</Typography>
                <Chip 
                  label={warehouseClass.label} 
                  color={warehouseClass.color} 
                  sx={{ fontWeight: 700, mt: 0.5 }}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="body2" color="text.secondary">Palets (est.)</Typography>
                <Typography variant="h5" fontWeight={700} color="success.main">
                  ~{estimatedPallets.toLocaleString()}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* ALERTAS CONTEXTUALES */}
        {aspectRatio > 4 && (
          <Grid item xs={12}>
            <Alert severity="warning" icon={<Info />}>
              <strong>Nave muy alargada</strong> (proporción {aspectRatio}:1). 
              Considera orientar racks paralelos al largo para minimizar distancias de picking.
            </Alert>
          </Grid>
        )}

        {dimensions.height >= 12 && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<Info />}>
              <strong>Nave alta ({dimensions.height}m)</strong>. 
              Podrás usar racks de 5-6 niveles. Considera maquinaria VNA para máxima densidad.
            </Alert>
          </Grid>
        )}

        {totalArea < 400 && (
          <Grid item xs={12}>
            <Alert severity="info" icon={<Info />}>
              <strong>Nave pequeña ({totalArea}m²)</strong>. 
              La optimización ABC se desactivará automáticamente (requiere mín. 400m²).
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
