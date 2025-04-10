import React, { useState } from 'react';
import { TextField, Box, IconButton, CircularProgress } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SearchResultOverlay from './SearchResultOverlay';

const SearchBar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm) return;

    setLoading(true);
    setShowOverlay(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/leaderboard/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: searchTerm })
      });

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ error: 'No results found' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search wallet or runner..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: 'white',
              '& fieldset': { borderColor: '#00e676' },
              '&:hover fieldset': { borderColor: '#00e676' },
              '&.Mui-focused fieldset': { borderColor: '#00e676' },
            },
            input: { color: 'white' },
          }}
        />
        <IconButton type="submit" sx={{ color: '#00e676' }}>
          {loading ? <CircularProgress size={24} color="inherit" /> : <SearchIcon />}
        </IconButton>
      </Box>
      
      {showOverlay && (
        <SearchResultOverlay
          results={searchResults}
          onClose={() => {
            setShowOverlay(false);
            setSearchResults(null);
            setSearchTerm('');
          }}
        />
      )}
    </>
  );
};

export default SearchBar;
