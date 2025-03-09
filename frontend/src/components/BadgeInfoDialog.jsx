import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Box } from '@mui/material';

function BadgeInfoDialog({ open, handleClose }) {
  const badgeInfo = [
    { emoji: '🔥', description: 'High-Conviction Buyer' },
    { emoji: '👑', description: 'Legendary Buyer' },
    { emoji: '🐳', description: 'Whale Buyer' },
    { emoji: '💎', description: 'Diamond Hands' },
    { emoji: '🚀', description: 'Comeback Trader' },
    { emoji: '🤡', description: 'Degen Sprayer' },
    { emoji: '✨', description: 'One-Hit Wonder' },
    { emoji: '💀', description: 'Dead Wallet' },
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { background: '#fff', border: '2px solid #1976d2' } }}
    >
      <DialogTitle sx={{ color: '#1976d2' }}>Badge Information</DialogTitle>
      <DialogContent sx={{ color: '#000' }}>
        {badgeInfo.map((badge, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ mr: 1 }}>
              {badge.emoji}
            </Typography>
            <Typography variant="body1">
              {badge.description}
            </Typography>
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
}

export default BadgeInfoDialog;
