/**
 * UNITNAVE - Diseñador 3D de Naves Industriales
 * Componente Principal con Three.js
 */

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Grid, 
  Box, 
  Plane,
  Html,
  PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';
import axios from 'axios';

// ==================== CONFIGURACIÓN ====================
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ==================== COMPONENTES 3D ====================

/**
 * Estructura principal de la nave
 */
function WarehouseShell({ dimensions }) {
  const { length, width, height } = dimensions;
  
  return (
    <group>
      {/* SUELO */}
      <Plane
        args={[length, width]}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[length / 2, 0, width / 2]}
      >
        <meshStandardMaterial 
          color="#888888" 
          roughness={0.3}
          metalness={0.1}
        />
      </Plane>
      
      {/* PAREDES */}
      {/* Pared trasera */}
      <Box
        args={[length, height, 0.3]}
        position={[length / 2, height / 2, 0]}
      >
        <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.4} />
      </Box>
      
      {/* Pared frontal */}
      <Box
        args={[length, height, 0.3]}
        position={[length / 2, height / 2, width]}
      >
        <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.4} />
      </Box>
      
      {/* Pared izquierda */}
      <Box
        args={[0.3, height, width]}
        position={[0, height / 2, width / 2]}
      >
        <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.4} />
      </Box>
      
      {/* Pared derecha */}
      <Box
        args={[0.3, height, width]}
        position={[length, height / 2, width / 2]}
      >
        <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.4} />
      </Box>
      
      {/* TECHO (simplificado) */}
      <Plane
        args={[length, width]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[length / 2, height, width / 2]}
      >
        <meshStandardMaterial 
          color="#707070" 
          side={THREE.DoubleSide}
          metalness={0.7}
          roughness={0.5}
        />
      </Plane>
    </group>
  );
}

/**
 * Estantería industrial
 */
function Shelf({ position, dimensions, onClick, isSelected }) {
  const meshRef = useRef();
  const { length = 2.7, height = 8, depth = 1.1 } = dimensions;
  
  useFrame(() => {
    if (isSelected && meshRef.current) {
      meshRef.current.rotation.y += 0.01;
    }
  });
  
  return (
    <group position={position} onClick={onClick}>
      {/* Postes verticales */}
      {[0, length].map((x, i) =>
        [0, depth].map((z, j) => (
          <Box
            key={`post-${i}-${j}`}
            args={[0.1, height, 0.1]}
            position={[x, height / 2, z]}
          >
            <meshStandardMaterial color="#ff6b35" metalness={0.95} roughness={0.6} />
          </Box>
        ))
      )}
      
      {/* Niveles horizontales */}
      {[0, 2, 4, 6, 8].map((h, idx) => (
        <Box
          key={`level-${idx}`}
          args={[length, 0.05, depth]}
          position={[length / 2, h, depth / 2]}
        >
          <meshStandardMaterial color="#e85d00" metalness={0.9} roughness={0.5} />
        </Box>
      ))}
      
      {/* Bounding box si está seleccionado */}
      {isSelected && (
        <Box
          ref={meshRef}
          args={[length + 0.2, height + 0.2, depth + 0.2]}
          position={[length / 2, height / 2, depth / 2]}
        >
          <meshBasicMaterial color="#00ff00" wireframe opacity={0.3} transparent />
        </Box>
      )}
    </group>
  );
}

/**
 * Módulo de oficinas
 */
function Office({ position, dimensions }) {
  const { length = 10, width = 8, height = 3.5 } = dimensions;
  
  return (
    <group position={position}>
      {/* Estructura principal */}
      <Box
        args={[length, height, width]}
        position={[length / 2, height / 2, width / 2]}
      >
        <meshPhysicalMaterial 
          color="#b0c4de"
          transmission={0.8}
          opacity={0.6}
          transparent
          roughness={0.1}
          metalness={0.1}
        />
      </Box>
      
      {/* Marco de aluminio */}
      <Box
        args={[length + 0.2, 0.1, width + 0.2]}
        position={[length / 2, height, width / 2]}
      >
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </Box>
    </group>
  );
}

/**
 * Muelle de carga
 */
function LoadingDock({ position, dimensions }) {
  const { width = 3.0 } = dimensions;
  
  return (
    <group position={position}>
      <Box
        args={[width, 1.2, 3.0]}
        position={[width / 2, 0.6, 1.5]}
      >
        <meshStandardMaterial color="#606060" roughness={0.8} />
      </Box>
      
      {/* Líneas amarillas */}
      <Box
        args={[width, 0.01, 0.2]}
        position={[width / 2, 0.01, 0.1]}
      >
        <meshBasicMaterial color="#ffff00" />
      </Box>
    </group>
  );
}

/**
 * Iluminación de la escena
 */
