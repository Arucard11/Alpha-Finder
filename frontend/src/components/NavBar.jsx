import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';

function NavBar() {
  const navigate = useNavigate();
  return (
    <AppBar position="static" sx={{ background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <Toolbar>
        <IconButton edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }}>
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" color="textPrimary" sx={{ flexGrow: 1 }}>
          Modern Dashboard
        </Typography>
        <Button color="primary" onClick={() => navigate('/admin')}>
          Admin
        </Button>
      </Toolbar>
    </AppBar>
  );
}

export default NavBar;
