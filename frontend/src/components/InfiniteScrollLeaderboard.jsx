// src/components/InfiniteScrollLeaderboard.jsx
import React, { useState, useEffect } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Box, Typography } from '@mui/material';
import WalletCard from './WalletCard';

// Helper to compute a runner's PnL
const computePnl = (runner) => {
  const buys = runner.transactions.buy || [];
  const sells = runner.transactions.sell || [];
  const totalBuy = buys.reduce((sum, tx) => sum + tx.price * tx.amount, 0);
  const totalSell = sells.reduce((sum, tx) => sum + tx.price * tx.amount, 0);
  return totalSell - totalBuy;
};

const InfiniteScrollLeaderboard = ({ type, filter }) => {
  const [wallets, setWallets] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Use a parameter to ensure we always use the correct offset
  const fetchWallets = (currentOffset) => {
    let url = '';
    let body = {};
    if (type === 'all-time') {
      url = 'http://localhost:5000/leaderboard/all-time';
      body = { offset: currentOffset, sort: filter };
    } else {
      url = 'http://localhost:5000/leaderboard/day';
      const days = type === '7-day' ? 7 : type === '30-day' ? 30 : 90;
      body = { days, offset: currentOffset, sort: filter };
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.length === 0) {
          setHasMore(false);
        } else {
          setWallets((prev) => [...prev, ...data]);
          setOffset(currentOffset + data.length);
        }
      })
      .catch((err) => {
        console.error('Error fetching leaderboard data:', err);
      });
  };

  // When day range (type) or filter changes, reset the leaderboard and fetch from the beginning
  useEffect(() => {
    setWallets([]);
    setOffset(0);
    setHasMore(true);
    fetchWallets(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, filter]);

  // Sort wallets locally in descending order based on the filter
  const sortedWallets = [...wallets].sort((a, b) => {
    if (filter === 'pnl') {
      const aPnl = a.runners.reduce((acc, runner) => acc + computePnl(runner), 0);
      const bPnl = b.runners.reduce((acc, runner) => acc + computePnl(runner), 0);
      return bPnl - aPnl;
    } else if (filter === 'confidence') {
      return Number(b.confidence_score) - Number(a.confidence_score);
    } else if (filter === 'runners') {
      return (b.runners?.length || 0) - (a.runners?.length || 0);
    } else {
      return 0;
    }
  });

  return (
    <Box
      id="scrollableDiv"
      sx={{
        height: 300,
        overflow: 'auto',
        backgroundColor: '#1d1d1d',
        padding: 2,
        borderRadius: 1,
        mt: 2,
        border: '2px solid #00e676',
        boxShadow: '0px 0px 15px rgba(0,230,118,0.7)',
        mx: 'auto',
        maxWidth: 800,
      }}
    >
      <InfiniteScroll
        dataLength={wallets.length}
        next={() => fetchWallets(offset)}
        hasMore={hasMore}
        loader={<Typography>Loading...</Typography>}
        scrollableTarget="scrollableDiv"
      >
        {sortedWallets.map((wallet) => (
          <WalletCard key={wallet.id} wallet={wallet} computePnl={computePnl} />
        ))}
      </InfiniteScroll>
    </Box>
  );
};

export default InfiniteScrollLeaderboard;
