// src/pages/Dashboard.jsx
import React from 'react';
import { Box, Grid } from '@mui/material';
import NavBar from '../components/NavBar';
import Leaderboard from '../components/Leaderboard';
import BadgeInfoDialog from '../components/BadgeInfoDialog';

function Dashboard() {
  return (
    <>
      <NavBar />
      <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} md={6}>
            <Leaderboard title="All-Time Leaderboard" category="allTime" />
          </Grid>
          <Grid item xs={12} md={6}>
            <Leaderboard title="90-Day Leaderboard" category="90d" />
          </Grid>
          <Grid item xs={12} md={6}>
            <Leaderboard title="30-Day Leaderboard" category="30d" />
          </Grid>
          <Grid item xs={12} md={6}>
            <Leaderboard title="7-Day Leaderboard" category="7d" />
          </Grid>
        </Grid>
        <BadgeInfoDialog />
      </Box>
    </>
  );
}

export default Dashboard;
