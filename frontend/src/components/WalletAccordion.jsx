// src/components/WalletAccordion.jsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
  'comeback trader': '🔥',
};

const WalletAccordion = ({ wallet, computePnl }) => {
  const [open, setOpen] = useState(false);

  // Deduplicate runners by address
  const uniqueRunners = wallet.runners.filter(
    (runner, idx, arr) => arr.findIndex((r) => r.address === runner.address) === idx
  );

  // Compute total PnL from unique runners
  const totalPnl = uniqueRunners.reduce(
    (acc, runner) => acc + computePnl(runner),
    0
  );

  // Style PnL: red if negative, neon green if positive
  const pnlStyle = {
    color: totalPnl < 0 ? 'red' : '#00e676',
    fontWeight: 'bold',
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet.address);
    alert('Wallet address copied to clipboard!');
  };

  const handleOpenDialog = (e) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
  };

  return (
    <>
      {/* Wallet Card */}
      <Box
        sx={{
          backgroundColor: '#272727',
          color: '#fff',
          marginBottom: 2,
          padding: 1,
          border: '1px solid #00e676',
          boxShadow: '0px 0px 4px rgba(0,230,118,0.5)',
          borderRadius: 1,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {/* Confidence Score */}
          <Typography variant="body1" sx={{ color: '#00e676', fontWeight: 'bold' }}>
            Confidence Score: {Number(wallet.confidence_score).toFixed(2)}
          </Typography>
          {/* Wallet Address with Copy Icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1, wordBreak: 'break-all' }}>
              {wallet.address}
            </Typography>
            <IconButton onClick={handleCopy} size="small" sx={{ color: '#00e676' }}>
              <ContentCopyIcon />
            </IconButton>
          </Box>
          {/* PnL */}
          <Typography variant="body2">
            PnL: <span style={pnlStyle}>{totalPnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
          </Typography>
          {/* Badges */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {wallet.badges.map((badge, idx) => {
              const emoji = badgeEmojis[badge.toLowerCase()] || '';
              return (
                <Chip
                  key={idx}
                  label={`${emoji} ${badge}`}
                  size="small"
                  sx={{
                    backgroundColor: '#00e676',
                    color: '#121212',
                    fontWeight: 'bold',
                  }}
                />
              );
            })}
          </Box>
          {/* See Runners Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleOpenDialog}
              sx={{
                backgroundColor: '#ff4081',
                color: '#121212',
                minWidth: 'auto',
              }}
            >
              See Runners
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Dialog Popup for Runner Details */}
      <Dialog open={open} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>Runner Details for Wallet</DialogTitle>
        <DialogContent dividers>
          {uniqueRunners.map((runner, index) => (
            <Box key={index} sx={{ mb: 2 }}>
              <RunnerAccordion runner={runner} computePnl={computePnl} />
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} variant="contained" color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WalletAccordion;
