import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateWarehousePDF = async (warehouseData, canvasElement) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // --- PORTADA ---
  pdf.setFillColor(25, 118, 210);
  pdf.rect(0, 0, pageWidth, 80, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.setFont('helvetica', 'bold');
  pdf.text('UNITNAVE', pageWidth / 2, 30, { align: 'center' });
  
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Diseño Optimizado de Nave Industrial', pageWidth / 2, 45, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, 55, { align: 'center' });
  
  // Datos del proyecto
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DATOS DEL PROYECTO', 20, 95);
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  const { dimensions, capacity, surfaces } = warehouseData;
  
  let y = 105;
  const addLine = (label, value) => {
    pdf.text(`${label}:`, 20, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, 100, y);
    pdf.setFont('helvetica', 'normal');
    y += 7;
  };
  
  addLine('Dimensiones', `${dimensions.length}m × ${dimensions.width}m × ${dimensions.height}m`);
  addLine('Superficie Total', `${(dimensions.length * dimensions.width).toLocaleString()} m²`);
  addLine('Capacidad Total', `${capacity.total_pallets.toLocaleString()} palets`);
  addLine('Eficiencia', `${surfaces.efficiency.toFixed(1)}%`);
  addLine('Área Almacenamiento', `${surfaces.storage_area.toFixed(0)} m²`);
  
  // --- PÁGINA 2: RENDER 3D ---
  pdf.addPage();
  
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('VISTA 3D DE LA NAVE', 20, 20);
  
  if (canvasElement) {
    try {
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: '#f5f5f5',
        scale: 2
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 20, 30, imgWidth, Math.min(imgHeight, 180));
    } catch (error) {
      console.error('Error capturando canvas:', error);
    }
  }
  
  // --- PÁGINA 3: MÉTRICAS ---
  pdf.addPage();
  
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('MÉTRICAS CLAVE', 20, 20);
  
  // Gráfico de distribución
  pdf.setFillColor(25, 118, 210);
  pdf.rect(20, 30, (surfaces.storage_area / surfaces.total_area) * 170, 10, 'F');
  pdf.setFillColor(255, 107, 53);
  pdf.rect(20 + (surfaces.storage_area / surfaces.total_area) * 170, 30, 
           (surfaces.operational_area / surfaces.total_area) * 170, 10, 'F');
  
  pdf.setFontSize(10);
  pdf.text(`Almacenamiento: ${((surfaces.storage_area / surfaces.total_area) * 100).toFixed(1)}%`, 20, 48);
  pdf.text(`Operativo: ${((surfaces.operational_area / surfaces.total_area) * 100).toFixed(1)}%`, 80, 48);
  pdf.text(`Circulación: ${((surfaces.circulation_area / surfaces.total_area) * 100).toFixed(1)}%`, 140, 48);
  
  // Validaciones
  y = 65;
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('VALIDACIONES NORMATIVAS', 20, y);
  
  y += 10;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  if (warehouseData.validations && warehouseData.validations.length > 0) {
    warehouseData.validations.forEach(validation => {
      const icon = validation.type === 'error' ? '❌' : validation.type === 'warning' ? '⚠️' : 'ℹ️';
      pdf.text(`${icon} ${validation.message}`, 20, y);
      y += 6;
      if (y > pageHeight - 20) {
        pdf.addPage();
        y = 20;
      }
    });
  } else {
    pdf.setTextColor(76, 175, 80);
    pdf.text('✓ Diseño conforme a normativa CTE DB-SI', 20, y);
  }
  
  // --- FOOTER EN TODAS LAS PÁGINAS ---
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `UNITNAVE Designer v2.0 | www.unitnave.com | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
  
  // Guardar
  pdf.save(`UNITNAVE_${dimensions.length}x${dimensions.width}_${new Date().toISOString().split('T')[0]}.pdf`);
};