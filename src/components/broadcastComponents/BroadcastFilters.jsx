import React from 'react';
import { Clock } from 'lucide-react';
import './BroadcastFilters.css';

const BroadcastFilters = ({
  formatLastUpdated
}) => {
  return (
    <div className="broadcast-header">
      <div className="broadcast-title">
        <h3>Broadcast list</h3>
      </div>

      <div className="last-updated">
        <Clock size={14} />
        {formatLastUpdated()}
      </div>
    </div>
  );
};

export default BroadcastFilters;
