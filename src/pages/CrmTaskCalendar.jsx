import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import "./CrmWorkspace.css";

const TASK_CALENDAR_LOADING_TIMEOUT_MS = 8000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const safeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const parsed = safeDate(value);
  return parsed ? parsed.toLocaleString() : "-";
};

const formatDayKey = (value) => {
  const parsed = safeDate(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthStart = (value = new Date()) => {
  const parsed = safeDate(value) || new Date();
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
};

const buildCalendarDays = (monthValue) => {
  const monthStart = getMonthStart(monthValue);
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 42 }, () => {
    const current = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    return current;
  });
};

const sanitizeTask = (task = {}) => ({
  _id: String(task?._id || task?.id || "").trim(),
  title: String(task?.title || "").trim(),
  status: String(task?.status || "pending").trim(),
  priority: String(task?.priority || "medium").trim(),
  dueAt: String(task?.dueAt || "").trim(),
  reminderAt: String(task?.reminderAt || "").trim(),
  assignedTo: String(task?.assignedTo || "").trim(),
  contactName: String(task?.contactId?.name || "").trim(),
  contactPhone: String(task?.contactId?.phone || "").trim()
});

const CrmTaskCalendar = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => getMonthStart(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState("");

  const loadTasks = useCallback(async ({ silent = false } = {}) => {
    const releaseLoadingGuard = startLoadingTimeoutGuard(
      () => {
        if (silent) setRefreshing(false);
        else setLoading(false);
      },
      TASK_CALENDAR_LOADING_TIMEOUT_MS
    );

    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const result = await crmService.getTasks({ limit: 400 });
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to load tasks");
      }
      const nextTasks = Array.isArray(result?.data) ? result.data.map(sanitizeTask) : [];
      setTasks(nextTasks);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load tasks");
    } finally {
      releaseLoadingGuard();
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const tasksByDay = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      const key = formatDayKey(task?.dueAt || task?.reminderAt);
      if (!key) return;
      const existing = map.get(key) || [];
      existing.push(task);
      map.set(key, existing);
    });
    for (const value of map.values()) {
      value.sort((a, b) => {
        const left = safeDate(a?.dueAt || a?.reminderAt)?.getTime() || 0;
        const right = safeDate(b?.dueAt || b?.reminderAt)?.getTime() || 0;
        return left - right;
      });
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const activeDateKey = selectedDateKey || formatDayKey(new Date());
  const selectedDayTasks = tasksByDay.get(activeDateKey) || [];

  useEffect(() => {
    if (selectedDateKey && tasksByDay.has(selectedDateKey)) return;
    const todayKey = formatDayKey(new Date());
    if (tasksByDay.has(todayKey)) {
      setSelectedDateKey(todayKey);
      return;
    }
    const firstKey = Array.from(tasksByDay.keys()).sort()[0] || "";
    setSelectedDateKey(firstKey);
  }, [tasksByDay, selectedDateKey]);

  return (
    <div className="crm-workspace">
      <div className="crm-workspace-header">
        <div>
          <h1>Task Calendar</h1>
          <p>View day-wise scheduled tasks from CRM in one calendar.</p>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => loadTasks({ silent: true })}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {loading && <CrmPageSkeleton variant="calendar" />}

      {!loading && (
        <div className="crm-report-two-column crm-report-two-column--meetings">
          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <div>
                <h3>Calendar</h3>
                <span className="crm-drawer-helper-text">Pick a date to see scheduled tasks.</span>
              </div>
              <div className="crm-inline-actions">
                <button
                  type="button"
                  className="crm-icon-btn"
                  onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <strong className="crm-calendar-title">
                  {monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </strong>
                <button
                  type="button"
                  className="crm-icon-btn"
                  onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="crm-calendar-grid">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="crm-calendar-weekday">
                  {label}
                </div>
              ))}
              {calendarDays.map((day) => {
                const dayKey = formatDayKey(day);
                const items = tasksByDay.get(dayKey) || [];
                const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                const isSelected = dayKey === activeDateKey;
                return (
                  <button
                    key={dayKey}
                    type="button"
                    className={[
                      "crm-calendar-day",
                      isCurrentMonth ? "" : "crm-calendar-day--muted",
                      isSelected ? "crm-calendar-day--selected" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedDateKey(dayKey)}
                  >
                    <span>{day.getDate()}</span>
                    <strong>{items.length > 0 ? items.length : ""}</strong>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <div>
                <h3>Daily Agenda</h3>
                <span className="crm-drawer-helper-text">{activeDateKey || "No date selected"}</span>
              </div>
            </div>

            {selectedDayTasks.length === 0 ? (
              <div className="crm-empty-state">
                <strong>No tasks scheduled for this day.</strong>
                <span>Choose another date or create tasks in CRM Tasks.</span>
              </div>
            ) : (
              <div className="crm-meeting-list">
                {selectedDayTasks.map((task) => (
                  <article key={task._id} className="crm-meeting-card">
                    <div className="crm-meeting-card-main">
                      <div>
                        <h4>{task.title || "Untitled task"}</h4>
                        <p>
                          {task.contactName || "No contact"}
                          {task.contactPhone ? ` | ${task.contactPhone}` : ""}
                        </p>
                      </div>
                      <div className="crm-meeting-card-meta">
                        <span>Due: {formatDateTime(task.dueAt || task.reminderAt)}</span>
                        <span>Status: {task.status || "pending"}</span>
                        <span>Priority: {task.priority || "medium"}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="crm-empty-state">
          <CalendarDays size={18} />
          <strong>No scheduled tasks found.</strong>
        </div>
      )}
    </div>
  );
};

export default CrmTaskCalendar;

