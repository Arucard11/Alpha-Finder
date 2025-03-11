// src/components/WalletCard.jsx
import React from 'react';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const MotionPaper = motion(Paper);

const badgeMapping = {
  'legendary buyer': { emoji: '👑', description: 'Legendary Buyer' },
  'high-conviction buyer': { emoji: '🔥', description: 'High-Conviction Buyer' },
  'potential alpha': { emoji: '🚀', description: 'Potential Alpha' },
  'mid trader': { emoji: '📉', description: 'Mid Trader' },
  'degen sprayer': { emoji: '🤡', description: 'Degen Sprayer' },
  'one-hit wonder': { emoji: '💥', description: 'One-Hit Wonder' },
  'diamond hands buyer': { emoji: '💎', description: 'Diamond Hands Buyer' },
  'whale buyer': { emoji: '🐳', description: 'Whale Buyer' },
  'dead wallet': { emoji: '⚰️', description: 'Dead Wallet' },
  'comeback trader': { emoji: '🔄', description: 'Comeback Trader' },
  'volume factor': { emoji: '📊', description: 'Volume Factor' },
};

function WalletCard({ wallet, rank }) {
  const [showWalletChart, setShowWalletChart] = React.useState(false);
  const fullAddress = wallet.address;
  const confidence = parseFloat(wallet.confidence_score);

  // Filter duplicate runners by address
  const uniqueRunners = wallet.runners
    ? Array.from(new Map(wallet.runners.map(runner => [runner.address, runner])).values()
    )
    : [];

  let avgRunnerScore = 0;
  if (uniqueRunners.length > 0) {
    avgRunnerScore =
      uniqueRunners.reduce((sum, runner) => sum + runner.score, 0) / uniqueRunners.length;
    avgRunnerScore = parseFloat(avgRunnerScore.toFixed(2));
  }

  const walletChartData = [
    { name: 'Confidence', value: confidence },
    { name: 'Avg Runner', value: avgRunnerScore },
  ];

  const copyAddress = () => {
    navigator.clipboard.writeText(fullAddress);
  };

  return (
    <MotionPaper
      variant="outlined"
      sx={{
        borderRadius: '8px',
        border: '2px solid #00bfa5',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        mb: 2,
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
      }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#00bfa5', mr: 2 }}>
          {rank}.
        </Typography>
        <Box sx={{ mr: 2 }}>
          <Typography variant="caption" sx={{ color: '#555' }}>
            Wallet Address:
          </Typography>
          <Tooltip title="Click to copy address">
            <Typography
              variant="body1"
              onClick={copyAddress}
              sx={{ cursor: 'pointer', wordBreak: 'break-all' }}
            >
              {fullAddress}
            </Typography>
          </Tooltip>
        </Box>
        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
          <Typography variant="caption" sx={{ color: '#555' }}>
            Confidence Score:
          </Typography>
          <Typography variant="body2">{confidence}%</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        {wallet.badges.map((badge, idx) => {
          const key = badge.toLowerCase();
          const info = badgeMapping[key] || { emoji: badge, description: badge };
          return (
            <Chip
              key={idx}
              label={`${info.emoji} ${info.description}`}
              size="small"
              sx={{ background: 'rgba(0,191,165,0.1)', color: '#00bfa5' }}
            />
          );
        })}
        <IconButton size="small" onClick={() => setShowWalletChart(prev => !prev)}>
          <BarChartIcon sx={{ color: '#00bfa5' }} />
        </IconButton>
      </Box>
      {showWalletChart && (
        <Box sx={{ width: '100%', height: 60, mb: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={walletChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
              <XAxis dataKey="name" tick={{ fill: '#333', fontSize: 10 }} />
              <YAxis tick={{ fill: '#333', fontSize: 10 }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#eee',
                  border: 'none',
                  borderRadius: '5px',
                  color: '#333',
                }}
              />
              <Bar dataKey="value" fill="#00bfa5" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
      {uniqueRunners.length > 0 && (
        <Accordion sx={{ background: '#f9f9f9' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#ff5252' }} />}>
            <Typography sx={{ color: '#333' }}>View Runners</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {uniqueRunners.map((runner, idx) => (
              <RunnerCard key={idx} runner={runner} />
            ))}
          </AccordionDetails>
        </Accordion>
      )}
    </MotionPaper>
  );
}

export default WalletCard;
