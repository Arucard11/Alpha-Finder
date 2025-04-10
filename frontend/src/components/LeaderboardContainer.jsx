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
    <Box sx={{ mt: 2, mx: 'auto', maxWidth: '1200px' }}> {/* Reduced max width */}
      <Tabs 
        value={timeframe} 
        onChange={handleTabChange} 
        centered 
        textColor="primary" 
        indicatorColor="primary"
        sx={{
          '& .MuiTab-root': {
            fontSize: '1.1rem',
            fontWeight: 'bold',
          }
        }}
      >
        <Tab label="All-Time" value="all-time" />
        <Tab label="90-Day" value="90-day" />
        <Tab label="30-Day" value="30-day" />
        <Tab label="7-Day" value="7-day" />
      </Tabs>
      <Box sx={{ mt: 3, mb: 3, display: 'flex', justifyContent: 'center' }}>
        <FormControl variant="outlined" sx={{ minWidth: 250 }}>
          <InputLabel id="filter-label" sx={{ fontSize: '1.1rem' }}>Filter</InputLabel>
          <Select
            labelId="filter-label"
            label="Filter"
            value={filter}
            onChange={handleFilterChange}
            sx={{ fontSize: '1.1rem' }}
          >
            <MenuItem value="pnl" sx={{ fontSize: '1.1rem' }}>Most Profit / PnL</MenuItem>
            <MenuItem value="confidence" sx={{ fontSize: '1.1rem' }}>Confidence Score</MenuItem>
            <MenuItem value="runners" sx={{ fontSize: '1.1rem' }}>Most Runners</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <InfiniteScrollLeaderboard key={`${timeframe}-${filter}`} type={timeframe} filter={filter} />
    </Box>
  );
};

export default LeaderboardContainer;
