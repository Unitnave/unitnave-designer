import { Grid, Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { 
  Inventory, SquareFoot, TrendingUp, CheckCircle 
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const MetricCard = ({ icon: Icon, title, value, subtitle, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
  >
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          left: 20,
          width: 56,
          height: 56,
          borderRadius: 2,
          bgcolor: `${color}.main`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 3,
        }}
      >
        <Icon sx={{ fontSize: 32, color: 'white' }} />
      </Box>
      <CardContent sx={{ pt: 5 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

export default function MetricsCards({ capacity, surfaces }) {
  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          icon={Inventory}
          title="CAPACIDAD TOTAL"
          value={capacity.total_pallets.toLocaleString()}
          subtitle={`${capacity.pallets_per_level} palets/nivel`}
          color="primary"
          delay={0}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          icon={SquareFoot}
          title="SUPERFICIE ÚTIL"
          value={`${surfaces.storage_area.toFixed(0)} m²`}
          subtitle={`${((surfaces.storage_area / surfaces.total_area) * 100).toFixed(1)}% del total`}
          color="secondary"
          delay={0.1}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          icon={TrendingUp}
          title="EFICIENCIA"
          value={`${surfaces.efficiency.toFixed(1)}%`}
          subtitle={capacity.efficiency_percentage > 70 ? 'Óptima' : 'Mejorable'}
          color="success"
          delay={0.2}
        />
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          icon={CheckCircle}
          title="NIVELES PROMEDIO"
          value={capacity.levels_avg}
          subtitle={`Altura libre: ${(capacity.levels_avg * 1.75).toFixed(1)}m`}
          color="info"
          delay={0.3}
        />
      </Grid>
    </Grid>
  );
}