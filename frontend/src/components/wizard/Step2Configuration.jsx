import { 
  Grid, Typography, Box, FormControl, InputLabel, 
  Select, MenuItem, Card, CardContent, CardActionArea,
  Chip, TextField, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import { 
  LocalShipping, Forklift, Inventory, 
  People, Warehouse as WarehouseIcon 
} from '@mui/icons-material';

const machineryOptions = [
  { 
    value: 'transpaleta', 
    label: 'Transpaleta', 
    aisle: '1.8m',
    icon: '🚶',
    description: 'Manual, básico',
    cost: '€',
    capacity: '⭐⭐'
  },
  { 
    value: 'apilador', 
    label: 'Apilador', 
    aisle: '2.4m',
    icon: '🏗️',
    description: 'Semi-automático',
    cost: '€€',
    capacity: '⭐⭐⭐'
  },
  { 
    value: 'retractil', 
    label: 'Retráctil', 
    aisle: '2.8m',
    icon: '🚜',
    description: 'Equilibrio óptimo',
    cost: '€€€',
    capacity: '⭐⭐⭐⭐',
    recommended: true
  },
  { 
    value: 'contrapesada', 
    label: 'Contrapesada', 
    aisle: '3.6m',
    icon: '🚛',
    description: 'Cargas pesadas',
    cost: '€€€€',
    capacity: '⭐⭐⭐'
  },
  { 
    value: 'trilateral', 
    label: 'Trilateral VNA', 
    aisle: '1.9m',
    icon: '🤖',
    description: 'Máxima densidad',
    cost: '€€€€€',
    capacity: '⭐⭐⭐⭐⭐'
  },
];

export default function Step2Configuration({ data, onChange }) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight={600} sx={{ mb: 3 }}>
        ⚙️ Configuración Operativa
      </Typography>

      <Grid container spacing={3}>
        {/* MAQUINARIA */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom fontWeight={600} sx={{ mb: 2 }}>
            🚜 Tipo de Maquinaria
          </Typography>
          <Grid container spacing={2}>
            {machineryOptions.map((option) => (
              <Grid item xs={12} sm={6} md={4} key={option.value}>
                <Card 
                  sx={{ 
                    border: data.machinery === option.value ? 3 : 1,
                    borderColor: data.machinery === option.value ? 'primary.main' : 'grey.300',
                    position: 'relative',
                    height: '100%'
                  }}
                >
                  {option.recommended && (
                    <Chip 
                      label="RECOMENDADO" 
                      color="success" 
                      size="small" 
                      sx={{ 
                        position: 'absolute', 
                        top: 8, 
                        right: 8,
                        fontWeight: 700
                      }} 
                    />
                  )}
                  <CardActionArea onClick={() => onChange('machinery', option.value)}>
                    <CardContent>
                      <Typography variant="h4" sx={{ mb: 1 }}>{option.icon}</Typography>
                      <Typography variant="h6" fontWeight={600}>{option.label}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {option.description}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                        <Chip label={`Pasillo: ${option.aisle}`} size="small" color="primary" />
                        <Chip label={option.cost} size="small" />
                      </Box>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Capacidad: {option.capacity}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* MUELLES */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Muelles de Carga</InputLabel>
            <Select
              value={data.n_docks}
              onChange={(e) => onChange('n_docks', e.target.value)}
              startAdornment={<LocalShipping sx={{ mr: 1, color: 'action.active' }} />}
            >
              {[1, 2, 3, 4, 6, 8, 10].map(n => (
                <MenuItem key={n} value={n}>
                  {n} {n === 1 ? 'muelle' : 'muelles'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* TIPO PALET */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>Tipo de Palet</InputLabel>
            <Select
              value={data.pallet_type}
              onChange={(e) => onChange('pallet_type', e.target.value)}
              startAdornment={<Inventory sx={{ mr: 1, color: 'action.active' }} />}
            >
              <MenuItem value="EUR">EUR (1.2×0.8m)</MenuItem>
              <MenuItem value="US">US (1.2×1.0m)</MenuItem>
              <MenuItem value="CUSTOM">Personalizado</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* TRABAJADORES */}
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Trabajadores"
            type="number"
            value={data.workers || ''}
            onChange={(e) => onChange('workers', e.target.value ? Number(e.target.value) : null)}
            placeholder="Automático"
            InputProps={{
              startAdornment: <People sx={{ mr: 1, color: 'action.active' }} />,
            }}
            helperText="Dejar vacío para cálculo automático"
          />
        </Grid>

        {/* TIPO ACTIVIDAD */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Tipo de Actividad
          </Typography>
          <RadioGroup
            row
            value={data.activity_type}
            onChange={(e) => onChange('activity_type', e.target.value)}
          >
            <FormControlLabel 
              value="warehouse" 
              control={<Radio />} 
              label="Almacén General" 
            />
            <FormControlLabel 
              value="distribution" 
              control={<Radio />} 
              label="Centro Distribución" 
            />
            <FormControlLabel 
              value="production" 
              control={<Radio />} 
              label="Producción + Almacén" 
            />
            <FormControlLabel 
              value="ecommerce" 
              control={<Radio />} 
              label="E-commerce" 
            />
          </RadioGroup>
        </Grid>
      </Grid>
    </Box>
  );
}