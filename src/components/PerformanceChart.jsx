import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

const formatCompactNumber = (value) =>
  new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value || 0));

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const aggregateWeekly = (data = []) => {
  const buckets = [];

  data.forEach((entry, index) => {
    const bucketIndex = Math.floor(index / 7);
    if (!buckets[bucketIndex]) {
      buckets[bucketIndex] = {
        date: `Week ${bucketIndex + 1}`,
        reach: 0,
        spend: 0
      };
    }

    buckets[bucketIndex].reach += Number(entry.reach || 0);
    buckets[bucketIndex].spend += Number(entry.spend || 0);
  });

  return buckets.map((bucket) => ({
    ...bucket,
    spend: Number(bucket.spend.toFixed(2))
  }));
};

const chartTooltipFormatter = (value, name) => {
  if (name === 'Spend') {
    return [formatCurrency(value), name];
  }
  return [formatCompactNumber(value), name];
};

const PerformanceChart = ({ data = [], granularity = 'day', onGranularityChange }) => {
  const chartData = useMemo(() => {
    if (granularity === 'week') {
      return aggregateWeekly(data);
    }

    return data.map((entry) => ({
      ...entry,
      date: entry.date?.slice(5) || entry.date
    }));
  }, [data, granularity]);

  return (
    <section className="insights-panel">
      <div className="insights-panel-header">
        <div>
          <h2>Performance Trends</h2>
          <p>Track reach and spend over time.</p>
        </div>
        <div className="chart-toggle">
          <button
            type="button"
            className={granularity === 'day' ? 'active' : ''}
            onClick={() => onGranularityChange?.('day')}
          >
            Day
          </button>
          <button
            type="button"
            className={granularity === 'week' ? 'active' : ''}
            onClick={() => onGranularityChange?.('week')}
          >
            Week
          </button>
        </div>
      </div>

      <div className="chart-shell">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              minTickGap={18}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={formatCompactNumber}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={formatCurrency}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '14px',
                border: '1px solid #dbe4f0',
                boxShadow: '0 18px 38px rgba(15, 23, 42, 0.08)'
              }}
              formatter={chartTooltipFormatter}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="reach"
              name="Reach"
              stroke="#2563eb"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="spend"
              name="Spend"
              stroke="#0f766e"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default PerformanceChart;
