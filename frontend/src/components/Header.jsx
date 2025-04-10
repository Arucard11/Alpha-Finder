// src/components/Header.jsx
import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link } from 'react-router-dom';
import SearchBar from './SearchBar';

const Header = ({ isAdmin }) => {
  const admin = isAdmin || localStorage.getItem('isAdmin') === 'true';

  return (
    <AppBar position="static" sx={{ background: '#1d1d1d' }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div">
          Spectra
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SearchBar />
          <Button component={Link} to="/dashboard" color="inherit">
            Dashboard
          </Button>
          {admin && (
            <Button component={Link} to="/admin" color="inherit">
              Admin
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
