import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, ArrowUp, ArrowDown, Play, AlertCircle } from 'lucide-react';
import apiService from '../services/api';
import './RoutingRules.css';

const normalizeRules = (responseData) => {
  const raw = responseData?.data || responseData?.rules || responseData || [];
  return Array.isArray(raw) ? raw : [];
};

const normalizeIvrMenus = (responseData) => {
  const raw = responseData?.ivrMenus || responseData?.data || responseData || [];
  return Array.isArray(raw) ? raw : [];
};

const inferIvrPromptFromAction = (action = '') => {
  const text = String(action || '').trim();
  if (!text.startsWith('ivr:')) return '';
  return text.slice(4).trim();
};

const buildRuleDraft = (rule, ivrMenus = []) => {
  const inferredPromptKey = rule?.ivrPromptKey || inferIvrPromptFromAction(rule?.action);
  const linkedMenu = ivrMenus.find((menu) => menu.promptKey === inferredPromptKey || menu._id === rule?.ivrMenuId);
  const actionType = rule?.actionType || (inferredPromptKey ? 'ivr' : 'custom');

  return {
    id: rule?.id || '',
    name: rule?.name || '',
    priority: Number.isFinite(Number(rule?.priority)) ? Number(rule.priority) : 1,
    condition: rule?.condition || '',
    actionType,
    action: rule?.action || (inferredPromptKey ? `ivr:${inferredPromptKey}` : ''),
    ivrMenuId: rule?.ivrMenuId || linkedMenu?._id || '',
    ivrPromptKey: inferredPromptKey || linkedMenu?.promptKey || '',
    enabled: typeof rule?.enabled === 'boolean' ? rule.enabled : true
  };
};

