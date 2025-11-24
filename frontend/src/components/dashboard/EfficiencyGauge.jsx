import { Paper, Typography, Box, LinearProgress } from '@mui/material';
import { motion } from 'framer-motion';

const getEfficiencyColor = (value) => {
  if (value >= 70) return 'success';
  if (value >= 50) return 'warning';
  return 'error';
};

const getEfficiencyLabel = (value) => {
  if (value >= 70) return '🎯 Óptima';
  if (value >= 50) return '⚠️ Aceptable';
  return '❌ Mejorable';
};

export default function EfficiencyGauge({ efficiency }) {
  const color = getEfficiencyColor(efficiency);
  const label = getEfficiencyLabel(efficiency);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        📈 Indicador de Eficiencia
      </Typography>

      <Box sx={{ textAlign: 'center', py: 3 }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 100 }}
        >
          <Typography variant="h2" fontWeight={700} color={`${color}.main`}>
            {efficiency.toFixed(1)}%
          </Typography>
        </motion.div>
        
        <Typography variant="h6" gutterBottom sx={{ mt: 1 }}>
          {label}
        </Typography>

        <Box sx={{ mt: 3, px: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={efficiency} 
            color={color}
            sx={{ height: 12, borderRadius: 6 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" color="text.secondary">0%</Typography>
            <Typography variant="caption" color="text.secondary">50%</Typography>
            <Typography variant="caption" color="text.secondary">100%</Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Eficiencia = Área Almacenamiento / Área Útil
        </Typography>
      </Box>
    </Paper>
  );
}