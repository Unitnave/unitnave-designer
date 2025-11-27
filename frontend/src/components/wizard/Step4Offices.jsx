/**
 * UNITNAVE Designer - Step3Offices
 * Configuración de oficinas: superficie, ubicación, accesos
 * 
 * ARCHIVO: frontend/src/components/wizard/Step3Offices.jsx
 * ACCIÓN: CREAR NUEVO
 */

import { useState, useEffect } from 'react';
import { 
  Grid, Typography, Box, Slider, 
  ToggleButton, ToggleButtonGroup, Alert, Paper, Switch, FormControlLabel
} from '@mui/material';
import { Business, Stairs, Elevator } from '@mui/icons-material';

export default function Step3Offices({ data, onChange }) {
  const [officeConfig, setOfficeConfig] = useState(data.officeConfig || {
    area: 40,
    floor: 'mezzanine',
    mezzanineHeight: 3.5,
    hasElevator: true,
    hasStairs: true
  });

  // Calcular trabajadores estimados
  const totalArea = data.length * data.width;
  const workers = data.workers || Math.max(10, Math.floor(totalArea / 80));
  const recommendedArea = workers * 2; // 2m² por trabajador
  const maxMezzanineHeight = Math.min(5.0, data.height - 4);

  useEffect(() => {
    onChange({ officeConfig });
  }, [officeConfig]);

  const handleChange = (field, value) => {
    setOfficeConfig(prev => ({ ...prev, [field]: value }));
  };

  const floorOptions = [
    { value: 'ground', label: 'Planta Baja', description: 'Ocupa superficie de almacén', icon: '🏠' },
    { value: 'mezzanine', label: 'Entreplanta', description: 'NO ocupa suelo almacén', icon: '🏢', recommended: true },
    { value: 'both', label: 'Ambas Plantas', description: 'Máxima superficie', icon: '🏗️' }
  ];

  const impactOnStorage = officeConfig.floor === 'mezzanine' 
    ? 0 
    : officeConfig.floor === 'ground' 
      ? officeConfig.area 
      : officeConfig.area * 0.5;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        🏢 Configuración de Oficinas
      </Typography>

      <Grid container spacing={4}>
        {/* SUPERFICIE */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
              Superficie de Oficinas
            </Typography>
            <Box sx={{ mt: 3, px: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Área: <strong>{officeConfig.area}m²</strong>
              </Typography>
              <Slider
                value={officeConfig.area}
                onChange={(_, v) => handleChange('area', v)}
                min={20}
                max={300}
                step={5}
                marks={[
                  { value: 20, label: '20m²' },
                  { value: recommendedArea, label: `${recommendedArea}m² ★` },
                  { value: 300, label: '300m²' }
                ]}
                valueLabelDisplay="auto"
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                Recomendado: <strong>{recommendedArea}m²</strong> para {workers} trabajadores (2m²/persona)
              </Alert>
            </Box>
          </Paper>
        </Grid>

        {/* UBICACIÓN */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>📍 Ubicación</Typography>
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
                    '&.Mui-selected': {
                      borderColor: 'primary.main'
                    }
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

        {/* ALTURA ENTREPLANTA */}
        {officeConfig.floor !== 'ground' && (
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>📏 Altura Entreplanta</Typography>
              <Box sx={{ mt: 3, px: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Altura libre: <strong>{officeConfig.mezzanineHeight}m</strong>
                </Typography>
                <Slider
                  value={officeConfig.mezzanineHeight}
                  onChange={(_, v) => handleChange('mezzanineHeight', v)}
                  min={2.5}
                  max={maxMezzanineHeight}
                  step={0.1}
                  marks={[
                    { value: 2.5, label: '2.5m' },
                    { value: 3.5, label: '3.5m ★' },
                    { value: maxMezzanineHeight, label: `${maxMezzanineHeight}m` }
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* ACCESO VERTICAL */}
        {officeConfig.floor !== 'ground' && (
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>🚪 Acceso Vertical</Typography>
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={true}
                      disabled
                    />
                  }
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
                <Alert severity="success" sx={{ mt: 2 }}>
                  Escalera y ascensor juntos en bloque vertical (no ocupan espacio extra)
                </Alert>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* RESUMEN */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'primary.50', border: '2px solid', borderColor: 'primary.200' }}>
            <Typography variant="h6" gutterBottom>📊 Resumen de Oficinas</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Superficie</Typography>
                <Typography variant="h5" fontWeight={700}>{officeConfig.area}m²</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Ubicación</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {officeConfig.floor === 'mezzanine' ? 'Entreplanta' : officeConfig.floor === 'ground' ? 'Planta Baja' : 'Ambas'}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Impacto en almacén</Typography>
                <Typography variant="h5" fontWeight={700} color={impactOnStorage === 0 ? 'success.main' : 'warning.main'}>
                  {impactOnStorage === 0 ? 'Ninguno' : `-${impactOnStorage}m²`}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Acceso</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {officeConfig.floor === 'ground' ? 'Directo' : officeConfig.hasElevator ? '🚶 + 🛗' : '🚶'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
