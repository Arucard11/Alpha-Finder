import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { formatRelative } from 'date-fns';

// Helper function to format large numbers
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

const RecentLaunches = () => {
  const [runners, setRunners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedAddress, setCopiedAddress] = useState(null);

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
        
        // Remove ATH MC filter, take up to 50 runners
        const filteredRunners = data.runners.slice(0, 50);

        // Debug logging to check data
        console.log('Total runners received:', data.runners.length);
        console.log('Selected runners:', filteredRunners.length);

        // Filter runners with valid logouri
        const runnersWithValidLogos = await Promise.all(
          filteredRunners.map(async (runner) => {
            if (runner.logouri) {
              try {
                const img = new window.Image();
                img.src = runner.logouri;
                await new Promise((resolve, reject) => {
                  img.onload = resolve;
                  img.onerror = reject;
                  setTimeout(reject, 5000); // Timeout after 5 seconds if image doesn't load
                });
                return runner;
              } catch {
                console.log(`Image failed to load for ${runner.name}: ${runner.logouri}`);
                return null;
              }
            }
            return null;
          })
        );

        // Filter out null values (runners with invalid logos)
        const validRunners = runnersWithValidLogos.filter(runner => runner !== null);

        setRunners(validRunners);
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

  useEffect(() => {
    if (copiedAddress) {
      const timer = setTimeout(() => {
        setCopiedAddress(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedAddress]);

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
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'row', sm: 'row' },
        alignItems: 'center',
        gap: 2,
        overflowX: 'auto',
        width: '100%',
        pb: 1,
        '::-webkit-scrollbar': { display: 'block', height: '8px' },
        '::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 230, 118, 0.5)', borderRadius: '4px' },
        animation: 'scroll 20s linear infinite',
        flexWrap: 'nowrap',
        '@keyframes scroll': {
          '0%': { transform: 'translateX(calc(-75% + 75vw))' },
          '100%': { transform: 'translateX(0)' },
        },
      }}
    >
      {runners.map((runner, idx) => {
        console.log('Rendering runner:', runner.name, 'Index:', idx); // Debug log to confirm rendering
        const createdAt = new Date(runner.created);
        const isValidDate = !isNaN(createdAt.getTime()) && createdAt.getFullYear() > 1970;
        return (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              alignItems: 'center',
              minWidth: { xs: 180, sm: 160 }, // Reduced width to fit more items
              maxWidth: 300,
              backgroundColor: 'rgba(0, 230, 118, 0.1)',
              p: 1,
              borderRadius: 2,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,230,118,0.08)',
              gap: 1,
            }}
          >
            <img
              src={runner.logouri}
              alt={runner.name}
              style={{ width: 32, height: 32, marginRight: 10, borderRadius: '50%' }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  color: '#fff',
                  fontSize: { xs: '1rem', sm: '0.95rem' },
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {runner.name} ({runner.symbol})
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#b0bec5',
                  fontSize: { xs: '0.75rem', sm: '0.7rem' },
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%', // Ensure it doesn't overflow the container
                  cursor: 'pointer', // Indicate clickable
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
                title={runner.address} // Full address on hover
                onClick={() => {
                  navigator.clipboard.writeText(runner.address);
                  setCopiedAddress(runner.address); // Set the copied address for feedback
                }}
              >
                Addr: {runner.address.slice(0, 6)}...{runner.address.slice(-4)}
              </Typography>
              {copiedAddress === runner.address && (
                <Typography
                  variant="caption"
                  sx={{
                    color: '#00e676', // Bright green for feedback
                    fontSize: { xs: '0.75rem', sm: '0.7rem' },
                    whiteSpace: 'nowrap',
                    mt: 0.2,
                  }}
                >
                  Copied!
                </Typography>
              )}
              <Typography
                variant="caption"
                sx={{
                  color: '#00e676',
                  fontSize: { xs: '0.85rem', sm: '0.8rem' },
                  whiteSpace: 'nowrap',
                }}
              >
                {isValidDate ? formatRelative(createdAt, new Date()) : 'Date unavailable'}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default RecentLaunches; 