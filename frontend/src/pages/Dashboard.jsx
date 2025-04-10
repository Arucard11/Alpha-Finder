// src/pages/Dashboard.jsx
import React from 'react';
import Header from '../components/Header';
import LeaderboardContainer from '../components/LeaderboardContainer';
import ThreeBackground from '../components/ThreeBackground';
import { Container, Grid, Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import RunnerStats from '../components/RunnerStats';

const Dashboard = () => {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <ThreeBackground />
      <Header isAdmin={isAdmin} />
      <Box sx={{ 
        display: 'flex', 
        height: 'calc(100vh - 64px)', // Account for header height
        position: 'relative',
        overflow: 'hidden',
        mt: 0 // Remove margin top
      }}>
        <Box sx={{ 
          width: 300, 
          position: 'fixed', 
          left: 0, 
          top: 64, // Match header height
          height: 'calc(100vh - 64px)',
          overflowY: 'auto'
        }}>
          <RunnerStats />
        </Box>
        <Box sx={{ 
          marginLeft: '300px', 
          width: 'calc(100vw - 300px)',
          height: '100%',
          overflow: 'hidden',
          p: 2
        }}>
          <LeaderboardContainer />
        </Box>
      </Box>
    </div>
  );
};

export default Dashboard;
