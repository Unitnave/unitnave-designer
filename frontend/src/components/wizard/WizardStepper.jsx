/**
 * UNITNAVE Designer - WizardStepper
 * Controlador principal del wizard de 6 pasos
 * 
 * ARCHIVO: frontend/src/components/wizard/WizardStepper.jsx
 */

import { useState, useCallback } from 'react';
import { 
  Box, Stepper, Step, StepLabel, StepContent,
  Button, Paper, Typography, Alert, useTheme, useMediaQuery
} from '@mui/material';
import { 
  NavigateNext, NavigateBefore, Check, 
  Straighten, Settings, Business, LocalShipping, Tune, PlayArrow
} from '@mui/icons-material';

// Importar configuración de API
import { API_URL } from '../../config';

// Importar pasos
import Step1Dimensions from './Step1Dimensions';
import Step2Configuration from './Step2Configuration';
import Step3Offices from './Step3Offices';
import Step4Docks from './Step4Docks';
import Step5Preferences from './Step5Preferences';
import Step6Preview from './Step6Preview';

// Definición de pasos
const STEPS = [
  { 
    label: 'Dimensiones', 
    description: 'Largo, ancho y alto de la nave',
    icon: <Straighten />,
    component: Step1Dimensions
  },
  { 
    label: 'Configuración', 
    description: 'Tipo de actividad y maquinaria',
    icon: <Settings />,
    component: Step2Configuration
  },
  { 
    label: 'Oficinas', 
    description: 'Zona administrativa y servicios',
    icon: <Business />,
    component: Step3Offices
  },
  { 
    label: 'Muelles', 
    description: 'Carga, descarga y expedición',
    icon: <LocalShipping />,
    component: Step4Docks
  },
  { 
    label: 'Preferencias', 
    description: 'Prioridades y ABC Zoning',
    icon: <Tune />,
    component: Step5Preferences
  },
  { 
    label: 'Optimizar', 
    description: 'Vista previa y ejecución',
    icon: <PlayArrow />,
    component: Step6Preview
  }
];

