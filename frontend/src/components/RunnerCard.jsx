import React, { useState } from 'react';
import { Box, Avatar, Typography, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

// Calculate PnL from transactions (unchanged)
function calculatePnL(transactions) {
  const buyTotal = transactions.buy.reduce((acc, tx) => acc + tx.price * tx.amount, 0);
  const sellTotal = transactions.sell.reduce((acc, tx) => acc + tx.price * tx.amount, 0);
  return sellTotal - buyTotal;
}

// Create a combined data array using runner.timestamps.allprices along with buy/sell events
function prepareCombinedChartData(runner) {
  const data = [];
  // Use the provided allprices array (inside runner.timestamps)
  if (runner.timestamps && Array.isArray(runner.timestamps.allprices)) {
    runner.timestamps.allprices.forEach((item) => {
      data.push({ time: item.unixTime, price: item.value });
    });
  }
  // Add buy events
  runner.transactions.buy.forEach((tx) => {
    data.push({ time: tx.timestamp, buy: tx.price });
  });
  // Add sell events
  runner.transactions.sell.forEach((tx) => {
    data.push({ time: tx.timestamp, sell: tx.price });
  });
  // Sort by time
  data.sort((a, b) => a.time - b.time);
  // Merge data points with the same time
  const mergedData = [];
  data.forEach((dp) => {
    const last = mergedData[mergedData.length - 1];
    if (last && last.time === dp.time) {
      mergedData[mergedData.length - 1] = { ...last, ...dp };
    } else {
      mergedData.push(dp);
    }
  });
  return mergedData;
}

// Format unix timestamp (assumed in seconds) to a date string
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

function RunnerCard({ runner }) {
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'
  const pnl = calculatePnL(runner.transactions);
  
  // Prepare combined data for the chart
  const combinedData = prepareCombinedChartData(runner);

  // For the bar chart, aggregate total buy and sell prices (example aggregation)
  const totalBuy = runner.transactions.buy.reduce((acc, tx) => acc + tx.price, 0);
  const totalSell = runner.transactions.sell.reduce((acc, tx) => acc + tx.price, 0);
  const barData = [
    { name: 'Buy', value: totalBuy },
    { name: 'Sell', value: totalSell },
    { name: 'ATH', value: parseFloat(runner.athprice) },
  ];

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 0 5px rgba(0,0,0,0.2)',
        background: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Avatar
          src={runner.logouri}
          alt={runner.name}
          sx={{ width: 56, height: 56, mr: 2 }}
        />
        <Box>
          <Typography variant="subtitle1">
            {runner.name} ({runner.symbol})
          </Typography>
          <Typography variant="body2">
            Score: {runner.score.toFixed(2)}
          </Typography>
          <Typography variant="body2" sx={{ color: pnl >= 0 ? 'green' : 'red' }}>
            PnL: {pnl.toFixed(4)}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <Button variant="outlined" size="small" onClick={() => setShowChart((prev) => !prev)}>
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </Button>
        </Box>
      </Box>
      {showChart && (
        <Box>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={chartType}
            onChange={(e, newType) => {
              if (newType) setChartType(newType);
            }}
            sx={{ mb: 1 }}
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="bar">Bar</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ width: '100%', height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="time" tickFormatter={formatDate} tick={{ fill: '#000', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#000', fontSize: 10 }} />
                  <Tooltip 
                    labelFormatter={(label) => formatDate(label)}
                    contentStyle={{ backgroundColor: '#eee', border: 'none', borderRadius: '5px', color: '#000' }}
                  />
                  <Line type="monotone" dataKey="buy" stroke="#00bcd4" activeDot={{ r: 3 }} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="sell" stroke="#f44336" activeDot={{ r: 3 }} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="price" stroke="#4caf50" activeDot={{ r: 3 }} dot={false} strokeWidth={2} />
                  {/* Optionally, add reference lines for key timestamps if desired */}
                  {runner.twoMillion && (
                    <ReferenceLine
                      x={runner.twoMillion}
                      stroke="#ff9800"
                      strokeDasharray="3 3"
                      label={{ value: '2M', fill: '#ff9800', fontSize: 10 }}
                    />
                  )}
                  {runner.fiveMillion && (
                    <ReferenceLine
                      x={runner.fiveMillion}
                      stroke="#9c27b0"
                      strokeDasharray="3 3"
                      label={{ value: '5M', fill: '#9c27b0', fontSize: 10 }}
                    />
                  )}
                </LineChart>
              ) : (
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="name" tick={{ fill: '#000', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#000', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#eee', border: 'none', borderRadius: '5px', color: '#000' }} />
                  <Bar dataKey="value" fill="#00bcd4" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default RunnerCard;
