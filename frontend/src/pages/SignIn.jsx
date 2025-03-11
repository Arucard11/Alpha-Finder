import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import NavBar from '../components/NavBar';

function SignIn({ setAuthenticated }) {
  const [error, setError] = useState('');

  const connectPhantom = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const response = await window.solana.connect();
        console.log('Connected:', response.publicKey.toString());
        // Here, add your whitelist check logic.
        setAuthenticated(true);
      } catch (err) {
        setError('Phantom connection rejected.');
      }
    } else {
      setError('Phantom not found. Please install Phantom wallet.');
    }
  };

  return (
    <>
      <NavBar />
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Sign In
        </Typography>
        <Typography variant="body1" gutterBottom>
          Connect your Phantom wallet to sign in.
        </Typography>
        <Button variant="contained" onClick={connectPhantom}>
          Connect Phantom
        </Button>
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </Box>
    </>
  );
}

export default SignIn;
