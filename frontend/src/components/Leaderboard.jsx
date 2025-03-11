// src/pages/LeaderboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Box, CircularProgress, Container } from '@mui/material';
import WalletCard from '../components/WalletCard';
import Filters from '../components/Filters';
import { fetchLeaderboardData } from '../api';

function LeaderboardPage({category}) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
 // Can be 'allTime', '7-day', '30-day', '90-day'
  const [sortBy, setSortBy] = useState('confidence');
  const [badgeFilter, setBadgeFilter] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeaderboardData(category, offset, sortBy);
      setLeaderboard(prev => [...prev, ...data]);
      setOffset(prev => prev + 50);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }, [category, offset, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !loading) {
        loadData();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadData]);

  // Filter leaderboard by badgeFilter and searchQuery
  const filteredLeaderboard = leaderboard.filter(wallet => {
    let matchesBadge = true;
    if (badgeFilter.length > 0) {
      // Convert both wallet badges and filter selections to lowercase for comparison
      matchesBadge = badgeFilter.every(b =>
        wallet.badges.map(x => x.toLowerCase()).includes(b.toLowerCase())
      );
    }
    let matchesSearch = true;
    if (searchQuery.trim() !== '') {
      matchesSearch = wallet.address.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return matchesBadge && matchesSearch;
  });

  return (
    <Container sx={{ py: 4 }}>
      <Filters
        sortBy={sortBy}
        setSortBy={setSortBy}
        badgeFilter={badgeFilter}
        setBadgeFilter={setBadgeFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredLeaderboard.map((wallet, idx) => (
          <WalletCard key={wallet.id} wallet={wallet} rank={idx + 1} />
        ))}
      </Box>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      )}
    </Container>
  );
}

export default LeaderboardPage;
