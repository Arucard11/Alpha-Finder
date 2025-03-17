// src/components/CoinConveyer.jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import CoinCard from './CoinCard';

const CoinConveyer = () => {
  const [coins, setCoins] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/coins')
      .then((response) => response.json())
      .then((data) => setCoins(data))
      .catch((err) => console.error('Error fetching coins:', err));
  }, []);

  // Duplicate the coin list for a seamless loop
  const coinList = coins.concat(coins);

  return (
    <Box
      sx={{
        backgroundColor: '#1d1d1d',
        padding: '10px 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Typography variant="h6" sx={{ color: '#00e676', textAlign: 'center', mb: 1 }}>
        Runners– Past Month
      </Typography>
      <motion.div
        style={{ display: 'flex', whiteSpace: 'nowrap' }}
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
      >
        {coinList.map((coin, index) => (
          <CoinCard key={index} coin={coin} />
        ))}
      </motion.div>
    </Box>
  );
};

export default CoinConveyer;
