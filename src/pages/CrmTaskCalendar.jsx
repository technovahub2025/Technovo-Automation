import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import { crmService } from "../services/crmService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import "./CrmWorkspace.css";

const TASK_CALENDAR_LOADING_TIMEOUT_MS = 8000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

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

const buildYearOptions = (year) => Array.from({ length: 12 }, (_, index) => year - 5 + index);

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
  const [error, setError] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => getMonthStart(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [calendarPickerView, setCalendarPickerView] = useState("day");

  const loadTasks = useCallback(async ({ silent = false } = {}) => {
    const releaseLoadingGuard = startLoadingTimeoutGuard(
      () => {
        if (!silent) setLoading(false);
      },
      TASK_CALENDAR_LOADING_TIMEOUT_MS
    );

    try {
      if (!silent) setLoading(true);
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
  const todayKey = useMemo(() => formatDayKey(new Date()), []);
  const activeDateKey = selectedDateKey || todayKey;
  const selectedDayTasks = tasksByDay.get(activeDateKey) || [];
  const calendarYearOptions = useMemo(
    () => buildYearOptions(monthCursor.getFullYear()),
    [monthCursor]
  );
  const calendarMonthOptions = useMemo(
    () =>
      MONTH_LABELS.map((label, index) => ({
        key: `${monthCursor.getFullYear()}-${index}`,
        label,
        monthIndex: index
      })),
    [monthCursor]
  );
  const calendarHeaderLabel = monthCursor.toLocaleString(undefined, {
    month: "long",
    year: "numeric"
  });
  const selectedDayLabel = activeDateKey ? formatDateTime(`${activeDateKey}T00:00:00`) : "Today";
  const monthTaskTotal = useMemo(
    () =>
      calendarDays.reduce((total, day) => {
        const dayKey = formatDayKey(day);
        return total + (tasksByDay.get(dayKey)?.length || 0);
      }, 0),
    [calendarDays, tasksByDay]
  );
  const monthBusyDays = useMemo(
    () => calendarDays.filter((day) => (tasksByDay.get(formatDayKey(day))?.length || 0) > 0).length,
    [calendarDays, tasksByDay]
  );
  const selectedDayPrioritySummary = useMemo(
    () =>
      selectedDayTasks.reduce(
        (summary, task) => {
          const priority = String(task.priority || "medium").toLowerCase();
          if (priority === "high") summary.high += 1;
          else if (priority === "low") summary.low += 1;
          else summary.medium += 1;
          return summary;
        },
        { high: 0, medium: 0, low: 0 }
      ),
    [selectedDayTasks]
  );

  const crmRealtime = useCrmRealtimeRefresh({
    entities: ["task"],
    onRefresh: () => loadTasks({ silent: true })
  });

  useEffect(() => {
    if (selectedDateKey) return;
    if (tasksByDay.has(todayKey)) {
      setSelectedDateKey(todayKey);
      return;
    }
    const firstKey = Array.from(tasksByDay.keys()).sort()[0] || "";
    setSelectedDateKey(firstKey);
  }, [tasksByDay, selectedDateKey, todayKey]);

  const shiftCalendarCursor = useCallback(
    (direction) => {
      setMonthCursor((prev) => {
        if (calendarPickerView === "year") {
          return new Date(prev.getFullYear() + direction * 12, prev.getMonth(), 1);
        }
        if (calendarPickerView === "month") {
          return new Date(prev.getFullYear() + direction, prev.getMonth(), 1);
        }
        return new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
      });
    },
    [calendarPickerView]
  );

  const handleCalendarHeaderClick = useCallback(() => {
    setCalendarPickerView((current) => {
      if (current === "day") return "year";
      if (current === "year") return "month";
      return "day";
    });
  }, []);

  const handleYearSelect = useCallback((year) => {
    setMonthCursor(new Date(year, 0, 1));
    setCalendarPickerView("month");
  }, []);

  const handleMonthSelect = useCallback((monthIndex) => {
    const nextMonthCursor = new Date(monthCursor.getFullYear(), monthIndex, 1);
    setMonthCursor(nextMonthCursor);
    setCalendarPickerView("day");
    setSelectedDateKey(formatDayKey(nextMonthCursor));
  }, [monthCursor]);

  return (
    <div className="crm-workspace">
      <div className="crm-workspace-header">
        <div>
          <h1>Task Calendar</h1>
          <p>View day-wise scheduled tasks from CRM in one calendar.</p>
        </div>
        <CrmRealtimeStatus status={crmRealtime.connectionStatus} />
      </div>

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {loading && <CrmPageSkeleton variant="calendar" />}

      {!loading && (
        <div className="crm-report-two-column crm-report-two-column--meetings">
          <section className="crm-report-card crm-task-calendar-card">
            <div className="crm-drawer-card-header">
              <div className="crm-task-calendar-header-copy">
                <h3>Calendar</h3>
                <span className="crm-drawer-helper-text">Pick a date to see scheduled tasks.</span>
              </div>
              <div className="crm-inline-actions crm-task-calendar-nav">
                <button
                  type="button"
                  className="crm-icon-btn"
                  onClick={() => shiftCalendarCursor(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="crm-calendar-title-button"
                  onClick={handleCalendarHeaderClick}
                  aria-label={`Change calendar view from ${calendarHeaderLabel}`}
                >
                  <strong className="crm-calendar-title">{calendarHeaderLabel}</strong>
                  <span className="crm-calendar-title-hint">
                    {calendarPickerView === "day"
                      ? "Click to browse years"
                      : calendarPickerView === "year"
                      ? "Select a year"
                      : "Select a month"}
                  </span>
                </button>
                <button
                  type="button"
                  className="crm-icon-btn"
                  onClick={() => shiftCalendarCursor(1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="crm-task-calendar-summary">
              <span className="crm-ops-chip">Total tasks: {tasks.length}</span>
              <span className="crm-ops-chip">This month: {monthTaskTotal}</span>
              <span className="crm-ops-chip">Busy days: {monthBusyDays}</span>
              <span className="crm-ops-chip">Selected: {selectedDateKey === todayKey ? "Today" : selectedDayLabel}</span>
            </div>

            {calendarPickerView === "day" && (
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
                  const isToday = dayKey === todayKey;
                  const dayClassName = [
                    "crm-calendar-day",
                    isCurrentMonth ? "" : "crm-calendar-day--muted",
                    isSelected ? "crm-calendar-day--selected" : "",
                    isToday ? "crm-calendar-day--today" : "",
                    items.length > 0 ? "crm-calendar-day--task-heavy" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      className={dayClassName}
                      onClick={() => setSelectedDateKey(dayKey)}
                    >
                      <span className="crm-calendar-day__date">{day.getDate()}</span>
                      <strong>{items.length > 0 ? items.length : ""}</strong>
                    </button>
                  );
                })}
              </div>
            )}

            {calendarPickerView === "year" && (
              <div className="crm-task-calendar-picker">
                <div className="crm-task-calendar-picker__title">
                  <strong>Select a year</strong>
                  <span>Choose a year to browse its months.</span>
                </div>
                <div className="crm-task-calendar-picker-grid crm-task-calendar-picker-grid--years">
                  {calendarYearOptions.map((year) => {
                    const isSelected = year === monthCursor.getFullYear();
                    return (
                      <button
                        key={year}
                        type="button"
                        className={`crm-task-calendar-picker-btn ${isSelected ? "is-selected" : ""}`}
                        onClick={() => handleYearSelect(year)}
                      >
                        <strong>{year}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {calendarPickerView === "month" && (
              <div className="crm-task-calendar-picker">
                <div className="crm-task-calendar-picker__title">
                  <strong>Select a month</strong>
                  <span>{monthCursor.getFullYear()}</span>
                </div>
                <div className="crm-task-calendar-picker-grid crm-task-calendar-picker-grid--months">
                  {calendarMonthOptions.map((month) => {
                    const isSelected = month.monthIndex === monthCursor.getMonth();
                    return (
                      <button
                        key={month.key}
                        type="button"
                        className={`crm-task-calendar-picker-btn ${isSelected ? "is-selected" : ""}`}
                        onClick={() => handleMonthSelect(month.monthIndex)}
                      >
                        <strong>{month.label}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="crm-report-card crm-task-agenda-card">
            <div className="crm-drawer-card-header crm-task-agenda-header">
              <div className="crm-task-agenda-header-copy">
                <h3>Daily Agenda</h3>
                <span className="crm-drawer-helper-text">{selectedDayLabel}</span>
              </div>
              <div className="crm-task-agenda-stats">
                <span className="crm-ops-chip">Tasks: {selectedDayTasks.length}</span>
                <span className="crm-ops-chip">High: {selectedDayPrioritySummary.high}</span>
                <span className="crm-ops-chip">Medium: {selectedDayPrioritySummary.medium}</span>
                <span className="crm-ops-chip">Low: {selectedDayPrioritySummary.low}</span>
              </div>
            </div>

            {selectedDayTasks.length === 0 ? (
              <div className="crm-empty-state crm-task-agenda-empty">
                <strong>No tasks scheduled for this day.</strong>
                <span>Choose another date or create tasks in CRM Tasks.</span>
              </div>
            ) : (
              <div className="crm-meeting-list crm-task-agenda-list">
                {selectedDayTasks.map((task) => (
                  <article key={task._id} className="crm-meeting-card">
                    <div className="crm-meeting-card__time">
                      <strong>{task.priority || "medium"}</strong>
                      <span>{formatDateTime(task.dueAt || task.reminderAt)}</span>
                    </div>
                    <div className="crm-meeting-card-main crm-task-agenda-main">
                      <div>
                        <h4>{task.title || "Untitled task"}</h4>
                        <p>
                          {task.contactName || "No contact"}
                          {task.contactPhone ? ` | ${task.contactPhone}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="crm-meeting-card-meta crm-task-agenda-meta">
                      <span>Status: {task.status || "pending"}</span>
                      <span>Priority: {task.priority || "medium"}</span>
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

