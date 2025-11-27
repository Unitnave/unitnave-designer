/**
 * UNITNAVE Designer - Step2Configuration
 * Configuración operativa: actividad, maquinaria, tipo palet
 * 
 * ARCHIVO: frontend/src/components/wizard/Step2Configuration.jsx
 */

import { useState, useEffect } from 'react';
import { 
  Grid, Typography, Box, Paper, Alert,
  ToggleButton, ToggleButtonGroup, Chip, TextField
} from '@mui/material';
import { 
  LocalShipping, Inventory, ShoppingCart, 
  AcUnit, Warehouse, Speed
} from '@mui/icons-material';

export default function Step2Configuration({ data, onChange }) {
  const [config, setConfig] = useState({
    activityType: data.activityType || 'industrial',
    machinery: data.machinery || 'retractil',
    palletType: data.palletType || 'europalet',
    workers: data.workers || null
  });

  useEffect(() => {
    onChange(config);
  }, [config]);

  const handleChange = (field, value) => {
    if (value !== null) {
      setConfig(prev => ({ ...prev, [field]: value }));
    }
  };

  // Opciones de tipo de actividad
  const activityTypes = [
    { 
      value: 'industrial', 
      label: 'Industrial', 
      icon: <Warehouse />, 
      description: 'Fabricación, materias primas',
      aisleWidth: '3.5m',
      rotation: 'Media'
    },
    { 
      value: 'ecommerce', 
      label: 'E-commerce', 
      icon: <ShoppingCart />, 
      description: 'Alto picking, alta rotación',
      aisleWidth: '4.0m',
      rotation: 'Muy alta'
    },
    { 
      value: '3pl', 
      label: '3PL/Logística', 
      icon: <LocalShipping />, 
      description: 'Multi-cliente, flexibilidad',
      aisleWidth: '3.8m',
      rotation: 'Variable'
    },
    { 
      value: 'almacen_masivo', 
      label: 'Almacén Masivo', 
      icon: <Inventory />, 
      description: 'Stock largo plazo, densidad',
      aisleWidth: '3.2m',
      rotation: 'Baja'
    },
    { 
      value: 'frio', 
      label: 'Frío/Congelado', 
      icon: <AcUnit />, 
      description: 'Cámara frigorífica',
      aisleWidth: '3.5m',
      rotation: 'Media'
    },
    { 
      value: 'crossdock', 
      label: 'Cross-docking', 
      icon: <Speed />, 
      description: 'Tránsito rápido, sin stock',
      aisleWidth: '5.0m',
      rotation: 'Máxima'
    }
  ];

  // Opciones de maquinaria
  const machineryTypes = [
    { 
      value: 'frontal', 
      label: 'Carretilla Frontal', 
      aisleWidth: 4.0,
      maxHeight: 6,
      description: 'Económica, versátil',
      icon: '🚜'
    },
    { 
      value: 'retractil', 
      label: 'Retráctil', 
      aisleWidth: 2.8,
      maxHeight: 10,
      description: 'Estándar logística',
      icon: '🔶',
      recommended: true
    },
    { 
      value: 'vna', 
      label: 'VNA (Pasillo Estrecho)', 
      aisleWidth: 1.8,
      maxHeight: 14,
      description: 'Máxima densidad',
      icon: '📍'
    },
    { 
      value: 'trilateral', 
      label: 'Trilateral', 
      aisleWidth: 1.6,
      maxHeight: 16,
      description: 'Automatizado, alta altura',
      icon: '🔺'
    },
    { 
      value: 'apilador', 
      label: 'Apilador Eléctrico', 
      aisleWidth: 2.5,
      maxHeight: 5,
      description: 'Pequeños almacenes',
      icon: '🔋'
    }
  ];

  // Opciones de palet
  const palletTypes = [
    { value: 'europalet', label: 'Europalet', dims: '1200×800mm', icon: '🇪🇺' },
    { value: 'universal', label: 'Universal', dims: '1200×1000mm', icon: '🌍' },
    { value: 'medio', label: 'Medio Palet', dims: '800×600mm', icon: '📦' },
    { value: 'americano', label: 'Americano', dims: '1219×1016mm', icon: '🇺🇸' }
  ];

  const selectedActivity = activityTypes.find(a => a.value === config.activityType);
  const selectedMachinery = machineryTypes.find(m => m.value === config.machinery);
  const selectedPallet = palletTypes.find(p => p.value === config.palletType);

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        ⚙️ Configuración Operativa
      </Typography>

      <Grid container spacing={4}>
        {/* TIPO DE ACTIVIDAD */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>🏭 Tipo de Actividad</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Determina anchos de pasillo recomendados y estrategia de zonificación
            </Typography>
            <ToggleButtonGroup
              value={config.activityType}
              exclusive
              onChange={(_, v) => handleChange('activityType', v)}
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1,
                '& .MuiToggleButton-root': {
                  flex: '1 1 calc(33.333% - 8px)',
                  minWidth: '150px'
                }
              }}
            >
              {activityTypes.map(type => (
                <ToggleButton 
                  key={type.value} 
                  value={type.value}
                  sx={{ 
                    flexDirection: 'column',
                    py: 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.100',
                      borderColor: 'primary.main',
                      '&:hover': { bgcolor: 'primary.200' }
                    }
                  }}
                >
                  <Box sx={{ color: 'primary.main', mb: 1 }}>{type.icon}</Box>
                  <Typography variant="body2" fontWeight={600}>{type.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {type.description}
                  </Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            
            {selectedActivity && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>{selectedActivity.label}</strong>: Pasillo recomendado {selectedActivity.aisleWidth}, 
                rotación {selectedActivity.rotation}
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* MAQUINARIA */}
        <Grid item xs={12} md={7}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>🚜 Maquinaria de Manutención</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Define ancho de pasillo y altura máxima de racks
            </Typography>
            <ToggleButtonGroup
              value={config.machinery}
              exclusive
              onChange={(_, v) => handleChange('machinery', v)}
              orientation="vertical"
              fullWidth
            >
              {machineryTypes.map(machine => (
                <ToggleButton 
                  key={machine.value} 
                  value={machine.value}
                  sx={{ 
                    justifyContent: 'flex-start', 
                    py: 1.5,
                    border: machine.recommended ? '2px solid' : '1px solid',
                    borderColor: machine.recommended ? 'success.main' : 'divider',
                    '&.Mui-selected': {
                      bgcolor: 'primary.100',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  <Typography variant="h5" sx={{ mr: 2, minWidth: 40 }}>{machine.icon}</Typography>
                  <Box sx={{ textAlign: 'left', flex: 1 }}>
                    <Typography variant="body1" fontWeight={600}>
                      {machine.label}
                      {machine.recommended && (
                        <Chip label="RECOMENDADO" size="small" color="success" sx={{ ml: 1 }} />
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {machine.description}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" fontWeight={600}>
                      Pasillo: {machine.aisleWidth}m
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Altura máx: {machine.maxHeight}m
                    </Typography>
                  </Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>
        </Grid>

        {/* TIPO DE PALET Y TRABAJADORES */}
        <Grid item xs={12} md={5}>
          <Grid container spacing={3}>
            {/* TIPO DE PALET */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>📦 Tipo de Palet</Typography>
                <ToggleButtonGroup
                  value={config.palletType}
                  exclusive
                  onChange={(_, v) => handleChange('palletType', v)}
                  fullWidth
                  sx={{ flexWrap: 'wrap' }}
                >
                  {palletTypes.map(pallet => (
                    <ToggleButton 
                      key={pallet.value} 
                      value={pallet.value}
                      sx={{ 
                        flex: '1 1 45%',
                        flexDirection: 'column',
                        py: 1.5,
                        '&.Mui-selected': {
                          bgcolor: 'primary.100'
                        }
                      }}
                    >
                      <Typography variant="h5">{pallet.icon}</Typography>
                      <Typography variant="body2" fontWeight={600}>{pallet.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{pallet.dims}</Typography>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Paper>
            </Grid>

            {/* TRABAJADORES */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>👷 Personal Estimado</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Opcional: para dimensionar oficinas y servicios
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  label="Número de trabajadores"
                  value={config.workers || ''}
                  onChange={(e) => handleChange('workers', parseInt(e.target.value) || null)}
                  placeholder="Auto-calculado si vacío"
                  helperText="Dejar vacío para cálculo automático"
                />
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* RESUMEN */}
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
            <Typography variant="h6" gutterBottom>📊 Resumen de Configuración</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Actividad</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {selectedActivity?.icon} {selectedActivity?.label}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Maquinaria</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {selectedMachinery?.icon} {selectedMachinery?.label}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Ancho Pasillo</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {selectedMachinery?.aisleWidth}m
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography variant="body2" color="text.secondary">Palet</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {selectedPallet?.icon} {selectedPallet?.dims}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
