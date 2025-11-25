// frontend/src/config.js

// 🔴 CAMBIO IMPORTANTE: Quitamos "import.meta.env..." para forzar producción
export const API_URL = 'https://unitnave-designer-production.up.railway.app';

export const config = {
  apiUrl: API_URL,
  endpoints: {
    calculate: '/api/calculate',
    render: '/api/render',
    designs: '/api/designs',
    optimize: '/api/optimize',
    optimizeScenarios: '/api/optimize/scenarios',
    health: '/api/health'
  }
};

export const buildUrl = (endpoint) => `${API_URL}${endpoint}`;