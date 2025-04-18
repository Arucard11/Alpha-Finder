// src/components/LeaderboardContainer.jsx
import React, { useState } from 'react';
import {
  Tabs,
  Tab,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Typography,
} from '@mui/material';
import InfiniteScrollLeaderboard from './InfiniteScrollLeaderboard';
import { badgeEmojis } from '../utils/badgeMappings';

// Define all possible badges (keys from the mapping)
// Convert to lowercase now for easier lookup later if needed, or handle in map
const allBadges = Object.keys(badgeEmojis);

const LeaderboardContainer = () => {
  const [timeframe, setTimeframe] = useState('all-time');
  const [sortBy, setSortBy] = useState('confidence');
  const [selectedBadges, setSelectedBadges] = useState([]);

  const handleTabChange = (event, newValue) => {
    setTimeframe(newValue);
  };

  const handleSortByChange = (event) => {
    setSortBy(event.target.value);
  };

  const handleBadgeChange = (event) => {
    const {
      target: { value },
    } = event;
    setSelectedBadges(typeof value === 'string' ? value.split(',') : value);
  };

  return (
    <Box sx={{ mt: 2, mx: 'auto', maxWidth: '1200px' }}>
      {/* Timeframe Tabs */}
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
          },
        }}
      >
        <Tab label="All-Time" value="all-time" />
        <Tab label="90-Day" value="90-day" />
        <Tab label="30-Day" value="30-day" />
        <Tab label="7-Day" value="7-day" />
      </Tabs>

      {/* Filter Controls */}
      <Box sx={{ mt: 3, mb: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Sort By Filter */}
        <FormControl variant="outlined" sx={{ minWidth: 250 }}>
          <InputLabel id="sortby-label" sx={{ fontSize: '1.1rem' }}>Sort By</InputLabel>
          <Select
            labelId="sortby-label"
            label="Sort By"
            value={sortBy}
            onChange={handleSortByChange}
            sx={{ fontSize: '1.1rem' }}
          >
            <MenuItem value="pnl" sx={{ fontSize: '1.1rem' }}>Most Profit / PnL</MenuItem>
            <MenuItem value="confidence" sx={{ fontSize: '1.1rem' }}>Confidence Score</MenuItem>
            <MenuItem value="runners" sx={{ fontSize: '1.1rem' }}>Most Runners</MenuItem>
          </Select>
        </FormControl>

        {/* Badge Filter */}
        <FormControl variant="outlined" sx={{ minWidth: 250 }}>
          <InputLabel id="badge-filter-label" sx={{ fontSize: '1.1rem' }}>Filter by Badges</InputLabel>
          <Select
            labelId="badge-filter-label"
            id="badge-multiple-checkbox"
            multiple
            value={selectedBadges}
            onChange={handleBadgeChange}
            input={<OutlinedInput label="Filter by Badges" />}
            renderValue={(selected) => selected.map(badge => `${badgeEmojis[badge.toLowerCase()] || ''} ${badge}`).join(', ')}
            MenuProps={{
              PaperProps: { style: { maxHeight: 48 * 6.5 + 8, width: 300 } },
              getContentAnchorEl: null,
              anchorOrigin: {
                vertical: "bottom",
                horizontal: "center"
              },
              transformOrigin: {
                vertical: "top",
                horizontal: "center"
              },
              variant: "menu"
            }}
            sx={{ fontSize: '1.1rem' }}
          >
            {allBadges.map((badge) => {
              const emoji = badgeEmojis[badge.toLowerCase()] || '';
              return (
                <MenuItem key={badge} value={badge} sx={{ fontSize: '1.1rem' }}>
                  <Checkbox checked={selectedBadges.indexOf(badge) > -1} />
                  <ListItemText primary={`${emoji} ${badge}`} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>

      {/* Leaderboard Display - Update key and pass badgeFilter */}
      <InfiniteScrollLeaderboard
        key={`${timeframe}-${sortBy}-${selectedBadges.join(',')}`}
        type={timeframe}
        sortBy={sortBy}
        badgeFilter={selectedBadges}
      />
    </Box>
  );
};

export default LeaderboardContainer;
