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
  Button,
  FormControlLabel
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
  const [excludeBots, setExcludeBots] = useState(false);
  const [athmcThreshold, setAthmcThreshold] = useState('');

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

  const handleExcludeBotsChange = (event) => {
    setExcludeBots(event.target.checked);
  };

  const handleAthmcThresholdChange = (event) => {
    setAthmcThreshold(event.target.value);
  };

  return (
    <Box sx={{ mt: 2, mx: 'auto', width: '100%', maxWidth: '1200px', backgroundColor: 'rgba(39, 39, 39, 0.6)', borderRadius: 2, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)', p: 3, backdropFilter: 'blur(5px)', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
      {/* Timeframe Tabs */}
      <Tabs
        value={timeframe}
        onChange={handleTabChange}
        centered
        textColor="primary"
        indicatorColor="primary"
        sx={{
          '& .MuiTab-root': {
            fontSize: { xs: '0.9rem', sm: '1.1rem' },
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-selected': {
              color: '#00e676',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#00e676',
            height: 3,
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
        <FormControl variant="outlined" sx={{ minWidth: { xs: 200, sm: 250 }, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(0, 230, 118, 0.3)' }, '&:hover fieldset': { borderColor: '#00e676' } } }}>
          <InputLabel id="sortby-label" sx={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)' }}>Sort By</InputLabel>
          <Select
            labelId="sortby-label"
            label="Sort By"
            value={sortBy}
            onChange={handleSortByChange}
            sx={{ fontSize: '1.1rem', color: '#fff' }}
          >
            <MenuItem value="pnl" sx={{ fontSize: '1.1rem' }}>Most Profit / PnL</MenuItem>
            <MenuItem value="confidence" sx={{ fontSize: '1.1rem' }}>Confidence Score</MenuItem>
            <MenuItem value="runners" sx={{ fontSize: '1.1rem' }}>Most Runners</MenuItem>
          </Select>
        </FormControl>

        {/* Badge Filter */}
        <FormControl variant="outlined" sx={{ minWidth: { xs: 200, sm: 250 }, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(0, 230, 118, 0.3)' }, '&:hover fieldset': { borderColor: '#00e676' } } }}>
          <InputLabel id="badge-filter-label" sx={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)' }}>Filter by Badges</InputLabel>
          <Select
            labelId="badge-filter-label"
            id="badge-multiple-checkbox"
            multiple
            value={selectedBadges}
            onChange={handleBadgeChange}
            input={<OutlinedInput label="Filter by Badges" />}
            renderValue={(selected) => selected.map(badge => `${badgeEmojis[badge.toLowerCase()] || ''} ${badge}`).join(', ')}
            MenuProps={{
              PaperProps: { style: { maxHeight: 48 * 6.5 + 8, width: 300, backgroundColor: '#333', color: '#fff' } },
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
            sx={{ fontSize: '1.1rem', color: '#fff' }}
          >
            {allBadges.map((badge) => {
              const emoji = badgeEmojis[badge.toLowerCase()] || '';
              return (
                <MenuItem key={badge} value={badge} sx={{ fontSize: '1.1rem', '&.Mui-selected': { backgroundColor: 'rgba(0, 230, 118, 0.2)' } }}>
                  <Checkbox checked={selectedBadges.indexOf(badge) > -1} sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#00e676' } }} />
                  <ListItemText primary={`${emoji} ${badge}`} />
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        {/* Exclude Bots Checkbox */}
        <FormControlLabel
          control={
            <Checkbox 
              checked={excludeBots} 
              onChange={handleExcludeBotsChange} 
              sx={{ color: 'rgba(255, 255, 255, 0.7)', '&.Mui-checked': { color: '#00e676' } }} 
            />
          }
          label="Exclude Bots"
          sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}
        />

        {/* ATHMC Threshold Filter */}
        <FormControl variant="outlined" sx={{ minWidth: { xs: 200, sm: 250 }, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(0, 230, 118, 0.3)' }, '&:hover fieldset': { borderColor: '#00e676' } } }}>
          <InputLabel id="athmc-threshold-label" sx={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)' }}>ATHMC Threshold</InputLabel>
          <Select
            labelId="athmc-threshold-label"
            label="ATHMC Threshold"
            value={athmcThreshold}
            onChange={handleAthmcThresholdChange}
            sx={{ fontSize: '1.1rem', color: '#fff' }}
          >
            <MenuItem value="" sx={{ fontSize: '1.1rem' }}>None</MenuItem>
            <MenuItem value="2000000" sx={{ fontSize: '1.1rem' }}>2 Million</MenuItem>
            <MenuItem value="5000000" sx={{ fontSize: '1.1rem' }}>5 Million</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Leaderboard Display - Update key and pass badgeFilter */}
      <InfiniteScrollLeaderboard
        key={`${timeframe}-${sortBy}-${selectedBadges.join(',')}-${excludeBots}-${athmcThreshold}`}
        type={timeframe}
        sortBy={sortBy}
        badgeFilter={selectedBadges}
        excludeBots={excludeBots}
        athmcThreshold={athmcThreshold ? parseInt(athmcThreshold) : null}
      />
    </Box>
  );
};

export default LeaderboardContainer;
