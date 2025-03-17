// src/components/LeaderboardContainer.jsx
import React, { useState } from 'react';
import { Tabs, Tab, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import InfiniteScrollLeaderboard from './InfiniteScrollLeaderboard';

const LeaderboardContainer = () => {
  const [timeframe, setTimeframe] = useState('all-time');
  const [filter, setFilter] = useState('confidence'); // or 'pnl', 'runners'

  const handleTabChange = (event, newValue) => {
    setTimeframe(newValue);
  };

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  return (
    <Box sx={{ mt: 4, mx: 'auto', maxWidth: 800 }}>
      <Tabs value={timeframe} onChange={handleTabChange} centered textColor="primary" indicatorColor="primary">
        <Tab label="All-Time" value="all-time" />
        <Tab label="90-Day" value="90-day" />
        <Tab label="30-Day" value="30-day" />
        <Tab label="7-Day" value="7-day" />
      </Tabs>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <FormControl variant="outlined" sx={{ minWidth: 200 }}>
          <InputLabel id="filter-label">Filter</InputLabel>
          <Select
            labelId="filter-label"
            label="Filter"
            value={filter}
            onChange={handleFilterChange}
          >
            <MenuItem value="pnl">Most Profit / PnL</MenuItem>
            <MenuItem value="confidence">Confidence Score</MenuItem>
            <MenuItem value="runners">Most Runners</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {/* Pass a key based on timeframe and filter */}
      <InfiniteScrollLeaderboard key={`${timeframe}-${filter}`} type={timeframe} filter={filter} />
    </Box>
  );
};

export default LeaderboardContainer;
