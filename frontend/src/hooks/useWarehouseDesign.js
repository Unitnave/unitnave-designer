import { useState, useCallback } from 'react';
import useWarehouseStore from '../stores/useWarehouseStore';

export default function useWarehouseDesign() {
  const { setDimensions, setElements, clearWarehouse } = useWarehouseStore();
  const [designState, setDesignState] = useState({
    currentStep: 'form', // form | optimizing | results
    formData: null,
    optimizationResult: null,
    selectedScenario: null
  });

  const updateFormData = useCallback((data) => {
    setDesignState(prev => ({ ...prev, formData: data }));
  }, []);

  const startOptimization = useCallback(() => {
    setDesignState(prev => ({ ...prev, currentStep: 'optimizing' }));
  }, []);

  // Aceptamos 'inputData' como segundo parámetro opcional
  const setOptimizationResult = useCallback((result, inputData) => {
    // Usamos el dato pasado directamente O el del estado si no se pasa
    const dataToUse = inputData || designState.formData;

    if (result.elements && dataToUse) {
      setDimensions({
        length: dataToUse.length,
        width: dataToUse.width,
        height: dataToUse.height
      });
      setElements(result.elements);
    }
    
    setDesignState(prev => ({ 
      ...prev, 
      currentStep: 'results',
      optimizationResult: result
    }));
  }, [designState.formData, setDimensions, setElements]);
    
    setDesignState(prev => ({ 
      ...prev, 
      currentStep: 'results',
      optimizationResult: result
    }));
  }, [designState.formData, setDimensions, setElements]);

  const selectScenario = useCallback((scenario) => {
    setDesignState(prev => ({ ...prev, selectedScenario: scenario }));
    if (scenario.elements) {
      setElements(scenario.elements);
    }
  }, [setElements]);

  const resetDesign = useCallback(() => {
    clearWarehouse();
    setDesignState({
      currentStep: 'form',
      formData: null,
      optimizationResult: null,
      selectedScenario: null
    });
  }, [clearWarehouse]);

  return {
    designState,
    updateFormData,
    startOptimization,
    setOptimizationResult,
    selectScenario,
    resetDesign
  };
}