import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CoinChart from './CoinChart';

const SimpleRunnerDisplay = ({ runner }) => {
  const [expanded, setExpanded] = useState(false);

  // Function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
      sx={{ backgroundColor: '#333' }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#00e676' }} />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img 
              src={runner.logouri} 
              alt={runner.name}
              style={{ width: 30, height: 30 }}
            />
            <Typography sx={{ color: '#fff' }}>
              {runner.name} ({runner.symbol})
            </Typography>
          </Box>
          <Typography sx={{ color: '#00e676', ml: 'auto' }}>
            ATH MC: ${Number(runner.athmc || 0).toLocaleString()}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ backgroundColor: '#272727' }}>
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: '#fff', mb: 1, fontWeight: 'bold' }}>Important Timestamps:</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {runner.timestamps?.twoMillion && (
              <Typography sx={{ color: 'purple' }}>
                2M: {formatTimestamp(runner.timestamps.twoMillion)}
              </Typography>
            )}
            {runner.timestamps?.fiveMillion && (
              <Typography sx={{ color: 'orange' }}>
                5M: {formatTimestamp(runner.timestamps.fiveMillion)}
              </Typography>
            )}
            {runner.timestamps?.early && (
              <Typography sx={{ color: 'blue' }}>
                Early: {formatTimestamp(runner.timestamps.early)}
              </Typography>
            )}
            {runner.timestamps?.late && (
              <Typography sx={{ color: 'red' }}>
                Late: {formatTimestamp(runner.timestamps.late)}
              </Typography>
            )}
          </Box>
        </Box>
        <CoinChart coin={runner} />
      </AccordionDetails>
    </Accordion>
  );
};

export default SimpleRunnerDisplay;
