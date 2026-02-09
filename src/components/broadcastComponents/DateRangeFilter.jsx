import React from 'react';
import { Calendar, Download } from 'lucide-react';
import './DateRangeFilter.css';

const DateRangeFilter = ({
  startDate,
  endDate,
  selectedPeriod,
  onStartDateChange,
  onEndDateChange,
  onPeriodChange,
  onApplyFilter,
  onExportCampaigns
}) => {
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (date) => {
    if (!date) return 'dd-mm-yyyy';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="date-range-filter">
      <div className="date-range-header">
        <h4>Date range filter</h4>
      </div>
      <div className="date-range-controls">
        <div className="date-input-group">
          <label>Date picker from</label>
          <div className="date-input-wrapper">
            <input
              type="date"
              value={formatDateForInput(startDate)}
              onChange={onStartDateChange}
              className="date-input"
            />
            <Calendar size={16} className="date-icon" />
            {!startDate && <span className="date-placeholder">{formatDateForDisplay()}</span>}
          </div>
        </div>
        <div className="date-input-group">
          <label>Date picker to</label>
          <div className="date-input-wrapper">
            <input
              type="date"
              value={formatDateForInput(endDate)}
              onChange={onEndDateChange}
              className="date-input"
            />
            <Calendar size={16} className="date-icon" />
            {!endDate && <span className="date-placeholder">{formatDateForDisplay()}</span>}
          </div>
        </div>
        <div className="period-select-group">
          <label>Period</label>
          <select
            value={selectedPeriod}
            onChange={onPeriodChange}
            className="period-select"
          >
            <option value="">Select period</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 days</option>
            <option value="last30days">Last 30 days</option>
            <option value="last3months">Last 3 months</option>
            <option value="last6months">Last 6 months</option>
            <option value="lastyear">Last year</option>
          </select>
        </div>
        <div className="filter-actions">
          <button className="apply-btn" onClick={onApplyFilter}>
            Apply now
          </button>
          <button className="export-btn" onClick={onExportCampaigns}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateRangeFilter;
