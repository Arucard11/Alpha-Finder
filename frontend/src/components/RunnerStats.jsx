import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { format, formatRelative } from 'date-fns';

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
        width: '100%',
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
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', mb: 1 }}>
        <Box sx={{ mr: 3, flexShrink: 0 }}>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium', mb: 1 }}>
            Peak Launch Hours:
          </Typography>
          {stats.stats.peak_hours.map((peak, idx) => (
            <Typography key={idx} variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 0.5 }}>
              {new Date(0, 0, 0, peak.hour).toLocaleTimeString([], { hour: 'numeric', hour12: true })} - {peak.count} launches
            </Typography>
          ))}
        </Box>

        <Box sx={{ mr: 3, flexShrink: 0 }}>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium', mb: 1 }}>
            Most Active Days:
          </Typography>
          {stats.stats.top_days.map((day, idx) => (
            <Typography key={idx} variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 0.5 }}>
              {dayNames[day.day]} - {day.count} launches
            </Typography>
          ))}
        </Box>

        <Box sx={{ mr: 3, flexShrink: 0 }}>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium', mb: 1 }}>
            Monthly Distribution:
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Early Month: {stats.stats.month_distribution.early} launches
            <br />
            Late Month: {stats.stats.month_distribution.late} launches
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default RunnerStats;
