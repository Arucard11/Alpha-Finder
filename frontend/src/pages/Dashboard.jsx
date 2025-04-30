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
    <div>
      <ThreeBackground />
      <Header isAdmin={isAdmin} />
      {/* Main Content (no margin-top needed) */}
      <Box sx={{
        width: '100%',
        overflow: 'visible',
        p: { xs: 1, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <LeaderboardContainer />
      </Box>
      {/* RunnerStats Section (static/relative) */}
      <Box sx={{
        width: '100%',
        maxWidth: '1200px',
        mx: 'auto',
        background: 'linear-gradient(to bottom, #1d1d1d, #2d2d2d)',
        boxShadow: '0px 2px 10px rgba(0,0,0,0.2)',
        borderBottom: '1px solid #00e676',
        borderRadius: 2,
        mt: 3,
      }}>
        <Typography variant="h6" sx={{ color: '#00e676', p: 1, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', backgroundColor: '#272727', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottom: '1px solid #00e676', boxShadow: '0px 0px 5px rgba(0,230,118,0.3)' }}>
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
          gap: 2,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}>
          <RunnerStats />
          <Box sx={{ width: '100%', overflow: 'hidden', borderTop: '1px solid rgba(0, 230, 118, 0.3)', pt: 1 }}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'medium', mb: 0.5 }}>
              Recent Launches:
            </Typography>
            <RecentLaunches />
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default Dashboard;
