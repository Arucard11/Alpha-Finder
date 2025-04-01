// src/components/InfiniteScrollLeaderboard.jsx
import React, { useState, useEffect } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Box, Typography, Button, Menu, MenuItem, Grid } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import WalletAccordion from './WalletAccordion'; // Assuming WalletAccordion now uses wallet.pnl

// *** REMOVED: omitAllprices function is no longer needed ***
// function omitAllprices(wallets) { ... }

// Export conversions (remain the same, will now receive wallets potentially with allprices)
// Ensure your export logic handles potentially large data if 'allprices' was significant.
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
    // Assuming a 'pnl' column exists in your wallets table
    statements.push(`INSERT INTO wallets(id, address, confidence_score, pnl) VALUES (${id}, '${address}', ${conf}, ${pnl});`);
  });
  return statements.join('\n');
}

function exportToJson(wallets) {
  // JSON.stringify will handle the nested structures, including 'allprices' if present.
  // Be mindful of potential large output size.
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
    // *** REMOVED: Call to omitAllprices ***
    // const sanitizedData = omitAllprices(wallets);
    // Now directly use the 'wallets' state
    const dataToExport = wallets;
    let content = '';
    let mimeType = 'text/plain';
    let fileName = 'wallets';

    switch (format) {
      case 'excel':
        content = exportToCsv(dataToExport); // Pass wallets directly
        mimeType = 'text/csv';
        fileName += '.csv';
        break;
      case 'sql':
        content = exportToSql(dataToExport); // Pass wallets directly
        mimeType = 'text/sql';
        fileName += '.sql';
        break;
      case 'json':
        content = exportToJson(dataToExport); // Pass wallets directly
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
      if (filter) {
        body.sort = filter;
      }
    } else {
      url = `${import.meta.env.VITE_API_ENDPOINT}/leaderboard/day`;
      const days = type === '7-day' ? 7 : type === '30-day' ? 30 : 90;
      body = { days, offset: currentOffset };
      if (filter) {
        body.sort = filter;
      }
    }

    console.log("Fetching wallets with body:", body);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
           // Try to get error message from response body if possible
          return res.text().then(text => {
            let errorMsg = `Network response was not ok: ${res.status} ${res.statusText}`;
            try {
                const jsonError = JSON.parse(text);
                errorMsg = jsonError.message || jsonError.error || errorMsg;
            } catch (e) {
                // Ignore if response is not JSON
                if(text) errorMsg = text; // Use text if available
            }
            throw new Error(errorMsg);
          });
        }
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
             console.error("API did not return an array:", data);
             setError("Invalid data format received from API.");
             setHasMore(false);
             return;
        }
        if (data.length === 0) {
          setHasMore(false);
        } else {
           // Filter out potential null/undefined entries and ensure 'id' exists
           const newValidWallets = data.filter(w => w && w.id != null);

          if (newValidWallets.length === 0 && data.length > 0) {
              console.warn("Received data but none were valid wallets.");
              // Decide if this should stop fetching or continue, depends on API behavior
              // setHasMore(false); // Option: stop if only invalid data comes
          }

          setWallets((prev) => {
            const combined = [...prev, ...newValidWallets];
            // Deduplicate
            const unique = combined.filter(
              (w, idx, arr) => arr.findIndex((x) => x.id === w.id) === idx
            );

             // Check if new unique items were actually added
             const newUniqueCount = unique.length - prev.length;

             if (newUniqueCount === 0 && newValidWallets.length > 0 && prev.length > 0) {
                console.warn("Received duplicate data or no new unique wallets, potentially indicating end of list or API issue.");
                setHasMore(false);
             } else if (newValidWallets.length === 0 && data.length === 0){
                setHasMore(false); // Explicitly stop if API returns empty array
             } else {
                // Only increment offset based on the number of *new unique* wallets added
                // This provides a more accurate offset for the *next* fetch
                setOffset(prevOffset => prevOffset + newUniqueCount);
                // Ensure hasMore is true if we added wallets
                if(newUniqueCount > 0) setHasMore(true);
             }
            return unique;
          });
        }
      })
      .catch((err) => {
        console.error('Error fetching leaderboard data:', err);
        setError(err.message || "An unknown error occurred."); // Provide default error message
        setHasMore(false);
      });
  };

  // Fetch on mount and when type or filter changes
  useEffect(() => {
    console.log(`Effect triggered: type=${type}, filter=${filter}. Resetting state.`);
    setWallets([]);
    setOffset(0); // Reset offset to 0 for new fetch
    setHasMore(true); // Assume there is more data initially
    setError(null); // Clear previous errors
    fetchWallets(0); // Fetch the first batch
  }, [type, filter]);

  return (
    // Outer container
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
      {/* Inner container */}
      <Box sx={{ width: '100%', maxWidth: '1400px', marginX: 'auto', padding: 2 }}>
        {/* Top bar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            minHeight: '40px',
          }}
        >
          {/* Error display */}
          {error && (
            <Typography sx={{ color: 'red', flexGrow: 1, textAlign: 'left', mr: 2 }}>
              Error: {error}
            </Typography>
          )}
          {/* Export Button */}
           <Box sx={{ ml: error ? 0 : 'auto' }}>
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
          dataLength={wallets.length}
          next={() => {
              console.log(`InfiniteScroll requesting next batch, current offset: ${offset}`);
              fetchWallets(offset); // Use the current offset state
          }}
          hasMore={hasMore}
          loader={<Typography sx={{ textAlign: 'center', color: 'grey.500', my: 2 }}>Loading...</Typography>}
          endMessage={
            <Typography sx={{ textAlign: 'center', color: 'grey.500', my: 2 }}>
              {!error && wallets.length === 0 && !hasMore ? 'No wallets found.' : // Initial load, no results
               !error && wallets.length > 0 && !hasMore ? `You've reached the end!` : // Loaded some, now at end
               ''}
               {/* Error message is displayed above */}
            </Typography>
          }
          scrollableTarget="scrollableDiv"
        >
          {/* Grid layout */}
          <Grid container spacing={2}>
            {wallets.map((wallet) => (
              <Grid item xs={12} md={6} key={wallet.id}>
                <WalletAccordion wallet={wallet} />
              </Grid>
            ))}
          </Grid>
        </InfiniteScroll>
      </Box>
    </Box>
  );
};

export default InfiniteScrollLeaderboard;