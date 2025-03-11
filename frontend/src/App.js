import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import SignIn from './pages/SignIn';

function App() {
  // For demo purposes, we simulate authentication (set to true after Phantom connect)
  const [authenticated, setAuthenticated] = useState(true);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/signin" element={<SignIn setAuthenticated={setAuthenticated} />} />
          <Route path="/admin" element={authenticated ? <Admin /> : <Navigate to="/signin" />} />
          <Route path="/" element={authenticated ? <Dashboard /> : <Navigate to="/signin" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
