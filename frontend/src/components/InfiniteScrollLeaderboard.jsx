// src/components/InfiniteScrollLeaderboard.jsx
import React, { useState, useEffect } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Box, Typography } from '@mui/material';
import WalletAccordion from './WalletAccordion';

// Helper function to compute a runner's PnL
const computePnl = (runner) => {
  const buys = runner.transactions.buy || [];
  const sells = runner.transactions.sell || [];
  if (sells.length === 0) {
    return 0;
  }
  const totalBuy = buys.reduce((sum, tx) => sum + tx.price * tx.amount, 0);
  const totalSell = sells.reduce((sum, tx) => sum + tx.price * tx.amount, 0);
  return totalSell - totalBuy;
};

const InfiniteScrollLeaderboard = ({ type, filter }) => {
  const [wallets, setWallets] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Fetch wallets from the API
  const fetchWallets = (currentOffset) => {
    let url = '';
    let body = {};

    if (type === 'all-time') {
      url = `${import.meta.env.VITE_API_ENDPOINT}/leaderboard/all-time`;
      body = { offset: currentOffset };
      if (filter !== 'pnl') {
        body.sort = filter;
      }
    } else {
      url = `${import.meta.env.VITE_API_ENDPOINT}/leaderboard/day`;
      const days = type === '7-day' ? 7 : type === '30-day' ? 30 : 90;
      body = { days, offset: currentOffset };
      if (filter !== 'pnl') {
        body.sort = filter;
      }
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.length === 0) {
          setHasMore(false);
        } else {
          setWallets((prev) => {
            const combined = [...prev, ...data];
            // Deduplicate wallets by id
            const unique = combined.filter(
              (w, idx, arr) => arr.findIndex((x) => x.id === w.id) === idx
            );
            return unique;
          });
          setOffset(currentOffset + data.length);
        }
      })
      .catch((err) => {
        console.error('Error fetching leaderboard data:', err);
        setError(err.message);
        setHasMore(false);
      });
  };

  // Fetch data once on mount
  useEffect(() => {
    fetchWallets(0);
  }, []);

  // Inline sort: if filter is "pnl", sort the wallets locally by total PnL (descending)
  let sortedWallets = wallets;
  if (filter === 'pnl') {
    sortedWallets = [...wallets].sort((a, b) => {
      const aPnl = a.runners.reduce((acc, runner) => acc + computePnl(runner), 0);
      const bPnl = b.runners.reduce((acc, runner) => acc + computePnl(runner), 0);
      return bPnl - aPnl;
    });
  }

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
        boxShadow: '0px 0px 15px rgba(0,230,118,0.7)',
        mx: 'auto',
        maxWidth: 800,
      }}
    >
      {error && (
        <Typography sx={{ color: 'red', textAlign: 'center', mb: 1 }}>
          {error}
        </Typography>
      )}
      <InfiniteScroll
        dataLength={wallets.length}
        next={() => fetchWallets(offset)}
        hasMore={hasMore}
        loader={<Typography>Loading...</Typography>}
        scrollableTarget="scrollableDiv"
      >
        {sortedWallets.map((wallet) => (
          <WalletAccordion key={wallet.id} wallet={wallet} computePnl={computePnl} />
        ))}
      </InfiniteScroll>
    </Box>
  );
};

export default InfiniteScrollLeaderboard;
