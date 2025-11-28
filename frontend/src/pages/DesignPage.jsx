import { useState, useRef } from 'react';
import { Container, Box, CircularProgress, Alert, Snackbar, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

import Header from '../components/layout/Header';
import WizardStepper from '../components/wizard/WizardStepper';
import MetricsCards from '../components/dashboard/MetricsCards';
import CapacityChart from '../components/dashboard/CapacityChart';
import EfficiencyGauge from '../components/dashboard/EfficiencyGauge';
import ValidationPanel from '../components/dashboard/ValidationPanel';
import ScenarioComparator from '../components/scenarios/ScenarioComparator';
import Warehouse3DViewer from '../components/viewer/Warehouse3DViewer';
import ExportButton from '../components/export/ExportButton';

import useOptimizer from '../hooks/useOptimizer';
import useWarehouseDesign from '../hooks/useWarehouseDesign';

export default function DesignPage() {
  const { optimizeScenarios, loading, error } = useOptimizer();
  const { designState, updateFormData, startOptimization, setOptimizationResult, selectScenario } = useWarehouseDesign();
  
  const [showScenarios, setShowScenarios] = useState(false);
  const [scenarios, setScenarios] = useState(null);
  const canvasRef = useRef(null);

  /**
   * handleComplete recibe el resultado de la optimización del WizardStepper
   * @param {Object} result - Resultado de la API (con status, elements, capacity, etc.)
   * @param {Object} apiPayload - Payload que se envió a la API (ya transformado)
   */
  const handleComplete = async (result, apiPayload) => {
    // El wizard YA hizo la optimización, recibimos el resultado directamente
    if (result && result.status === 'success') {
      updateFormData(apiPayload || {});
      startOptimization();
      setOptimizationResult(result, apiPayload || {});
      
      // Generar multi-escenario en background usando el payload ya transformado
      if (apiPayload) {
        try {
          const scenariosData = await optimizeScenarios(apiPayload);
          setScenarios(scenariosData);
          setShowScenarios(true);
        } catch (err) {
          console.error('Error generando escenarios:', err);
          // No bloqueamos si falla, el resultado principal ya está
        }
      }
    } else {
      console.error('Optimización fallida:', result);
    }
  };

  const handleExport = () => {
    if (designState.optimizationResult && canvasRef.current) {
      const { formData, optimizationResult } = designState;
      generateWarehousePDF({
        dimensions: formData,
        capacity: optimizationResult.capacity,
        surfaces: optimizationResult.surfaces,
        validations: optimizationResult.validations
      }, canvasRef.current);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header onExport={handleExport} onShare={() => alert('Compartir (próximamente)')} />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <AnimatePresence mode="wait">
          {designState.currentStep === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <WizardStepper onComplete={handleComplete} />
            </motion.div>
          )}

          {designState.currentStep === 'optimizing' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: '60vh' 
              }}
            >
              <CircularProgress size={80} />
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>
                  🚀 Optimizando diseño...
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Generando layout, calculando capacidad y validando normativas
                </Typography>
              </Box>
            </motion.div>
          )}

          {designState.currentStep === 'results' && designState.optimizationResult && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Comparador de Escenarios */}
              {showScenarios && scenarios && (
                <ScenarioComparator 
                  scenarios={scenarios} 
                  onSelect={selectScenario}
                />
              )}

              {/* Métricas */}
              <MetricsCards 
                capacity={designState.optimizationResult.capacity}
                surfaces={designState.optimizationResult.surfaces}
              />

              {/* Visualizador 3D */}
              <Box ref={canvasRef} sx={{ mb: 3 }}>
                <Warehouse3DViewer />
              </Box>

              {/* Gráficos y Validaciones */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 3 }}>
                <CapacityChart capacity={designState.optimizationResult.capacity} />
                <EfficiencyGauge efficiency={designState.optimizationResult.surfaces.efficiency} />
              </Box>

              <ValidationPanel validations={designState.optimizationResult.validations} />

              {/* Botón Export */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <ExportButton 
                  warehouseData={{
                    dimensions: designState.formData,
                    capacity: designState.optimizationResult.capacity,
                    surfaces: designState.optimizationResult.surfaces,
                    validations: designState.optimizationResult.validations
                  }}
                  canvasElement={canvasRef.current}
                />
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snackbar de errores */}
        <Snackbar open={!!error} autoHideDuration={6000}>
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}
