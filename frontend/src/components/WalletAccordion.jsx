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
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RunnerAccordion from './RunnerAccordion'; // Assuming RunnerAccordion no longer needs computePnl
import { badgeEmojis, badgeDescriptions } from '../utils/badgeMappings'; // Import both mappings
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// *** CHANGE HERE: Removed computePnl from props ***
const WalletAccordion = ({ wallet, useAccordion = false }) => {
  const [open, setOpen] = useState(false);

  // Replace all instances of uniqueRunners with wallet.runners (default to [] if undefined)
  const runners = wallet.runners || [];

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
              {wallet.address || 'N/A'}
            </Typography>
            <IconButton onClick={handleCopy} size="small" sx={{ color: '#00e676' }} disabled={!wallet.address}>
              <ContentCopyIcon />
            </IconButton>
          </Box>
          {/* PnL */}
          <Typography variant="body2">
            PnL: <span style={pnlStyle}> {Number(totalPnl).toLocaleString('en-US', { style: 'currency',currency: 'USD', })}</span>
          </Typography>
          {/* Badges */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
            {badges.map((badge, idx) => {
              // Ensure badge name is lowercase for consistent lookup
              const badgeKey = badge.toLowerCase();
              const emoji = badgeEmojis[badgeKey] || '';
              const description = badgeDescriptions[badgeKey] || badge; // Fallback to badge name if no description

              return (
                <Tooltip title={description} key={idx} arrow>
                  {/* Wrap Chip in Tooltip */}
                  <Chip
                    label={`${emoji} ${badge}`}
                    size="small"
                    sx={{
                      backgroundColor: '#00e676',
                      color: '#121212',
                      fontWeight: 'bold',
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
          {useAccordion ? (
            // Runners Accordion for Search Overlay
            <Accordion
              expanded={open}
              onChange={(_, isExpanded) => setOpen(isExpanded)}
              disabled={!runners || runners.length === 0}
              sx={{ backgroundColor: '#333', mt: 1, border: '1px solid rgba(0,230,118,0.3)' }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#00e676' }} />}
                sx={{ backgroundColor: '#272727' }}
              >
                <Typography sx={{ color: '#ff4081', fontWeight: 'bold' }}>
                  See Runners ({runners.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: '#272727', p: 1 }}>
                {runners.length === 0 ? (
                  <Typography sx={{ color: '#fff' }}>No runners associated with this wallet.</Typography>
                ) : (
                  runners.map((runner, index) => (
                    <Box key={runner.address || index} sx={{ mb: 1 }}>
                      <RunnerAccordion runner={runner} />
                    </Box>
                  ))
                )}
              </AccordionDetails>
            </Accordion>
          ) : (
            // See Runners Button for Main Dashboard
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              {/* Disable button if no runners */}
              <Button
                variant="contained"
                size="small"
                onClick={handleOpenDialog}
                disabled={!runners || runners.length === 0}
                sx={{
                  backgroundColor: '#ff4081',
                  color: '#121212',
                  minWidth: 'auto',
                  '&:disabled': { // Style for disabled state
                      backgroundColor: 'grey.700',
                  }
                }}
              >
                See Runners ({runners.length}) {/* Show count */}
              </Button>
            </Box>
          )}
        </Box>
      </Box>
      {!useAccordion && (
        // Dialog Popup for Runner Details in Main Dashboard
        <Dialog open={open} onClose={handleCloseDialog} fullWidth maxWidth="md">
          <DialogTitle>Runner Details for Wallet: {wallet.address}</DialogTitle>
          <DialogContent dividers>
            {runners.map((runner, index) => (
              <Box key={runner.address || index} sx={{ mb: 2 }}> {/* Use runner.address as key if available */}
                {/* *** CHANGE HERE: Removed computePnl prop *** */}
                <RunnerAccordion runner={runner} />
              </Box>
            ))}
             {runners.length === 0 && (
               <Typography>No runners associated with this wallet.</Typography>
             )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} variant="contained" color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default WalletAccordion;