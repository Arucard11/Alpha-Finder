import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import WalletCard from './WalletCard';
import Filters from './Filters';
import fetchLeaderboardData from '../api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function Leaderboard({ title, category }) {
  const [wallets, setWallets] = useState([]);
  const [viewMode, setViewMode] = useState('cards'); // "cards" or "chart"

  useEffect(() => {
    fetchLeaderboardData(category).then((data) => setWallets(data));
  }, [category]);

  // Prepare aggregated data for chart view
  const aggregatedData = wallets.map((wallet) => {
    let avgRunner = 0;
    if (wallet.runners && wallet.runners.length > 0) {
      avgRunner = wallet.runners.reduce((sum, runner) => sum + runner.score, 0) / wallet.runners.length;
    }
    return {
      address: wallet.address,
      confidence: wallet.confidence,
      avgRunner: parseFloat(avgRunner.toFixed(2)),
    };
  });

  return (
    <Box
      sx={{
        p: 2,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minHeight: '400px',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" color="textPrimary">
          {title}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={(e, newView) => {
            if (newView) setViewMode(newView);
          }}
          color="secondary"
        >
          <ToggleButton value="cards">Cards</ToggleButton>
          <ToggleButton value="chart">Chart</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Filters />
      <AnimatePresence>
        {viewMode === 'cards' ? (
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Grid container spacing={2}>
              {wallets.map((wallet, idx) => (
                <Grid item xs={12} key={wallet.address}>
                  <WalletCard wallet={wallet} rank={idx + 1} />
                </Grid>
              ))}
            </Grid>
          </motion.div>
        ) : (
          <motion.div
            key="chart"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ width: '100%', height: 300 }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregatedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                <XAxis dataKey="address" tick={{ fill: '#000', fontSize: 10 }} />
                <YAxis tick={{ fill: '#000', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    color: '#000',
                  }}
                />
                <Bar dataKey="confidence" fill="#1976d2" name="Confidence" />
                <Bar dataKey="avgRunner" fill="#dc004e" name="Avg Runner Score" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

export default Leaderboard;
