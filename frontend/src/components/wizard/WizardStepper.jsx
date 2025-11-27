/**
 * UNITNAVE Designer - WizardStepper V5
 * Wizard de 6 pasos con configuración completa
 * 
 * ARCHIVO: frontend/src/components/wizard/WizardStepper.jsx
 * ACCIÓN: REEMPLAZAR contenido completo
 */

import { useState } from 'react';
import { 
  Stepper, Step, StepLabel, Box, Container, Paper,
  Button, Typography, StepConnector, styled, CircularProgress,
  Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowBack, ArrowForward, Rocket,
  Straighten, Settings, Business, LocalShipping, Tune, Visibility
} from '@mui/icons-material';

import Step1Dimensions from './Step1Dimensions';
import Step2Configuration from './Step2Configuration';
import Step3Preview from './Step3Preview';

// Nuevos componentes (se crean inline si no existen)
import Step3Offices from './Step3Offices';
import Step4Docks from './Step4Docks';
import Step5Preferences from './Step5Preferences';

// Conector personalizado
const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
  '& .MuiStepConnector-line': {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.grey[300],
    borderRadius: 1,
  },
  '&.Mui-active .MuiStepConnector-line': {
    backgroundImage: 'linear-gradient(95deg, #2196F3 0%, #21CBF3 100%)',
  },
  '&.Mui-completed .MuiStepConnector-line': {
    backgroundImage: 'linear-gradient(95deg, #4CAF50 0%, #8BC34A 100%)',
  },
}));

// Icono personalizado
const StepIconRoot = styled('div')(({ theme, ownerState }) => ({
  backgroundColor: ownerState.completed ? '#4CAF50' : ownerState.active ? '#2196F3' : theme.palette.grey[300],
  zIndex: 1,
  color: '#fff',
  width: 50,
  height: 50,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  boxShadow: ownerState.active ? '0 4px 10px 0 rgba(33,150,243,.35)' : 'none',
  transition: 'all 0.3s ease',
}));

function ColorlibStepIcon(props) {
  const { active, completed, icon } = props;
  
  const icons = {
    1: <Straighten />,
    2: <Settings />,
    3: <Business />,
    4: <LocalShipping />,
    5: <Tune />,
    6: <Visibility />,
  };

  return (
    <StepIconRoot ownerState={{ completed, active }}>
      {icons[String(icon)]}
    </StepIconRoot>
  );
}

const steps = [
  { label: 'Dimensiones', description: 'Largo, ancho, alto' },
  { label: 'Operativa', description: 'Maquinaria, palets' },
  { label: 'Oficinas', description: 'Ubicación, tamaño' },
  { label: 'Muelles', description: 'Cantidad, posición' },
  { label: 'Preferencias', description: 'Prioridad, tipo' },
  { label: 'Vista Previa', description: 'Resumen final' },
];

export default function WizardStepper({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Dimensiones
    length: 50,
    width: 30,
    height: 10,
    
    // Operativa
    n_docks: 4,
    machinery: 'retractil',
    pallet_type: 'EUR',
    pallet_height: 1.5,
    workers: null,
    activity_type: 'industrial',
    
    // Oficinas (NUEVO)
    officeConfig: {
      area: 40,
      floor: 'mezzanine',
      mezzanineHeight: 3.5,
      hasElevator: true,
      hasStairs: true
    },
    
    // Muelles (NUEVO)
    dockConfig: {
      count: 4,
      position: 'center',
      maneuverZone: 4.0,
      dockWidth: 3.5,
      dockDepth: 4.0
    },
    
    // Preferencias (NUEVO)
    preferences: {
      include_offices: true,
      include_services: true,
      include_docks: true,
      include_technical: true,
      priority: 'balance',
      warehouse_type: 'industrial',
      layout_complexity: 'medio',
      high_rotation_pct: 0.20
    }
  });

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleGenerate();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const updateFormData = (field, value) => {
    if (typeof field === 'object') {
      // Si es un objeto, merge completo
      setFormData(prev => ({ ...prev, ...field }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    
    // Preparar datos finales para el backend
    const finalData = {
      ...formData,
      
      // Mapear officeConfig
      office_floor: formData.officeConfig.floor,
      office_height: formData.officeConfig.mezzanineHeight,
      office_area: formData.officeConfig.area,
      has_elevator: formData.officeConfig.hasElevator,
      
      // Mapear dockConfig
      n_docks: formData.dockConfig.count,
      dock_maneuver_zone: formData.dockConfig.maneuverZone,
      dock_position: formData.dockConfig.position,
      
      // Mapear preferences
      priority: formData.preferences.priority,
      
      // Incluir configs completas para el backend V5
      office_config: {
        area: formData.officeConfig.area,
        floor: formData.officeConfig.floor,
        mezzanine_height: formData.officeConfig.mezzanineHeight,
        has_elevator: formData.officeConfig.hasElevator,
        has_stairs: formData.officeConfig.hasStairs
      },
      dock_config: {
        count: formData.dockConfig.count,
        position: formData.dockConfig.position,
        maneuver_zone: formData.dockConfig.maneuverZone,
        dock_width: formData.dockConfig.dockWidth,
        dock_depth: formData.dockConfig.dockDepth
      },
    };
    
    try {
      await onComplete(finalData);
    } catch (error) {
      console.error('Error en generación:', error);
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step) => {
    switch (step) {
      case 0:
        return formData.length >= 15 && formData.width >= 10 && formData.height >= 4;
      case 1:
        return !!formData.machinery && !!formData.pallet_type;
      case 2:
        return formData.officeConfig.area >= 20;
      case 3:
        return formData.dockConfig.count >= 1;
      case 4:
        return !!formData.preferences.priority;
      case 5:
        return true;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch(activeStep) {
      case 0:
        return <Step1Dimensions data={formData} onChange={updateFormData} />;
      case 1:
        return <Step2Configuration data={formData} onChange={updateFormData} />;
      case 2:
        return <Step3Offices data={formData} onChange={updateFormData} />;
      case 3:
        return <Step4Docks data={formData} onChange={updateFormData} />;
      case 4:
        return <Step5Preferences data={formData} onChange={updateFormData} />;
      case 5:
        return <Step3Preview data={formData} />;  // Reutilizamos Step3Preview como resumen
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        {/* Stepper mejorado */}
        <Stepper 
          activeStep={activeStep} 
          alternativeLabel 
          connector={<ColorlibConnector />}
          sx={{ mb: 4 }}
        >
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel 
                StepIconComponent={ColorlibStepIcon}
                optional={
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                }
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Contenido animado */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        {/* Navegación */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, alignItems: 'center' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack />}
            variant="outlined"
            size="large"
          >
            Atrás
          </Button>
          
          {/* Indicador central */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Paso {activeStep + 1} de {steps.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mx: 2 }}>
              {steps.map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: i < activeStep ? 'success.main' : i === activeStep ? 'primary.main' : 'grey.300',
                    transition: 'all 0.3s'
                  }}
                />
              ))}
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!isStepValid(activeStep) || loading}
            endIcon={activeStep === steps.length - 1 ? (loading ? <CircularProgress size={20} color="inherit" /> : <Rocket />) : <ArrowForward />}
            size="large"
            sx={{
              background: activeStep === steps.length - 1 
                ? 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)'
                : 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              boxShadow: activeStep === steps.length - 1
                ? '0 3px 5px 2px rgba(76, 175, 80, .3)'
                : '0 3px 5px 2px rgba(33, 150, 243, .3)',
            }}
          >
            {activeStep === steps.length - 1 ? (loading ? 'Generando...' : '🚀 Generar Diseño') : 'Siguiente'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
