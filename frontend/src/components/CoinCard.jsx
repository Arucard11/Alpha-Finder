// src/components/CoinCard.jsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardContent, CardMedia, Typography } from '@mui/material';
import CoinChart from './CoinChart';

const CoinCard = ({ coin }) => {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  // Render overlay using a portal
  const overlay = hovered && ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ width: '90%', maxWidth: '600px', height: '300px' }}>
        <CoinChart coin={coin} />
      </div>
    </div>,
    document.getElementById('chart-overlay')
  );

  return (
    <>
      <Card
        sx={{
          display: 'inline-block',
          margin: '0 10px',
          cursor: 'pointer',
          verticalAlign: 'top',
          backgroundColor: '#272727',
          border: '1px solid #00e676',
          boxShadow: '0px 0px 4px rgba(0,230,118,0.5)',
          width: 80,
          height: 120, // fixed height for uniformity
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <CardMedia
          component="img"
          image={coin.logouri}
          alt={coin.name}
          sx={{
            width: 50,
            height: 50,
            margin: '0 auto',
            display: 'block',
          }}
        />
        <CardContent sx={{ padding: '2px', textAlign: 'center' }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontSize: '0.7rem',
              fontWeight: 'bold',
              color: '#00e676',
            }}
          >
            {coin.name}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.65rem' }}>
            ATH: {Number(coin.athprice).toFixed(4)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.65rem',
              fontWeight: 'bold',
              color: coin.checked ? '#00e676' : 'red',
            }}
          >
            {coin.checked ? 'Checked' : 'Not Checked'}
          </Typography>
        </CardContent>
      </Card>
      {overlay}
    </>
  );
};

export default CoinCard;
