import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import './ReliabilityInsights.css';

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPercent = (value) => `${(Math.max(0, value) * 100).toFixed(1)}%`;

const ReliabilityInsights = ({ data }) => {
  const safeData = data || {};
  const recipientCount = Math.max(0, toNumber(safeData.recipientCount));
  const suppressed = Math.max(0, toNumber(safeData.suppressed));
  const deferred = Math.max(0, toNumber(safeData.deferred));
  const retried = Math.max(0, toNumber(safeData.retried));
  const skippedQuietHours = Math.max(0, toNumber(safeData.skippedQuietHours));
  const failureCodeBreakdown =
    safeData.failureCodeBreakdown && typeof safeData.failureCodeBreakdown === 'object'
      ? safeData.failureCodeBreakdown
      : {};
  const topFailureCode = safeData.topFailureCode || null;

  const denominator = recipientCount > 0 ? recipientCount : 1;
  const suppressionRate = suppressed / denominator;
  const deferredRate = deferred / denominator;
  const retryRate = retried / denominator;
  const quietSkipRate = skippedQuietHours / denominator;

  const healthScoreRaw = 100 - (suppressionRate * 40 + deferredRate * 25 + retryRate * 20 + quietSkipRate * 15) * 100;
  const healthScore = Math.max(0, Math.min(100, Math.round(healthScoreRaw)));

  const failureRows = Object.entries(failureCodeBreakdown)
    .map(([code, count]) => ({
      code: String(code || '').trim(),
      count: Math.max(0, toNumber(count))
    }))
    .filter((row) => row.code)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="reliability-insights">
      <div className="reliability-insights__header">
        <h3>Reliability Insights</h3>
        <div className={`reliability-insights__score ${healthScore >= 85 ? 'healthy' : healthScore >= 65 ? 'moderate' : 'critical'}`}>
          <ShieldCheck size={15} />
          <span>{healthScore} health</span>
        </div>
      </div>

      <div className="reliability-insights__metrics">
        <div className="reliability-insights__metric">
          <span>Suppression Rate</span>
          <strong>{formatPercent(suppressionRate)}</strong>
        </div>
        <div className="reliability-insights__metric">
          <span>Deferred Rate</span>
          <strong>{formatPercent(deferredRate)}</strong>
        </div>
        <div className="reliability-insights__metric">
          <span>Retry Rate</span>
          <strong>{formatPercent(retryRate)}</strong>
        </div>
        <div className="reliability-insights__metric">
          <span>Quiet-Hour Skip Rate</span>
          <strong>{formatPercent(quietSkipRate)}</strong>
        </div>
      </div>

      <div className="reliability-insights__failure">
        <div className="reliability-insights__failure-head">
          <AlertTriangle size={15} />
          <span>
            Top failure code:{' '}
            <strong>{topFailureCode?.code || 'None'}</strong>
          </span>
        </div>

        {failureRows.length > 0 ? (
          <div className="reliability-insights__failure-list">
            {failureRows.map((row) => (
              <div key={row.code} className="reliability-insights__failure-row">
                <span>{row.code}</span>
                <strong>{row.count.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="reliability-insights__empty">No delivery error codes in selected range.</p>
        )}
      </div>
    </div>
  );
};

export default ReliabilityInsights;
