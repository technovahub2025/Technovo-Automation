import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Save, X, ArrowUp, ArrowDown, Play, AlertCircle } from 'lucide-react';
import './RoutingRules.css';

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
          name: 'High Value Customers',
          priority: 1,
          condition: 'customer_value > 10000',
          action: 'transfer_to_premium_support',
          enabled: true
        },
        {
          id: 2,
          name: 'Emergency Calls',
          priority: 2,
          condition: 'caller_type == "emergency"',
          action: 'transfer_to_emergency_queue',
          enabled: true
        },
        {
          id: 3,
          name: 'After Hours',
          priority: 3,
          condition: 'current_time > 18:00 OR current_time < 09:00',
          action: 'transfer_to_voicemail',
          enabled: true
        }
      ];
      
      setTimeout(() => {
        setRules(mockRules);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to fetch routing rules:', error);
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    const newRule = {
      id: Date.now(),
      name: '',
      priority: rules.length + 1,
      condition: '',
      action: '',
      enabled: true
    };
    setEditingRule(newRule);
    setIsAddingRule(true);
  };

  const handleEditRule = (rule) => {
    setEditingRule({ ...rule });
    setIsAddingRule(false);
  };

  const handleSaveRule = async () => {
    if (!editingRule.name || !editingRule.condition || !editingRule.action) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (isAddingRule) {
        setRules([...rules, editingRule]);
      } else {
        setRules(rules.map(rule => 
          rule.id === editingRule.id ? editingRule : rule
        ));
      }
      
      setEditingRule(null);
      setIsAddingRule(false);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setRules(rules.filter(rule => rule.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete rule:', error);
      alert('Failed to delete rule');
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      setRules(rules.map(rule => 
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      ));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleMoveRule = async (ruleId, direction) => {
    const ruleIndex = rules.findIndex(rule => rule.id === ruleId);
    if (
      (direction === 'up' && ruleIndex === 0) ||
      (direction === 'down' && ruleIndex === rules.length - 1)
    ) {
      return;
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newRules = [...rules];
      const targetIndex = direction === 'up' ? ruleIndex - 1 : ruleIndex + 1;
      
      // Swap rules
      [newRules[ruleIndex], newRules[targetIndex]] = [newRules[targetIndex], newRules[ruleIndex]];
      
      // Update priorities
      newRules.forEach((rule, index) => {
        rule.priority = index + 1;
      });
      
      setRules(newRules);
    } catch (error) {
      console.error('Failed to move rule:', error);
    }
  };

  const handleTestRule = async (rule) => {
    try {
      // Simulate testing
      alert(`Testing rule: ${rule.name}\nCondition: ${rule.condition}\nAction: ${rule.action}`);
    } catch (error) {
      console.error('Failed to test rule:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setIsAddingRule(false);
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
              onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) })}
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label>Condition</label>
            <textarea
              value={editingRule.condition}
              onChange={(e) => setEditingRule({ ...editingRule, condition: e.target.value })}
              placeholder="e.g., customer_value > 10000"
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label>Action</label>
            <input
              type="text"
              value={editingRule.action}
              onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value })}
              placeholder="e.g., transfer_to_premium_support"
            />
          </div>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editingRule.enabled}
                onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
              />
              Enable this rule
            </label>
          </div>
          
          <div className="form-actions">
            <button 
              className="btn btn-secondary" 
              onClick={handleCancelEdit}
              disabled={saving}
            >
              <X size={16} />
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSaveRule}
              disabled={saving}
            >
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
          rules.sort((a, b) => a.priority - b.priority).map((rule, index) => (
            <div key={rule.id} className={`rule-item ${!rule.enabled ? 'disabled' : ''}`}>
              <div className="rule-header">
                <div className="rule-info">
                  <span className="rule-priority">#{rule.priority}</span>
                  <h3>{rule.name}</h3>
                </div>
                <div className="rule-actions">
                  <button
                    onClick={() => handleMoveRule(rule.id, 'up')}
                    disabled={index === 0}
                    className="btn btn-icon"
                    title="Move up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMoveRule(rule.id, 'down')}
                    disabled={index === rules.length - 1}
                    className="btn btn-icon"
                    title="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    onClick={() => handleTestRule(rule)}
                    className="btn btn-secondary"
                    title="Test rule"
                  >
                    <Play size={16} />
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
                  <strong>Action:</strong> {rule.action}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RoutingRules;
