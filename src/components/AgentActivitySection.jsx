import { useEffect, useState } from 'react';
import ActivitySectionTabs from './ActivitySectionTabs';
import useActivityCreators from '../hooks/useActivityCreators';
import { getActivitySections } from '../utils/activitySections';
import apiService from '../services/api';
import { resolveApiBaseUrl } from '../services/apiBaseUrl';
import resolveAdminApiUrl from '../services/adminApiUrl';
import './AgentActivitySection.css';

export default function AgentActivitySection({ path, children }) {
  const sections = getActivitySections(path);
  const directory = useActivityCreators(Boolean(sections));
  const [tab, setTab] = useState('all');
  const [typeIndex, setTypeIndex] = useState(0);
  const [creator, setCreator] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ data: [], pagination: { total: 0, pages: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selected = sections?.[typeIndex];

  useEffect(() => {
    if (!directory.isAdmin || tab !== 'agent' || !selected) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setResult({ data: [], pagination: { total: 0, pages: 0 } });
    const timer = setTimeout(async () => {
      try {
        const base = selected.service === 'broadcast' ? resolveApiBaseUrl()
          : selected.service === 'admin' ? resolveAdminApiUrl() : '';
        const response = await apiService.get(`${String(base || '').replace(/\/$/, '')}/api/agent-activity/${selected.kind}`, {
          params: { page, createdById: creator || undefined, search }, signal: controller.signal
        });
        if (active) setResult(response.data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Could not load agent activity. Please retry.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [directory.isAdmin, tab, selected, creator, search, page, refresh]);

  if (!sections || !directory.isAdmin) return children;
  const agents = directory.creators.filter((entry) => entry.isAgent);
  return (
    <>
      <ActivitySectionTabs value={tab} onChange={setTab} />
      {tab === 'all' ? children : (
        <section className="agent-activity-panel" aria-label="Agent activity">
          <h2>Agent · {selected.label}</h2>
          <div className="agent-activity-controls">
            {sections.length > 1 && <label>Activity
              <select value={typeIndex} onChange={(event) => { setTypeIndex(Number(event.target.value)); setPage(1); }}>
                {sections.map((entry, index) => <option key={`${entry.service}:${entry.kind}`} value={index}>{entry.label}</option>)}
              </select>
            </label>}
            <label>Created By
              <select value={creator} onChange={(event) => { setCreator(event.target.value); setPage(1); }}>
                <option value="">All agents</option>
                {agents.map((agent) => <option key={agent.value} value={agent.value}>{agent.label}</option>)}
              </select>
            </label>
            <label>Search<input type="search" value={search} placeholder="Search activity" onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
            <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>Refresh</button>
          </div>
          {directory.error && <p role="status">{directory.error}</p>}
          {error ? <p role="alert">{error} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></p>
            : loading ? <p role="status">Loading agent activity…</p>
            : result.data.length === 0 ? <p>No agent activity matches these filters.</p>
            : <div className="agent-activity-table"><table>
              <thead><tr><th>Name</th><th>Created By</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>{result.data.map((record) => <tr key={record.id}>
                <td>{record.name}</td><td>{directory.labelFor(record)}</td><td>{record.status || '—'}</td>
                <td>{record.createdAt && Number.isFinite(Date.parse(record.createdAt)) ? new Date(record.createdAt).toLocaleString() : '—'}</td>
              </tr>)}</tbody>
            </table></div>}
          {!error && !loading && <div className="agent-activity-pagination">
            <span>{result.pagination.total} records</span>
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>Page {page} of {Math.max(1, result.pagination.pages)}</span>
            <button type="button" disabled={page >= result.pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>}
        </section>
      )}
    </>
  );
}
