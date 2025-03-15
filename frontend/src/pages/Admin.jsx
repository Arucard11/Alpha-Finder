// src/pages/Admin.jsx
import React, { useState } from 'react';
import { Container, TextField, Button, Typography, Box } from '@mui/material';
import Header from '../components/Header';
import { useLocation } from 'react-router-dom';

const Admin = () => {
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch('http://localhost:5000/admin/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address })
    })
      .then((response) => response.json())
      .then((res) => {
        alert('Whitelist entry added successfully');
      })
      .catch((err) => {
        console.error('Error adding whitelist entry:', err);
      });
  };

  if (!isAdmin) {
    return <Typography variant="h4" align="center">Access Denied</Typography>;
  }

  return (
    <div>
      <Header isAdmin={true} />
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>Add Whitelist Entry</Typography>
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
    </div>
  );
};

export default Admin;
