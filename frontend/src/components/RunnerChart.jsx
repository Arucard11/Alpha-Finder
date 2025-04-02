// src/components/RunnerChart.jsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ScatterController,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';

// Register all controllers and plugins, including the scatter controller.
Chart.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend, annotationPlugin, ScatterController);

const RunnerChart = ({ runner }) => {
  // Prepare main dataset from allprices with proper sorting
  const prices = runner.timestamps.allprices || [];
  const sortedPrices = prices.sort((a, b) => a.unixTime - b.unixTime);
  
  // Get start and end dates from price data
  const startDate = sortedPrices.length ? new Date(sortedPrices[0].unixTime * 1000) : new Date();
  const endDate = sortedPrices.length ? new Date(sortedPrices[sortedPrices.length - 1].unixTime * 1000) : new Date();

  const lineData = sortedPrices.map((p) => ({
    x: new Date(p.unixTime * 1000),
    y: p.value,
  }));

  // Filter buy and sell points to only show within the price data range
  const buyPoints = (runner.transactions.buy || [])
    .filter(tx => {
      const txDate = new Date(tx.timestamp * 1000);
      return txDate >= startDate && txDate <= endDate;
    })
    .map((tx) => ({
      x: new Date(tx.timestamp * 1000),
      y: tx.price,
    }));

  const sellPoints = (runner.transactions.sell || [])
    .filter(tx => {
      const txDate = new Date(tx.timestamp * 1000);
      return txDate >= startDate && txDate <= endDate;
    })
    .map((tx) => ({
      x: new Date(tx.timestamp * 1000),
      y: tx.price,
    }));

  // Setup annotations for twoMillion, fiveMillion, early, late
  const annotations = {};
  let showLegend = false;
  if (runner.timestamps.twoMillion) {
    annotations.twoMillionLine = {
      type: 'line',
      xMin: new Date(runner.timestamps.twoMillion * 1000),
      xMax: new Date(runner.timestamps.twoMillion * 1000),
      borderColor: 'purple',
      borderWidth: 2,
      label: {
        content: '2M',
        enabled: true,
        position: 'start',
        backgroundColor: 'purple',
        color: '#ffffff',
      },
    };
    showLegend = true;
  }
  if (runner.timestamps.fiveMillion) {
    annotations.fiveMillionLine = {
      type: 'line',
      xMin: new Date(runner.timestamps.fiveMillion * 1000),
      xMax: new Date(runner.timestamps.fiveMillion * 1000),
      borderColor: 'orange',
      borderWidth: 2,
      label: {
        content: '5M',
        enabled: true,
        position: 'start',
        backgroundColor: 'orange',
        color: '#ffffff',
      },
    };
    showLegend = true;
  }
  if (runner.timestamps.early) {
    annotations.earlyLine = {
      type: 'line',
      xMin: new Date(runner.timestamps.early * 1000),
      xMax: new Date(runner.timestamps.early * 1000),
      borderColor: 'blue',
      borderWidth: 2,
      label: {
        content: 'Early',
        enabled: true,
        position: 'start',
        backgroundColor: 'blue',
        color: '#ffffff',
      },
    };
    showLegend = true;
  }
  if (runner.timestamps.late) {
    annotations.lateLine = {
      type: 'line',
      xMin: new Date(runner.timestamps.late * 1000),
      xMax: new Date(runner.timestamps.late * 1000),
      borderColor: 'red',
      borderWidth: 2,
      label: {
        content: 'Late',
        enabled: true,
        position: 'start',
        backgroundColor: 'red',
        color: '#ffffff',
      },
    };
    showLegend = true;
  }

  const data = {
    datasets: [
      {
        label: 'Price History',
        data: lineData,
        fill: false,
        borderColor: 'rgba(0, 230, 118, 0.8)',
        tension: 0.1,
        pointRadius: 0,
      },
      {
        label: 'Buy Transactions',
        data: buyPoints,
        backgroundColor: 'green',
        borderColor: 'green',
        pointRadius: 5,
        type: 'scatter',
        showLine: false,
      },
      {
        label: 'Sell Transactions',
        data: sellPoints,
        backgroundColor: 'red',
        borderColor: 'red',
        pointRadius: 5,
        type: 'scatter',
        showLine: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          tooltipFormat: 'Pp',
          unit: 'day',
          displayFormats: {
            day: 'MMM dd, yyyy'
          }
        },
        title: { display: true, text: 'Time' },
        min: startDate,
        max: endDate,
        ticks: {
          autoSkip: true,
          maxRotation: 45,
          color: '#ffffff',
          maxTicksLimit: 10 // Add this to limit the number of ticks
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)' // Add this to make grid lines visible
        }
      },
      y: {
        title: { display: true, text: 'Price' },
        ticks: {
          color: '#ffffff'
        }
      },
    },
    plugins: {
      legend: { display: true, position: 'top' },
      annotation: { annotations: annotations },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y}`,
        },
      },
    },
  };

  return (
    <div>
      <div style={{ height: '150px' }}>
        <Line data={data} options={options} />
      </div>
      {showLegend && (
        <div
          style={{
            textAlign: 'center',
            marginTop: '4px',
            fontSize: '0.8rem',
            color: '#ffffff',
          }}
        >
          <span style={{ marginRight: '12px' }}>
            <span style={{ color: 'purple', fontWeight: 'bold' }}>■</span> 2M Timestamp
          </span>
          <span style={{ marginRight: '12px' }}>
            <span style={{ color: 'orange', fontWeight: 'bold' }}>■</span> 5M Timestamp
          </span>
          <span style={{ marginRight: '12px' }}>
            <span style={{ color: 'blue', fontWeight: 'bold' }}>■</span> Early Timestamp
          </span>
          <span>
            <span style={{ color: 'red', fontWeight: 'bold' }}>■</span> Holding Threshold Timestamp
          </span>
        </div>
      )}
      {/* Transaction details */}
      <div
        style={{
          marginTop: '8px',
          backgroundColor: '#333',
          padding: '8px',
          borderRadius: '4px',
        }}
      >
        <div style={{ marginBottom: '4px' }}>
          <strong style={{ color: '#ffffff' }}>Buy Transactions:</strong>
        </div>
        {runner.transactions.buy.map((tx, idx) => (
          <div
            key={`buy-${idx}`}
            style={{
              color: 'green',
              fontSize: '0.75rem',
              marginBottom: '2px',
            }}
          >
            {new Date(tx.timestamp * 1000).toLocaleString()} - Price: ${Number(tx.price).toFixed(5)} - Total: ${(tx.price * tx.amount).toFixed(0)}
          </div>
        ))}
        <div style={{ marginTop: '4px', marginBottom: '4px' }}>
          <strong style={{ color: '#ffffff' }}>Sell Transactions:</strong>
        </div>
        {runner.transactions.sell.map((tx, idx) => (
          <div
            key={`sell-${idx}`}
            style={{
              color: 'red',
              fontSize: '0.75rem',
              marginBottom: '2px',
            }}
          >
            {new Date(tx.timestamp * 1000).toLocaleString()} - Price: ${Number(tx.price).toFixed(5)} - Total: ${(tx.price * tx.amount).toFixed(0)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RunnerChart;
