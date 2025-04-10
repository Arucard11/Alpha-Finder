import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WalletAccordion from './WalletAccordion';
import RunnerAccordion from './RunnerAccordion';

const SearchResultOverlay = ({ results, onClose }) => {
  if (!results) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        padding: 3,
        overflowY: 'auto'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <IconButton onClick={onClose} sx={{ color: '#00e676' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {results.error ? (
        <Typography color="error">{results.error}</Typography>
      ) : (
        <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
          {results.type === 'wallet' && (
            <WalletAccordion wallet={results.data} />
          )}
          
          {results.type === 'runner' && (
            <>
              <RunnerAccordion runner={results.data.runner} />
              <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#00e676' }}>
                Wallets Holding This Runner
              </Typography>
              {results.data.wallets.map((wallet, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <WalletAccordion wallet={wallet} />
                </Box>
              ))}
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default SearchResultOverlay;
