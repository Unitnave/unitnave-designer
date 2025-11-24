import { useState } from 'react';
import { 
  Grid, Paper, Typography, Box, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Card, CardContent
} from '@mui/material';
import { CompareArrows, TrendingUp, Speed, Euro } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import ScenarioCard from './ScenarioCard';

export default function ScenarioComparator({ scenarios, onSelect }) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [comparisonMode, setComparisonMode] = useState(true);

  if (!scenarios || Object.keys(scenarios).length === 0) {
    return null;
  }

  const scenarioKeys = Object.keys(scenarios);
  const scenarioData = scenarioKeys.map(key => ({
    key,
    name: key.replace('Option_', '').replace(/_/g, ' '),
    data: scenarios[key]
  }));

  // Extraer métricas para comparación
  const getMetrics = (scenario) => ({
    capacity: scenario.data.capacity.total_pallets,
    efficiency: scenario.data.surfaces.efficiency,
    storage_area: scenario.data.surfaces.storage_area,
    circulation: scenario.data.surfaces.circulation_area,
    machinery: scenario.data.metadata.machinery,
    aisle_width: scenario.data.metadata.aisle_width,
    warnings: scenario.data.validations.filter(v => v.type === 'warning').length,
    errors: scenario.data.validations.filter(v => v.type === 'error').length
  });

  const renderComparisonTable = () => (
    <TableContainer component={Paper} sx={{ mt: 3 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell><strong>Métrica</strong></TableCell>
            {scenarioData.map(scenario => (
              <TableCell key={scenario.key} align="center">
                <Chip 
                  label={scenario.name} 
                  color="primary" 
                  variant={selectedTab === scenarioKeys.indexOf(scenario.key) ? 'filled' : 'outlined'}
                />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>📦 Capacidad Total</TableCell>
            {scenarioData.map(scenario => {
              const metrics = getMetrics(scenario);
              const isMax = metrics.capacity === Math.max(...scenarioData.map(s => getMetrics(s).capacity));
              return (
                <TableCell key={scenario.key} align="center">
                  <Typography 
                    variant="h6" 
                    fontWeight={700}
                    color={isMax ? 'success.main' : 'text.primary'}
                  >
                    {metrics.capacity.toLocaleString()}
                    {isMax && ' 🏆'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">palets</Typography>
                </TableCell>
              );
            })}
          </TableRow>

          <TableRow>
            <TableCell>📊 Eficiencia</TableCell>
            {scenarioData.map(scenario => {
              const metrics = getMetrics(scenario);
              const isMax = metrics.efficiency === Math.max(...scenarioData.map(s => getMetrics(s).efficiency));
              return (
                <TableCell key={scenario.key} align="center">
                  <Typography 
                    variant="h6" 
                    fontWeight={700}
                    color={isMax ? 'success.main' : 'text.primary'}
                  >
                    {metrics.efficiency.toFixed(1)}%
                    {isMax && ' 🏆'}
                  </Typography>
                </TableCell>
              );
            })}
          </TableRow>

          <TableRow>
            <TableCell>🏢 Área Almacenamiento</TableCell>
            {scenarioData.map(scenario => {
              const metrics = getMetrics(scenario);
              return (
                <TableCell key={scenario.key} align="center">
                  <Typography variant="body1" fontWeight={600}>
                    {metrics.storage_area.toFixed(0)} m²
                  </Typography>
                </TableCell>
              );
            })}
          </TableRow>

          <TableRow>
            <TableCell>🚜 Ancho Pasillo</TableCell>
            {scenarioData.map(scenario => {
              const metrics = getMetrics(scenario);
              const isMin = metrics.aisle_width === Math.min(...scenarioData.map(s => getMetrics(s).aisle_width));
              return (
                <TableCell key={scenario.key} align="center">
                  <Typography 
                    variant="body1" 
                    fontWeight={600}
                    color={isMin ? 'success.main' : 'text.primary'}
                  >
                    {metrics.aisle_width}m
                    {isMin && ' ⚡'}
                  </Typography>
                </TableCell>
              );
            })}
          </TableRow>

          <TableRow>
            <TableCell>🚨 Validaciones</TableCell>
            {scenarioData.map(scenario => {
              const metrics = getMetrics(scenario);
              return (
                <TableCell key={scenario.key} align="center">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    {metrics.errors > 0 && (
                      <Chip label={`${metrics.errors} errores`} color="error" size="small" />
                    )}
                    {metrics.warnings > 0 && (
                      <Chip label={`${metrics.warnings} avisos`} color="warning" size="small" />
                    )}
                    {metrics.errors === 0 && metrics.warnings === 0 && (
                      <Chip label="✓ OK" color="success" size="small" />
                    )}
                  </Box>
                </TableCell>
              );
            })}
          </TableRow>

          <TableRow>
            <TableCell>💰 Inversión Estimada</TableCell>
            {scenarioData.map(scenario => {
              const metrics = getMetrics(scenario);
              const cost = {
                'transpaleta': '€',
                'apilador': '€€',
                'retractil': '€€€',
                'contrapesada': '€€€€',
                'trilateral': '€€€€€'
              }[metrics.machinery] || '€€€';
              
              return (
                <TableCell key={scenario.key} align="center">
                  <Typography variant="h6" fontWeight={700}>
                    {cost}
                  </Typography>
                </TableCell>
              );
            })}
          </TableRow>

          <TableRow>
            <TableCell></TableCell>
            {scenarioData.map((scenario, idx) => (
              <TableCell key={scenario.key} align="center">
                <Button
                  variant={selectedTab === idx ? 'contained' : 'outlined'}
                  onClick={() => {
                    setSelectedTab(idx);
                    onSelect && onSelect(scenario.data);
                  }}
                  fullWidth
                >
                  Seleccionar
                </Button>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderCards = () => (
    <Grid container spacing={3} sx={{ mt: 2 }}>
      {scenarioData.map((scenario, idx) => (
        <Grid item xs={12} md={4} key={scenario.key}>
          <ScenarioCard
            scenario={scenario}
            isSelected={selectedTab === idx}
            onSelect={() => {
              setSelectedTab(idx);
              onSelect && onSelect(scenario.data);
            }}
          />
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box sx={{ mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={600}>
            🔄 Comparación de Escenarios
          </Typography>
          <Button
            startIcon={<CompareArrows />}
            onClick={() => setComparisonMode(!comparisonMode)}
            variant="outlined"
          >
            {comparisonMode ? 'Ver Tarjetas' : 'Ver Tabla'}
          </Button>
        </Box>

        <AnimatePresence mode="wait">
          <motion.div
            key={comparisonMode ? 'table' : 'cards'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {comparisonMode ? renderComparisonTable() : renderCards()}
          </motion.div>
        </AnimatePresence>

        {/* Recomendación */}
        <Card sx={{ mt: 3, bgcolor: 'info.50', border: '2px solid', borderColor: 'info.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight={600} color="info.main">
              💡 Recomendación UNITNAVE
            </Typography>
            <Typography variant="body1">
              Para la mayoría de proyectos, recomendamos <strong>Opción B - Retráctil</strong> 
              por su equilibrio óptimo entre capacidad, coste y flexibilidad operativa. 
              VNA Trilateral maximiza capacidad pero requiere mayor inversión inicial.
            </Typography>
          </CardContent>
        </Card>
      </Paper>
    </Box>
  );
}