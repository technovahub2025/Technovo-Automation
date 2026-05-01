import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, Search } from 'lucide-react';
import useIVRMenus from '../../../hooks/useIVRMenus';
import apiService from '../../../services/api';
import IVRMenuCard from './IVRMenuCard';
import './IVRMenuConfig.css';

const PAGE_SIZE = 12;
const STATUS_FILTERS = ['all', 'active', 'draft', 'inactive'];
const STATUS_RANK = {
  active: 0,
  draft: 1,
  inactive: 2,
  archived: 3
};

const getMenuStatus = (menu) => String(menu?.status || 'draft').toLowerCase();

const getMenuTimestamp = (menu) => {
  const timestamp = new Date(menu?.updatedAt || menu?.createdAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getMenuName = (menu) =>
  menu?.displayName || menu?.ivrName || menu?.name || menu?.promptKey || 'Untitled IVR';



const IVRMenuConfig = () => {
  const {
    ivrMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    loading,
    setError,
  } = useIVRMenus();

  const [newIvrName, setNewIvrName] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const createInputRef = useRef(null);

  const sortedMenus = useMemo(() => {
    if (!Array.isArray(ivrMenus)) return [];
    return [...ivrMenus].sort((a, b) => {
      const statusDelta = (STATUS_RANK[getMenuStatus(a)] ?? 99) - (STATUS_RANK[getMenuStatus(b)] ?? 99);
      if (statusDelta !== 0) return statusDelta;
      return getMenuTimestamp(b) - getMenuTimestamp(a);
    });
  }, [ivrMenus]);

  const statusCounts = useMemo(() => {
    const counts = { all: sortedMenus.length, active: 0, draft: 0, inactive: 0 };
    sortedMenus.forEach((menu) => {
      const status = getMenuStatus(menu);
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    });
    return counts;
  }, [sortedMenus]);

  const filteredMenus = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return sortedMenus.filter((menu) => {
      const status = getMenuStatus(menu);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      if (!matchesStatus) return false;

      if (!normalizedSearch) return true;

      const searchableText = [
        getMenuName(menu),
        menu?.promptKey,
        menu?.ivrName,
        menu?.name,
        status
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [searchQuery, sortedMenus, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMenus.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const pageEndIndex = Math.min(pageStartIndex + PAGE_SIZE, filteredMenus.length);
  const paginatedMenus = filteredMenus.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);

  const hasMenus = sortedMenus.length > 0;
  const hasFilteredMenus = paginatedMenus.length > 0;

  useEffect(() => {
    if (!createModalOpen) return undefined;

    createInputRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCreateModalOpen(false);
        setNewIvrName('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createModalOpen]);

  const handleCloseCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    setNewIvrName('');
  }, []);

  const handleCreateMenu = useCallback(async () => {
    const trimmedName = newIvrName.trim();
    if (!trimmedName) {
      setError('IVR name is required');
      return;
    }

    try {
      const now = Date.now();

      const menuData = {
        displayName: trimmedName,
        promptKey: `ivr_${trimmedName.replace(/\s+/g, '_').toLowerCase()}_${now}`,
        workflowConfig: {
          nodes: [],
          edges: []
        },
        status: 'draft'
      };

      await createMenu(menuData);
      setNewIvrName('');
      setCreateModalOpen(false);
      setError(null);
    } catch (error) {
      console.error('Error creating IVR:', error);
      setError(`Failed to create IVR: ${error.message}`);
    }
  }, [newIvrName, createMenu, setError]);

  const handleMenuDelete = useCallback(async (menuId) => {
    try {
      await deleteMenu(menuId);
      setError(null);
    } catch (error) {
      console.error('Error deleting menu:', error);
      setError(`Failed to delete IVR: ${error.message}`);
    }
  }, [deleteMenu, setError]);

  const handleWorkflowUpdate = useCallback(async (menuId, workflowData) => {
    try {
      const incomingWorkflow = workflowData?.workflowConfig || workflowData || {};
      const hasWorkflowPayload =
        Array.isArray(incomingWorkflow?.nodes) ||
        Array.isArray(incomingWorkflow?.edges);

      const sanitizedWorkflowData = hasWorkflowPayload
        ? {
            ...incomingWorkflow,
            ...(Array.isArray(incomingWorkflow.nodes)
              ? {
                  nodes: incomingWorkflow.nodes.map(node => ({
                    ...node,
                    data: {
                      ...node.data,
                      text: node.data?.text || '',
                      voice: node.data?.voice || 'en-GB-SoniaNeural',
                      language: node.data?.language || 'en-GB'
                    }
                  }))
                }
              : {})
          }
        : null;

      const updatePayload = {
        ...(sanitizedWorkflowData ? { workflowConfig: sanitizedWorkflowData } : {}),
        ...(workflowData?.status
          ? { status: workflowData.status }
          : (sanitizedWorkflowData ? { status: 'draft' } : {})),
        ...(workflowData?.lastEditedBy ? { lastEditedBy: workflowData.lastEditedBy } : {})
      };

      if (Object.keys(updatePayload).length === 0) {
        return;
      }

      await updateMenu(menuId, updatePayload);
      setError(null);
    } catch (error) {
      console.error('Error updating workflow:', error);
      setError(`Failed to update workflow: ${error.message}`);
    }
  }, [updateMenu, setError]);

  const handleWorkflowTest = useCallback(async (menuId) => {
    try {
      const phoneNumber = prompt('Enter phone number to test the IVR workflow (or leave empty for simulation only):');
      
      console.log('Testing workflow:', menuId, 'Phone:', phoneNumber);
      
      const response = await apiService.testIVRMenu(menuId, phoneNumber || undefined);
      
      console.log('Test result:', response.data);
      
      if (response.data.success) {
        setError(null);
        alert(`Test ${phoneNumber ? 'call initiated' : 'simulation'} completed successfully!`);
      } else {
        setError(`Test failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing workflow:', error);
      setError(`Failed to test workflow: ${error.response?.data?.error || error.message}`);
    }
  }, [setError]);

  const currentFilterLabel = statusFilter === 'all'
    ? 'All'
    : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);


  return (
    <div className="ivr-menu-tab">
      <div className="config-header">
        <h2>IVR Configuration</h2>
      </div>

      <div className="ivr-inline-create">
        <div className="ivr-create-group">
          <button
            type="button"
            className="btn btn-primary ivr-open-create"
            onClick={() => setCreateModalOpen(true)}
            disabled={loading}
          >
            <Plus size={18} />
            Create IVR
          </button>
        </div>

        <div className="ivr-search-box">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search IVRs..."
            aria-label="Search IVR workflows"
          />
        </div>

        <div className="ivr-filter-menu">
          <button
            type="button"
            className={`ivr-filter-button ${filterOpen ? 'active' : ''}`}
            onClick={() => setFilterOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={filterOpen}
          >
            <Filter size={16} />
            <span>Filter: {currentFilterLabel}</span>
            <strong>{statusCounts[statusFilter] || 0}</strong>
            <ChevronDown size={16} />
          </button>

          {filterOpen && (
            <div className="ivr-filter-dropdown" role="menu" aria-label="Filter IVR workflows by status">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="menuitem"
                  className={`ivr-filter-option ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => {
                    setStatusFilter(status);
                    setCurrentPage(1);
                    setFilterOpen(false);
                  }}
                >
                  <span>{status === 'all' ? 'All' : status}</span>
                  <strong>{statusCounts[status] || 0}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {createModalOpen && (
        <div
          className="ivr-create-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseCreateModal();
            }
          }}
        >
          <form
            className="ivr-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ivr-create-modal-title"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateMenu();
            }}
          >
            <div className="ivr-create-modal-header">
              <h3 id="ivr-create-modal-title">Create IVR</h3>
            </div>
            <div className="ivr-create-modal-body">
              <label htmlFor="ivr-create-name">IVR Name</label>
              <input
                id="ivr-create-name"
                ref={createInputRef}
                type="text"
                value={newIvrName}
                onChange={(event) => setNewIvrName(event.target.value)}
                placeholder="Type IVR name..."
                disabled={loading}
              />
            </div>
            <div className="ivr-create-modal-footer">
              <button
                type="button"
                className="ivr-modal-secondary"
                onClick={handleCloseCreateModal}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary ivr-modal-primary"
                disabled={loading || !newIvrName.trim()}
              >
                <Plus size={16} />
                Create
              </button>
            </div>
          </form>
        </div>
      )}

          <div className="menus-list-section">
            <div className="ivr-list-summary">
              <span>
                {filteredMenus.length === 0
                  ? 'No workflows to show'
                  : `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${filteredMenus.length} workflows`}
              </span>
              {statusCounts.active > 0 && <span>Active workflows are pinned first.</span>}
            </div>

            {loading && !hasMenus ? (
              <div className="empty-state">
                <div className="empty-state-content">
                  <h3>Loading IVR Configurations...</h3>
                  <p>Please wait while your workflows are being fetched.</p>
                </div>
              </div>
            ) : !hasMenus ? (
              <div className="empty-state">
                <div className="empty-state-content">
                  <h3>No IVR Configurations Yet</h3>
                  <p>Use Create IVR above to create your first workflow.</p>
                </div>
              </div>
            ) : !hasFilteredMenus ? (
              <div className="empty-state">
                <div className="empty-state-content">
                  <h3>No Matching IVR Configurations</h3>
                  <p>Adjust the search or status filter to find a workflow.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="menus-grid">
                  {paginatedMenus.map((menu, index) => (
                    <IVRMenuCard
                      key={menu._id || menu.promptKey || menu.ivrName || menu.name || `menu-${index}`}
                      menu={menu}
                      onUpdate={handleWorkflowUpdate}
                      onDelete={handleMenuDelete}
                      onTest={handleWorkflowTest}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="ivr-pagination" aria-label="IVR workflow pagination">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={safeCurrentPage === 1}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <span>Page {safeCurrentPage} of {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={safeCurrentPage === totalPages}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
      </div>
    </div>
  );
};



export default IVRMenuConfig;

