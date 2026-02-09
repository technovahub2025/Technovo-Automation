import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, Save, X, Play, Settings } from 'lucide-react';
import { apiService } from '../services/api';

const IVRConfig = () => {
  const [ivrMenus, setIvrMenus] = useState({});
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [editingMenu, setEditingMenu] = useState(null);
  const [isAddingMenu, setIsAddingMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIVRConfigs();
  }, []);

  const fetchIVRConfigs = async () => {
    try {
      const response = await apiService.getIVRConfigs();
      setIvrMenus(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch IVR configs:', error);
      setLoading(false);
    }
  };

  const saveIVRConfig = async (menuName, config) => {
    try {
      setSaving(true);
      const response = await apiService.updateIVRConfig(menuName, config);
      
      if (response.data) {
        setIvrMenus(prev => ({
          ...prev,
          [menuName]: response.data.menu
        }));
        setEditingMenu(null);
        setIsAddingMenu(false);
      }
    } catch (error) {
      console.error('Failed to save IVR config:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteIVRMenu = async (menuName) => {
    if (!confirm(`Are you sure you want to delete the "${menuName}" menu?`)) {
      return;
    }

    try {
      await apiService.deleteIVRConfig(menuName);
      
      setIvrMenus(prev => {
        const newMenus = { ...prev };
        delete newMenus[menuName];
        return newMenus;
      });
      
      if (selectedMenu === menuName) {
        setSelectedMenu(null);
      }
    } catch (error) {
      console.error('Failed to delete IVR menu:', error);
    }
  };

  const testIVRMenu = async (menuName) => {
    try {
      await apiService.testIVRMenu(menuName);
      alert('IVR menu test initiated. Check your phone for the test call.');
    } catch (error) {
      console.error('Failed to test IVR menu:', error);
      alert('Failed to initiate IVR test');
    }
  };

  const createNewMenu = () => {
    const newMenu = {
      greeting: 'Welcome to our service. Please choose from the following options:',
      menu: [
        {
          key: '1',
          text: 'For support, press 1',
          action: 'route_to_ai',
          next: null
        },
        {
          key: '2',
          text: 'To speak with an agent, press 2',
          action: 'queue_for_agent',
          queue: 'general'
        }
      ],
      timeout: 10,
      maxAttempts: 3,
      invalidInputMessage: 'Invalid selection. Please try again.'
    };

    setEditingMenu({ name: 'new_menu', config: newMenu });
    setIsAddingMenu(true);
  };

  const renderMenuEditor = () => {
    if (!editingMenu) return null;

    const { name, config } = editingMenu;
    const isEditing = !isAddingMenu;

    return (
      <div className="ivr-editor">
        <div className="editor-header">
          <h3>{isEditing ? `Edit Menu: ${name}` : 'Create New Menu'}</h3>
          <div className="editor-actions">
            <button
              className="btn btn-primary"
              onClick={() => saveIVRConfig(name, config)}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditingMenu(null);
                setIsAddingMenu(false);
              }}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>

        <div className="editor-content">
          <div className="form-group">
            <label>Menu Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setEditingMenu(prev => ({ ...prev, name: e.target.value }))}
              disabled={isEditing}
              placeholder="Enter menu name"
            />
          </div>

          <div className="form-group">
            <label>Greeting Message</label>
            <textarea
              value={config.greeting}
              onChange={(e) => setEditingMenu(prev => ({
                ...prev,
                config: { ...prev.config, greeting: e.target.value }
              }))}
              placeholder="Enter greeting message"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Timeout (seconds)</label>
              <input
                type="number"
                value={config.timeout}
                onChange={(e) => setEditingMenu(prev => ({
                  ...prev,
                  config: { ...prev.config, timeout: parseInt(e.target.value) }
                }))}
                min="5"
                max="30"
              />
            </div>
            <div className="form-group">
              <label>Max Attempts</label>
              <input
                type="number"
                value={config.maxAttempts}
                onChange={(e) => setEditingMenu(prev => ({
                  ...prev,
                  config: { ...prev.config, maxAttempts: parseInt(e.target.value) }
                }))}
                min="1"
                max="5"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Invalid Input Message</label>
            <input
              type="text"
              value={config.invalidInputMessage}
              onChange={(e) => setEditingMenu(prev => ({
                ...prev,
                config: { ...prev.config, invalidInputMessage: e.target.value }
              }))}
              placeholder="Message for invalid input"
            />
          </div>

          <div className="menu-options">
            <div className="options-header">
              <h4>Menu Options</h4>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setEditingMenu(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    menu: [...prev.config.menu, {
                      key: '',
                      text: '',
                      action: 'route_to_ai',
                      next: null
                    }]
                  }
                }))}
              >
                <Plus size={14} />
                Add Option
              </button>
            </div>

            {config.menu.map((option, index) => (
              <div key={index} className="menu-option">
                <div className="option-row">
                  <div className="form-group">
                    <label>Key</label>
                    <input
                      type="text"
                      value={option.key}
                      onChange={(e) => {
                        const newMenu = [...config.menu];
                        newMenu[index].key = e.target.value;
                        setEditingMenu(prev => ({
                          ...prev,
                          config: { ...prev.config, menu: newMenu }
                        }));
                      }}
                      placeholder="1, 2, 3, etc."
                      maxLength={1}
                    />
                  </div>
                  <div className="form-group">
                    <label>Text</label>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => {
                        const newMenu = [...config.menu];
                        newMenu[index].text = e.target.value;
                        setEditingMenu(prev => ({
                          ...prev,
                          config: { ...prev.config, menu: newMenu }
                        }));
                      }}
                      placeholder="Option text"
                    />
                  </div>
                  <div className="form-group">
                    <label>Action</label>
                    <select
                      value={option.action}
                      onChange={(e) => {
                        const newMenu = [...config.menu];
                        newMenu[index].action = e.target.value;
                        setEditingMenu(prev => ({
                          ...prev,
                          config: { ...prev.config, menu: newMenu }
                        }));
                      }}
                    >
                      <option value="route_to_ai">Route to AI</option>
                      <option value="queue_for_agent">Queue for Agent</option>
                      <option value="route_to_sales">Route to Sales</option>
                      <option value="route_to_tech">Route to Tech</option>
                      <option value="route_to_billing">Route to Billing</option>
                      <option value="repeat">Repeat Menu</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      const newMenu = config.menu.filter((_, i) => i !== index);
                      setEditingMenu(prev => ({
                        ...prev,
                        config: { ...prev.config, menu: newMenu }
                      }));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMenuList = () => (
    <div className="ivr-menu-list">
      <div className="menu-list-header">
        <h3>IVR Menus</h3>
        <button className="btn btn-primary" onClick={createNewMenu}>
          <Plus size={16} />
          Create Menu
        </button>
      </div>

      <div className="menu-grid">
        {Object.entries(ivrMenus).map(([name, menu]) => (
          <div key={name} className="menu-card">
            <div className="menu-card-header">
              <div className="menu-title">
                <MessageSquare size={20} />
                <h4>{name}</h4>
              </div>
              <div className="menu-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => testIVRMenu(name)}
                  title="Test menu"
                >
                  <Play size={14} />
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setEditingMenu({ name, config: menu })}
                  title="Edit menu"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => deleteIVRMenu(name)}
                  title="Delete menu"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="menu-preview">
              <p><strong>Greeting:</strong> {menu.greeting}</p>
              <div className="menu-options-preview">
                <strong>Options:</strong>
                <ul>
                  {menu.menu.map((option, index) => (
                    <li key={index}>
                      Press {option.key}: {option.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="menu-settings">
                <span>Timeout: {menu.timeout}s</span>
                <span>Max attempts: {menu.maxAttempts}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(ivrMenus).length === 0 && !loading && (
        <div className="empty-state">
          <MessageSquare size={48} />
          <h3>No IVR Menus</h3>
          <p>Create your first IVR menu to get started</p>
          <button className="btn btn-primary" onClick={createNewMenu}>
            <Plus size={16} />
            Create Menu
          </button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="ivr-config loading">
        <div className="loading-spinner"></div>
        <p>Loading IVR configurations...</p>
      </div>
    );
  }

  return (
    <div className="ivr-config">
      {editingMenu ? renderMenuEditor() : renderMenuList()}
    </div>
  );
};

export default IVRConfig;
