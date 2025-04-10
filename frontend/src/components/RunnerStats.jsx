import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { format, formatRelative } from 'date-fns';

const RunnerStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/leaderboard/runner-stats`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching runner stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <CircularProgress />;
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <Paper 
      sx={{ 
        p: 2, 
        backgroundColor: '#272727',
        border: '1px solid #00e676',
        boxShadow: '0px 0px 4px rgba(0,230,118,0.5)',
      }}
    >
      <Typography variant="h6" sx={{ color: '#00e676', mb: 2 }}>
        Runner Launch Statistics
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#fff' }}>
          Peak Launch Hours (Local Time):
        </Typography>
        {stats.stats.peak_hours.map((peak, idx) => (
          <Typography key={idx} variant="body2" sx={{ color: '#fff' }}>
            {format(new Date(peak.hour), 'PPP p')} - {peak.count} launches
          </Typography>
        ))}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ color: '#fff' }}>
          Most Active Days:
        </Typography>
        {stats.stats.top_days.map((day, idx) => (
          <Typography key={idx} variant="body2" sx={{ color: '#fff' }}>
            {dayNames[day.day]} - {day.count} launches
          </Typography>
        ))}
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ color: '#fff' }}>
          Monthly Distribution:
        </Typography>
        <Typography variant="body2" sx={{ color: '#fff' }}>
          Early Month: {stats.stats.month_distribution.early} launches
          <br />
          Late Month: {stats.stats.month_distribution.late} launches
        </Typography>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" sx={{ color: '#fff' }}>
          Recent Launches:
        </Typography>
        {stats.runners.slice(0, 5).map((runner, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <img 
              src={runner.logouri} 
              alt={runner.name} 
              style={{ width: 20, height: 20, marginRight: 8 }}
            />
            <Typography variant="body2" sx={{ color: '#fff' }}>
              {runner.name} ({runner.symbol}) - {formatRelative(new Date(runner.created_at), new Date())}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default RunnerStats;
