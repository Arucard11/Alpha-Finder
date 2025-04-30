import React from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WalletAccordion from './WalletAccordion';
import SimpleRunnerDisplay from './SimpleRunnerDisplay';

const SearchResultOverlay = ({ results, onClose }) => {
  if (!results) return null;

  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        padding: 3,
        overflowY: 'auto',
        overflowX: 'hidden',
        pointerEvents: 'auto',
        boxSizing: 'border-box',
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
            <WalletAccordion wallet={results.data} useAccordion={true} />
          )}
          
          {results.type === 'runner' && (
            <>
              {console.log('Runner search results:', results)}
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SimpleRunnerDisplay runner={results.data.runner} />
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: results.data.runner.checked ? '#00e676' : '#ff5252', fontSize: '0.7em' }}>
                    Checked {results.data.runner.checked ? '✓' : '✗'}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#00e676' }}>
                Wallets That Bought This Runner
              </Typography>
              {results.data.wallets
                .sort((a, b) => {
                  const aEarliestBuy = Math.min(...a.runners.filter(r => r.address === results.data.runner.address).flatMap(r => r.transactions.buy.map(tx => tx.timestamp)));
                  const bEarliestBuy = Math.min(...b.runners.filter(r => r.address === results.data.runner.address).flatMap(r => r.transactions.buy.map(tx => tx.timestamp)));
                  return aEarliestBuy - bEarliestBuy;
                })
                .map((wallet, index) => {
                  // Calculate the first buy price for the specific runner
                  const runnerData = wallet.runners.find(r => r.address === results.data.runner.address);
                  const firstBuyPrice = runnerData && runnerData.transactions.buy.length > 0 
                    ? Math.min(...runnerData.transactions.buy.map(tx => tx.price)) 
                    : 0;
                  const totalSupply = results.data.runner.totalsupply || 0;
                  const firstBuyMC = firstBuyPrice * totalSupply;
                  return (
                    <Box key={index} sx={{ mb: 2 }}>
                      <WalletAccordion wallet={wallet} useAccordion={true} />
                      {firstBuyPrice > 0 && totalSupply > 0 && (
                        <Typography variant="caption" sx={{ color: '#00e676', ml: 2, fontSize: '0.7em' }}>
                          First Buy MC: ${(firstBuyMC).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} (Market Cap at First Purchase)
                        </Typography>
                      )}
                    </Box>
                  );
                })}
            </>
          )}
        </Box>
      )}
    </Box>,
    document.body
  );
};

export default SearchResultOverlay;
