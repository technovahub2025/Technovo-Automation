import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, ArrowUp, ArrowDown, Play, AlertCircle } from 'lucide-react';

const RoutingRules = () => {
  const [rules, setRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoutingRules();
  }, []);

  const fetchRoutingRules = async () => {
    try {
      // Mock data - replace with actual API call
      const mockRules = [
        {
          id: 1,
          name: 'VIP Customers',
          priority: 10,
          enabled: true,
          conditions: [
            { field: 'user.vip', operator: 'equals', value: true }
          ],
          actions: ['priority_queue', 'route_to_ai'],
          description: 'Route VIP customers to priority queue with AI assistant'
        },
        {
          id: 2,
          name: 'Business Hours',
          priority: 5,
          enabled: true,
          conditions: [
            { field: 'time', operator: 'in_hours', value: { start: 9, end: 17 } }
          ],
          actions: ['ivr_main'],
          description: 'During business hours, route to main IVR menu'
        },
        {
          id: 3,
          name: 'After Hours',
          priority: 5,
          enabled: true,
          conditions: [
            { field: 'time', operator: 'out_of_hours', value: { start: 9, end: 17 } }
          ],
          actions: ['voicemail', 'callback_option'],
          description: 'After business hours, offer voicemail and callback'
        },
        {
          id: 4,
          name: 'Support Numbers',
          priority: 3,
          enabled: false,
          conditions: [
            { field: 'phone_number', operator: 'contains', value: '1800' }
          ],
          actions: ['route_to_tech'],
          description: 'Route support numbers directly to technical support'
        }
      ];

      setRules(mockRules.sort((a, b) => b.priority - a.priority));
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch routing rules:', error);
      setLoading(false);
    }
  };

  const saveRoutingRule = async (rule) => {
    try {
      setSaving(true);
      
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (isAddingRule) {
        setRules(prev => [...prev, { ...rule, id: Date.now() }].sort((a, b) => b.priority - a.priority));
      } else {
        setRules(prev => prev.map(r => r.id === rule.id ? rule : r).sort((a, b) => b.priority - a.priority));
      }

      setEditingRule(null);
      setIsAddingRule(false);
    } catch (error) {
      console.error('Failed to save routing rule:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteRoutingRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this routing rule?')) {
      return;
    }

    try {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setRules(prev => prev.filter(rule => rule.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete routing rule:', error);
    }
  };

  const toggleRule = async (ruleId) => {
    try {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      ));
    } catch (error) {
      console.error('Failed to toggle routing rule:', error);
    }
  };

  const moveRule = async (ruleId, direction) => {
    const ruleIndex = rules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) return;

    let newIndex;
    if (direction === 'up' && ruleIndex > 0) {
      newIndex = ruleIndex - 1;
    } else if (direction === 'down' && ruleIndex < rules.length - 1) {
      newIndex = ruleIndex + 1;
    } else {
      return;
    }

    const newRules = [...rules];
    const [movedRule] = newRules.splice(ruleIndex, 1);
    newRules.splice(newIndex, 0, movedRule);

    // Update priorities based on new order
    const updatedRules = newRules.map((rule, index) => ({
      ...rule,
      priority: newRules.length - index
    }));

    setRules(updatedRules);
  };

  const testRoutingRule = async (ruleId) => {
    try {
      // Mock API call - replace with actual implementation
      alert(`Test initiated for routing rule. Check logs for results.`);
    } catch (error) {
      console.error('Failed to test routing rule:', error);
      alert('Failed to test routing rule');
    }
  };

  const createNewRule = () => {
    const newRule = {
      name: '',
      priority: 1,
      enabled: true,
      conditions: [
        { field: 'phone_number', operator: 'contains', value: '' }
      ],
      actions: ['route_to_ai'],
      description: ''
    };

    setEditingRule(newRule);
    setIsAddingRule(true);
  };

  const renderRuleEditor = () => {
    if (!editingRule) return null;

    return (
      <div className="routing-editor">
        <div className="editor-header">
          <h3>{isAddingRule ? 'Create Routing Rule' : 'Edit Routing Rule'}</h3>
          <div className="editor-actions">
            <button
              className="btn btn-primary"
              onClick={() => saveRoutingRule(editingRule)}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditingRule(null);
                setIsAddingRule(false);
              }}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>

        <div className="editor-content">
          <div className="form-row">
            <div className="form-group">
              <label>Rule Name</label>
              <input
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter rule name"
              />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <input
                type="number"
                value={editingRule.priority}
                onChange={(e) => setEditingRule(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={editingRule.description}
              onChange={(e) => setEditingRule(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this rule does"
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={editingRule.enabled}
                onChange={(e) => setEditingRule(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable this rule
            </label>
          </div>

          <div className="conditions-section">
            <h4>Conditions</h4>
            {editingRule.conditions.map((condition, index) => (
              <div key={index} className="condition-row">
                <select
                  value={condition.field}
                  onChange={(e) => {
                    const newConditions = [...editingRule.conditions];
                    newConditions[index].field = e.target.value;
                    setEditingRule(prev => ({ ...prev, conditions: newConditions }));
                  }}
                >
                  <option value="phone_number">Phone Number</option>
                  <option value="user.vip">VIP Status</option>
                  <option value="time">Time of Day</option>
                  <option value="day_of_week">Day of Week</option>
                </select>

                <select
                  value={condition.operator}
                  onChange={(e) => {
                    const newConditions = [...editingRule.conditions];
                    newConditions[index].operator = e.target.value;
                    setEditingRule(prev => ({ ...prev, conditions: newConditions }));
                  }}
                >
                  <option value="equals">Equals</option>
                  <option value="contains">Contains</option>
                  <option value="starts_with">Starts With</option>
                  <option value="in_hours">In Hours</option>
                  <option value="out_of_hours">Out of Hours</option>
                </select>

                <input
                  type="text"
                  value={typeof condition.value === 'object' ? JSON.stringify(condition.value) : condition.value}
                  onChange={(e) => {
                    let value;
                    try {
                      value = JSON.parse(e.target.value);
                    } catch {
                      value = e.target.value;
                    }
                    const newConditions = [...editingRule.conditions];
                    newConditions[index].value = value;
                    setEditingRule(prev => ({ ...prev, conditions: newConditions }));
                  }}
                  placeholder="Value"
                />

                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    const newConditions = editingRule.conditions.filter((_, i) => i !== index);
                    setEditingRule(prev => ({ ...prev, conditions: newConditions }));
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setEditingRule(prev => ({
                ...prev,
                conditions: [...prev.conditions, { field: 'phone_number', operator: 'contains', value: '' }]
              }))}
            >
              <Plus size={14} />
              Add Condition
            </button>
          </div>

          <div className="actions-section">
            <h4>Actions</h4>
            <div className="action-list">
              {['ivr_main', 'route_to_ai', 'priority_queue', 'voicemail', 'callback_option', 'route_to_sales', 'route_to_tech', 'route_to_billing'].map(action => (
                <label key={action} className="action-item">
                  <input
                    type="checkbox"
                    checked={editingRule.actions.includes(action)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditingRule(prev => ({ ...prev, actions: [...prev.actions, action] }));
                      } else {
                        setEditingRule(prev => ({ ...prev, actions: prev.actions.filter(a => a !== action) }));
                      }
                    }}
                  />
                  {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRulesList = () => (
    <div className="routing-rules">
      <div className="rules-header">
        <h3>Routing Rules</h3>
        <button className="btn btn-primary" onClick={createNewRule}>
          <Plus size={16} />
          Create Rule
        </button>
      </div>

      <div className="rules-list">
        {rules.map((rule, index) => (
          <div key={rule.id} className={`rule-card ${!rule.enabled ? 'disabled' : ''}`}>
            <div className="rule-header">
              <div className="rule-info">
                <div className="rule-title">
                  <h4>{rule.name}</h4>
                  <span className="priority-badge">Priority: {rule.priority}</span>
                </div>
                <p className="rule-description">{rule.description}</p>
              </div>
              <div className="rule-actions">
                <div className="rule-controls">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => moveRule(rule.id, 'up')}
                    disabled={index === 0}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => moveRule(rule.id, 'down')}
                    disabled={index === rules.length - 1}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <div className="rule-toggle">
                  <button
                    className={`btn btn-sm ${rule.enabled ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => toggleRule(rule.id)}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="rule-management">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => testRoutingRule(rule.id)}
                    title="Test rule"
                  >
                    <Play size={14} />
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setEditingRule(rule)}
                    title="Edit rule"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => deleteRoutingRule(rule.id)}
                    title="Delete rule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="rule-details">
              <div className="conditions">
                <strong>Conditions:</strong>
                <ul>
                  {rule.conditions.map((condition, index) => (
                    <li key={index}>
                      {condition.field} {condition.operator} {typeof condition.value === 'object' ? JSON.stringify(condition.value) : condition.value}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="actions">
                <strong>Actions:</strong>
                <div className="action-tags">
                  {rule.actions.map((action, index) => (
                    <span key={index} className="action-tag">
                      {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && !loading && (
        <div className="empty-state">
          <Settings size={48} />
          <h3>No Routing Rules</h3>
          <p>Create routing rules to control how calls are processed</p>
          <button className="btn btn-primary" onClick={createNewRule}>
            <Plus size={16} />
            Create Rule
          </button>
        </div>
      )}
    </div>
  );

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
      {editingRule ? renderRuleEditor() : renderRulesList()}
    </div>
  );
};

export default RoutingRules;
