// src/components/InfiniteScrollLeaderboard.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Import useRef
import InfiniteScroll from 'react-infinite-scroll-component';
import { Box, Typography, Button, Menu, MenuItem, Grid, CircularProgress } from '@mui/material'; // Import CircularProgress
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import WalletAccordion from './WalletAccordion';

// --- Export functions (exportToCsv, exportToSql, exportToJson, downloadFile) ---
// Keep your existing, verified export functions here
function exportToCsv(wallets) {
  const header = ['id', 'address', 'confidence_score', 'pnl', 'badges', 'runners_count'];
  const rows = wallets.map((w) => [
    w.id,
    w.address,
    w.confidence_score ?? 'N/A',
    w.pnl ?? 'N/A',
    (w.badges || []).join(';'), // Add safety check for badges
    w.runners ? w.runners.length : 0,
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function exportToSql(wallets) {
  let statements = [];
  wallets.forEach((w) => {
    const id = w.id;
    const address = w.address ? w.address.replace(/'/g, "''") : ''; // Add safety check
    const conf = w.confidence_score ?? 0;
    const pnl = w.pnl ?? 0;
    statements.push(`INSERT INTO wallets(id, address, confidence_score, pnl) VALUES (${id}, '${address}', ${conf}, ${pnl});`);
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
// --- End Export Functions ---


const InfiniteScrollLeaderboard = ({ type, sortBy, badgeFilter, excludeBots = false, athmcThreshold = null }) => {
  const [wallets, setWallets] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false); // Tracks if a fetch is in progress

  // Use a ref to track if a fetch is *actively* being requested by the scroll component
  // This helps prevent race conditions where 'next' is called multiple times quickly
  const fetchRequested = useRef(false);

  // Export dropdown state and handlers
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);
  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  // Export logic
  const handleExport = (format) => {
    const dataToExport = wallets;
    let content = '';
    let mimeType = 'text/plain';
    let fileName = 'wallets';
    switch (format) { /* ... cases ... */
      case 'excel': content = exportToCsv(dataToExport); mimeType = 'text/csv'; fileName += '.csv'; break;
      case 'sql': content = exportToSql(dataToExport); mimeType = 'text/sql'; fileName += '.sql'; break;
      case 'json': content = exportToJson(dataToExport); mimeType = 'application/json'; fileName += '.json'; break;
      default: break;
    }
    downloadFile(content, fileName, mimeType);
    handleMenuClose();
  };

  // API Fetch Logic
  const fetchWallets = useCallback(async (currentOffset) => {
    // Prevent fetching if already loading or if no more data known
    // Also check fetchRequested ref to avoid rapid-fire requests
    if (loading || !hasMore || fetchRequested.current) {
      console.log(`Fetch skipped: loading=${loading}, hasMore=${hasMore}, fetchRequested=${fetchRequested.current}`);
      return;
    }

    // Log all filters being used
    console.log(`--- Fetching Wallets --- Offset: ${currentOffset}, Type: ${type}, SortBy: ${sortBy}, Badges: ${badgeFilter?.join(',') || 'None'}, ExcludeBots: ${excludeBots}, ATHMC Threshold: ${athmcThreshold}`);
    setLoading(true);
    fetchRequested.current = true; // Mark that a fetch has been initiated
    setError(null);

    // *** Match this limit with the backend ***
    const limit = 50;
    let url = '';

    // Construct query parameters
    const queryParams = new URLSearchParams({
      offset: currentOffset.toString(),
      limit: limit.toString(),
      sortBy: sortBy || 'confidence',
      excludeBots: excludeBots.toString()
    });

    // Add badge filter if badges are selected
    if (badgeFilter && badgeFilter.length > 0) {
      queryParams.append('badges', badgeFilter.join(','));
    }

    // Add ATHMC threshold if set
    if (athmcThreshold !== null) {
      queryParams.append('athmcThreshold', athmcThreshold.toString());
    }

    if (type === 'all-time') {
      url = `${import.meta.env.VITE_API_ENDPOINT}/leaderboard/all-time?${queryParams.toString()}`;
    } else {
      const days = type === '7-day' ? 7 : type === '30-day' ? 30 : 90;
      queryParams.append('days', days.toString());
      url = `${import.meta.env.VITE_API_ENDPOINT}/leaderboard/dynamic?${queryParams.toString()}`;
    }

    console.log("Request URL:", url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorBody = await response.text();
            const jsonError = JSON.parse(errorBody);
            errorMsg = jsonError.message || jsonError.error || errorMsg;
        } catch (e) { /* Ignore if error body isn't JSON */ }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        console.error("API did not return an array:", data);
        throw new Error("Invalid data format received from API.");
      }

      const newValidWallets = data.filter(w => w && w.id != null);
      console.log(`Received ${data.length} items, ${newValidWallets.length} valid wallets.`);

      setWallets(prevWallets => {
        const combined = [...prevWallets, ...newValidWallets];
        const unique = combined.filter((w, idx, arr) => arr.findIndex((x) => x.id === w.id) === idx);
        console.log(`Total unique wallets after update: ${unique.length}`);
        return unique;
      });

      // Update offset for the *next* fetch request
      setOffset(currentOffset + newValidWallets.length);

      // Determine if there might be more data
      // API returns exactly 'limit' items if more pages exist, fewer otherwise
      const moreDataAvailable = newValidWallets.length === limit;
      setHasMore(moreDataAvailable);
      console.log(`More data available: ${moreDataAvailable}`);

    } catch (err) {
      console.error('Error during fetchWallets:', err);
      setError(err.message || "An unknown error occurred fetching data.");
      setHasMore(false); // Stop fetching on error
    } finally {
      setLoading(false);
      fetchRequested.current = false; // Allow next fetch request
      console.log("--- Fetch Complete ---");
    }
  // Dependencies for useCallback
  }, [type, sortBy, badgeFilter, excludeBots, athmcThreshold, loading, hasMore]); // Include loading/hasMore for checks inside

  // Effect for initial load and when type/filter changes
  useEffect(() => {
    console.log(`*** EFFECT: Resetting for type=${type}, sortBy=${sortBy}, badges=${badgeFilter?.join(',') || 'None'}, excludeBots=${excludeBots}, athmcThreshold=${athmcThreshold} ***`);
    setWallets([]);
    setOffset(0);
    setHasMore(true); // Reset hasMore assumption
    setError(null);
    setLoading(false); // Ensure loading is reset
    fetchRequested.current = false; // Reset request flag

    // Use setTimeout to ensure state resets apply before the first fetch
    // This can sometimes help prevent race conditions on rapid filter changes
    const timerId = setTimeout(() => {
        console.log("*** EFFECT: Initiating first fetch ***");
        fetchWallets(0); // Fetch initial batch with offset 0
    }, 0);

    // Cleanup function
    return () => {
        clearTimeout(timerId);
        console.log("*** EFFECT: Cleanup ***");
    };
  // Dependencies for useEffect
  }, [type, sortBy, badgeFilter, excludeBots, athmcThreshold]); // Re-run on filter change


  // Function called by InfiniteScroll's 'next' prop
  const loadMoreItems = () => {
      // Double check conditions here before calling fetchWallets
      if (!loading && hasMore && !fetchRequested.current) {
          console.log(`InfiniteScroll triggered 'next'. Calling fetchWallets with offset: ${offset}`);
          fetchWallets(offset);
      } else {
          console.log(`InfiniteScroll triggered 'next', but fetch skipped: loading=${loading}, hasMore=${hasMore}, fetchRequested=${fetchRequested.current}`);
      }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: 'calc(100vh - 220px)', // Reduced height
        backgroundColor: '#1d1d1d',
        boxShadow: '0px 0px 15px rgba(0,230,118,0.7)',
        overflow: 'hidden',
        borderRadius: 1,
        maxWidth: '1200px', // Match with LeaderboardContainer
        mx: 'auto', // Center horizontally
      }}
    >
      {/* Top bar with export button */}
      <Box sx={{ 
        p: 2,
        display: 'flex', 
        justifyContent: 'flex-end',
        borderBottom: '1px solid rgba(0,230,118,0.2)'
      }}>
        {error && (
          <Typography sx={{ color: 'red', flexGrow: 1, mr: 2, fontSize: '1rem' }}>{error}</Typography>
        )}
        <Box>
          <Button
            variant="contained"
            onClick={handleMenuOpen}
            endIcon={<ArrowDropDownIcon />}
            sx={{ 
              backgroundColor: '#00e676', 
              color: '#121212', 
              fontWeight: 'bold',
              fontSize: '1rem',
              px: 3,
              py: 1
            }}
          >
            Export
          </Button>
          <Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
            <MenuItem onClick={() => handleExport('excel')} sx={{ fontSize: '1rem' }}>Excel (CSV)</MenuItem>
            <MenuItem onClick={() => handleExport('sql')} sx={{ fontSize: '1rem' }}>SQL</MenuItem>
            <MenuItem onClick={() => handleExport('json')} sx={{ fontSize: '1rem' }}>JSON</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Scrollable content area */}
      <Box
        id="scrollableDiv"
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          p: 2,
          maxHeight: 'calc(100% - 60px)' // Account for export button area
        }}
      >
        <InfiniteScroll
          dataLength={wallets.length}
          next={loadMoreItems}
          hasMore={hasMore}
          loader={
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={30} sx={{ color: '#00e676' }} />
            </Box>
          }
          scrollableTarget="scrollableDiv"
          style={{ 
            overflow: 'hidden',
            maxWidth: '100%'
          }}
        >
          <Grid container spacing={3} sx={{ maxWidth: '100%', m: 0 }}>
            {wallets.map((wallet) => (
              <Grid item xs={12} md={6} key={wallet.id}>
                <WalletAccordion wallet={wallet} />
              </Grid>
            ))}
          </Grid>
        </InfiniteScroll>

        {/* Fallback: Show loader if loading initially and no wallets yet */}
        {loading && wallets.length === 0 && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#00e676' }} />
          </Box>
        )}

      </Box>
    </Box>
  );
};

export default InfiniteScrollLeaderboard;