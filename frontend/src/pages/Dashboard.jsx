// src/pages/Dashboard.jsx
import React from 'react';
import Header from '../components/Header';
import LeaderboardContainer from '../components/LeaderboardContainer';
import CoinConveyer from '../components/CoinConveyer';
import { Container, Grid } from '@mui/material';
import { useLocation } from 'react-router-dom';

const Dashboard = () => {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;

  return (
    <div>
      <Header isAdmin={isAdmin} />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Grid container spacing={4}>
          {/* Leaderboard on top */}
          <Grid item xs={12}>
            <LeaderboardContainer />
          </Grid>
          {/* Coins conveyer on bottom */}
          <Grid item xs={12}>
            <CoinConveyer />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
};

export default Dashboard;
