// src/components/InfiniteScrollLeaderboard.jsx
import React, { useState, useEffect } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Box, Typography, Button, Menu, MenuItem, Grid } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
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

// Omit runner.timestamps.allprices
function omitAllprices(wallets) {
  return wallets.map((wallet) => {
    const clonedWallet = { ...wallet };
    if (clonedWallet.runners) {
      clonedWallet.runners = clonedWallet.runners.map((runner) => {
        const { timestamps, ...rest } = runner;
        if (!timestamps) return runner;
        const { allprices, ...timestampsNoAllprices } = timestamps;
        return { ...rest, timestamps: timestampsNoAllprices };
      });
    }
    return clonedWallet;
  });
}

// Export conversions
function exportToCsv(wallets) {
  const header = ['id', 'address', 'confidence_score', 'badges', 'runners_count'];
  const rows = wallets.map((w) => [
    w.id,
    w.address,
    w.confidence_score,
    w.badges.join(';'),
    w.runners ? w.runners.length : 0,
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function exportToSql(wallets) {
  let statements = [];
  wallets.forEach((w) => {
    const id = w.id;
    const address = w.address.replace(/'/g, "''");
    const conf = w.confidence_score || 0;
    statements.push(`INSERT INTO wallets(id, address, confidence_score) VALUES (${id}, '${address}', ${conf});`);
  });
  return statements.join('\n');
}

function exportToJson(wallets) {
  return JSON.stringify(wallets, null, 2);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const InfiniteScrollLeaderboard = ({ type, filter }) => {
  const [wallets, setWallets] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Export dropdown
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  // Export logic
  const handleExport = (format) => {
    const sanitizedData = omitAllprices(wallets);
    let content = '';
    let mimeType = 'text/plain';
    let fileName = 'wallets';

    switch (format) {
      case 'excel':
        content = exportToCsv(sanitizedData);
        mimeType = 'text/csv';
        fileName += '.csv';
        break;
      case 'sql':
        content = exportToSql(sanitizedData);
        mimeType = 'text/sql';
        fileName += '.sql';
        break;
      case 'json':
        content = exportToJson(sanitizedData);
        mimeType = 'application/json';
        fileName += '.json';
        break;
      default:
        break;
    }
    downloadFile(content, fileName, mimeType);
    handleMenuClose();
  };

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
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Network response was not ok: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.length === 0) {
          setHasMore(false);
        } else {
          setWallets((prev) => {
            const combined = [...prev, ...data];
            // Deduplicate
            const unique = combined.filter(
              (w, idx, arr) => arr.findIndex((x) => x.id === w.id) === idx
            );
            if (unique.length === prev.length) {
              setHasMore(false);
            }
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

  // Fetch on mount
  useEffect(() => {
    fetchWallets(0);
  }, []);

  // Local sort for "pnl"
  let sortedWallets = wallets;
  if (filter === 'pnl') {
    sortedWallets = [...wallets].sort((a, b) => {
      const aPnl = a.runners.reduce((acc, r) => acc + computePnl(r), 0);
      const bPnl = b.runners.reduce((acc, r) => acc + computePnl(r), 0);
      return bPnl - aPnl;
    });
  }

  return (
    // Outer container: fill screen, center content horizontally with flex
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: '100%',
        height: '90vh',
        backgroundColor: '#1d1d1d',
        overflow: 'auto',
        boxShadow: '0px 0px 15px rgba(0,230,118,0.7)',
      }}
      id="scrollableDiv"
    >
      {/* Inner box with max width, so content is truly centered */}
      <Box sx={{ width: '100%', maxWidth: '1400px', marginX: 'auto', padding: 2 }}>
        {/* Top bar: error + export dropdown */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          {error && (
            <Typography sx={{ color: 'red', textAlign: 'center' }}>
              {error}
            </Typography>
          )}
          <Box>
            <Button
              variant="contained"
              onClick={handleMenuOpen}
              endIcon={<ArrowDropDownIcon />}
              sx={{ backgroundColor: '#00e676', color: '#121212', fontWeight: 'bold' }}
            >
              Export
            </Button>
            <Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
              <MenuItem onClick={() => handleExport('excel')}>Excel (CSV)</MenuItem>
              <MenuItem onClick={() => handleExport('sql')}>SQL</MenuItem>
              <MenuItem onClick={() => handleExport('json')}>JSON</MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Infinite scroll content */}
        <InfiniteScroll
          dataLength={sortedWallets.length}
          next={() => fetchWallets(offset)}
          hasMore={hasMore}
          loader={<Typography>Loading...</Typography>}
          scrollableTarget="scrollableDiv"
        >
          {/* 2-column layout on md+, single column on small screens */}
          <Grid container spacing={2}>
            {sortedWallets.map((wallet) => (
              <Grid item xs={12} md={6} key={wallet.id}>
                <WalletAccordion wallet={wallet} computePnl={computePnl} />
              </Grid>
            ))}
          </Grid>
        </InfiniteScroll>
      </Box>
    </Box>
  );
};

export default InfiniteScrollLeaderboard;
