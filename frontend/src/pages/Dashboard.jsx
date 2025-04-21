// src/pages/Dashboard.jsx
import React from 'react';
import Header from '../components/Header';
import LeaderboardContainer from '../components/LeaderboardContainer';
import ThreeBackground from '../components/ThreeBackground';
import { Container, Grid, Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import RunnerStats from '../components/RunnerStats';
import PriceChart from '../components/PriceChart';
import RecentLaunches from '../components/RecentLaunches';

const Dashboard = () => {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <ThreeBackground />
      <Header isAdmin={isAdmin} />
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: 'calc(100vh - 64px)', // Account for header height
        position: 'relative',
        overflow: 'hidden',
        mt: 0,
        background: 'linear-gradient(to bottom, #1d1d1d, #2d2d2d)', // Subtle gradient for depth
      }}>
        <Typography variant="h6" sx={{ color: '#00e676', p: 1, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: '#272727', borderBottom: '1px solid #00e676', boxShadow: '0px 0px 5px rgba(0,230,118,0.3)' }}>
          Runner Stats
        </Typography>
        <Box sx={{ 
          width: '100%',
          backgroundColor: '#272727',
          borderBottom: '1px solid #00e676',
          boxShadow: '0px 0px 10px rgba(0,230,118,0.3)',
          p: 2,
          height: 'auto',
          minHeight: '150px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}>
          <RunnerStats />
          <Box sx={{ width: '100%', overflow: 'hidden', borderTop: '1px solid rgba(0, 230, 118, 0.3)', pt: 1 }}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium', mb: 0.5 }}>
              Recent Launches:
            </Typography>
            <RecentLaunches />
          </Box>
        </Box>
        <Box sx={{ 
          width: '100%',
          height: 'calc(100vh - 64px - 170px - 40px)', // Adjust height based on RunnerStats and title height
          overflow: 'auto',
          p: { xs: 1, sm: 3 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <LeaderboardContainer />
          <PriceChart />
        </Box>
      </Box>
    </div>
  );
};

export default Dashboard;
