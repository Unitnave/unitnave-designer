import { 
  Grid, Typography, Box, Paper, Divider, 
  List, ListItem, ListItemText, ListItemIcon 
} from '@mui/material';
import { 
  CheckCircle, Straighten, Height, LocalShipping, 
  Forklift, Inventory, People 
} from '@mui/icons-material';

export default function Step3Preview({ data }) {
  const totalArea = data.length * data.width;
  const volume = data.length * data.width * data.height;
  const estimatedCapacity = Math.floor(volume / 3.5);

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        ✅ Resumen del Diseño
      </Typography>

      <Grid container spacing={3}>
        {/* DIMENSIONES */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              📏 Dimensiones
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List dense>
              <ListItem>
                <ListItemIcon><Straighten color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Largo" 
                  secondary={`${data.length}m`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Straighten color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Ancho" 
                  secondary={`${data.width}m`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Height color="primary" /></ListItemIcon>
                <ListItemText 
                  primary="Altura" 
                  secondary={`${data.height}m`}
                />
              </ListItem>
            </List>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Superficie</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {totalArea.toLocaleString()} m²
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Volumen</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {volume.toLocaleString()} m³
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* CONFIGURACIÓN */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50', height: '100%' }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              ⚙️ Configuración
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <List dense>
              <ListItem>
                <ListItemIcon><Forklift color="secondary" /></ListItemIcon>
                <ListItemText 
                  primary="Maquinaria" 
                  secondary={data.machinery.toUpperCase()}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><LocalShipping color="secondary" /></ListItemIcon>
                <ListItemText 
                  primary="Muelles" 
                  secondary={`${data.n_docks} muelles de carga`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><Inventory color="secondary" /></ListItemIcon>
                <ListItemText 
                  primary="Tipo Palet" 
                  secondary={data.pallet_type}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><People color="secondary" /></ListItemIcon>
                <ListItemText 
                  primary="Trabajadores" 
                  secondary={data.workers || 'Cálculo automático'}
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* ESTIMACIÓN */}
        <Grid item xs={12}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              bgcolor: 'primary.main', 
              color: 'white',
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" fontWeight={700} gutterBottom>
              📦 {estimatedCapacity.toLocaleString()} palets
            </Typography>
            <Typography variant="body1">
              Capacidad estimada (cálculo exacto tras optimización)
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}