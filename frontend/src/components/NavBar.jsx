import React from 'react';
import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

function NavBar() {
  return (
    <AppBar position="static" sx={{ background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <Toolbar>
        <IconButton edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" color="textPrimary">
          Modern Dashboard
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

export default NavBar;