function Lights({ warehouseDimensions }) {
  const { length, width, height } = warehouseDimensions;
  
  return (
    <>
      {/* Luz ambiental */}
      <ambientLight intensity={0.3} />
      
      {/* Luz principal (sol) */}
      <directionalLight
        position={[length * 0.7, height * 2, width * 0.5]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      
      {/* Luces industriales en techo */}
      {Array.from({ length: Math.floor(length / 10) }, (_, i) =>
        Array.from({ length: Math.floor(width / 10) }, (_, j) => (
          <pointLight
            key={`light-${i}-${j}`}
            position={[
              (i + 1) * (length / (Math.floor(length / 10) + 1)),
              height - 0.5,
              (j + 1) * (width / (Math.floor(width / 10) + 1))
            ]}
            intensity={40}
            distance={15}
            color="#fffaed"
          />
        ))
      )}
    </>
  );
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function WarehouseDesigner() {
  // Estado del diseño
  const [dimensions, setDimensions] = useState({
    length: 40,
    width: 25,
    height: 10
  });
  
  const [elements, setElements] = useState([
    // Estantería de ejemplo
    {
      id: '1',
      type: 'shelf',
      position: [5, 0, 5],
      dimensions: { length: 10, height: 8, depth: 1.1 },
      properties: { levels: 4 }
    }
  ]);
  
  const [selectedElement, setSelectedElement] = useState(null);
  const [calculations, setCalculations] = useState(null);
  const [viewMode, setViewMode] = useState('3d'); // '3d', 'top', 'exterior'
  
  // Calcular capacidad automáticamente
  useEffect(() => {
    calculateCapacity();
  }, [elements, dimensions]);
  
  const calculateCapacity = async () => {
    try {
      const design = { name: 'Diseño actual', dimensions, elements };
      const response = await axios.post(`${API_URL}/api/calculate`, design);
      setCalculations(response.data);
    } catch (error) {
      console.error('Error calculando capacidad:', error);
    }
  };
  
  const addElement = (type) => {
    const newElement = {
      id: Date.now().toString(),
      type,
      position: [dimensions.length / 2, 0, dimensions.width / 2],
      dimensions: getDefaultDimensions(type),
      properties: {}
    };
    
    setElements([...elements, newElement]);
  };
  
  const getDefaultDimensions = (type) => {
    switch (type) {
      case 'shelf':
        return { length: 2.7, height: 8, depth: 1.1 };
      case 'office':
        return { length: 10, width: 8, height: 3.5 };
      case 'dock':
        return { width: 3.0 };
      default:
        return {};
    }
  };
  
  const requestBlenderRender = async () => {
    try {
      const design = { name: 'Render profesional', dimensions, elements };
      const response = await axios.post(`${API_URL}/api/render`, design);
      alert(`Render solicitado. ID: ${response.data.render_id}. Tiempo estimado: 60-90 seg`);
    } catch (error) {
      console.error('Error solicitando render:', error);
      alert('Error al solicitar render');
    }
  };
  
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      {/* PANEL IZQUIERDO - Elementos */}
      <div style={{
        width: '250px',
        background: '#2c3e50',
        color: 'white',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <div style={{ marginBottom: '30px' }}>
          <img 
            src="data:image/svg+xml,%3Csvg viewBox='0 0 450 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='40' y='50' font-family='Montserrat, Arial' font-size='52' font-weight='800' fill='%232c3e50' letter-spacing='-1'%3Eunit%3Ctspan fill='%23ff6b35'%3Enave%3C/tspan%3E%3C/text%3E%3C/svg%3E"
            alt="UNITNAVE"
            style={{ width: '100%' }}
          />
        </div>
        
        <h3>ELEMENTOS</h3>
        
        <button 
          onClick={() => addElement('shelf')}
          style={buttonStyle}
        >
          📦 Estantería
        </button>
        
        <button 
          onClick={() => addElement('office')}
          style={buttonStyle}
        >
          🏢 Oficina
        </button>
        
        <button 
          onClick={() => addElement('dock')}
          style={buttonStyle}
        >
          🚛 Muelle carga
        </button>
        
        <hr style={{ margin: '20px 0', borderColor: '#ff6b35' }} />
        
        <h3>DIMENSIONES NAVE</h3>
        
        <label>Largo: {dimensions.length}m</label>
        <input
          type="range"
          min="20"
          max="100"
          value={dimensions.length}
          onChange={(e) => setDimensions({...dimensions, length: parseFloat(e.target.value)})}
          style={{ width: '100%' }}
        />
        
        <label>Ancho: {dimensions.width}m</label>
        <input
          type="range"
          min="15"
          max="50"
          value={dimensions.width}
          onChange={(e) => setDimensions({...dimensions, width: parseFloat(e.target.value)})}
          style={{ width: '100%' }}
        />
        
        <label>Alto: {dimensions.height}m</label>
        <input
          type="range"
          min="6"
          max="14"
          value={dimensions.height}
          onChange={(e) => setDimensions({...dimensions, height: parseFloat(e.target.value)})}
          style={{ width: '100%' }}
        />
      </div>
      
      {/* CANVAS 3D - Centro */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Controles de vista */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: '8px',
          display: 'flex',
          gap: '10px'
        }}>
          <button 
            onClick={() => setViewMode('3d')}
            style={{...viewButtonStyle, background: viewMode === '3d' ? '#ff6b35' : '#555'}}
          >
            3D
          </button>
          <button 
            onClick={() => setViewMode('top')}
            style={{...viewButtonStyle, background: viewMode === 'top' ? '#ff6b35' : '#555'}}
          >
            Planta
          </button>
          <button 
            onClick={() => setViewMode('exterior')}
            style={{...viewButtonStyle, background: viewMode === 'exterior' ? '#ff6b35' : '#555'}}
          >
            Exterior
          </button>
        </div>
        
        <Canvas
          shadows
          camera={{ position: [dimensions.length * 1.2, dimensions.height * 1.5, dimensions.width * 1.2], fov: 50 }}
        >
          <color attach="background" args={['#87ceeb']} />
          
          <Lights warehouseDimensions={dimensions} />
          
          {/* Grid de referencia */}
          <Grid
            args={[dimensions.length * 1.5, dimensions.width * 1.5]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#555"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#ff6b35"
            fadeDistance={200}
            fadeStrength={1}
            position={[dimensions.length / 2, 0.01, dimensions.width / 2]}
          />
          
          {/* Estructura de la nave */}
          <WarehouseShell dimensions={dimensions} />
          
          {/* Elementos del diseño */}
          {elements.map((element) => {
            switch (element.type) {
              case 'shelf':
                return (
                  <Shelf
                    key={element.id}
                    position={element.position}
                    dimensions={element.dimensions}
                    isSelected={selectedElement === element.id}
                    onClick={() => setSelectedElement(element.id)}
                  />
                );
              case 'office':
                return (
                  <Office
                    key={element.id}
                    position={element.position}
                    dimensions={element.dimensions}
                  />
                );
              case 'dock':
                return (
                  <LoadingDock
                    key={element.id}
                    position={element.position}
                    dimensions={element.dimensions}
                  />
                );
              default:
                return null;
            }
          })}
          
          {/* Controles de cámara */}
          <OrbitControls 
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={200}
          />
        </Canvas>
      </div>
      
      {/* PANEL DERECHO - Datos */}
      <div style={{
        width: '300px',
        background: '#ecf0f1',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <h2 style={{ color: '#2c3e50' }}>CÁLCULOS</h2>
        
        {calculations && (
          <div style={{ marginTop: '20px' }}>
            <div style={statBoxStyle}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ff6b35' }}>
                {calculations.total_pallets}
              </div>
              <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                PALETS TOTALES
              </div>
            </div>
            
            <div style={statBoxStyle}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {calculations.usable_area} m²
              </div>
              <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                SUPERFICIE ÚTIL
              </div>
            </div>
            
            <div style={statBoxStyle}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {calculations.efficiency_percentage}%
              </div>
              <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                APROVECHAMIENTO
              </div>
            </div>
            
            <div style={statBoxStyle}>
              <div style={{ fontSize: '20px' }}>
                {calculations.circulation_area} m²
              </div>
              <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                ÁREA CIRCULACIÓN
              </div>
            </div>
            
            {calculations.warnings.length > 0 && (
              <div style={{
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                padding: '15px',
                marginTop: '20px'
              }}>
                <strong>⚠️ AVISOS:</strong>
                <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                  {calculations.warnings.map((warning, idx) => (
                    <li key={idx} style={{ fontSize: '13px', marginTop: '5px' }}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        <hr style={{ margin: '30px 0' }} />
        
        <button
          onClick={requestBlenderRender}
          style={{
            ...buttonStyle,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontSize: '16px',
            padding: '15px',
            fontWeight: 'bold'
          }}
        >
          🎨 RENDER PROFESIONAL
        </button>
        
        <button
          onClick={() => alert('Función de exportar PDF en desarrollo')}
          style={{
            ...buttonStyle,
            background: '#e74c3c'
          }}
        >
          📄 EXPORTAR PDF
        </button>
        
        <button
          onClick={() => alert('Función de guardar diseño en desarrollo')}
          style={{
            ...buttonStyle,
            background: '#27ae60'
          }}
        >
          💾 GUARDAR DISEÑO
        </button>
      </div>
    </div>
  );
}

// ==================== ESTILOS ====================

const buttonStyle = {
  width: '100%',
  padding: '12px',
  marginTop: '10px',
  background: '#ff6b35',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600',
  transition: 'all 0.3s'
};

const viewButtonStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '5px',
  color: 'white',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600'
};

const statBoxStyle = {
  background: 'white',
  borderRadius: '12px',
  padding: '20px',
  marginTop: '15px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  textAlign: 'center'
};
