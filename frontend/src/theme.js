import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' }, // Modern blue
    secondary: { main: '#dc004e' }, // Accent red
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // Subtle gradient background
          backgroundImage: 'linear-gradient(135deg, #f5f7fa, #c3cfe2)',
        },
      },
    },
  },
});

export default theme;
