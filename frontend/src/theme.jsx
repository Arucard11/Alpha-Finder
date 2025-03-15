// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00e676' },
    secondary: { main: '#ff4081' },
    background: {
      default: '#121212',
      paper: '#1d1d1d',
    },
    text: { primary: '#ffffff' },
  },
  typography: {
    fontFamily: "'Poppins', sans-serif",
  },
});

export default theme;
