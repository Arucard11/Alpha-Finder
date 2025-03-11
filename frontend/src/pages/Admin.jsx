import React from 'react';
import { Box, Typography } from '@mui/material';
import NavBar from '../components/NavBar';

function Admin() {
  return (
    <>
      <NavBar />
      <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          Admin Page
        </Typography>
        <Typography variant="body1">
          This is the admin page. Add your admin functionality here.
        </Typography>
      </Box>
    </>
  );
}

export default Admin;
