/**
 * UNITNAVE Designer - Visor 3D con cámara corregida
 * 
 * Mejoras:
 * - Vista 3D: órbita sobre el centro real de la nave
 * - Vista Planta: cámara ortográfica desde arriba, sin rotación
 * - Vista Alzado: cámara ortográfica frontal, sin rotación
 * - Vista Perfil: cámara ortográfica lateral, sin rotación
 * - Zoom automático según dimensiones de la nave
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { Box, Paper, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { ThreeDRotation, ViewInAr, GridOn, Layers } from '@mui/icons-material';
import { useRef, useEffect, useMemo } from 'react';
import Warehouse3DPro from '../Warehouse3DPro';
import useUIStore from '../../stores/useUIStore';
import useWarehouseStore from '../../stores/useWarehouseStore';

export default function Warehouse3DViewer() {
  const { viewMode, setViewMode } = useUIStore();
  const { dimensions } = useWarehouseStore();
  
  const controlsRef = useRef();

  // Calcular centro de la nave
  const center = useMemo(() => ({
    x: dimensions.length / 2,
    y: dimensions.height / 2,
    z: dimensions.width / 2
  }), [dimensions]);

  // Calcular distancia de cámara según el tamaño de la nave
  const cameraDistance = useMemo(() => {
    const maxDim = Math.max(dimensions.length, dimensions.width, dimensions.height);
    return maxDim * 1.5;
  }, [dimensions]);

  // Zoom ortográfico calculado para que quepa la nave
  const orthoZoom = useMemo(() => {
    const maxDim = Math.max(dimensions.length, dimensions.width);
    // Ajustar para que quepa en el viewport con margen
    return 600 / (maxDim * 1.3);
  }, [dimensions]);

  // Configuración de cámara según vista
  const cameraConfig = useMemo(() => {
    switch (viewMode) {
      case 'Planta':
        return {
          position: [center.x, cameraDistance, center.z],
          target: [center.x, 0, center.z],
          isOrtho: true,
          zoom: orthoZoom
        };
      case 'Alzado':
        return {
          position: [center.x, center.y, cameraDistance + dimensions.width],
          target: [center.x, center.y, center.z],
          isOrtho: true,
          zoom: orthoZoom
        };
      case 'Perfil':
        return {
          position: [cameraDistance + dimensions.length, center.y, center.z],
          target: [center.x, center.y, center.z],
          isOrtho: true,
          zoom: orthoZoom
        };
      default: // 3D
        return {
          position: [
            center.x + cameraDistance * 0.7,
            center.y + cameraDistance * 0.5,
            center.z + cameraDistance * 0.7
          ],
          target: [center.x, 0, center.z],
          isOrtho: false,
          zoom: 1
        };
    }
  }, [viewMode, center, cameraDistance, orthoZoom, dimensions]);

  // Actualizar controles cuando cambia la vista
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...cameraConfig.target);
      controlsRef.current.update();
    }
  }, [cameraConfig.target]);

  const isOrtho = cameraConfig.isOrtho;

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
            <ThreeDRotation sx={{ mr: 1 }} />
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
        <Canvas shadows key={viewMode}>
          {isOrtho ? (
            <OrthographicCamera
              makeDefault
              position={cameraConfig.position}
              zoom={cameraConfig.zoom}
              near={0.1}
              far={cameraDistance * 10}
            />
          ) : (
            <PerspectiveCamera
              makeDefault
              position={cameraConfig.position}
              fov={50}
              near={0.1}
              far={cameraDistance * 10}
            />
          )}
          
          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={cameraConfig.target}
            // En vistas ortográficas: solo zoom, no rotar
            enableRotate={!isOrtho}
            enablePan={true}
            enableZoom={true}
            // Límites de zoom
            minZoom={isOrtho ? 1 : undefined}
            maxZoom={isOrtho ? 100 : undefined}
            minDistance={isOrtho ? undefined : 10}
            maxDistance={isOrtho ? undefined : cameraDistance * 3}
            // Suavizado
            enableDamping={true}
            dampingFactor={0.05}
          />
          
          <Warehouse3DPro />
        </Canvas>
      </Box>
    </Paper>
  );
}