// src/components/WalletAccordion.jsx
import React, { useState } from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
  IconButton,
  Button
} from '@mui/material';
import { styled } from '@mui/system';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RunnerAccordion from './RunnerAccordion';

const StyledAccordionSummary = styled(AccordionSummary)(() => ({
  minHeight: 0,
  padding: '4px 8px',
  '& .MuiAccordionSummary-content': {
    margin: '4px 0'
  }
}));

const badgeEmojis = {
  'legendary buyer': '🏆',
  'high conviction': '💼',
  'potential alpha': '🚀',
  'mid trader': '📈',
  'degen sprayer': '🤪',
  'one hit wonder': '🎯',
  'diamond hands buyer': '💎',
  'whale buyer': '🐋',
  'dead wallet': '⚰️',
  'comeback trader': '🔥'
};

const WalletAccordion = ({ wallet, computePnl }) => {
  const [expanded, setExpanded] = useState(false);

  // Deduplicate runners by address
  const uniqueRunners = wallet.runners.filter(
    (runner, idx, arr) => arr.findIndex((r) => r.address === runner.address) === idx
  );

  // Compute total PnL from unique runners
  const totalPnl = uniqueRunners.reduce((acc, runner) => acc + computePnl(runner), 0);

  // Styles for metrics
  const pnlStyle = {
    color: totalPnl < 0 ? 'red' : '#00e676',
    fontWeight: 'bold',
    fontSize: '0.7rem'
  };
  const confidenceStyle = {
    color: Number(wallet.confidence_score) <= 20 ? 'red' : '#00e676',
    fontWeight: 'bold',
    fontSize: '0.8rem' // Slightly larger to emphasize it
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(wallet.address);
    alert('Wallet address copied to clipboard!');
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <Accordion
      expanded={expanded}
      sx={{
        backgroundColor: '#272727',
        color: '#ffffff',
        marginBottom: '4px',
        border: '1px solid #00e676',
        boxShadow: '0px 0px 4px rgba(0,230,118,0.5)',
        borderRadius: 1
      }}
    >
      <StyledAccordionSummary>
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {/* Top row: wallet address, copy icon, and See/Hide Runners button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: '#00e676',
                fontWeight: 'bold',
                fontSize: '0.75rem',
                flex: 1,
                wordBreak: 'break-all'
              }}
            >
              {wallet.address}
            </Typography>
            <IconButton onClick={handleCopy} size="small" sx={{ color: '#00e676' }}>
              <ContentCopyIcon sx={{ fontSize: '0.75rem' }} />
            </IconButton>
            <Button
              variant="contained"
              size="small"
              onClick={handleToggle}
              sx={{
                backgroundColor: '#ff4081',
                color: '#121212',
                fontSize: '0.65rem',
                minWidth: 'auto'
              }}
            >
              {expanded ? 'Hide Runners' : 'See Runners'}
            </Button>
          </Box>
          {/* Middle row: Full label for Confidence Score and PnL */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
              Confidence Score: <span style={confidenceStyle}>{Number(wallet.confidence_score).toFixed(2)}</span>
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}>
              PnL: <span style={pnlStyle}>{totalPnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
            </Typography>
          </Box>
          {/* Badges row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: '2px' }}>
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
                    fontSize: '0.65rem',
                    height: '18px'
                  }}
                />
              );
            })}
          </Box>
        </Box>
      </StyledAccordionSummary>

      <AccordionDetails
        sx={{
          backgroundColor: '#1d1d1d',
          borderTop: '1px solid #00e676',
          padding: '8px'
        }}
      >
        {uniqueRunners.map((runner, index) => (
          <RunnerAccordion key={index} runner={runner} computePnl={computePnl} />
        ))}
      </AccordionDetails>
    </Accordion>
  );
};

export default WalletAccordion;
