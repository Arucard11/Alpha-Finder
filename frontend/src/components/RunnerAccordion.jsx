// src/components/RunnerAccordion.jsx
import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RunnerChart from './RunnerChart';

const RunnerAccordion = ({ runner, computePnl }) => {
  const [expanded, setExpanded] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState(null);

  const handleAccordionChange = (event, isExpanded) => {
    setExpanded(isExpanded);
    if (isExpanded && !chartData) {
      // Fetch chart data when expanded for the first time
      setLoadingChart(true);
      setChartError(null);
      fetch(`${import.meta.env.VITE_API_ENDPOINT}/getprices/${runner.address}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Error: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          setChartData(data);
          setLoadingChart(false);
        })
        .catch((err) => {
          setChartError(err.message);
          setLoadingChart(false);
        });
    }
  };

  return (
    <Accordion expanded={expanded} onChange={handleAccordionChange}>
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#00e676' }} />}>
        <Typography variant="body1" sx={{ color: '#fff' }}>
          Runner: {runner.name} ({runner.symbol}) - Score: {runner.score.toFixed(2)}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box>
          {loadingChart && <CircularProgress size={24} sx={{ color: '#00e676' }} />}
          {chartError && (
            <Typography sx={{ color: 'red' }}>
              Error loading chart: {chartError}
            </Typography>
          )}
          {chartData && !loadingChart && (
            // Pass a runner object with the fetched chart data in timestamps.allprices
            <RunnerChart
              runner={{
                ...runner,
                timestamps: { ...runner.timestamps, allprices: chartData },
              }}
            />
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default RunnerAccordion;
