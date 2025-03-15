// src/components/WalletCard.jsx
import React, { useState } from 'react';
import { Card, CardContent, Typography, Button, Box, Chip, Divider } from '@mui/material';
import RunnerAccordion from './RunnerAccordion';

const badgeEmojis = {
  'legendary buyer': '🏆',
  'high-conviction buyer': '💼',
  'potential alpha': '🚀',
  'mid trader': '📈',
  'degen sprayer': '🤪',
  'one-hit wonder': '🎯',
  'diamond hands buyer': '💎',
  'whale buyer': '🐋',
  'dead wallet': '⚰️',
  'comeback trader': '🔥'
};

const WalletCard = ({ wallet, computePnl }) => {
  const [showRunners, setShowRunners] = useState(false);

  // Compute total PnL across all runners
  const totalPnl = wallet.runners.reduce((acc, runner) => acc + computePnl(runner), 0);
  const pnlStyle = { color: totalPnl < 0 ? 'red' : '#00e676', fontWeight: 'bold' };
  const confidenceStyle = { color: Number(wallet.confidence_score) <= 20 ? 'red' : '#ffffff', fontWeight: 'bold' };

  const handleCopyAddress = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet.address);
    alert("Wallet address copied to clipboard!");
  };

  return (
    <Card
      sx={{
        marginBottom: 2,
        backgroundColor: '#272727',
        padding: 2,
        borderRadius: 2,
        border: '1px solid #00e676',
        boxShadow: '0px 0px 10px rgba(0,230,118,0.5)',
        cursor: 'pointer'
      }}
      onClick={handleCopyAddress}
    >
      <CardContent>
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ color: '#00e676', fontWeight: 'bold', wordBreak: 'break-all' }}>
            {wallet.address}
          </Typography>
          <Divider sx={{ my: 1, backgroundColor: '#00e676' }} />
          <Typography variant="body2" sx={{ color: '#ffffff' }}>
            Confidence: <span style={confidenceStyle}>{Number(wallet.confidence_score).toFixed(2)}</span>
          </Typography>
          <Typography variant="body2" sx={{ color: '#ffffff' }}>
            Total PnL: <span style={pnlStyle}>{totalPnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {wallet.badges.map((badge, idx) => {
              const emoji = badgeEmojis[badge.toLowerCase()] || "";
              return (
                <Chip
                  key={idx}
                  label={`${emoji} ${badge}`}
                  sx={{
                    backgroundColor: '#00e676',
                    color: '#121212',
                    fontWeight: 'bold',
                    fontSize: '0.8rem'
                  }}
                />
              );
            })}
          </Box>
        </Box>
        <Button
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            setShowRunners((prev) => !prev);
          }}
          sx={{ mt: 1, color: '#00e676', borderColor: '#00e676' }}
        >
          {showRunners ? 'Hide Runners' : 'See Runners'}
        </Button>
        {showRunners && (
          <Box sx={{ mt: 2, borderTop: '1px solid #00e676', pt: 2 }}>
            {wallet.runners.map((runner, index) => (
              <RunnerAccordion key={index} runner={runner} computePnl={computePnl} />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletCard;
