// src/components/Header.jsx
import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';

const Header = ({ isAdmin }) => {
  const admin = isAdmin || localStorage.getItem('isAdmin') === 'true';

  return (
    <AppBar position="static" sx={{ background: '#1d1d1d' }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Spectra
        </Typography>
        <Button component={Link} to="/dashboard" color="inherit">
          Dashboard
        </Button>
        {admin && (
          <Button component={Link} to="/admin" color="inherit">
            Admin
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
