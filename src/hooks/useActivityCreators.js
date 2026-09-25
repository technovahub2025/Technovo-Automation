import { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../pages/authcontext';
import apiService from '../services/api';
import { activityCreatorLabel } from '../utils/activityCreator';
export { activityCreatorId } from '../utils/activityCreator';

export default function useActivityCreators(enabled = true) {
  const { user } = useContext(AuthContext);
  const userId = String(user?.id || user?.userId || user?._id || '');
  const isAdmin = ['admin', 'manager'].includes(String(user?.companyRole || user?.role || '').toLowerCase());
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setAgents([]);
    setError('');
    if (isAdmin && enabled) apiService.listWorkspaceAgents().then((response) => {
      if (active) setAgents(response?.data?.data || []);
    }).catch(() => {
      if (active) setError('Agent names could not be loaded. Refresh to try again.');
    });
    return () => { active = false; };
  }, [isAdmin, userId, enabled]);

  const creators = useMemo(() => [
    { value: userId, label: user?.username || user?.name || user?.email || 'Admin', isAgent: false },
    ...agents.map((agent) => ({
      value: String(agent._id || agent.id),
      label: agent.username || agent.name || agent.fullName || agent.email || 'Unknown agent',
      isAgent: true
    }))
  ].filter((creator) => creator.value), [userId, user?.username, user?.name, user?.email, agents]);
  const byId = useMemo(() => new Map(creators.map((creator) => [creator.value, creator])), [creators]);
  const labelFor = (record) => activityCreatorLabel(record, byId);
  return { userId, isAdmin, creators, labelFor, error };
}
