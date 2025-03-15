// src/components/CoinConveyer.jsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardMedia } from '@mui/material';
import { motion } from 'framer-motion';

const CoinConveyer = () => {
  const [coins, setCoins] = useState([]);

  useEffect(() => {
    // Replace with your actual coin endpoint
    fetch('http://localhost:5000/coins')
      .then((response) => response.json())
      .then((data) => {
        setCoins(data);
      })
      .catch((err) => {
        console.error('Error fetching coins:', err);
      });
  }, []);

  return (
    <Box
      sx={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        position: 'relative',
        background: '#1d1d1d',
        padding: '10px 0'
      }}
    >
      <motion.div
        animate={{ x: [-100, 0] }} // Adjust animation as needed
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      >
        {coins.map((coin) => (
          <Card key={coin.id} sx={{ display: 'inline-block', margin: '0 20px', cursor: 'pointer' }}>
            <CardMedia
              component="img"
              image={coin.logouri}
              alt={coin.name}
              sx={{ width: 50, height: 50 }}
            />
            <Typography variant="subtitle2">{coin.symbol}</Typography>
            <Typography variant="caption">ATH: {coin.athprice}</Typography>
          </Card>
        ))}
      </motion.div>
    </Box>
  );
};

export default CoinConveyer;
