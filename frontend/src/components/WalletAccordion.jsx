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
import RunnerAccordion from './RunnerAccordion'; // Assuming RunnerAccordion no longer needs computePnl

const badgeEmojis = {
  'legendary buyer': '🏆',
  'high conviction': '💼',
  'potential alpha': '🚀',
  'mid trader': '📈',
  'degen sprayer': '🤪',
  'one-hit wonder': '🎯',
  'diamond hands buyer': '💎',
  'whale buyer': '🐋',
  'dead wallet': '⚰️',
  'comeback trader': '🔥',
};

// *** CHANGE HERE: Removed computePnl from props ***
const WalletAccordion = ({ wallet }) => {
  const [open, setOpen] = useState(false);

  // Deduplicate runners by address (still potentially useful for display if needed, but not for PnL calc)
  const uniqueRunners = wallet.runners ? wallet.runners.filter(
    (runner, idx, arr) => arr.findIndex((r) => r.address === runner.address) === idx
  ) : [];

  // *** CHANGE HERE: Use wallet.pnl directly. Add nullish coalescing for safety ***
  const totalPnl = wallet.pnl ?? 0; // Use the pnl field from the wallet object

  // Style PnL: red if negative, neon green if positive
  const pnlStyle = {
    color: totalPnl < 0 ? 'red' : '#00e676',
    fontWeight: 'bold',
  };

  const handleCopy = (e) => {
    e.stopPropagation(); // Prevent dialog from opening if clicking copy inside button area
    navigator.clipboard.writeText(wallet.address);
    alert('Wallet address copied to clipboard!');
  };

  const handleOpenDialog = (e) => {
    e.stopPropagation(); // Prevent accordion toggle if button is inside summary
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
  };

  // Ensure badges is an array before mapping
  const badges = Array.isArray(wallet.badges) ? wallet.badges : [];

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
             {/* Use nullish coalescing for safety */}
            Confidence Score: {Number(wallet.confidence_score ?? 0).toFixed(2)}
          </Typography>
          {/* Wallet Address with Copy Icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1, wordBreak: 'break-all' }}>
              {wallet.address || 'N/A'} {/* Add fallback for address */}
            </Typography>
            <IconButton onClick={handleCopy} size="small" sx={{ color: '#00e676' }} disabled={!wallet.address}>
              <ContentCopyIcon />
            </IconButton>
          </Box>
          {/* PnL */}
          <Typography variant="body2">
            PnL:<span style={pnlStyle}>${Number(totalPnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </Typography>
          {/* Badges */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {badges.map((badge, idx) => {
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
             {/* Disable button if no runners */}
            <Button
              variant="contained"
              size="small"
              onClick={handleOpenDialog}
              disabled={!uniqueRunners || uniqueRunners.length === 0}
              sx={{
                backgroundColor: '#ff4081',
                color: '#121212',
                minWidth: 'auto',
                '&:disabled': { // Style for disabled state
                    backgroundColor: 'grey.700',
                }
              }}
            >
              See Runners ({uniqueRunners.length}) {/* Show count */}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Dialog Popup for Runner Details */}
      <Dialog open={open} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>Runner Details for Wallet: {wallet.address}</DialogTitle>
        <DialogContent dividers>
          {uniqueRunners.map((runner, index) => (
            <Box key={runner.address || index} sx={{ mb: 2 }}> {/* Use runner.address as key if available */}
              {/* *** CHANGE HERE: Removed computePnl prop *** */}
              <RunnerAccordion runner={runner} />
            </Box>
          ))}
           {uniqueRunners.length === 0 && (
             <Typography>No runners associated with this wallet.</Typography>
           )}
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