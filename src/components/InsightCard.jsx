import React from 'react';

const InsightCard = ({ label, value, accent = 'blue', helper }) => (
  <div className={`insight-card insight-card-${accent}`}>
    <div className="insight-card-label">{label}</div>
    <div className="insight-card-value">{value}</div>
    {helper ? <div className="insight-card-helper">{helper}</div> : null}
  </div>
);

export default InsightCard;

