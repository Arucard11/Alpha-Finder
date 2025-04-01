// src/components/InfiniteScrollLeaderboard.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import InfiniteScroll from 'react-infinite-scroll-component';
import { Box, Typography, Button, Menu, MenuItem, Grid } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import WalletAccordion from './WalletAccordion';

// Export functions (exportToCsv, exportToSql, exportToJson, downloadFile) remain the same...
// ... (paste your existing export functions here) ...
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
  const [loading, setLoading] = useState(false); // Add loading state for fetch calls

  // Export dropdown state and handlers remain the same...
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);
  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  // Export logic (handleExport) remains the same...
   const handleExport = (format) => {
    const dataToExport = wallets;
    let content = '';
    let mimeType = 'text/plain';
    let fileName = 'wallets';

    switch (format) {
      case 'excel':
        content = exportToCsv(dataToExport);
        mimeType = 'text/csv';
        fileName += '.csv';
        break;
      case 'sql':
        content = exportToSql(dataToExport);
        mimeType = 'text/sql';
        fileName += '.sql';
        break;
      case 'json':
        content = exportToJson(dataToExport);
        mimeType = 'application/json';
        fileName += '.json';
        break;
      default:
        break;
    }
    downloadFile(content, fileName, mimeType);
    handleMenuClose();
  };


  // Use useCallback to memoize fetchWallets, preventing unnecessary recreation
  // especially important if passed directly to `next` prop without intermediate function
  const fetchWallets = useCallback((currentOffset) => {
    // Prevent fetching if already loading or if no more data
    if (loading || !hasMore) {
        console.log(`Fetch skipped: loading=${loading}, hasMore=${hasMore}`);
        return;
    }

    setLoading(true); // Set loading true at the start of fetch
    setError(null); // Clear previous errors on new fetch attempt

    let url = '';
    let body = {};
    const limit = 20; // Example: Define how many items to fetch per request (adjust as needed)

    if (type === 'all-time') {
      url = `${import.meta.env.VITE_API_ENDPOINT}/leaderboard/all-time`;
      // Send offset and potentially a limit if API supports it
      body = { offset: currentOffset, limit: limit };
      if (filter) {
        body.sort = filter;
      }
    } else {
      url = `${import.meta.env.VITE_API_ENDPOINT}/leaderboard/day`;
      const days = type === '7-day' ? 7 : type === '30-day' ? 30 : 90;
      // Send offset and potentially a limit if API supports it
      body = { days, offset: currentOffset, limit: limit };
      if (filter) {
        body.sort = filter;
      }
    }

    console.log(`Fetching wallets: type=${type}, filter=${filter}, offset=${currentOffset}, limit=${limit}`);
    console.log("Request body:", body);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) {
          return res.text().then(text => {
            let errorMsg = `API Error: ${res.status} ${res.statusText}`;
            try {
                const jsonError = JSON.parse(text);
                errorMsg = jsonError.message || jsonError.error || errorMsg;
            } catch (e) { if(text) errorMsg = text; }
            throw new Error(errorMsg);
          });
        }
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
             console.error("API did not return an array:", data);
             throw new Error("Invalid data format received from API.");
        }

        // Filter out potential null/undefined entries and ensure 'id' exists
        const newValidWallets = data.filter(w => w && w.id != null);
        console.log(`Received ${data.length} items, ${newValidWallets.length} valid wallets.`);

        // Update wallets state by appending new valid wallets and deduplicating
        setWallets(prevWallets => {
             const combined = [...prevWallets, ...newValidWallets];
             const unique = combined.filter(
               (w, idx, arr) => arr.findIndex((x) => x.id === w.id) === idx
             );
             console.log(`Total unique wallets after update: ${unique.length}`);
             return unique;
        });

        // Update offset for the *next* fetch
        setOffset(currentOffset + newValidWallets.length);

        // Determine if there's more data
        // Assumption: API returns an empty array or fewer items than requested limit when done.
        const moreDataAvailable = newValidWallets.length === limit; // Adjust if API signals end differently
        setHasMore(moreDataAvailable);
        console.log(`More data available: ${moreDataAvailable}`);

      })
      .catch((err) => {
        console.error('Error fetching leaderboard data:', err);
        setError(err.message || "An unknown error occurred fetching data.");
        setHasMore(false); // Stop fetching on error
      })
      .finally(() => {
        setLoading(false); // Set loading false when fetch completes (success or error)
      });
  // Add dependencies for useCallback
  }, [type, filter, loading, hasMore]); // Include loading/hasMore to prevent stale closures


  // Effect for initial load and when type/filter changes
  useEffect(() => {
    console.log(`Effect triggered: type=${type}, filter=${filter}. Resetting state.`);
    setWallets([]);     // Clear existing wallets
    setOffset(0);       // Reset offset to 0
    setHasMore(true);   // Assume more data exists for the new filter/type
    setError(null);     // Clear previous errors
    setLoading(false);  // Reset loading state
    // Fetch the first batch for the new settings
    // Wrap fetchWallets(0) in a function to avoid direct call potentially causing issues
    // Also ensures the loading state check inside fetchWallets works correctly for the initial load.
    const initialFetch = () => fetchWallets(0);
    initialFetch();

    // Cleanup function (optional but good practice)
    return () => {
        console.log("Cleanup effect");
        // Potentially cancel ongoing fetch requests here if needed
    };
  // Ensure fetchWallets is stable or included if it changes based on props/state outside its definition
  }, [type, filter, fetchWallets]);


  return (
    // Outer container
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: '100%',
        height: '90vh', // Make sure this height allows scrolling
        backgroundColor: '#1d1d1d',
        overflow: 'auto', // This is crucial for scrolling
        boxShadow: '0px 0px 15px rgba(0,230,118,0.7)',
      }}
      id="scrollableDiv" // Target for InfiniteScroll
    >
      {/* Inner container */}
      <Box sx={{ width: '100%', maxWidth: '1400px', marginX: 'auto', padding: 2 }}>
        {/* Top bar (Error display and Export Button) */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            minHeight: '40px',
          }}
        >
          {error && (
            <Typography sx={{ color: 'red', flexGrow: 1, textAlign: 'left', mr: 2 }}>
              Error: {error}
            </Typography>
          )}
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

        {/* Infinite scroll component */}
        <InfiniteScroll
          dataLength={wallets.length} // Current number of items
          next={() => fetchWallets(offset)} // Function to call for more data (use current offset)
          hasMore={hasMore && !error} // Continue if hasMore is true AND no error occurred
          loader={ // Display loader only when actively loading
             loading && <Typography sx={{ textAlign: 'center', color: 'grey.500', my: 2 }}>Loading...</Typography>
          }
          endMessage={ // Message when hasMore becomes false
            <Typography sx={{ textAlign: 'center', color: 'grey.500', my: 2 }}>
              {!error && wallets.length === 0 && !hasMore ? 'No wallets found.' :
               !error && wallets.length > 0 && !hasMore ? `You've reached the end!` :
               ''}
            </Typography>
          }
          scrollableTarget="scrollableDiv" // Matches the ID of the scrollable container
          style={{ overflow: 'visible' }} // Prevent InfiniteScroll from adding its own scrollbars
        >
          {/* Grid layout */}
          <Grid container spacing={2}>
            {wallets.map((wallet) => (
              <Grid item xs={12} md={6} key={wallet.id}>
                {/* Pass wallet data to the accordion */}
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