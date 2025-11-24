import { 
  TextField, Grid, Typography, Box, Slider, 
  Paper, InputAdornment 
} from '@mui/material';
import { Straighten, Height } from '@mui/icons-material';

export default function Step1Dimensions({ data, onChange }) {
  const marks = [
    { value: 4, label: '4m' },
    { value: 10, label: '10m' },
    { value: 15, label: '15m' },
    { value: 20, label: '20m' },
  ];

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        📏 Dimensiones de la Nave
      </Typography>

      <Grid container spacing={3}>
        {/* LARGO */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'primary.50', height: '100%' }}>
            <Typography variant="subtitle2" gutterBottom color="primary" fontWeight={600}>
              LARGO
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={data.length}
              onChange={(e) => onChange('length', Number(e.target.value))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Straighten color="primary" />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              }}
              sx={{ mb: 2, bgcolor: 'white' }}
            />
            <Slider
              value={data.length}
              onChange={(e, val) => onChange('length', val)}
              min={15}
              max={150}
              step={5}
              valueLabelDisplay="auto"
              color="primary"
            />
            <Typography variant="caption" color="text.secondary">
              Rango: 15m - 150m
            </Typography>
          </Paper>
        </Grid>

        {/* ANCHO */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'secondary.50', height: '100%' }}>
            <Typography variant="subtitle2" gutterBottom color="secondary" fontWeight={600}>
              ANCHO
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={data.width}
              onChange={(e) => onChange('width', Number(e.target.value))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Straighten color="secondary" />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              }}
              sx={{ mb: 2, bgcolor: 'white' }}
            />
            <Slider
              value={data.width}
              onChange={(e, val) => onChange('width', val)}
              min={10}
              max={80}
              step={5}
              valueLabelDisplay="auto"
              color="secondary"
            />
            <Typography variant="caption" color="text.secondary">
              Rango: 10m - 80m
            </Typography>
          </Paper>
        </Grid>

        {/* ALTURA */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'success.50', height: '100%' }}>
            <Typography variant="subtitle2" gutterBottom color="success.main" fontWeight={600}>
              ALTURA
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={data.height}
              onChange={(e) => onChange('height', Number(e.target.value))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Height color="success" />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              }}
              sx={{ mb: 2, bgcolor: 'white' }}
            />
            <Slider
              value={data.height}
              onChange={(e, val) => onChange('height', val)}
              min={4}
              max={20}
              marks={marks}
              valueLabelDisplay="auto"
              color="success"
            />
            <Typography variant="caption" color="text.secondary">
              Rango: 4m - 20m
            </Typography>
          </Paper>
        </Grid>

        {/* RESUMEN */}
        <Grid item xs={12}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              bgcolor: 'grey.100', 
              border: '2px dashed',
              borderColor: 'grey.300'
            }}
          >
            <Typography variant="h6" gutterBottom fontWeight={600}>
              📊 Resumen
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Superficie Total</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {(data.length * data.width).toLocaleString()} m²
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Volumen</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {(data.length * data.width * data.height).toLocaleString()} m³
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Capacidad Estimada</Typography>
                <Typography variant="h6" fontWeight={700} color="primary">
                  ~{Math.floor((data.length * data.width * data.height) / 3.5).toLocaleString()} palets
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <Typography variant="body2" color="text.secondary">Tipo de Nave</Typography>
                <Typography variant="h6" fontWeight={700}>
                  {data.length * data.width < 500 ? 'Pequeña' : 
                   data.length * data.width < 2000 ? 'Mediana' : 'Grande'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}