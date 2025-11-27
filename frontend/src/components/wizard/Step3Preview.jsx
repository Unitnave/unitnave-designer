/**
 * UNITNAVE Designer - Step6Preview
 * Vista previa final antes de generar
 * 
 * UBICACIÓN: frontend/src/components/wizard/Step6Preview.jsx
 */

import { 
  Grid, Typography, Box, Paper, Divider,
  List, ListItem, ListItemIcon, ListItemText,
  Alert, Chip, LinearProgress
} from '@mui/material';
import { 
  Straighten, Height, LocalShipping, Settings,
  Business, Inventory, People, CheckCircle, Warning,
  Speed, Balance
} from '@mui/icons-material';

export default function Step6Preview({ data }) {
  // Cálculos
  const totalArea = data.length * data.width;
  const volume = totalArea * data.height;
  
  // Oficinas
  const officeConfig = data.officeConfig || { area: 40, floor: 'mezzanine' };
  const officeArea = officeConfig.floor === 'mezzanine' ? 0 : officeConfig.area;
  
  // Muelles
  const dockConfig = data.dockConfig || { count: 4, maneuverZone: 4, dockWidth: 3.5, dockDepth: 4 };
  const dockArea = dockConfig.count * dockConfig.dockWidth * (dockConfig.dockDepth + dockConfig.maneuverZone);
  
  // Preferencias
  const prefs = data.preferences || { priority: 'balance', warehouse_type: 'industrial' };
  
  // Disponible
  const fixedArea = officeArea + dockArea + (prefs.include_services ? 60 : 0) + (prefs.include_technical ? 20 : 0);
  const availableArea = totalArea - fixedArea;
  const storagePercentage = (availableArea / totalArea * 100).toFixed(1);
  
  // Estimaciones
  const palletHeight = data.pallet_height || 1.5;
  const levelHeight = palletHeight + 0.25;
  const maxLevels = Math.floor((data.height - 0.5) / levelHeight);
  const estimatedPallets = Math.floor(availableArea * 0.55 / 1.2 * maxLevels);
  
  // Trabajadores
  const workers = data.workers || Math.max(10, Math.floor(totalArea / 80));

  // Verificaciones
  const checks = [
    { label: 'Dimensiones válidas', ok: data.length >= 15 && data.width >= 10 && data.height >= 4, detail: `${data.length}×${data.width}×${data.height}m` },
    { label: 'Maquinaria seleccionada', ok: !!data.machinery, detail: data.machinery },
    { label: 'Muelles configurados', ok: dockConfig.count >= 1, detail: `${dockConfig.count} muelles` },
    { label: 'Oficinas configuradas', ok: officeConfig.area >= 20, detail: `${officeConfig.area}m² en ${officeConfig.floor}` },
    { label: 'Espacio suficiente', ok: parseFloat(storagePercentage) >= 50, detail: `${storagePercentage}% disponible` }
  ];
  const allChecksOk = checks.every(c => c.ok);

  const priorityLabels = { capacity: 'Máxima Capacidad', balance: 'Equilibrado', operations: 'Operativa Rápida' };
  const typeLabels = { industrial: 'Industrial', ecommerce: 'E-commerce', '3pl': '3PL', almacen_masivo: 'Almacén Masivo', crossdock: 'Cross-dock', frio: 'Cámara Fría' };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        👁️ Vista Previa - Resumen Final
      </Typography>

      <Grid container spacing={3}>
        {/* NAVE */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>🏭 La Nave</Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><Straighten color="primary" /></ListItemIcon>
                <ListItemText primary="Dimensiones" secondary={`${data.length}m × ${data.width}m × ${data.height}m`} />
              </ListItem>
              <ListItem>
                <ListItemIcon><Height color="primary" /></ListItemIcon>
                <ListItemText primary="Superficie / Volumen" secondary={`${totalArea.toLocaleString()}m² / ${volume.toLocaleString()}m³`} />
              </ListItem>
              <ListItem>
                <ListItemIcon><Settings color="primary" /></ListItemIcon>
                <ListItemText primary="Maquinaria" secondary={data.machinery} />
              </ListItem>
              <ListItem>
                <ListItemIcon><Inventory color="primary" /></ListItemIcon>
                <ListItemText primary="Palet" secondary={`${data.pallet_type} (altura ${palletHeight}m)`} />
              </ListItem>
              <ListItem>
                <ListItemIcon><People color="primary" /></ListItemIcon>
                <ListItemText primary="Trabajadores" secondary={workers} />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* CONFIGURACIÓN */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>⚙️ Configuración</Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Oficinas</Typography>
              <Typography variant="body2">
                {officeConfig.area}m² en {officeConfig.floor === 'mezzanine' ? 'entreplanta' : officeConfig.floor === 'ground' ? 'planta baja' : 'ambas plantas'}
                {officeConfig.hasElevator && ' + ascensor'}
              </Typography>
            </Box>
            
            <Divider sx={{ my: 1.5 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Muelles</Typography>
              <Typography variant="body2">
                {dockConfig.count} muelles ({dockConfig.dockWidth}×{dockConfig.dockDepth}m) - Zona: {dockConfig.maneuverZone}m
              </Typography>
            </Box>
            
            <Divider sx={{ my: 1.5 }} />
            
            <Box>
              <Typography variant="subtitle2" color="text.secondary">Optimización</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Chip 
                  icon={prefs.priority === 'capacity' ? <Inventory /> : prefs.priority === 'operations' ? <Speed /> : <Balance />}
                  label={priorityLabels[prefs.priority]} 
                  color="primary" 
                  size="small" 
                />
                <Chip label={typeLabels[prefs.warehouse_type]} size="small" />
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* ESTIMACIONES */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.200' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>📊 Estimaciones de Capacidad</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={800} color="primary">{availableArea.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">m² almacenamiento</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={800} color="success.main">{storagePercentage}%</Typography>
                  <Typography variant="body2" color="text.secondary">eficiencia estimada</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={800} color="secondary.main">{maxLevels}</Typography>
                  <Typography variant="body2" color="text.secondary">niveles estanterías</Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={800} color="warning.main">~{estimatedPallets.toLocaleString()}</Typography>
                  <Typography variant="body2" color="text.secondary">palets estimados</Typography>
                </Box>
              </Grid>
            </Grid>
            
            <Alert severity="info" sx={{ mt: 2 }}>
              El optimizador evaluará <strong>5-8 escenarios diferentes</strong> y seleccionará el mejor según tu prioridad ({priorityLabels[prefs.priority]})
            </Alert>
          </Paper>
        </Grid>

        {/* VERIFICACIONES */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>✅ Verificaciones</Typography>
            
            <Grid container spacing={1}>
              {checks.map((check, i) => (
                <Grid item xs={12} md={6} key={i}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: check.ok ? 'success.50' : 'warning.50', borderRadius: 1 }}>
                    {check.ok ? <CheckCircle color="success" /> : <Warning color="warning" />}
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{check.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{check.detail}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
            
            {allChecksOk ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                ✅ Todo listo. Haz clic en <strong>"Generar Diseño"</strong> para optimizar.
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                ⚠️ Revisa las verificaciones marcadas antes de continuar.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* PROCESO */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>🔄 Proceso de Optimización</Typography>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              {['Generar escenarios', 'Evaluar fitness', 'Seleccionar mejor', 'Calcular métricas', 'Generar informe'].map((step, i) => (
                <Chip key={i} label={`${i+1}. ${step}`} variant="outlined" />
              ))}
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              El optimizador generará múltiples configuraciones de layout, evaluará cada una con un sistema de puntuación multi-criterio, y seleccionará la mejor opción junto con 2 alternativas.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
