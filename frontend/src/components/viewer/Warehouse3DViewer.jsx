import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { Box, Paper, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { View3D, ViewInAr, GridOn, Layers } from '@mui/icons-material';
import { useState } from 'react';
import Warehouse3D from '../Warehouse3D';
import useUIStore from '../../stores/useUIStore';

export default function Warehouse3DViewer() {
  const { viewMode, setViewMode } = useUIStore();

  const isOrthographic = ['Planta', 'Alzado', 'Perfil'].includes(viewMode);

  return (
    <Paper sx={{ p: 2, borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          🏗️ Visualización 3D
        </Typography>
        
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="3D">
            <View3D sx={{ mr: 1 }} />
            3D
          </ToggleButton>
          <ToggleButton value="Planta">
            <GridOn sx={{ mr: 1 }} />
            Planta
          </ToggleButton>
          <ToggleButton value="Alzado">
            <ViewInAr sx={{ mr: 1 }} />
            Alzado
          </ToggleButton>
          <ToggleButton value="Perfil">
            <Layers sx={{ mr: 1 }} />
            Perfil
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ width: '100%', height: 600, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Canvas shadows>
          {isOrthographic ? (
            <OrthographicCamera makeDefault position={[50, 50, 50]} zoom={10} />
          ) : (
            <PerspectiveCamera makeDefault position={[50, 40, 50]} fov={50} />
          )}
          
          <OrbitControls makeDefault />
          <Warehouse3D />
        </Canvas>
      </Box>
    </Paper>
  );
}