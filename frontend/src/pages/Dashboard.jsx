// src/pages/Dashboard.jsx
import React from 'react';
import Header from '../components/Header';
import LeaderboardContainer from '../components/LeaderboardContainer';
// import CoinConveyer from '../components/CoinConveyer';
import ThreeBackground from '../components/ThreeBackground';
import { Container, Grid } from '@mui/material';
import { useLocation } from 'react-router-dom';
import RunnerStats from '../components/RunnerStats';

const Dashboard = () => {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;

  return (
    <div>
      {/* These animated components are placed at the top level so they won't be re-rendered
          when the leaderboard updates */}
      <ThreeBackground />
      {/* <CoinConveyer /> */}
      <Header isAdmin={isAdmin} />
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <RunnerStats />
          </Grid>
          <Grid item xs={12} md={8}>
            <LeaderboardContainer />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
};

export default Dashboard;
