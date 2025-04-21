// src/components/Header.jsx
import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Drawer, List, ListItem, ListItemButton, ListItemText } from '@mui/material';
import { Link } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import SearchBar from './SearchBar';

const Header = ({ isAdmin }) => {
  const admin = isAdmin || localStorage.getItem('isAdmin') === 'true';
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard' },
    ...(admin ? [{ label: 'Admin', path: '/admin' }] : []),
  ];

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2, fontWeight: 'bold', color: '#00e676' }}>
        SPECTRA
      </Typography>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton component={Link} to={item.path} sx={{ textAlign: 'center' }}>
              <ListItemText primary={item.label} sx={{ color: '#fff' }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <AppBar position="static" sx={{ background: 'rgba(29, 29, 29, 0.9)', boxShadow: '0 4px 20px rgba(0, 230, 118, 0.2)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0, 230, 118, 0.3)' }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: '#00e676', letterSpacing: '1px' }}>
            SPECTRA
          </Typography>
        </Box>
        
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
          <SearchBar />
          {menuItems.map((item) => (
            <Button key={item.label} component={Link} to={item.path} color="inherit" sx={{ textTransform: 'none', fontWeight: 'medium', '&:hover': { color: '#00e676' } }}>
              {item.label}
            </Button>
          ))}
        </Box>

        <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center' }}>
          <SearchBar />
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="end"
            onClick={handleDrawerToggle}
            sx={{ ml: 1, color: '#fff' }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Toolbar>
      <Box component="nav">
        <Drawer
          anchor="right"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240, background: 'rgba(29, 29, 29, 0.9)', color: '#fff' },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
    </AppBar>
  );
};

export default Header;
