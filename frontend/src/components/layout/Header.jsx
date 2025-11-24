import { AppBar, Toolbar, Typography, Button, Box, IconButton } from '@mui/material';
import { Warehouse, Download, Share, Settings } from '@mui/icons-material';
import { motion } from 'framer-motion';

export default function Header({ onExport, onShare }) {
  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}
        >
          <Warehouse sx={{ fontSize: 40, mr: 2 }} />
          <Box>
            <Typography variant="h5" component="div" fontWeight={700}>
              UNITNAVE Designer
            </Typography>
            <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
              Diseña tu nave industrial en 5 minutos
            </Typography>
          </Box>
        </motion.div>

        <Button
          startIcon={<Download />}
          onClick={onExport}
          sx={{ mr: 2, color: 'white' }}
        >
          Exportar PDF
        </Button>
        
        <Button
          startIcon={<Share />}
          onClick={onShare}
          sx={{ mr: 2, color: 'white' }}
        >
          Compartir
        </Button>

        <IconButton color="inherit">
          <Settings />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}