import React, { useState, useEffect } from 'react';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const PriceChart = () => {
  const [interval, setInterval] = useState('hourly');
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [{
      label: 'Price (SOL)',
      data: [],
      borderColor: '#00e676',
      backgroundColor: 'rgba(0, 230, 118, 0.2)',
      fill: true,
      tension: 0.3,
    }],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data based on interval
    const fetchData = async () => {
      setLoading(true);
      try {
        // Replace with actual API endpoint to fetch price data
        const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/price-data?interval=${interval}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Assuming data structure is { labels: [], prices: [] }
        // Adjust based on actual API response structure
        setChartData({
          labels: data.labels || [],
          datasets: [{
            label: 'Price (SOL)',
            data: data.prices || [],
            borderColor: '#00e676',
            backgroundColor: 'rgba(0, 230, 118, 0.2)',
            fill: true,
            tension: 0.3,
          }],
        });
      } catch (error) {
        console.error('Error fetching price data:', error);
        // Fallback to mock data in case of error
        const mockData = generateMockData(interval);
        setChartData({
          labels: mockData.labels,
          datasets: [{
            label: 'Price (SOL)',
            data: mockData.prices,
            borderColor: '#00e676',
            backgroundColor: 'rgba(0, 230, 118, 0.2)',
            fill: true,
            tension: 0.3,
          }],
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [interval]);

  const handleIntervalChange = (event) => {
    setInterval(event.target.value);
  };

  // Mock data generation based on interval
  const generateMockData = (interval) => {
    const labels = [];
    const prices = [];
    const now = new Date();
    let timeRange;
    let format;

    switch (interval) {
      case 'hourly':
        timeRange = 24; // Last 24 hours
        format = (date) => `${date.getHours()}:00`;
        for (let i = timeRange; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 60 * 60 * 1000);
          labels.push(format(date));
          prices.push(Math.random() * 100 + 50); // Random price between 50 and 150
        }
        break;
      case 'daily':
        timeRange = 7; // Last 7 days
        format = (date) => `${date.getDate()}/${date.getMonth() + 1}`;
        for (let i = timeRange; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          labels.push(format(date));
          prices.push(Math.random() * 100 + 50);
        }
        break;
      case 'weekly':
        timeRange = 4; // Last 4 weeks
        format = (date) => `Week ${Math.ceil(date.getDate() / 7)}`;
        for (let i = timeRange; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          labels.push(format(date));
          prices.push(Math.random() * 100 + 50);
        }
        break;
      default:
        timeRange = 24;
        format = (date) => `${date.getHours()}:00`;
        for (let i = timeRange; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 60 * 60 * 1000);
          labels.push(format(date));
          prices.push(Math.random() * 100 + 50);
        }
    }
    return { labels, prices };
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#fff',
        },
      },
      title: {
        display: true,
        text: 'Price Trend',
        color: '#fff',
        font: {
          size: 18,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#fff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.2)',
        },
      },
      y: {
        ticks: {
          color: '#fff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.2)',
        },
        beginAtZero: false,
      },
    },
  };

  return (
    <Box sx={{ width: '100%', height: '300px', backgroundColor: 'rgba(39, 39, 39, 0.6)', borderRadius: 2, p: 2, mt: 3, border: '1px solid rgba(0, 230, 118, 0.2)', boxShadow: '0 4px 10px rgba(0, 230, 118, 0.2)', backdropFilter: 'blur(5px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#00e676' }}>Price Chart</Typography>
        <FormControl variant="outlined" sx={{ minWidth: 150, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(0, 230, 118, 0.3)' }, '&:hover fieldset': { borderColor: '#00e676' } } }}>
          <InputLabel id="interval-label" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Interval</InputLabel>
          <Select
            labelId="interval-label"
            label="Interval"
            value={interval}
            onChange={handleIntervalChange}
            sx={{ color: '#fff' }}
          >
            <MenuItem value="hourly">Hourly</MenuItem>
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
          <Typography sx={{ color: '#fff' }}>Loading chart...</Typography>
        </Box>
      ) : (
        <Line data={chartData} options={options} />
      )}
    </Box>
  );
};

export default PriceChart; 