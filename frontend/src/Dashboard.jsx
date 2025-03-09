import React, { useState } from 'react';
import { Box, Grid } from '@mui/material';
import NavBar from './components/NavBar';
import Leaderboard from './components/Leaderboard';
import BadgeInfoDialog from './components/BadgeInfoDialog';

function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <NavBar />
      <Box sx={{ p: 4, minHeight: '100vh' }}>
        <Grid container spacing={4}>
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
        <BadgeInfoDialog open={dialogOpen} handleClose={() => setDialogOpen(false)} />
      </Box>
    </>
  );
}

export default Dashboard;
