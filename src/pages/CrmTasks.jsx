import React, { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, CheckCircle2 } from "lucide-react";
import { crmService } from "../services/crmService";
import "./CrmWorkspace.css";

const TASK_STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" }
];

const TASK_PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" }
];

const toDateTimeInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

const CrmTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [form, setForm] = useState({
    contactId: "",
    title: "",
    description: "",
    dueAt: "",
    priority: "medium"
  });

  const loadData = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const taskParams = { limit: 200 };
      if (statusFilter !== "all") taskParams.status = statusFilter;
      if (priorityFilter !== "all") taskParams.priority = priorityFilter;

      const [tasksResult, contactsResult] = await Promise.all([
        crmService.getTasks(taskParams),
        crmService.getContacts({ limit: 300 })
      ]);

      if (tasksResult?.success === false) {
        throw new Error(tasksResult?.error || "Failed to fetch tasks");
      }
      if (contactsResult?.success === false) {
        throw new Error(contactsResult?.error || "Failed to fetch contacts");
      }

      const nextTasks = Array.isArray(tasksResult?.data) ? tasksResult.data : [];
      const nextContacts = Array.isArray(contactsResult?.data) ? contactsResult.data : [];

      setTasks(nextTasks);
      setContacts(nextContacts);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load CRM tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData({ silent: true });
  }, [statusFilter, priorityFilter]);

  const contactOptions = useMemo(
    () =>
      contacts.map((contact) => ({
        id: getEntityId(contact),
        label: `${contact?.name || "Unknown"} (${contact?.phone || "-"})`
      })),
    [contacts]
  );

  const handleCreateTask = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError("");

      if (!form.contactId) throw new Error("Select a contact");
      if (!String(form.title || "").trim()) throw new Error("Task title is required");

      const payload = {
        contactId: form.contactId,
        title: String(form.title || "").trim(),
        description: String(form.description || "").trim(),
        priority: form.priority || "medium"
      };
      if (form.dueAt) {
        const parsed = new Date(form.dueAt);
        if (!Number.isNaN(parsed.getTime())) payload.dueAt = parsed.toISOString();
      }

      const result = await crmService.createTask(payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to create task");
      }

      setForm({
        contactId: "",
        title: "",
        description: "",
        dueAt: "",
        priority: "medium"
      });
      await loadData({ silent: true });
    } catch (submitError) {
      setError(submitError?.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskStatusChange = async (task, nextStatus) => {
    const taskId = getEntityId(task);
    if (!taskId) return;

    const previousTasks = tasks;
    setTasks((prev) =>
      prev.map((item) => (getEntityId(item) === taskId ? { ...item, status: nextStatus } : item))
    );

    const result = await crmService.updateTask(taskId, { status: nextStatus });
    if (result?.success === false) {
      setTasks(previousTasks);
      setError(result?.error || "Failed to update task");
      return;
    }
  };

  return (
    <div className="crm-workspace">
      <div className="crm-workspace-header">
        <div>
          <h1>CRM Tasks</h1>
          <p>Create and track follow-ups for your leads.</p>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => loadData({ silent: true })}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <form className="crm-create-task" onSubmit={handleCreateTask}>
        <h3>
          <Plus size={16} />
          Create Task
        </h3>
        <div className="crm-create-task-grid">
          <select
            className="crm-select"
            value={form.contactId}
            onChange={(event) => setForm((prev) => ({ ...prev, contactId: event.target.value }))}
          >
            <option value="">Select Contact</option>
            {contactOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="crm-input"
            placeholder="Task title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <select
            className="crm-select"
            value={form.priority}
            onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.key} value={priority.key}>
                {priority.label}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            className="crm-input"
            value={form.dueAt}
            onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
          />
        </div>
        <textarea
          className="crm-textarea"
          placeholder="Task description (optional)"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          rows={3}
        />
        <button type="submit" className="crm-btn crm-btn-primary" disabled={submitting}>
          {submitting ? "Creating..." : "Create Task"}
        </button>
      </form>

      <div className="crm-toolbar">
        <select
          className="crm-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status.key} value={status.key}>
              {status.label}
            </option>
          ))}
        </select>
        <select
          className="crm-select"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
        >
          <option value="all">All Priorities</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority.key} value={priority.key}>
              {priority.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {loading && <div className="crm-loading">Loading CRM tasks...</div>}

      {!loading && (
        <div className="crm-task-table-wrap">
          <table className="crm-task-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Contact</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const taskId = getEntityId(task);
                const contact = task?.contactId || {};
                return (
                  <tr key={taskId || task.title}>
                    <td>
                      <strong>{task?.title || "Untitled"}</strong>
                      <p>{task?.description || "-"}</p>
                    </td>
                    <td>
                      <strong>{contact?.name || "-"}</strong>
                      <span>{contact?.phone || "-"}</span>
                    </td>
                    <td>
                      <span className={`crm-priority-badge priority-${String(task?.priority || "medium").toLowerCase()}`}>
                        {String(task?.priority || "medium")}
                      </span>
                    </td>
                    <td>{formatDateTime(task?.dueAt)}</td>
                    <td>
                      <div className="crm-task-status-cell">
                        <select
                          className="crm-select"
                          value={String(task?.status || "pending")}
                          onChange={(event) => handleTaskStatusChange(task, event.target.value)}
                        >
                          {TASK_STATUSES.map((status) => (
                            <option key={`${taskId}-${status.key}`} value={status.key}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        {String(task?.status || "").toLowerCase() === "completed" && (
                          <CheckCircle2 size={16} className="crm-completed-icon" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="crm-empty-row">
                    No tasks found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CrmTasks;
