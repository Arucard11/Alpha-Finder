// src/components/RunnerAccordion.jsx
import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Avatar,
  Box
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RunnerChart from './RunnerChart';

const RunnerAccordion = ({ runner, computePnl }) => {
  const pnl = computePnl(runner).toFixed(2);

  return (
    <Accordion sx={{ backgroundColor: '#1d1d1d', color: '#ffffff', mb: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#00e676' }} />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={runner.logouri} alt={runner.name} />
          <Box>
            <Typography variant="subtitle1" sx={{ color: '#ff4081' }}>
              {runner.name} ({runner.symbol})
            </Typography>
            <Typography variant="body2">
              Score: {runner.score.toFixed(2)} | PnL: {pnl}
            </Typography>
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ mt: 1 }}>
          <RunnerChart runner={runner} />
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default RunnerAccordion;
