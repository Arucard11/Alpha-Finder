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
  // Use maxProfitEnd as the end date if available, otherwise use the last price point
  const endDate = runner.timestamps.maxProfitEnd 
    ? new Date(runner.timestamps.maxProfitEnd * 1000) 
    : (sortedPrices.length ? new Date(sortedPrices[sortedPrices.length - 1].unixTime * 1000) : new Date());

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

  // Function to format timestamp for label
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

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
        content: `2M (${formatTimestamp(runner.timestamps.twoMillion)})`,
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
        content: `5M (${formatTimestamp(runner.timestamps.fiveMillion)})`,
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
        content: `Early (${formatTimestamp(runner.timestamps.early)})`,
        enabled: true,
        position: 'start',
        backgroundColor: 'blue',
        color: '#ffffff',
      },
    };
    showLegend = true;
  }
  // Add annotations for maxProfitStart and maxProfitEnd with a shaded zone
  if (runner.timestamps.maxProfitStart) {
    annotations.maxProfitStartLine = {
      type: 'line',
      xMin: new Date(runner.timestamps.maxProfitStart * 1000),
      xMax: new Date(runner.timestamps.maxProfitStart * 1000),
      borderColor: 'cyan',
      borderWidth: 2,
      label: {
        content: `Max Profit Start (${formatTimestamp(runner.timestamps.maxProfitStart)})`,
        enabled: true,
        position: 'start',
        backgroundColor: 'cyan',
        color: '#000000',
      },
    };
    showLegend = true;
  }
  if (runner.timestamps.maxProfitEnd) {
    annotations.maxProfitEndLine = {
      type: 'line',
      xMin: new Date(runner.timestamps.maxProfitEnd * 1000),
      xMax: new Date(runner.timestamps.maxProfitEnd * 1000),
      borderColor: 'magenta',
      borderWidth: 2,
      label: {
        content: `Max Profit End (${formatTimestamp(runner.timestamps.maxProfitEnd)})`,
        enabled: true,
        position: 'start',
        backgroundColor: 'magenta',
        color: '#ffffff',
      },
    };
    showLegend = true;
  }
  // Add shaded area for maxProfitZone if both start and end are available
  if (runner.timestamps.maxProfitStart && runner.timestamps.maxProfitEnd) {
    annotations.maxProfitZone = {
      type: 'box',
      xMin: new Date(runner.timestamps.maxProfitStart * 1000),
      xMax: new Date(runner.timestamps.maxProfitEnd * 1000),
      backgroundColor: 'rgba(0, 255, 255, 0.2)', // Light cyan shade for the zone
      borderColor: 'rgba(0, 255, 255, 0.5)',
      borderWidth: 1,
      label: {
        content: 'Max Profit Zone',
        enabled: true,
        position: 'center',
        backgroundColor: 'rgba(0, 255, 255, 0.7)',
        color: '#000000',
      },
    };
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
          <span style={{ marginRight: '12px' }}>
            <span style={{ color: 'cyan', fontWeight: 'bold' }}>■</span> Max Profit Start
          </span>
          <span style={{ marginRight: '12px' }}>
            <span style={{ color: 'magenta', fontWeight: 'bold' }}>■</span> Max Profit End
          </span>
          <span>
            <span style={{ color: 'rgba(0, 255, 255, 0.7)', fontWeight: 'bold' }}>■</span> Max Profit Zone
          </span>
        </div>
      )}
      {/* Transaction details */}
      <div
        style={{
          marginTop: '8px',
          backgroundColor: '#333',
          padding: '12px',
          borderRadius: '6px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        <div style={{ marginBottom: '8px' }}>
          <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>All Transactions:</strong>
        </div>
        {[...runner.transactions.buy.map(tx => ({ ...tx, type: 'buy' })),
          ...runner.transactions.sell.map(tx => ({ ...tx, type: 'sell' }))]
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((tx, idx) => (
          <div
            key={`transaction-${idx}`}
            style={{
              color: tx.type === 'buy' ? '#00e676' : '#ff1744',
              fontSize: '0.85rem',
              marginBottom: '6px',
              padding: '6px',
              backgroundColor: tx.type === 'buy' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 68, 0.1)',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 'bold', minWidth: '150px' }}>
              {new Date(tx.timestamp * 1000).toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            <span style={{ textTransform: 'capitalize', minWidth: '60px' }}>
              {tx.type === 'buy' ? 'Buy' : 'Sell'}
            </span>
            <span style={{ minWidth: '120px' }}>
              Price: ${Number(tx.price).toFixed(6)}
            </span>
            <span style={{ minWidth: '120px', fontStyle: 'italic' }}>
              Total: ${(tx.price * tx.amount).toFixed(2)}
            </span>
            {runner.totalsupply && (
              <span style={{ minWidth: '150px', fontStyle: 'italic' }}>
                MC at Tx: ${(tx.price * runner.totalsupply).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RunnerChart;
