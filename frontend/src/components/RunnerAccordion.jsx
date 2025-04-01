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

// *** CHANGE HERE: Removed computePnl from props ***
const RunnerAccordion = ({ runner }) => {
  const [expanded, setExpanded] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState(null);

  // Ensure runner and runner.address exist before fetching
  const canFetchChart = runner && runner.address;

  const handleAccordionChange = (event, isExpanded) => {
    setExpanded(isExpanded);
    // Only fetch if expanding, data doesn't exist, and we have an address
    if (isExpanded && !chartData && !loadingChart && canFetchChart) {
      setLoadingChart(true);
      setChartError(null);
      fetch(`${import.meta.env.VITE_API_ENDPOINT}/getprices/${runner.address}`)
        .then((res) => {
          if (!res.ok) {
             // Attempt to parse error message from response
             return res.text().then(text => {
               let errorMsg = `Error fetching chart: ${res.status} ${res.statusText}`;
               try {
                   const jsonError = JSON.parse(text);
                   errorMsg = jsonError.message || jsonError.error || errorMsg;
               } catch (e) { /* Ignore if not JSON */ }
               throw new Error(errorMsg);
             });
          }
          return res.json();
        })
        .then((data) => {
          // Basic validation of received data (expecting an array)
          if (!Array.isArray(data)) {
              throw new Error("Invalid chart data format received.");
          }
          setChartData(data);
          setLoadingChart(false);
        })
        .catch((err) => {
          console.error("Chart fetch error:", err);
          setChartError(err.message || "Failed to load chart data.");
          setLoadingChart(false);
        });
    }
  };

  // Provide default values or fallbacks for runner properties
  const runnerName = runner?.name ?? 'Unknown Runner';
  const runnerSymbol = runner?.symbol ?? 'N/A';
  const runnerScore = runner?.score ?? 0;

  return (
    // Disable accordion interaction if runner address is missing
    <Accordion
      expanded={expanded && canFetchChart} // Only allow expansion if chart can be fetched
      onChange={handleAccordionChange}
      disabled={!canFetchChart} // Disable the accordion if no address
      sx={{ backgroundColor: '#333' }} // Slightly different background for distinction
    >
      <AccordionSummary
         expandIcon={canFetchChart ? <ExpandMoreIcon sx={{ color: '#00e676' }} /> : null}
         sx={!canFetchChart ? { opacity: 0.6, cursor: 'default' } : {}} // Style disabled state
      >
        <Typography variant="body1" sx={{ color: '#fff' }}>
          Runner: {runnerName} ({runnerSymbol}) - Score: {runnerScore.toFixed(2)}
          {!canFetchChart && " (Data Unavailable)"}
        </Typography>
      </AccordionSummary>
      {/* Render details only if accordion can be expanded */}
      {canFetchChart && (
          <AccordionDetails sx={{ backgroundColor: '#272727' }}> {/* Match wallet card bg */}
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
                  ...(runner ?? {}), // Ensure runner is an object
                  timestamps: { ...(runner?.timestamps ?? {}), allprices: chartData },
                }}
              />
            )}
            {!chartData && !loadingChart && !chartError && (
                 <Typography sx={{ color: 'grey.500' }}>Expand to load chart.</Typography>
            )}
          </Box>
        </AccordionDetails>
      )}
    </Accordion>
  );
};

export default RunnerAccordion;