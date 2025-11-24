import { Paper, Typography } from '@mui/material';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, Cell 
} from 'recharts';

const COLORS = ['#1976d2', '#ff6b35', '#4caf50', '#ff9800', '#9c27b0'];

export default function CapacityChart({ capacity }) {
  if (!capacity.by_zone || Object.keys(capacity.by_zone).length === 0) {
    return null;
  }

  const data = Object.entries(capacity.by_zone).map(([zone, pallets], idx) => ({
    name: zone.replace('A', 'Fila A').replace('B', 'Fila B'),
    pallets,
    fill: COLORS[idx % COLORS.length]
  }));

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        📊 Distribución de Capacidad por Zona
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis label={{ value: 'Palets', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            formatter={(value) => [`${value} palets`, 'Capacidad']}
            contentStyle={{ borderRadius: 8 }}
          />
          <Legend />
          <Bar dataKey="pallets" name="Capacidad">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}