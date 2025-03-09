import React from 'react';
import { Stack, ToggleButtonGroup, ToggleButton, Slider, TextField, Typography, Box } from '@mui/material';

function Filters() {
  return (
    <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ mb: 3 }}>
      <ToggleButtonGroup size="small" exclusive>
        <ToggleButton value="desc">Score: High-Low</ToggleButton>
        <ToggleButton value="asc">Score: Low-High</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ width: 150 }}>
        <Typography variant="caption" color="textSecondary">
          Min Confidence
        </Typography>
        <Slider defaultValue={0} min={0} max={100} step={5} valueLabelDisplay="auto" color="primary" />
      </Box>
      <TextField variant="outlined" size="small" label="Search Address" sx={{ minWidth: 180 }} />
    </Stack>
  );
}

export default Filters;
