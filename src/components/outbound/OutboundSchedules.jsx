import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, RefreshCw, Search, ListChecks, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import './OutboundSchedules.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const OutboundSchedules = ({ embedded = false }) => {
  const navigate = useNavigate();

  const [scheduleFilters, setScheduleFilters] = useState({
    search: '',
    status: 'all',
    recurrence: 'all',
    page: 1,
    limit: 10
  });
  const [historyFilters, setHistoryFilters] = useState({
    page: 1,
    limit: 10,
    status: 'all',
    phoneNumber: '',
    startDate: '',
    endDate: ''
  });

  const [schedules, setSchedules] = useState([]);
  const [schedulePagination, setSchedulePagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [history, setHistory] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  const loadSchedules = useCallback(async () => {
    try {
      setLoadingSchedules(true);
      setError('');
      const response = await apiService.getOutboundLocalSchedules(scheduleFilters);
      const payload = response?.data || {};
      setSchedules(payload?.data || []);
      setSchedulePagination(payload?.pagination || { page: 1, totalPages: 1, total: 0, limit: 10 });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load schedules');
    } finally {
      setLoadingSchedules(false);
    }
  }, [scheduleFilters]);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setError('');
      const params = {
        ...historyFilters,
        direction: 'outbound-local'
      };
      if (params.status === 'all') delete params.status;
      if (!params.phoneNumber) delete params.phoneNumber;
      if (!params.startDate) delete params.startDate;
      if (!params.endDate) delete params.endDate;

      const response = await apiService.getCallHistory(params);
      const payload = response?.data || {};
      setHistory(payload?.data || []);
      setHistoryPagination(payload?.pagination || { page: 1, totalPages: 1, total: 0, limit: 10 });
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || 'Failed to load call history');
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilters]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onPauseResume = async (schedule) => {
    try {
      const action = schedule?.status === 'active' ? 'pause' : 'resume';
      await (action === 'pause'
        ? apiService.outboundLocalPauseSchedule(schedule._id)
        : apiService.outboundLocalResumeSchedule(schedule._id));
      await loadSchedules();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update schedule state');
    }
  };

  const scheduleInfo = useMemo(() => {
    const start = (schedulePagination.page - 1) * schedulePagination.limit + 1;
    const end = Math.min(schedulePagination.page * schedulePagination.limit, schedulePagination.total);
    return `${schedulePagination.total === 0 ? 0 : start}-${schedulePagination.total === 0 ? 0 : end} of ${schedulePagination.total}`;
  }, [schedulePagination]);

  const historyInfo = useMemo(() => {
    const start = (historyPagination.page - 1) * historyPagination.limit + 1;
    const end = Math.min(historyPagination.page * historyPagination.limit, historyPagination.total);
    return `${historyPagination.total === 0 ? 0 : start}-${historyPagination.total === 0 ? 0 : end} of ${historyPagination.total}`;
  }, [historyPagination]);

  return (
    <div className={`outbound-schedules-page ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <button className="btn-link schedules-back" onClick={() => navigate('/voice-automation/outbound')}>
          <ArrowLeft size={18} />
          Back to Outbound
        </button>
      )}

      {!embedded && (
        <header className="schedules-header">
          <h1>Outbound Schedules and History</h1>
          <p>Filter scheduled outbound campaigns and view outbound voice call history with pagination.</p>
        </header>
      )}

      {error && <div className="schedules-error">{error}</div>}

      <section className="schedules-card">
        <div className="schedules-card-head">
          <h2><ListChecks size={18} /> Scheduled Campaigns</h2>
          <button className="ghost-btn" type="button" onClick={loadSchedules} disabled={loadingSchedules}>
            <RefreshCw size={16} />
            {loadingSchedules ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="filters-grid">
          <label className="filter-field">
            <span>Search</span>
            <div className="search-wrap">
              <Search size={14} />
              <input
                value={scheduleFilters.search}
                onChange={(e) => setScheduleFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                placeholder="Campaign name or ID"
              />
            </div>
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select value={scheduleFilters.status} onChange={(e) => setScheduleFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Recurrence</span>
            <select value={scheduleFilters.recurrence} onChange={(e) => setScheduleFilters((prev) => ({ ...prev, recurrence: e.target.value, page: 1 }))}>
              <option value="all">All</option>
              <option value="once">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Rows</span>
            <select value={scheduleFilters.limit} onChange={(e) => setScheduleFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Recurrence</th>
                <th>Cron</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-row">No schedules found.</td>
                </tr>
              )}
              {schedules.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong>{item.campaignName}</strong>
                    <div className="muted">{item.campaignId}</div>
                  </td>
                  <td><span className={`status-pill ${item.status}`}>{item.status}</span></td>
                  <td>{item.recurrence}</td>
                  <td><code>{item.cronExpression}</code></td>
                  <td>{formatDateTime(item.updatedAt)}</td>
                  <td>
                    <button className="small-btn" type="button" onClick={() => onPauseResume(item)}>
                      {item.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <span>{scheduleInfo}</span>
          <div className="pager">
            <button
              type="button"
              disabled={schedulePagination.page <= 1 || loadingSchedules}
              onClick={() => setScheduleFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Prev
            </button>
            <span>{schedulePagination.page} / {Math.max(1, schedulePagination.totalPages)}</span>
            <button
              type="button"
              disabled={schedulePagination.page >= schedulePagination.totalPages || loadingSchedules}
              onClick={() => setScheduleFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="schedules-card">
        <div className="schedules-card-head">
          <h2><Clock3 size={18} /> Outbound Voice Call History</h2>
          <button className="ghost-btn" type="button" onClick={loadHistory} disabled={loadingHistory}>
            <RefreshCw size={16} />
            {loadingHistory ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="filters-grid history">
          <label className="filter-field">
            <span>Status</span>
            <select value={historyFilters.status} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))}>
              <option value="all">All</option>
              <option value="initiated">Initiated</option>
              <option value="ringing">Ringing</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="busy">Busy</option>
              <option value="no-answer">No Answer</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Phone</span>
            <input
              value={historyFilters.phoneNumber}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, phoneNumber: e.target.value, page: 1 }))}
              placeholder="+91..."
            />
          </label>
          <label className="filter-field">
            <span>From</span>
            <input
              type="date"
              value={historyFilters.startDate}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, startDate: e.target.value, page: 1 }))}
            />
          </label>
          <label className="filter-field">
            <span>To</span>
            <input
              type="date"
              value={historyFilters.endDate}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, endDate: e.target.value, page: 1 }))}
            />
          </label>
          <label className="filter-field">
            <span>Rows</span>
            <select value={historyFilters.limit} onChange={(e) => setHistoryFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Call SID</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-row">No call history found.</td>
                </tr>
              )}
              {history.map((item) => (
                <tr key={item._id || item.callSid}>
                  <td>{item.callSid || '-'}</td>
                  <td>{item.phoneNumber || '-'}</td>
                  <td><span className={`status-pill ${item.status}`}>{item.status || '-'}</span></td>
                  <td>{Number(item.duration || 0)}s</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <span>{historyInfo}</span>
          <div className="pager">
            <button
              type="button"
              disabled={historyPagination.page <= 1 || loadingHistory}
              onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Prev
            </button>
            <span>{historyPagination.page} / {Math.max(1, historyPagination.totalPages)}</span>
            <button
              type="button"
              disabled={historyPagination.page >= historyPagination.totalPages || loadingHistory}
              onClick={() => setHistoryFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <div className="helper-note">
        <CalendarClock size={14} />
        Schedule jobs are TRAI-compliant in backend (9AM-9PM IST), and this page reflects saved campaign plans.
      </div>
    </div>
  );
};

export default OutboundSchedules;

