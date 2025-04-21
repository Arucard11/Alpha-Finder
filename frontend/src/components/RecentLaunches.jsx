import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { formatRelative } from 'date-fns';

const RecentLaunches = () => {
  const [runners, setRunners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRunners = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/leaderboard/runner-stats`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Validate data structure
        if (!data.runners) {
          throw new Error('Invalid data structure received from server');
        }
        
        setRunners(data.runners.slice(0, 5));
        setError(null);
      } catch (error) {
        console.error('Error fetching recent launches:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRunners();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={1}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ p: 1, fontSize: '0.8rem' }}>
        Error loading recent launches: {error}
      </Alert>
    );
  }

  if (runners.length === 0) {
    return (
      <Alert severity="info" sx={{ p: 1, fontSize: '0.8rem' }}>
        No recent launches available at the moment.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', animation: 'slideLeft 20s linear infinite', '@keyframes slideLeft': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(-100%)' } } }}>
      {runners.map((runner, idx) => {
        const createdAt = new Date(runner.created_at);
        const isValidDate = !isNaN(createdAt.getTime()) && createdAt.getFullYear() > 1970;
        return (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mr: 3, backgroundColor: 'rgba(0, 230, 118, 0.1)', p: 0.5, borderRadius: 1, flexShrink: 0 }}>
            <img 
              src={runner.logouri} 
              alt={runner.name} 
              style={{ width: 20, height: 20, marginRight: 8, borderRadius: '50%' }}
            />
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#fff', 
                fontSize: '0.8rem', 
                whiteSpace: 'nowrap',
              }}
            >
              {runner.name} ({runner.symbol}) - {isValidDate ? formatRelative(createdAt, new Date()) : 'Date unavailable'}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default RecentLaunches; 