export default function WizardStepper({ onComplete, initialData = {} }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Estado consolidado del wizard
  const [wizardData, setWizardData] = useState({
    // Step 1: Dimensiones
    length: initialData.length || 80,
    width: initialData.width || 40,
    height: initialData.height || 10,
    
    // Step 2: Configuración
    activityType: initialData.activityType || 'industrial',
    machinery: initialData.machinery || 'retractil',
    palletType: initialData.palletType || 'europalet',
    workers: initialData.workers || null,
    
    // Step 3: Oficinas
    officeConfig: initialData.officeConfig || {
      include: true,
      area: 40,
      floor: 'mezzanine',
      mezzanineHeight: 3.5,
      hasElevator: true,
      position: 'front_left'
    },
    
    // Step 4: Muelles
    dockConfig: initialData.dockConfig || {
      count: 4,
      position: 'front',
      dockWidth: 3.5,
      maneuverDepth: 4.0,
      includeExpedition: true,
      expeditionDepth: 8,
      crossDocking: false
    },
    
    // Step 5: Preferencias
    preferences: initialData.preferences || {
      include_offices: true,
      include_services: true,
      include_docks: true,
      include_technical: true,
      priority: 'balance',
      warehouse_type: 'industrial',
      layout_complexity: 'medio',
      enable_abc_zones: false,
      abc_zone_a_pct: 0.20,
      abc_zone_b_pct: 0.40,
      abc_zone_c_pct: 0.40,
      high_rotation_pct: 0.20
    }
  });

  // Actualizar datos desde los pasos
  const handleStepChange = useCallback((stepData) => {
    setWizardData(prev => ({
      ...prev,
      ...stepData
    }));
  }, []);

  // Navegación
  const handleNext = () => {
    setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  const handleStepClick = (index) => {
    // Permitir navegar a pasos anteriores o al actual
    if (index <= activeStep) {
      setActiveStep(index);
    }
  };

  // Ejecutar optimización
  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Mapeo de tipos de palet (frontend → backend)
      const palletTypeMap = {
        'europalet': 'EUR',
        'universal': 'US',
        'medio': 'EUR',
        'americano': 'US'
      };
      
      // Construir payload para API
      const payload = {
        length: wizardData.length,
        width: wizardData.width,
        height: wizardData.height,
        activity_type: wizardData.activityType,
        machinery: wizardData.machinery,
        pallet_type: palletTypeMap[wizardData.palletType] || 'EUR',
        workers: wizardData.workers,
        n_docks: wizardData.dockConfig?.count || 4,
        
        // Configuración de oficinas
        office_config: wizardData.officeConfig?.include ? {
          area: wizardData.officeConfig.area,
          floor: wizardData.officeConfig.floor,
          mezzanine_height: wizardData.officeConfig.mezzanineHeight,
          has_elevator: wizardData.officeConfig.hasElevator,
          position: wizardData.officeConfig.position
        } : null,
        
        // Configuración de muelles
        dock_config: {
          count: wizardData.dockConfig?.count || 4,
          position: wizardData.dockConfig?.position || 'front',
          dock_width: wizardData.dockConfig?.dockWidth || 3.5,
          maneuver_depth: wizardData.dockConfig?.maneuverDepth || 4.0,
          include_expedition: wizardData.dockConfig?.includeExpedition !== false,
          expedition_depth: wizardData.dockConfig?.expeditionDepth || 8
        },
        
        // Preferencias
        preferences: {
          include_offices: wizardData.preferences?.include_offices !== false,
          include_services: wizardData.preferences?.include_services !== false,
          include_docks: wizardData.preferences?.include_docks !== false,
          include_technical: wizardData.preferences?.include_technical !== false,
          priority: wizardData.preferences?.priority || 'balance',
          warehouse_type: wizardData.preferences?.warehouse_type || wizardData.activityType,
          enable_abc_zones: wizardData.preferences?.enable_abc_zones || false,
          abc_zone_a_pct: wizardData.preferences?.abc_zone_a_pct || 0.20,
          abc_zone_b_pct: wizardData.preferences?.abc_zone_b_pct || 0.40,
          abc_zone_c_pct: wizardData.preferences?.abc_zone_c_pct || 0.40,
          high_rotation_pct: wizardData.preferences?.high_rotation_pct || 0.20
        }
      };

      // Llamar a API con URL completa
      const response = await fetch(`${API_URL}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
      
      // Callback al padre
      if (onComplete) {
        onComplete(data);
      }
      
    } catch (err) {
      console.error('Error en optimización:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar paso actual
  const renderStepContent = () => {
    const StepComponent = STEPS[activeStep].component;
    
    // Paso 6 tiene props especiales
    if (activeStep === 5) {
      return (
        <StepComponent 
          data={wizardData}
          onChange={handleStepChange}
          onOptimize={handleOptimize}
          isLoading={isLoading}
          result={result}
        />
      );
    }
    
    return (
      <StepComponent 
        data={wizardData}
        onChange={handleStepChange}
      />
    );
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          🏭 UNITNAVE Designer V5
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Optimizador de layouts para naves industriales
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper 
        activeStep={activeStep} 
        orientation={isMobile ? 'vertical' : 'horizontal'}
        sx={{ mb: 4 }}
      >
        {STEPS.map((step, index) => (
          <Step 
            key={step.label}
            onClick={() => handleStepClick(index)}
            sx={{ cursor: index <= activeStep ? 'pointer' : 'default' }}
          >
            <StepLabel
              StepIconComponent={() => (
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: index <= activeStep ? 'primary.main' : 'grey.300',
                    color: 'white',
                    transition: 'all 0.3s'
                  }}
                >
                  {index < activeStep ? <Check /> : step.icon}
                </Box>
              )}
            >
              <Typography 
                variant="body2" 
                fontWeight={index === activeStep ? 700 : 400}
                color={index <= activeStep ? 'text.primary' : 'text.secondary'}
              >
                {step.label}
              </Typography>
              {!isMobile && (
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
              )}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Contenido del paso */}
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, mb: 4 }}>
        {renderStepContent()}
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Navegación */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<NavigateBefore />}
          onClick={handleBack}
          disabled={activeStep === 0 || isLoading}
        >
          Anterior
        </Button>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Indicador de progreso */}
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ alignSelf: 'center' }}
          >
            Paso {activeStep + 1} de {STEPS.length}
          </Typography>
          
          {activeStep < STEPS.length - 1 && (
            <Button
              variant="contained"
              endIcon={<NavigateNext />}
              onClick={handleNext}
              disabled={isLoading}
            >
              Siguiente
            </Button>
          )}
        </Box>
      </Box>

      {/* Datos debug (solo desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <Paper 
          elevation={0} 
          sx={{ mt: 4, p: 2, bgcolor: 'grey.100', maxHeight: 200, overflow: 'auto' }}
        >
          <Typography variant="caption" component="pre">
            {JSON.stringify(wizardData, null, 2)}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
