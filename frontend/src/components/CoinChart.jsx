// src/components/CoinChart.jsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, annotationPlugin);

const CoinChart = ({ coin }) => {
  const prices = coin.timestamps.allprices || [];
  const sortedPrices = prices.sort((a, b) => a.unixTime - b.unixTime);
  const labels = sortedPrices.map((p) => new Date(p.unixTime * 1000).toLocaleString());
  const dataPoints = sortedPrices.map((p) => p.value);

  // Build annotations for late, early, twoMillion, and fiveMillion if present.
  const annotations = {};
  if (coin.timestamps.early) {
    annotations.earlyLine = {
      type: 'line',
      xMin: new Date(coin.timestamps.early * 1000),
      xMax: new Date(coin.timestamps.early * 1000),
      borderColor: 'blue',
      borderWidth: 2,
      label: {
        enabled: true,
        content: 'Early',
        backgroundColor: 'blue',
        color: '#fff',
        font: { size: 8 },
        position: 'start',
      },
    };
  }
  if (coin.timestamps.late) {
    annotations.lateLine = {
      type: 'line',
      xMin: new Date(coin.timestamps.late * 1000),
      xMax: new Date(coin.timestamps.late * 1000),
      borderColor: 'red',
      borderWidth: 2,
      label: {
        enabled: true,
        content: 'Late',
        backgroundColor: 'red',
        color: '#fff',
        font: { size: 8 },
        position: 'start',
      },
    };
  }
  if (coin.timestamps.twoMillion) {
    annotations.twoMillionLine = {
      type: 'line',
      xMin: new Date(coin.timestamps.twoMillion * 1000),
      xMax: new Date(coin.timestamps.twoMillion * 1000),
      borderColor: 'purple',
      borderWidth: 2,
      label: {
        enabled: true,
        content: '2M',
        backgroundColor: 'purple',
        color: '#fff',
        font: { size: 8 },
        position: 'start',
      },
    };
  }
  if (coin.timestamps.fiveMillion) {
    annotations.fiveMillionLine = {
      type: 'line',
      xMin: new Date(coin.timestamps.fiveMillion * 1000),
      xMax: new Date(coin.timestamps.fiveMillion * 1000),
      borderColor: 'orange',
      borderWidth: 2,
      label: {
        enabled: true,
        content: '5M',
        backgroundColor: 'orange',
        color: '#fff',
        font: { size: 8 },
        position: 'start',
      },
    };
  }

  const data = {
    labels,
    datasets: [
      {
        label: `${coin.name} Price`,
        data: dataPoints,
        fill: false,
        borderColor: '#00e676',
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { font: { size: 8 } },
      },
      y: {
        ticks: { font: { size: 8 } },
      },
    },
    plugins: {
      legend: { display: false },
      annotation: { annotations },
    },
  };

  return (
    <div style={{ height: '150px' }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default CoinChart;
