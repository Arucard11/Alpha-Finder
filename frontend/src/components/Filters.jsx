// src/components/Filters.jsx
import React from 'react';
import { Stack, TextField } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';

const badgeOptions = [
  'Legendary Buyer',
  'High-Conviction Buyer',
  'Potential Alpha',
  'Mid Trader',
  'Degen Sprayer',
  'One-Hit Wonder',
  'Diamond Hands Buyer',
  'Whale Buyer',
  'Dead Wallet',
  'Comeback Trader',
  'Volume Factor'
];

function Filters({ sortBy, setSortBy, badgeFilter, setBadgeFilter, searchQuery, setSearchQuery }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 3, alignItems: 'center', justifyContent: 'center' }}
    >
      <TextField
        select
        SelectProps={{ native: true }}
        label="Sort By"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value)}
        sx={{
          minWidth: 150,
          background: '#fff',
          borderRadius: '4px',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.2)'
        }}
      >
        <option value="highestConfidence">Highest Confidence</option>
        <option value="mostRunners">Most Runners</option>
        <option value="mostProfit">Most Profit (PnL)</option>
      </TextField>
      <Autocomplete
        multiple
        options={badgeOptions}
        value={badgeFilter}
        onChange={(event, newValue) => {
          setBadgeFilter(newValue);
        }}
        renderInput={(params) => (
          <TextField {...params} variant="outlined" label="Badge Filter" placeholder="Select badges" />
        )}
        sx={{
          minWidth: 200,
          background: '#fff',
          borderRadius: '4px',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.2)'
        }}
      />
      <TextField
        variant="outlined"
        size="small"
        label="Search Address"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{
          minWidth: 180,
          background: '#fff',
          borderRadius: '4px',
          boxShadow: '0px 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </Stack>
  );
}

export default Filters;
