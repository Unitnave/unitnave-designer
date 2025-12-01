import { AppBar, Toolbar, Typography, Button, Box, IconButton } from '@mui/material';
import { Download, Share, Settings } from '@mui/icons-material';
import { motion } from 'framer-motion';

// Logo UNITNAVE como componente SVG
const UnitnaveLogo = ({ height = 50 }) => (
  <svg viewBox="0 0 300 80" height={height} xmlns="http://www.w3.org/2000/svg">
    {/* Logo unitnave */}
    <text x="5" y="45" 
          fontFamily="'Montserrat', 'Arial Black', sans-serif" 
          fontSize="42" 
          fontWeight="800" 
          fill="#ffffff"
          letterSpacing="-1">
      unit<tspan fill="#ff6b35">nave</tspan>
    </text>
    
    {/* Línea divisoria */}
    <rect x="5" y="52" width="190" height="2" fill="#ff6b35" opacity="0.6"/>
    
    {/* Texto debajo */}
    <text x="5" y="68" 
          fontFamily="Arial, sans-serif" 
          fontSize="11" 
          fontWeight="600"
          fill="rgba(255,255,255,0.7)"
          letterSpacing="1.5">
      Designer Pro
    </text>
  </svg>
);

export default function Header({ onExport, onShare }) {
  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{ 
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderBottom: '2px solid #ff6b35'
      }}
    >
      <Toolbar sx={{ py: 1 }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}
        >
          <UnitnaveLogo height={55} />
        </motion.div>

        <Button
          startIcon={<Download />}
          onClick={onExport}
          sx={{ 
            mr: 2, 
            color: 'white',
            '&:hover': { bgcolor: 'rgba(255,107,53,0.2)' }
          }}
        >
          Exportar PDF
        </Button>
        
        <Button
          startIcon={<Share />}
          onClick={onShare}
          sx={{ 
            mr: 2, 
            color: 'white',
            '&:hover': { bgcolor: 'rgba(255,107,53,0.2)' }
          }}
        >
          Compartir
        </Button>

        <IconButton 
          color="inherit"
          sx={{ '&:hover': { bgcolor: 'rgba(255,107,53,0.2)' } }}
        >
          <Settings />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}