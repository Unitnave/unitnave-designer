/**
 * UNITNAVE Designer - Step1Dimensions
 * Configuración de dimensiones: largo, ancho, alto
 * 
 * ARCHIVO: frontend/src/components/wizard/Step1Dimensions.jsx
 */

import { useState, useEffect } from 'react';
import { 
  Grid, Typography, Box, TextField, Slider, 
  Paper, Alert, InputAdornment, Chip
} from '@mui/material';
import { Straighten, Height, AspectRatio, Info } from '@mui/icons-material';

export default function Step1Dimensions({ data, onChange }) {
  const [dimensions, setDimensions] = useState({
    length: data.length || 80,
    width: data.width || 40,
    height: data.height || 10
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

  // Estimaciones CORREGIDAS - Incluyen ALTURA
  // Altura por nivel de estantería: palet (1.5m) + beam (0.15m) + margen (0.15m) = ~1.8m
  const LEVEL_HEIGHT = 1.8;
  const SECURITY_MARGIN = 1.0; // Margen de seguridad bajo techo
  const usableHeight = Math.max(0, dimensions.height - SECURITY_MARGIN);
  const estimatedLevels = Math.max(1, Math.floor(usableHeight / LEVEL_HEIGHT));
  
  // Área de almacenamiento efectiva (~60% del total después de pasillos, muelles, etc.)
  const STORAGE_EFFICIENCY = 0.60;
  const storageArea = totalArea * STORAGE_EFFICIENCY;
  
  // M² por posición de palet (palet + separación)
  const M2_PER_PALLET_POSITION = 1.4;
  
  // Palets = posiciones en suelo × niveles
  const estimatedPallets = Math.floor((storageArea / M2_PER_PALLET_POSITION) * estimatedLevels);
  const estimatedWorkers = Math.max(5, Math.floor(totalArea / 150));

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
              <Grid item xs={6} sm={4} md={2}>
                <Typography variant="body2" color="text.secondary">Personal (est.)</Typography>
                <Typography variant="h5" fontWeight={700}>
                  ~{estimatedWorkers}
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