const RoutingRules = () => {
  const [rules, setRules] = useState([]);
  const [ivrMenus, setIvrMenus] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingRuleId, setTestingRuleId] = useState('');
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState(null);

  const hasIvrMenus = useMemo(() => ivrMenus.length > 0, [ivrMenus]);

  const fetchRoutingRules = async () => {
    const response = await apiService.getRoutingRules();
    const nextRules = normalizeRules(response.data).sort((a, b) => (a.priority || 0) - (b.priority || 0));
    setRules(nextRules);
  };

  const fetchIvrMenus = async () => {
    const response = await apiService.getIVRConfigs();
    const menus = normalizeIvrMenus(response.data);
    setIvrMenus(menus);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        setError('');
        await Promise.all([fetchRoutingRules(), fetchIvrMenus()]);
      } catch (err) {
        console.error('Failed to fetch routing rules or IVR menus:', err);
        setError(err.response?.data?.error || err.message || 'Failed to fetch routing rules');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const handleAddRule = () => {
    const firstMenu = ivrMenus[0];
    setEditingRule({
      id: '',
      name: '',
      priority: rules.length + 1,
      condition: '',
      actionType: firstMenu ? 'ivr' : 'custom',
      action: firstMenu ? `ivr:${firstMenu.promptKey}` : '',
      ivrMenuId: firstMenu?._id || '',
      ivrPromptKey: firstMenu?.promptKey || '',
      enabled: true
    });
    setIsAddingRule(true);
    setError('');
  };

  const handleEditRule = (rule) => {
    setEditingRule(buildRuleDraft(rule, ivrMenus));
    setIsAddingRule(false);
    setError('');
  };

  const handleActionTypeChange = (value) => {
    if (!editingRule) return;
    if (value === 'ivr') {
      const firstMenu = ivrMenus[0];
      setEditingRule((prev) => ({
        ...prev,
        actionType: 'ivr',
        ivrMenuId: firstMenu?._id || '',
        ivrPromptKey: firstMenu?.promptKey || '',
        action: firstMenu ? `ivr:${firstMenu.promptKey}` : ''
      }));
      return;
    }

    setEditingRule((prev) => ({
      ...prev,
      actionType: 'custom',
      ivrMenuId: '',
      ivrPromptKey: '',
      action: prev.action?.startsWith('ivr:') ? '' : prev.action
    }));
  };

  const handleIvrMenuChange = (menuId) => {
    const selectedMenu = ivrMenus.find((menu) => menu._id === menuId);
    setEditingRule((prev) => ({
      ...prev,
      ivrMenuId: selectedMenu?._id || '',
      ivrPromptKey: selectedMenu?.promptKey || '',
      action: selectedMenu?.promptKey ? `ivr:${selectedMenu.promptKey}` : prev.action
    }));
  };

  const handleSaveRule = async () => {
    if (!editingRule?.name || !editingRule?.condition) {
      setError('Please fill in all required fields');
      return;
    }

    if (editingRule.actionType === 'ivr' && !editingRule.ivrPromptKey) {
      setError('Please select an IVR menu for this rule');
      return;
    }

    if (editingRule.actionType === 'custom' && !editingRule.action) {
      setError('Action is required for custom rules');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        id: editingRule.id || undefined,
        name: editingRule.name,
        priority: Number.isFinite(Number(editingRule.priority)) ? Number(editingRule.priority) : 1,
        condition: editingRule.condition,
        actionType: editingRule.actionType,
        action:
          editingRule.actionType === 'ivr'
            ? `ivr:${editingRule.ivrPromptKey}`
            : editingRule.action,
        ivrMenuId: editingRule.actionType === 'ivr' ? editingRule.ivrMenuId : '',
        ivrPromptKey: editingRule.actionType === 'ivr' ? editingRule.ivrPromptKey : '',
        enabled: Boolean(editingRule.enabled)
      };

      await apiService.updateRoutingRule(payload);
      setEditingRule(null);
      setIsAddingRule(false);
      await fetchRoutingRules();
    } catch (err) {
      console.error('Failed to save rule:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    setError('');
    try {
      await apiService.deleteRoutingRule(ruleId);
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
    } catch (err) {
      console.error('Failed to delete rule:', err);
      setError(err.response?.data?.error || err.message || 'Failed to delete rule');
    }
  };

  const handleToggleRule = async (ruleId) => {
    setError('');
    try {
      const response = await apiService.toggleRoutingRule(ruleId);
      const updatedRule = response.data?.data;
      if (updatedRule) {
        setRules((prev) => prev.map((rule) => (rule.id === ruleId ? updatedRule : rule)));
        return;
      }
      await fetchRoutingRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
      setError(err.response?.data?.error || err.message || 'Failed to toggle rule');
    }
  };

  const handleMoveRule = async (ruleId, direction) => {
    const orderedRules = [...rules].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const ruleIndex = orderedRules.findIndex((rule) => rule.id === ruleId);
    if ((direction === 'up' && ruleIndex === 0) || (direction === 'down' && ruleIndex === orderedRules.length - 1)) {
      return;
    }

    setSaving(true);
    setError('');
    try {
      const nextRules = [...orderedRules];
      const targetIndex = direction === 'up' ? ruleIndex - 1 : ruleIndex + 1;
      [nextRules[ruleIndex], nextRules[targetIndex]] = [nextRules[targetIndex], nextRules[ruleIndex]];
      const prioritized = nextRules.map((rule, index) => ({ ...rule, priority: index + 1 }));
      await Promise.all(prioritized.map((rule) => apiService.updateRoutingRule(rule)));
      setRules(prioritized);
    } catch (err) {
      console.error('Failed to move rule:', err);
      setError(err.response?.data?.error || err.message || 'Failed to reorder rules');
    } finally {
      setSaving(false);
    }
  };

  const handleTestRule = async (rule) => {
    setTestingRuleId(rule.id);
    setError('');
    try {
      const response = await apiService.testRoutingRule(rule.id);
      const result = response?.data?.result || {};
      setTestResult({
        ruleId: rule.id,
        ruleName: rule.name,
        workflowName: result?.workflow?.displayName || result?.workflow?.promptKey || '',
        optionCount: Number.isFinite(Number(result?.optionCount)) ? Number(result.optionCount) : 0,
        twiml: result?.twiml || ''
      });
    } catch (err) {
      console.error('Failed to test rule:', err);
      setTestResult(null);
      setError(err.response?.data?.error || err.message || 'Failed to test rule');
    } finally {
      setTestingRuleId('');
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setIsAddingRule(false);
    setError('');
  };

  const resolveRuleActionText = (rule) => {
    const actionType = rule.actionType || (inferIvrPromptFromAction(rule.action) ? 'ivr' : 'custom');
    if (actionType !== 'ivr') return rule.action;
    const promptKey = rule.ivrPromptKey || inferIvrPromptFromAction(rule.action);
    const menu = ivrMenus.find((item) => item.promptKey === promptKey || item._id === rule.ivrMenuId);
    return menu ? `IVR: ${menu.displayName || menu.promptKey}` : `IVR: ${promptKey || 'Not linked'}`;
  };

  if (loading) {
    return (
      <div className="routing-rules loading">
        <div className="loading-spinner"></div>
        <p>Loading routing rules...</p>
      </div>
    );
  }

  return (
    <div className="routing-rules">
      <div className="rules-header">
        <h2>Routing Rules Manager</h2>
        <button className="btn btn-primary" onClick={handleAddRule}>
          <Plus size={16} />
          Add New Rule
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {!hasIvrMenus && (
        <p className="error-message">
          No active IVR menus found. Create an IVR first, then link it to routing rules.
        </p>
      )}

      {editingRule && (
        <div className="rule-editor">
          <h3>{isAddingRule ? 'Add New Rule' : 'Edit Rule'}</h3>
          <div className="form-group">
            <label>Rule Name</label>
            <input
              type="text"
              value={editingRule.name}
              onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
              placeholder="Enter rule name"
            />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <input
              type="number"
              value={editingRule.priority}
              onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value, 10) || 1 })}
              min="1"
            />
          </div>

          <div className="form-group">
            <label>Condition</label>
            <textarea
              value={editingRule.condition}
              onChange={(e) => setEditingRule({ ...editingRule, condition: e.target.value })}
              placeholder="e.g., caller_country == 'US'"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Action Type</label>
            <select
              value={editingRule.actionType}
              onChange={(e) => handleActionTypeChange(e.target.value)}
            >
              <option value="ivr">IVR Menu</option>
              <option value="custom">Custom Action</option>
            </select>
          </div>

          {editingRule.actionType === 'ivr' ? (
            <div className="form-group">
              <label>Linked IVR</label>
              <select
                value={editingRule.ivrMenuId}
                onChange={(e) => handleIvrMenuChange(e.target.value)}
                disabled={!hasIvrMenus}
              >
                {!hasIvrMenus && <option value="">No IVR menu available</option>}
                {ivrMenus.map((menu) => (
                  <option key={menu._id} value={menu._id}>
                    {menu.displayName || menu.promptKey}
                  </option>
                ))}
              </select>
              <p className="field-help">Action will be saved as: {editingRule.ivrPromptKey ? `ivr:${editingRule.ivrPromptKey}` : 'ivr:'}</p>
            </div>
          ) : (
            <div className="form-group">
              <label>Action</label>
              <input
                type="text"
                value={editingRule.action}
                onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value })}
                placeholder="e.g., transfer_to_premium_support"
              />
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(editingRule.enabled)}
                onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
              />
              Enable this rule
            </label>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>
              <X size={16} />
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveRule} disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>
      )}

      <div className="rules-list">
        {rules.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={48} />
            <p>No routing rules configured yet</p>
            <p>Click "Add New Rule" to get started</p>
          </div>
        ) : (
          [...rules]
            .sort((a, b) => (a.priority || 0) - (b.priority || 0))
            .map((rule, index, ordered) => {
              const ruleActionType = rule.actionType || (inferIvrPromptFromAction(rule.action) ? 'ivr' : 'custom');
              const isTesting = testingRuleId === rule.id;
              const playDisabled = isTesting || (ruleActionType === 'ivr' && !rule.ivrPromptKey && !inferIvrPromptFromAction(rule.action));

              return (
                <div key={rule.id} className={`rule-item ${!rule.enabled ? 'disabled' : ''}`}>
                  <div className="rule-header">
                    <div className="rule-info">
                      <span className="rule-priority">#{rule.priority}</span>
                      <h3>{rule.name}</h3>
                    </div>
                    <div className="rule-actions">
                      <button
                        onClick={() => handleMoveRule(rule.id, 'up')}
                        disabled={index === 0 || saving}
                        className="btn btn-icon-rule"
                        title="Move up"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => handleMoveRule(rule.id, 'down')}
                        disabled={index === ordered.length - 1 || saving}
                        className="btn btn-icon-rule"
                        title="Move down"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        onClick={() => handleTestRule(rule)}
                        className="btn btn-secondary"
                        title={ruleActionType === 'ivr' ? 'Test linked IVR flow' : 'Run rule test'}
                        disabled={playDisabled}
                      >
                        <Play size={16} />
                        {isTesting ? 'Testing...' : 'Play'}
                      </button>
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className={`btn ${rule.enabled ? 'btn-success' : 'btn-warning'}`}
                        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="btn btn-primary"
                        title="Edit rule"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="btn btn-danger"
                        title="Delete rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="rule-details">
                    <div className="rule-condition">
                      <strong>Condition:</strong> {rule.condition}
                    </div>
                    <div className="rule-action">
                      <strong>Action:</strong> {resolveRuleActionText(rule)}
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>

      {testResult && (
        <div className="rule-test-result">
          <h3>Rule Test Result</h3>
          <p><strong>Rule:</strong> {testResult.ruleName}</p>
          <p><strong>IVR:</strong> {testResult.workflowName || 'Unknown'}</p>
          <p><strong>Menu Options:</strong> {testResult.optionCount}</p>
          <label htmlFor="routing-rule-twiml"><strong>Generated TwiML</strong></label>
          <textarea
            id="routing-rule-twiml"
            value={testResult.twiml}
            readOnly
            rows={8}
          />
        </div>
      )}
    </div>
  );
};

export default RoutingRules;
