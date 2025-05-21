// src/pages/Login.jsx
import React, { useState } from 'react';
import { Container, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const navigate = useNavigate();

  const connectWallet = async () => {
    // Check if Phantom is installed
    if (window.solana && window.solana.isPhantom) {
      try {
        // Request wallet connection
        const response = await window.solana.connect();
        const address = response.publicKey.toString();
        setWalletAddress(address);

        // Check whitelist status via your backend
        const res = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/auth/checkWhitelist/${address}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.isWhitelisted) {
          // Store admin rights in localStorage for persistent access
          localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false');
          navigate('/dashboard', { state: { isAdmin: data.isAdmin } });
        } else {
          alert('You are not whitelisted to access the dashboard.');
        }
      } catch (err) {
        console.error('Wallet connection failed', err);
        alert('Failed to connect to Phantom wallet.');
      }
    } else {
      alert('Phantom wallet not found. Please install it.');
    }
  };

  return (
    <Container
      maxWidth="sm"
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212'
      }}
    >
      <Typography variant="h3" sx={{ color: '#00e676', mb: 4 }}>
        Spectra Dashboard
      </Typography>
      {walletAddress ? (
        <Typography variant="h6" sx={{ color: '#ffffff' }}>
          Wallet Connected: {walletAddress}
        </Typography>
      ) : (
        <Button
          onClick={connectWallet}
          variant="contained"
          sx={{
            backgroundColor: '#00e676',
            '&:hover': { backgroundColor: '#00c85f' },
            fontWeight: 'bold',
            fontSize: '1rem',
            px: 4,
            py: 1.5
          }}
        >
          Connect Phantom Wallet
        </Button>
      )}
    </Container>
  );
};

export default Login;
