import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BarChartIcon from '@mui/icons-material/BarChart';
import RunnerCard from './RunnerCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

// Mapping from badge emoji to description
const badgeMapping = {
  '🔥': 'High-Conviction Buyer',
  '👑': 'Legendary Buyer',
  '🐳': 'Whale Buyer',
  '💎': 'Diamond Hands',
  '🚀': 'Comeback Trader',
  '🤡': 'Degen Sprayer',
  '✨': 'One-Hit Wonder',
  '💀': 'Dead Wallet',
};

const MotionPaper = motion(Paper);

function WalletCard({ wallet, rank }) {
  const [showWalletChart, setShowWalletChart] = useState(false);
  
  // Show full wallet address
  const fullAddress = wallet.address;

  // Compute average runner score (if available)
  let avgRunnerScore = 0;
  if (wallet.runners && wallet.runners.length > 0) {
    avgRunnerScore =
      wallet.runners.reduce((sum, runner) => sum + runner.score, 0) / wallet.runners.length;
    avgRunnerScore = parseFloat(avgRunnerScore.toFixed(2));
  }

  // Data for wallet-level bar chart
  const walletChartData = [
    { name: 'Confidence', value: wallet.confidence },
    { name: 'Avg Runner', value: avgRunnerScore },
  ];

  // Copy address function
  const copyAddress = () => {
    navigator.clipboard.writeText(fullAddress);
  };

  return (
    <MotionPaper
      variant="outlined"
      sx={{
        borderRadius: '16px',
        borderColor: 'primary.main',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
      }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Wallet Info Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main', mr: 2 }}>
          {rank}.
        </Typography>
        <Tooltip title="Click to copy address">
          <Typography variant="body1" onClick={copyAddress} sx={{ mr: 2, cursor: 'pointer' }}>
            {fullAddress}
          </Typography>
        </Tooltip>
        <span style={{ flex: 1 }}></span>
        <Typography variant="body2" sx={{ mr: 2 }}>
          {wallet.confidence}%
        </Typography>
        {wallet.badges.map((badge) => (
          <Chip
            key={badge}
            label={`${badge} ${badgeMapping[badge] || ''}`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ mr: 0.5 }}
          />
        ))}
        <IconButton size="small" onClick={() => setShowWalletChart((prev) => !prev)}>
          <BarChartIcon color="primary" />
        </IconButton>
      </Box>
      {showWalletChart && (
        <Box sx={{ width: '100%', height: 80, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={walletChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
              <XAxis dataKey="name" tick={{ fill: '#000', fontSize: 10 }} />
              <YAxis tick={{ fill: '#000', fontSize: 10 }} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#eee', border: 'none', borderRadius: '5px', color: '#000' }} />
              <Bar dataKey="value" fill="#1976d2" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
      {/* Runners Accordion */}
      {wallet.runners && wallet.runners.length > 0 && (
        <Accordion sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon color="primary" />}>
            <Typography>View Runners</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {wallet.runners.map((runner, idx) => (
              <RunnerCard key={idx} runner={runner} />
            ))}
          </AccordionDetails>
        </Accordion>
      )}
    </MotionPaper>
  );
}

export default WalletCard;
