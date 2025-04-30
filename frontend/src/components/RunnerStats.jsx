import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { format, formatRelative } from 'date-fns';

// Helper function to format large numbers (copied from RecentLaunches)
const formatMarketCap = (num) => {
  if (num === null || num === undefined) return 'N/A';
  const value = Number(num);
  if (isNaN(value)) return 'N/A';
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  } else {
    return `$${value.toFixed(2)}`;
  }
};

const RunnerStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/leaderboard/runner-stats`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Validate data structure
        if (!data.stats || !data.runners) {
          throw new Error('Invalid data structure received from server');
        }
        
        setStats(data);
        setError(null);
      } catch (error) {
        console.error('Error fetching runner stats:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading runner statistics: {error}
      </Alert>
    );
  }

  if (!stats?.stats) {
    return (
      <Alert severity="info">
        No statistics available at the moment.
      </Alert>
    );
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <Paper 
      sx={{ 
        p: 2, 
        backgroundColor: 'rgba(39, 39, 39, 0.8)',
        border: '1px solid rgba(0, 230, 118, 0.3)',
        boxShadow: '0px 0px 15px rgba(0,230,118,0.4)',
        width: '60vw',
        mx: 'auto',
        maxWidth: 'none',
        height: 'auto',
        maxHeight: 'none',
        overflow: 'hidden',
        borderRadius: 2,
        backdropFilter: 'blur(5px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'flex-start', 
        width: '100%', 
        mb: 1,
        flexWrap: 'wrap',
        gap: { xs: 2, sm: 2 },
      }}>
        <Box sx={{ flex: '1 1 auto', minWidth: { xs: '100%', sm: '30%' }, mb: { xs: 2, sm: 0 } }}>
          <Typography variant="subtitle1" sx={{ color: '#00e676', fontWeight: 'bold', mb: 1, fontSize: { xs: '1.1rem', sm: '1.2rem' }, textShadow: '0px 0px 5px rgba(0, 230, 118, 0.5)' }}>
            Peak Launch Hours:
          </Typography>
          {stats.stats.peak_hours.map((peak, idx) => (
            <Typography key={idx} variant="body2" sx={{ color: '#ffffff', mb: 0.5, fontSize: { xs: '0.95rem', sm: '1rem' }, fontWeight: 'medium', textShadow: '0px 0px 3px rgba(255, 255, 255, 0.3)' }}>
              {new Date(0, 0, 0, peak.hour).toLocaleTimeString([], { hour: 'numeric', hour12: true })} - {peak.count} launches
            </Typography>
          ))}
        </Box>

        <Box sx={{ flex: '1 1 auto', minWidth: { xs: '100%', sm: '30%' }, mb: { xs: 2, sm: 0 } }}>
          <Typography variant="subtitle1" sx={{ color: '#00e676', fontWeight: 'bold', mb: 1, fontSize: { xs: '1.1rem', sm: '1.2rem' }, textShadow: '0px 0px 5px rgba(0, 230, 118, 0.5)' }}>
            Most Active Days:
          </Typography>
          {stats.stats.top_days.map((day, idx) => (
            <Typography key={idx} variant="body2" sx={{ color: '#ffffff', mb: 0.5, fontSize: { xs: '0.95rem', sm: '1rem' }, fontWeight: 'medium', textShadow: '0px 0px 3px rgba(255, 255, 255, 0.3)' }}>
              {dayNames[day.day]} - {day.count} launches
            </Typography>
          ))}
        </Box>

        <Box sx={{ flex: '1 1 auto', minWidth: { xs: '100%', sm: '30%' }, mb: { xs: 2, sm: 0 } }}>
          <Typography variant="subtitle1" sx={{ color: '#00e676', fontWeight: 'bold', mb: 1, fontSize: { xs: '1.1rem', sm: '1.2rem' }, textShadow: '0px 0px 5px rgba(0, 230, 118, 0.5)' }}>
            Monthly Distribution:
          </Typography>
          <Typography variant="body2" sx={{ color: '#ffffff', fontSize: { xs: '0.95rem', sm: '1rem' }, fontWeight: 'medium', textShadow: '0px 0px 3px rgba(255, 255, 255, 0.3)' }}>
            Early Month: {stats.stats.month_distribution.early} launches
            <br />
            Late Month: {stats.stats.month_distribution.late} launches
          </Typography>
        </Box>

        {/* New Box for Average ATHMC */}
        <Box sx={{ flex: '1 1 auto', minWidth: { xs: '100%', sm: '30%' }, mb: { xs: 2, sm: 0 } }}>
          <Typography variant="subtitle1" sx={{ color: '#00e676', fontWeight: 'bold', mb: 1, fontSize: { xs: '1.1rem', sm: '1.2rem' }, textShadow: '0px 0px 5px rgba(0, 230, 118, 0.5)' }}>
            Typical ATH Market Cap (Last 30d):
          </Typography>
          <Typography variant="body2" sx={{ color: '#ffffff', fontSize: { xs: '0.95rem', sm: '1rem' }, fontWeight: 'medium', textShadow: '0px 0px 3px rgba(255, 255, 255, 0.3)' }}>
            Median: {formatMarketCap(stats.stats.athmc_stats.median)}
            <br />
            Range (25th-75th): {formatMarketCap(stats.stats.athmc_stats.p25)} - {formatMarketCap(stats.stats.athmc_stats.p75)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default RunnerStats;
