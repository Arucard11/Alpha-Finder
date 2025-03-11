// src/components/RunnerCard.jsx
import React, { useState } from 'react';
import { Box, Avatar, Typography, Button, ToggleButtonGroup, ToggleButton, Divider } from '@mui/material';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
} from 'recharts';

// Sort and prepare line chart data from the allprices array (last 30 days)
function prepareLineChartData(allPrices) {
  const sorted = [...allPrices].sort((a, b) => a.unixTime - b.unixTime);
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 24 * 3600;
  return sorted
    .filter(item => item.unixTime >= thirtyDaysAgo)
    .map(item => ({
      date: new Date(item.unixTime * 1000).toISOString().split('T')[0],
      value: item.value,
    }));
}

// Prepare markers for transactions: buys and sells including timestamps
function prepareMarkers(transactions) {
  const buys = transactions.buy.map(tx => ({
    date: new Date(tx.timestamp * 1000).toISOString().split('T')[0],
    price: tx.price,
    amount: tx.amount,
    type: 'Buy',
    timestamp: tx.timestamp,
  }));
  const sells = transactions.sell.map(tx => ({
    date: new Date(tx.timestamp * 1000).toISOString().split('T')[0],
    price: tx.price,
    amount: tx.amount,
    type: 'Sell',
    timestamp: tx.timestamp,
  }));
  return { buys, sells };
}

function RunnerCard({ runner }) {
  const [showChart, setShowChart] = useState(false);

  // Calculate profit and loss for the runner
  const pnl = runner.transactions.sell.reduce((acc, tx) => acc + tx.price * tx.amount, 0) -
              runner.transactions.buy.reduce((acc, tx) => acc + tx.price * tx.amount, 0);

  const lineChartData = prepareLineChartData(runner.timestamps.allprices);
  const { buys, sells } = prepareMarkers(runner.transactions);

  // Combine buys and sells and sort by timestamp
  const allTransactions = [...buys, ...sells].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        border: '1px solid #ddd',
        borderRadius: '8px',
        background: '#fafafa',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
        <Avatar src={runner.logouri} alt={runner.name} sx={{ width: 56, height: 56, mr: 2 }} />
        <Box>
          <Typography variant="subtitle1" sx={{ color: '#333' }}>
            {runner.name} ({runner.symbol})
          </Typography>
          <Typography variant="body2" sx={{ color: '#555' }}>
            Score: {runner.score.toFixed(2)}
          </Typography>
          <Typography variant="body2" sx={{ color: pnl >= 0 ? 'green' : 'red' }}>
            PnL: {pnl.toFixed(4)}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <Button variant="outlined" size="small" onClick={() => setShowChart(prev => !prev)}>
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </Button>
        </Box>
      </Box>
      {showChart && (
        <>
          <ToggleButtonGroup size="small" exclusive value="line" sx={{ mb: 1 }}>
            <ToggleButton value="line">Line Graph</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ width: '100%', height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                <XAxis dataKey="date" tick={{ fill: '#333', fontSize: 10 }} />
                <YAxis tick={{ fill: '#333', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', color: '#333' }} />
                <Legend wrapperStyle={{ color: '#333', fontSize: '0.8rem' }} />
                <Line type="monotone" dataKey="value" stroke="#1976d2" strokeWidth={2} name="Price" dot={false} />
                {buys.length > 0 && (
                  <Scatter
                    data={buys}
                    dataKey="price"
                    fill="#00e676"
                    name="Buy"
                    label={({ payload, x, y }) => {
                      if (!payload || payload.amount == null) return null;
                      return (
                        <text x={x} y={y - 10} fill="#00e676" fontSize={10} textAnchor="middle">
                          {Number(payload.amount).toFixed(2)}
                        </text>
                      );
                    }}
                  />
                )}
                {sells.length > 0 && (
                  <Scatter
                    data={sells}
                    dataKey="price"
                    fill="#ff5252"
                    name="Sell"
                    label={({ payload, x, y }) => {
                      if (!payload || payload.amount == null) return null;
                      return (
                        <text x={x} y={y - 10} fill="#ff5252" fontSize={10} textAnchor="middle">
                          {Number(payload.amount).toFixed(2)}
                        </text>
                      );
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Transactions (sorted by time):
            </Typography>
            {allTransactions.map((tx, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 0.5,
                  p: 0.5,
                  background: tx.type === 'Buy' ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)',
                  borderRadius: '4px',
                }}
              >
                <Typography variant="caption" sx={{ width: '30%', color: '#555' }}>
                  {new Date(tx.timestamp * 1000).toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ width: '20%', color: tx.type === 'Buy' ? '#00e676' : '#ff5252' }}>
                  {tx.type}
                </Typography>
                <Typography variant="caption" sx={{ width: '50%', color: '#555' }}>
                  Total: {(tx.price * tx.amount).toFixed(2)}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

export default RunnerCard;
