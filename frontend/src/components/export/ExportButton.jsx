import { useState } from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Download, PictureAsPdf, Image, Code } from '@mui/icons-material';
import { generateWarehousePDF } from './PDFGenerator';

export default function ExportButton({ warehouseData, canvasElement }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleExportPDF = async () => {
    await generateWarehousePDF(warehouseData, canvasElement);
    handleClose();
  };

  const handleExportImage = async () => {
    if (!canvasElement) return;
    
    const canvas = await html2canvas(canvasElement, {
      backgroundColor: '#f5f5f5',
      scale: 2
    });
    
    const link = document.createElement('a');
    link.download = `unitnave_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    handleClose();
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(warehouseData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `unitnave_${Date.now()}.json`;
    link.href = url;
    link.click();
    handleClose();
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<Download />}
        onClick={handleClick}
        size="large"
      >
        Exportar
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={handleExportPDF}>
          <ListItemIcon><PictureAsPdf /></ListItemIcon>
          <ListItemText>PDF Completo</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportImage}>
          <ListItemIcon><Image /></ListItemIcon>
          <ListItemText>Imagen PNG</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportJSON}>
          <ListItemIcon><Code /></ListItemIcon>
          <ListItemText>Datos JSON</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}