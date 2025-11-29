/**
 * UNITNAVE Designer - Step6Preview
 * Vista previa de configuración y ejecución de optimización
 * 
 * ARCHIVO: frontend/src/components/wizard/Step6Preview.jsx
 */

import { useState } from 'react';
import { 
  Grid, Typography, Box, Paper, Alert, Button, Chip,
  CircularProgress, Divider, LinearProgress
} from '@mui/material';
import { 
  PlayArrow, CheckCircle, Warning, Info,
  Inventory, Speed, Layers, LocalShipping,
  Assessment, PictureAsPdf
} from '@mui/icons-material';
import DetailedReport from '../DetailedReport';

export default function Step6Preview({ data, onOptimize, isLoading, result }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Extraer datos de configuración
  const {
    length = 80,
    width = 40,
    height = 10,
    activityType = 'industrial',
    machinery = 'retractil',
    palletType = 'europalet',
    officeConfig = {},
    dockConfig = {},
    preferences = {}
  } = data;

  const totalArea = length * width;
  const totalVolume = totalArea * height;

  // Estimaciones
  const estimatedPallets = Math.floor(totalArea / 1.5);
  const estimatedTime = preferences.enable_abc_zones ? '15-25 seg' : '5-10 seg';

  // Validaciones
  const validations = [];
  
  if (totalArea < 400 && preferences.enable_abc_zones) {
    validations.push({
      type: 'warning',
      message: `ABC Zoning se desactivará automáticamente (área ${totalArea}m² < 400m² mínimo)`
    });
  }
  
  if (dockConfig.count > 10) {
    validations.push({
      type: 'info',
      message: `${dockConfig.count} muelles es una configuración de alta capacidad`
    });
  }

  if (height >= 12 && machinery !== 'vna' && machinery !== 'trilateral') {
    validations.push({
      type: 'info',
      message: `Con ${height}m de altura, considera maquinaria VNA para aprovechar el espacio vertical`
    });
  }

  // Configuración final a enviar
  const configSummary = {
    dimensions: { length, width, height },
    area: totalArea,
    volume: totalVolume,
    activityType,
    machinery,
    palletType,
    offices: officeConfig.include ? `${officeConfig.area}m² (${officeConfig.floor})` : 'No',
    docks: dockConfig.count || 4,
    priority: preferences.priority || 'balance',
    warehouseType: preferences.warehouse_type || activityType,
    abcEnabled: preferences.enable_abc_zones || false,
    abcZones: preferences.enable_abc_zones ? {
      A: `${(preferences.abc_zone_a_pct * 100).toFixed(0)}%`,
      B: `${(preferences.abc_zone_b_pct * 100).toFixed(0)}%`,
      C: `${(preferences.abc_zone_c_pct * 100).toFixed(0)}%`
    } : null
  };

  const handleOptimize = () => {
    if (onOptimize) {
      onOptimize(data);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        🚀 Vista Previa y Optimización
      </Typography>

      <Grid container spacing={4}>
        {/* RESUMEN DE CONFIGURACIÓN */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>📋 Resumen de Configuración</Typography>
            
            <Grid container spacing={2}>
              {/* Dimensiones */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  DIMENSIONES
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip label={`${length}m × ${width}m × ${height}m`} />
                  <Chip label={`${totalArea.toLocaleString()}m²`} color="primary" />
                  <Chip label={`${totalVolume.toLocaleString()}m³`} variant="outlined" />
                </Box>
              </Grid>
              
              <Grid item xs={12}><Divider /></Grid>
              
              {/* Operativa */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  CONFIGURACIÓN OPERATIVA
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Actividad:</strong> {activityType}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Maquinaria:</strong> {machinery}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Palet:</strong> {palletType}
                  </Typography>
                </Box>
              </Grid>
              
              {/* Instalaciones */}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  INSTALACIONES
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Oficinas:</strong> {configSummary.offices}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Muelles:</strong> {configSummary.docks}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Prioridad:</strong> {configSummary.priority}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12}><Divider /></Grid>
              
              {/* Optimización */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  MODO DE OPTIMIZACIÓN
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {configSummary.abcEnabled ? (
                    <>
                      <Chip 
                        icon={<Layers />} 
                        label="ABC Zoning Activo" 
                        color="success" 
                        sx={{ fontWeight: 700 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Zona A: {configSummary.abcZones.A} | 
                        Zona B: {configSummary.abcZones.B} | 
                        Zona C: {configSummary.abcZones.C}
                      </Typography>
                    </>
                  ) : (
                    <Chip 
                      icon={<Inventory />} 
                      label="Modo Uniforme" 
                      variant="outlined"
                    />
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* PANEL DE ESTIMACIONES */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, bgcolor: 'primary.50' }}>
            <Typography variant="h6" gutterBottom>📊 Estimaciones</Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Capacidad estimada</Typography>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  ~{estimatedPallets.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">palets</Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Escenarios a evaluar</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {configSummary.abcEnabled ? '15-20' : '5-8'}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Tiempo estimado</Typography>
                <Typography variant="h5" fontWeight={700}>
                  {estimatedTime}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* VALIDACIONES */}
        {validations.length > 0 && (
          <Grid item xs={12}>
            {validations.map((v, i) => (
              <Alert 
                key={i} 
                severity={v.type} 
                sx={{ mb: 1 }}
                icon={v.type === 'warning' ? <Warning /> : <Info />}
              >
                {v.message}
              </Alert>
            ))}
          </Grid>
        )}

        {/* BOTÓN DE OPTIMIZAR */}
        <Grid item xs={12}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              textAlign: 'center',
              bgcolor: isLoading ? 'grey.100' : 'success.50',
              border: '2px solid',
              borderColor: isLoading ? 'grey.300' : 'success.main'
            }}
          >
            {isLoading ? (
              <Box>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Optimizando diseño...
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Evaluando {configSummary.abcEnabled ? '15-20' : '5-8'} escenarios con fitness multi-criterio
                </Typography>
                <LinearProgress sx={{ mt: 2, maxWidth: 400, mx: 'auto' }} />
              </Box>
            ) : result ? (
              <Box>
                <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h5" gutterBottom color="success.main" fontWeight={700}>
                  ¡Optimización Completada!
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {result.capacity?.total_pallets?.toLocaleString() || '---'} palets | 
                  {result.metadata?.scenarios_evaluated || '---'} escenarios evaluados
                </Typography>
                {result.metadata?.comparative_analysis && (
                  <Alert severity="success" sx={{ mt: 2, maxWidth: 500, mx: 'auto' }}>
                    <strong>Mejora ABC:</strong> +{result.metadata.comparative_analysis.gain_pallets} palets 
                    ({result.metadata.comparative_analysis.gain_percentage}%) vs diseño uniforme
                  </Alert>
                )}
              </Box>
            ) : (
              <Box>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={handleOptimize}
                  sx={{ 
                    py: 2, 
                    px: 6, 
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    boxShadow: 4
                  }}
                >
                  🚀 OPTIMIZAR DISEÑO
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  El optimizador evaluará múltiples escenarios y seleccionará el mejor diseño
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* RESULTADO DETALLADO */}
        {result && (
          <Grid item xs={12}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>📈 Resultado Detallado</Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.50', borderRadius: 2 }}>
                    <Inventory color="primary" sx={{ fontSize: 40 }} />
                    <Typography variant="h4" fontWeight={700}>
                      {result.capacity?.total_pallets?.toLocaleString() || '---'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Palets totales</Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
                    <Speed color="success" sx={{ fontSize: 40 }} />
                    <Typography variant="h4" fontWeight={700}>
                      {result.metadata?.fitness?.efficiency?.toFixed(1) || '---'}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Eficiencia</Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
                    <Layers color="info" sx={{ fontSize: 40 }} />
                    <Typography variant="h4" fontWeight={700}>
                      {result.metadata?.scenarios_evaluated || '---'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Escenarios</Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
                    <LocalShipping color="warning" sx={{ fontSize: 40 }} />
                    <Typography variant="h4" fontWeight={700}>
                      {result.metadata?.fitness?.normalized_score?.toFixed(0) || '---'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Score</Typography>
                  </Box>
                </Grid>
              </Grid>
              
              {/* Escenario ganador */}
              {result.metadata?.scenario_name && (
                <Alert severity="info" sx={{ mt: 3 }}>
                  <strong>Escenario ganador:</strong> {result.metadata.scenario_name}
                  {result.metadata.scenario_config && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Orientación: {result.metadata.scenario_config.orientation} | 
                      Pasillos: {result.metadata.scenario_config.aisle_strategy}
                    </Typography>
                  )}
                </Alert>
              )}
              
              {/* Alternativas */}
              {result.metadata?.alternatives?.length > 1 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>Alternativas evaluadas:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {result.metadata.alternatives.slice(1).map((alt, i) => (
                      <Chip 
                        key={i}
                        label={`${alt.name}: ${alt.pallets} palets (${alt.efficiency?.toFixed(1)}%)`}
                        variant="outlined"
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* BOTÓN DE INFORME DETALLADO */}
              <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<Assessment />}
                  onClick={() => setShowReport(true)}
                  sx={{ fontWeight: 600 }}
                >
                  📋 Ver Informe Detallado
                </Button>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* MODAL DE INFORME DETALLADO */}
      {showReport && (
        <DetailedReport 
          warehouseData={{
            length: data.length,
            width: data.width,
            height: data.height,
            n_docks: data.dockConfig?.count || 4,
            machinery: data.machinery,
            pallet_type: data.palletType,
            activity_type: data.activityType,
            preferences: {
              enable_abc_zones: data.preferences?.enable_abc_zones || false,
              abc_zone_a_pct: data.preferences?.abc_zone_a_pct || 0.2,
              abc_zone_b_pct: data.preferences?.abc_zone_b_pct || 0.3,
              abc_zone_c_pct: data.preferences?.abc_zone_c_pct || 0.5,
              priority: data.preferences?.priority || 'balance',
              warehouse_type: data.preferences?.warehouse_type || data.activityType
            }
          }}
          onClose={() => setShowReport(false)}
        />
      )}
    </Box>
  );
}
