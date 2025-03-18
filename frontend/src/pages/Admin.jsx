// src/pages/Admin.jsx
import React, { useState } from 'react';
import { Container, TextField, Button, Typography, Box, Snackbar, Alert } from '@mui/material';
import Header from '../components/Header';
import { useLocation } from 'react-router-dom';

const Admin = () => {
  const location = useLocation();
  const isAdmin =
    location.state?.isAdmin || localStorage.getItem('isAdmin') === 'true';

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    severity: 'success',
    message: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch('http://localhost:5000/admin/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to add whitelist entry.');
        }
        return  setSnackbar({
          open: true,
          severity: 'success',
          message: 'Whitelist entry added successfully!',
        });
      })
      .catch((err) => {
        console.error('Error adding whitelist entry:', err);
        setSnackbar({
          open: true,
          severity: 'error',
          message: err.message || 'Error adding whitelist entry.',
        });
      });
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar({ ...snackbar, open: false });
  };

  if (!isAdmin) {
    return <Typography variant="h4" align="center">Access Denied</Typography>;
  }

  return (
    <div>
      <Header isAdmin={true} />
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Add Whitelist Entry
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Address"
            fullWidth
            margin="normal"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>
            Add Entry
          </Button>
        </Box>
      </Container>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Admin;
