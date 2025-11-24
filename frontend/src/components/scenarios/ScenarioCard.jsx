import { 
  Card, CardContent, CardActions, Typography, Box, 
  Button, Chip, LinearProgress, Divider 
} from '@mui/material';
import { CheckCircle, TrendingUp, Inventory, SquareFoot } from '@mui/icons-material';
import { motion } from 'framer-motion';

export default function ScenarioCard({ scenario, isSelected, onSelect }) {
  const { capacity, surfaces, validations, metadata } = scenario.data;
  
  const errorCount = validations.filter(v => v.type === 'error').length;
  const warningCount = validations.filter(v => v.type === 'warning').length;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        sx={{ 
          height: '100%',
          border: isSelected ? 3 : 1,
          borderColor: isSelected ? 'primary.main' : 'grey.300',
          position: 'relative'
        }}
      >
        {isSelected && (
          <Chip 
            label="SELECCIONADO" 
            color="primary" 
            size="small" 
            sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 700 }} 
          />
        )}
        
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            {scenario.name}
          </Typography>
          
          <Chip 
            label={metadata.machinery.toUpperCase()} 
            color="secondary" 
            size="small"
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2 }} />

          {/* Capacidad */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Inventory sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="body2" color="text.secondary">Capacidad</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700} color="primary">
              {capacity.total_pallets.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              palets ({capacity.levels_avg} niveles promedio)
            </Typography>
          </Box>

          {/* Eficiencia */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="body2" color="text.secondary">Eficiencia</Typography>
              </Box>
              <Typography variant="h6" fontWeight={700}>
                {surfaces.efficiency.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={surfaces.efficiency} 
              color="success"
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {/* Área */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SquareFoot sx={{ mr: 1, color: 'secondary.main' }} />
              <Typography variant="body2" color="text.secondary">Área Almacenamiento</Typography>
            </Box>
            <Typography variant="h6" fontWeight={600}>
              {surfaces.storage_area.toFixed(0)} m²
            </Typography>
          </Box>

          {/* Validaciones */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {errorCount > 0 && (
              <Chip label={`${errorCount} errores`} color="error" size="small" />
            )}
            {warningCount > 0 && (
              <Chip label={`${warningCount} avisos`} color="warning" size="small" />
            )}
            {errorCount === 0 && warningCount === 0 && (
              <Chip icon={<CheckCircle />} label="Normativa OK" color="success" size="small" />
            )}
          </Box>
        </CardContent>

        <CardActions>
          <Button 
            fullWidth 
            variant={isSelected ? 'contained' : 'outlined'}
            onClick={onSelect}
            size="large"
          >
            {isSelected ? '✓ Seleccionado' : 'Seleccionar'}
          </Button>
        </CardActions>
      </Card>
    </motion.div>
  );
}