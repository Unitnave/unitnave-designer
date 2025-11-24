export const API_URL = import.meta.env.VITE_API_URL || 'https://unitnave-designer-production.up.railway.app';

export const config = {
  apiUrl: API_URL,
  endpoints: {
    calculate: '/api/calculate',
    render: '/api/render',
    designs: '/api/designs',
    optimize: '/api/optimize',              // ⭐ NUEVO
    optimizeScenarios: '/api/optimize/scenarios', // ⭐ NUEVO
    health: '/health'
  }
};

export const buildUrl = (endpoint) => `${API_URL}${endpoint}`;