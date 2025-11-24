import { 
  Paper, Typography, List, ListItem, ListItemIcon, 
  ListItemText, Chip, Collapse, IconButton, Box, Alert 
} from '@mui/material';
import { 
  Error, Warning, Info, CheckCircle, 
  ExpandMore, ExpandLess 
} from '@mui/icons-material';
import { useState } from 'react';

const getIcon = (type) => {
  switch(type) {
    case 'error': return <Error color="error" />;
    case 'warning': return <Warning color="warning" />;
    case 'info': return <Info color="info" />;
    default: return <CheckCircle color="success" />;
  }
};

const getColor = (type) => {
  switch(type) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
    default: return 'success';
  }
};

export default function ValidationPanel({ validations }) {
  const [expanded, setExpanded] = useState(true);
  
  const errorCount = validations.filter(v => v.type === 'error').length;
  const warningCount = validations.filter(v => v.type === 'warning').length;
  const infoCount = validations.filter(v => v.type === 'info').length;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          📋 Validaciones Normativas
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {errorCount > 0 && <Chip label={`${errorCount} errores`} color="error" size="small" />}
          {warningCount > 0 && <Chip label={`${warningCount} avisos`} color="warning" size="small" />}
          {infoCount > 0 && <Chip label={`${infoCount} info`} color="info" size="small" />}
          <IconButton onClick={() => setExpanded(!expanded)} size="small">
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>

      {errorCount === 0 && warningCount === 0 && (
        <Alert severity="success" icon={<CheckCircle />}>
          ✅ Diseño conforme a normativa CTE DB-SI (Seguridad en caso de incendio)
        </Alert>
      )}

      <Collapse in={expanded}>
        <List>
          {validations.map((validation, idx) => (
            <ListItem key={idx} divider={idx < validations.length - 1}>
              <ListItemIcon>{getIcon(validation.type)}</ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight={500}>
                      {validation.message}
                    </Typography>
                    <Chip 
                      label={validation.code} 
                      size="small" 
                      variant="outlined"
                      color={getColor(validation.type)}
                    />
                  </Box>
                }
                secondary={validation.location}
              />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Paper>
  );
}