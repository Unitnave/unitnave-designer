import { useState } from 'react';
import { 
  Stepper, Step, StepLabel, Box, Container, Paper,
  Button, Typography 
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import Step1Dimensions from './Step1Dimensions';
import Step2Configuration from './Step2Configuration';
import Step3Preview from './Step3Preview';

const steps = ['Dimensiones', 'Configuración', 'Vista Previa'];

export default function WizardStepper({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    length: 50,
    width: 30,
    height: 10,
    n_docks: 4,
    machinery: 'retractil',
    pallet_type: 'EUR',
    workers: null,
    activity_type: 'warehouse'
  });

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      onComplete(formData);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderStepContent = () => {
    switch(activeStep) {
      case 0:
        return <Step1Dimensions data={formData} onChange={updateFormData} />;
      case 1:
        return <Step2Configuration data={formData} onChange={updateFormData} />;
      case 2:
        return <Step3Preview data={formData} />;
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            variant="outlined"
          >
            Atrás
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            size="large"
          >
            {activeStep === steps.length - 1 ? '🚀 Generar Diseño' : 'Siguiente'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}