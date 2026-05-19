import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Virtuoso } from "react-virtuoso";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ExternalLink,
  Link2,
  Search,
  Trash2,
  Unlink,
  UserRound,
  Video,
  X
} from "lucide-react";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import CrmToast from "../components/crm/CrmToast";
import { crmService } from "../services/crmService";
import { googleCalendarService } from "../services/googleCalendarService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import useCrmRealtimeRefresh from "../hooks/useCrmRealtimeRefresh";
import { resolveApiBaseUrl } from "../services/apiBaseUrl";
import {
  buildGoogleOAuthTrustedOrigins,
  isGoogleOAuthEventOriginTrusted,
  resolveGoogleOAuthEvent
} from "../utils/googleOAuthEvents";
import "./CrmWorkspace.css";

const CRM_MEETINGS_LOADING_TIMEOUT_MS = 8000;
const CALENDAR_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const safeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const parsed = safeDate(value);
  return parsed
    ? parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-";
};

const formatTimeRange = (startValue, endValue) => {
  const start = safeDate(startValue);
  const end = safeDate(endValue);
  if (!start && !end) return "Time not set";
  if (!end) return formatDateTime(start);

  return `${start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  })} - ${end.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
};

const formatDayKey = (value) => {
  const parsed = safeDate(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatInputDateTime = (value) => {
  const parsed = safeDate(value);
  if (!parsed) return "";
  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
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

const getMeetingStartValue = (meeting) => meeting?.start?.dateTime || meeting?.start || meeting?.createdAt;
const getMeetingEndValue = (meeting) => meeting?.end?.dateTime || meeting?.end;

const sanitizeMeeting = (meeting = {}) => ({
  _id: String(meeting?._id || "").trim(),
  summary: String(meeting?.summary || "").trim(),
  description: String(meeting?.description || "").trim(),
  meetingUrl: String(meeting?.meetingUrl || "").trim(),
  eventId: String(meeting?.eventId || "").trim(),
  eventHtmlLink: String(meeting?.eventHtmlLink || "").trim(),
  calendarId: String(meeting?.calendarId || "primary").trim(),
  createdAt: String(meeting?.createdAt || "").trim(),
  start:
    meeting?.start && typeof meeting.start === "object"
      ? {
          dateTime: String(meeting.start.dateTime || "").trim(),
          timeZone: String(meeting.start.timeZone || "").trim()
        }
      : { dateTime: String(meeting?.start || "").trim(), timeZone: "" },
  end:
    meeting?.end && typeof meeting.end === "object"
      ? {
          dateTime: String(meeting.end.dateTime || "").trim(),
          timeZone: String(meeting.end.timeZone || "").trim()
        }
      : { dateTime: String(meeting?.end || "").trim(), timeZone: "" },
  contact: {
    _id: String(meeting?.contact?._id || "").trim(),
    name: String(meeting?.contact?.name || "").trim(),
    phone: String(meeting?.contact?.phone || "").trim(),
    stage: String(meeting?.contact?.stage || "").trim(),
    ownerId: String(meeting?.contact?.ownerId || "").trim(),
    leadScore:
      Number.isFinite(Number(meeting?.contact?.leadScore)) && Number(meeting.contact.leadScore) >= 0
        ? Number(meeting.contact.leadScore)
        : 0
  }
});

const buildEditState = (meeting) => ({
  summary: meeting?.summary || "Meeting",
  description: meeting?.description || "",
  startDateTime: formatInputDateTime(getMeetingStartValue(meeting)),
  endDateTime: formatInputDateTime(getMeetingEndValue(meeting))
});

const closePopupWindow = (popupWindow) => {
  try {
    popupWindow?.close?.();
  } catch {
    // Cross-origin OAuth popups may reject window operations under COOP.
  }
};

const CrmMeetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [meta, setMeta] = useState({ total: 0, upcoming: 0, past: 0 });
  const [googleStatus, setGoogleStatus] = useState(null);
  const [bucket, setBucket] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => getMonthStart(new Date()));
  const [toast, setToast] = useState(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [editForm, setEditForm] = useState(buildEditState(null));
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [deletingMeetingId, setDeletingMeetingId] = useState("");
  const [checkingGoogleStatus, setCheckingGoogleStatus] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const oauthPopupRef = useRef(null);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadMeetings = useCallback(
    async ({ silent = false } = {}) => {
      const releaseLoadingGuard = startLoadingTimeoutGuard(
        () => {
          if (!silent) setLoading(false);
        },
        CRM_MEETINGS_LOADING_TIMEOUT_MS
      );

      try {
        if (!silent) setLoading(true);
        setError("");

        const authStatusResult = await googleCalendarService.getAuthStatus();
        if (authStatusResult?.success !== false) {
          setGoogleStatus(authStatusResult?.data || null);
        }

        if (!authStatusResult?.data?.connected) {
          setMeetings([]);
          setMeta({ total: 0, upcoming: 0, past: 0 });
          return;
        }

        const meetingsResult = await crmService.getMeetings({
          bucket,
          search: deferredSearchQuery.trim(),
          limit: 250
        });

        if (meetingsResult?.success === false) {
          throw new Error(meetingsResult?.error || "Failed to load CRM meetings");
        }

        const nextMeetings = Array.isArray(meetingsResult?.data)
          ? meetingsResult.data.map(sanitizeMeeting)
          : [];
        setMeetings(nextMeetings);
        setMeta(meetingsResult?.meta || { total: nextMeetings.length, upcoming: 0, past: 0 });
      } catch (loadError) {
        setError(loadError?.message || "Failed to load CRM meetings");
      } finally {
        releaseLoadingGuard();
        setLoading(false);
      }
    },
    [bucket, deferredSearchQuery]
  );

  const handleRealtimeRefresh = useCallback(() => {
    loadMeetings({ silent: true });
  }, [loadMeetings]);

  const crmRealtime = useCrmRealtimeRefresh({
    entities: ["meeting", "contact"],
    onRefresh: handleRealtimeRefresh
  });

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        loadMeetings({ silent: initialLoadRef.current });
        initialLoadRef.current = true;
      },
      initialLoadRef.current ? 250 : 0
    );

    return () => window.clearTimeout(timer);
  }, [loadMeetings]);

  const upcomingMeetings = useMemo(
    () =>
      meetings.filter((meeting) => {
        const parsed = safeDate(getMeetingStartValue(meeting));
        return !parsed || parsed >= new Date();
      }),
    [meetings]
  );

  const sortedMeetings = useMemo(
    () =>
      [...meetings].sort((left, right) => {
        const leftTime = safeDate(getMeetingStartValue(left))?.getTime() || 0;
        const rightTime = safeDate(getMeetingStartValue(right))?.getTime() || 0;
        return leftTime - rightTime;
      }),
    [meetings]
  );

  const meetingsByDay = useMemo(() => {
    const map = new Map();
    sortedMeetings.forEach((meeting) => {
      const key = formatDayKey(getMeetingStartValue(meeting));
      if (!key) return;
      const existing = map.get(key) || [];
      existing.push(meeting);
      map.set(key, existing);
    });
    return map;
  }, [sortedMeetings]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const isAllAgendaSelected = selectedDateKey === "all";
  const activeDateKey = selectedDateKey && !isAllAgendaSelected ? selectedDateKey : formatDayKey(new Date());
  const selectedDayMeetings = meetingsByDay.get(activeDateKey) || [];
  const agendaMeetings = isAllAgendaSelected ? sortedMeetings : selectedDayMeetings;
  const selectedDateLabel = isAllAgendaSelected
    ? "All matching meetings"
    : selectedDateKey
    ? formatDateTime(`${selectedDateKey}T00:00:00`)
    : "Default day";
  const busiestDay = useMemo(() => {
    let best = { key: "", count: 0 };
    meetingsByDay.forEach((items, key) => {
      if (items.length > best.count) best = { key, count: items.length };
    });
    return best;
  }, [meetingsByDay]);

  useEffect(() => {
    if (selectedDateKey === "all") return;
    if (selectedDateKey && meetingsByDay.has(selectedDateKey)) return;

    const todayKey = formatDayKey(new Date());
    if (meetingsByDay.has(todayKey)) {
      setSelectedDateKey(todayKey);
      return;
    }

    const firstKey = Array.from(meetingsByDay.keys()).sort()[0] || "";
    setSelectedDateKey(firstKey);
  }, [meetingsByDay, selectedDateKey]);

  const handleGoogleConnect = useCallback(async () => {
    try {
      setGoogleConnecting(true);
      const result = await googleCalendarService.getConnectAuthUrl(window.location.origin);
      if (result?.success === false || !result?.authUrl) {
        throw new Error(result?.error || "Failed to start Google OAuth.");
      }

      oauthPopupRef.current = window.open(
        result.authUrl,
        "google-calendar-oauth",
        "width=760,height=780,menubar=no,toolbar=no,status=no"
      );

      if (!oauthPopupRef.current) {
        throw new Error("Popup blocked. Allow popups for this site and try again.");
      }
    } catch (connectError) {
      setGoogleConnecting(false);
      setToast({ type: "error", message: connectError?.message || "Unable to start Google OAuth." });
    }
  }, []);

  const refreshGoogleStatus = useCallback(
    async ({ showToast = false } = {}) => {
      try {
        setCheckingGoogleStatus(true);
        const authStatusResult = await googleCalendarService.getAuthStatus();
        if (authStatusResult?.success === false) {
          throw new Error(authStatusResult?.error || "Failed to check Google Calendar status.");
        }

        const nextStatus = authStatusResult?.data || null;
        setGoogleStatus(nextStatus);

        if (nextStatus?.connected) {
          setGoogleConnecting(false);
          closePopupWindow(oauthPopupRef.current);
          oauthPopupRef.current = null;
          await loadMeetings({ silent: true });
          if (showToast) setToast({ type: "success", message: "Google Calendar is connected." });
          return true;
        }

        if (showToast) setToast({ type: "error", message: "Google Calendar is not connected yet." });
        return false;
      } catch (statusError) {
        if (showToast) {
          setToast({ type: "error", message: statusError?.message || "Failed to check Google Calendar status." });
        }
        return false;
      } finally {
        setCheckingGoogleStatus(false);
      }
    },
    [loadMeetings]
  );

  const handleGoogleDisconnect = useCallback(async () => {
    if (disconnectingGoogle) return;
    const shouldDisconnect = window.confirm(
      "Disconnect Google Calendar from CRM Meetings? Existing CRM meeting history remains stored, but this page will stop syncing until you reconnect."
    );
    if (!shouldDisconnect) return;

    try {
      setDisconnectingGoogle(true);
      const result = await googleCalendarService.disconnect();
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to disconnect Google Calendar.");
      }

      closePopupWindow(oauthPopupRef.current);
      oauthPopupRef.current = null;
      setGoogleConnecting(false);
      setGoogleStatus({ connected: false });
      setMeetings([]);
      setMeta({ total: 0, upcoming: 0, past: 0 });
      setSelectedDateKey("");
      setToast({ type: "success", message: "Google Calendar disconnected." });
    } catch (disconnectError) {
      setToast({
        type: "error",
        message: disconnectError?.message || "Failed to disconnect Google Calendar."
      });
    } finally {
      setDisconnectingGoogle(false);
    }
  }, [disconnectingGoogle]);

  useEffect(() => {
    const trustedOrigins = buildGoogleOAuthTrustedOrigins({
      windowOrigin: window.location.origin,
      apiBaseUrl: resolveApiBaseUrl()
    });

    const handleGoogleOAuthMessage = async (event) => {
      if (!isGoogleOAuthEventOriginTrusted(event?.origin, trustedOrigins)) return;

      const oauthEvent = resolveGoogleOAuthEvent(event?.data);
      if (oauthEvent.type === "ignore") return;

      if (oauthEvent.type === "success") {
        setGoogleConnecting(false);
        closePopupWindow(oauthPopupRef.current);
        oauthPopupRef.current = null;
        setToast({ type: "success", message: oauthEvent.message });
        await loadMeetings({ silent: true });
      } else if (oauthEvent.type === "error") {
        setGoogleConnecting(false);
        closePopupWindow(oauthPopupRef.current);
        oauthPopupRef.current = null;
        setToast({ type: "error", message: oauthEvent.message });
      }
    };

    window.addEventListener("message", handleGoogleOAuthMessage);
    return () => {
      window.removeEventListener("message", handleGoogleOAuthMessage);
      closePopupWindow(oauthPopupRef.current);
      oauthPopupRef.current = null;
    };
  }, [loadMeetings]);

  useEffect(() => {
    if (!googleConnecting) return undefined;
    const poller = window.setInterval(() => {
      refreshGoogleStatus();
    }, 2500);
    const timeout = window.setTimeout(() => {
      setGoogleConnecting(false);
    }, 90000);
    return () => {
      window.clearInterval(poller);
      window.clearTimeout(timeout);
    };
  }, [googleConnecting, refreshGoogleStatus]);

  const openEditMeeting = useCallback((meeting) => {
    setEditingMeeting(meeting);
    setEditForm(buildEditState(meeting));
  }, []);

  const closeEditMeeting = useCallback(() => {
    if (savingMeeting) return;
    setEditingMeeting(null);
    setEditForm(buildEditState(null));
  }, [savingMeeting]);

  const handleSaveMeeting = useCallback(
    async (event) => {
      event.preventDefault();
      if (!editingMeeting?._id) return;

      try {
        setSavingMeeting(true);
        const result = await crmService.updateMeeting(editingMeeting._id, {
          summary: editForm.summary,
          description: editForm.description,
          startDateTime: editForm.startDateTime ? new Date(editForm.startDateTime).toISOString() : "",
          endDateTime: editForm.endDateTime ? new Date(editForm.endDateTime).toISOString() : "",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        });

        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update meeting");
        }

        const updatedMeeting = sanitizeMeeting(result?.data || {});
        setMeetings((previous) =>
          previous.map((meeting) => (meeting._id === updatedMeeting._id ? updatedMeeting : meeting))
        );
        setEditingMeeting(null);
        setToast({ type: "success", message: "Meeting updated" });
        await loadMeetings({ silent: true });
      } catch (saveError) {
        setToast({ type: "error", message: saveError?.message || "Failed to update meeting" });
      } finally {
        setSavingMeeting(false);
      }
    },
    [editForm, editingMeeting, loadMeetings]
  );

  const handleDeleteMeeting = useCallback(
    async (meeting) => {
      if (!meeting?._id || deletingMeetingId) return;
      const shouldDelete = window.confirm(
        `Delete "${meeting.summary || "Meeting"}"? This will also cancel the Google Calendar event when linked.`
      );
      if (!shouldDelete) return;

      try {
        setDeletingMeetingId(meeting._id);
        const result = await crmService.deleteMeeting(meeting._id);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to delete meeting");
        }

        setMeetings((previous) => previous.filter((item) => item._id !== meeting._id));
        setToast({ type: "success", message: "Meeting deleted" });
        await loadMeetings({ silent: true });
      } catch (deleteError) {
        setToast({ type: "error", message: deleteError?.message || "Failed to delete meeting" });
      } finally {
        setDeletingMeetingId("");
      }
    },
    [deletingMeetingId, loadMeetings]
  );

  const renderMeetingCard = useCallback(
    (_index, meeting) => (
      <article className="crm-meeting-card">
        <div className="crm-meeting-card__time">
          <Clock3 size={17} />
          <strong>{formatTimeRange(getMeetingStartValue(meeting), getMeetingEndValue(meeting))}</strong>
          <span>{formatDateTime(getMeetingStartValue(meeting))}</span>
        </div>

        <div className="crm-meeting-card-main">
          <div>
            <h4>{meeting.summary || "Meeting"}</h4>
            <p>
              <UserRound size={14} />
              {meeting.contact?.name || "Unknown contact"}
              {meeting.contact?.phone ? ` | ${meeting.contact.phone}` : ""}
            </p>
          </div>
          <div className="crm-meeting-card-meta">
            <span>{meeting.contact?.stage || "No stage"}</span>
            <span>Lead score: {meeting.contact?.leadScore || 0}</span>
            <span>{meeting.eventId ? "Synced with Google" : "CRM only"}</span>
          </div>
        </div>

        <div className="crm-meeting-card-actions">
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={() => {
              setSelectedContact(meeting.contact || null);
              setSelectedContactId(meeting.contact?._id || "");
            }}
          >
            <UserRound size={15} />
            Contact
          </button>
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={() => openEditMeeting(meeting)}
          >
            <Edit3 size={15} />
            Edit
          </button>
          {meeting.eventHtmlLink && (
            <a className="crm-btn crm-btn-secondary" href={meeting.eventHtmlLink} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              Event
            </a>
          )}
          {meeting.meetingUrl && (
            <a className="crm-btn crm-btn-primary" href={meeting.meetingUrl} target="_blank" rel="noreferrer">
              <Video size={15} />
              Join
            </a>
          )}
          <button
            type="button"
            className="crm-btn crm-btn-danger"
            onClick={() => handleDeleteMeeting(meeting)}
            disabled={deletingMeetingId === meeting._id}
          >
            <Trash2 size={15} />
            {deletingMeetingId === meeting._id ? "Deleting" : "Delete"}
          </button>
        </div>
      </article>
    ),
    [deletingMeetingId, handleDeleteMeeting, openEditMeeting]
  );

  return (
    <div className="crm-workspace crm-meetings-workspace">
      <div className="crm-workspace-header">
        <div>
          <h1>CRM Meetings</h1>
          <p>Track Google Meet sessions, day-level load, and contact context in one workspace.</p>
        </div>
        <CrmRealtimeStatus status={crmRealtime.connectionStatus} />
      </div>
      <CrmToast toast={toast} />

      <div className="crm-metric-grid crm-meeting-metric-grid">
        <div className="crm-metric-card crm-metric-card--with-icon">
          <span className="crm-metric-icon"><CalendarDays size={18} /></span>
          <div>
            <strong>{meta.total ?? meetings.length}</strong>
            <span>Total Meetings</span>
          </div>
        </div>
        <div className="crm-metric-card crm-metric-card--with-icon">
          <span className="crm-metric-icon"><CalendarClock size={18} /></span>
          <div>
            <strong>{meta.upcoming ?? upcomingMeetings.length}</strong>
            <span>Upcoming</span>
          </div>
        </div>
        <div className="crm-metric-card crm-metric-card--with-icon">
          <span className="crm-metric-icon"><CalendarCheck size={18} /></span>
          <div>
            <strong>{meta.past ?? Math.max((meta.total ?? meetings.length) - (meta.upcoming ?? upcomingMeetings.length), 0)}</strong>
            <span>Past Meetings</span>
          </div>
        </div>
        <div className="crm-metric-card crm-metric-card--with-icon">
          <span className="crm-metric-icon"><Link2 size={18} /></span>
          <div>
            <strong>{googleStatus?.connected ? "Connected" : "Not Connected"}</strong>
            <span>Google Calendar</span>
          </div>
        </div>
      </div>

      {googleStatus?.connected && (
      <div className="crm-meeting-toolbar">
        <div className="crm-filter-group">
          {["upcoming", "past", "all"].map((value) => (
            <button
              key={value}
              type="button"
              className={`crm-filter-chip ${bucket === value ? "active" : ""}`}
              onClick={() => setBucket(value)}
            >
              {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>

        <label className="crm-meeting-search">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search contact, phone, meeting title, or link"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="crm-btn crm-btn-danger crm-meeting-disconnect-btn"
          onClick={handleGoogleDisconnect}
          disabled={disconnectingGoogle}
        >
          <Unlink size={15} />
          {disconnectingGoogle ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
      )}

      {!googleStatus?.connected && !loading && (
        <div className="crm-meeting-onboarding">
          <section className="crm-meeting-connect-card crm-meeting-connect-card--hero">
            <div className="crm-meeting-connect-icon-cell">
              <span className="crm-meeting-connect-icon"><Link2 size={18} /></span>
            </div>
            <div>
              <strong>Connect Google Calendar to load meetings</strong>
              <span>Meeting history, Meet links, edit, and delete actions appear here after calendar access is connected.</span>
            </div>
            <div className="crm-meeting-connect-actions">
              <button type="button" className="crm-btn crm-btn-primary" onClick={handleGoogleConnect} disabled={googleConnecting}>
                {googleConnecting ? "Waiting for Google..." : "Connect Google"}
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => refreshGoogleStatus({ showToast: true })}
                disabled={checkingGoogleStatus}
              >
                {checkingGoogleStatus ? "Checking..." : "Check connection"}
              </button>
            </div>
          </section>

          <section className="crm-meeting-onboarding-grid">
            <article>
              <CalendarClock size={18} />
              <strong>Track every meeting</strong>
              <span>View upcoming, past, and all Google Meet sessions with contact context.</span>
            </article>
            <article>
              <Edit3 size={18} />
              <strong>Edit and sync</strong>
              <span>Update meeting title, start time, end time, and description from CRM.</span>
            </article>
            <article>
              <Trash2 size={18} />
              <strong>Delete safely</strong>
              <span>Delete from CRM and cancel the linked Google Calendar event when available.</span>
            </article>
          </section>
        </div>
      )}

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {loading && <CrmPageSkeleton variant="calendar" />}

      {!loading && googleStatus?.connected && meetings.length === 0 && (
        <div className="crm-empty-state crm-meeting-empty-state">
          <CalendarClock size={28} />
          <strong>No meetings found.</strong>
          <span>Schedule the next meeting from Contact 360, then it will appear here with Google Meet details.</span>
        </div>
      )}

      {!loading && googleStatus?.connected && meetings.length > 0 && (
        <div className="crm-report-two-column crm-report-two-column--meetings">
          <section className="crm-report-card crm-meeting-calendar-card">
            <div className="crm-drawer-card-header">
              <div>
                <h3>Meeting Calendar</h3>
                <span className="crm-drawer-helper-text">
                  {busiestDay.count > 0 ? `Busiest day has ${busiestDay.count} meetings.` : "Click a day to focus the agenda."}
                </span>
              </div>
              <div className="crm-inline-actions">
                <button
                  type="button"
                  className="crm-icon-btn"
                  onClick={() =>
                    setMonthCursor(
                      (previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                    )
                  }
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <strong className="crm-calendar-title">
                  {monthCursor.toLocaleString(undefined, {
                    month: "long",
                    year: "numeric"
                  })}
                </strong>
                <button
                  type="button"
                  className="crm-icon-btn"
                  onClick={() =>
                    setMonthCursor(
                      (previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                    )
                  }
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="crm-calendar-grid crm-calendar-grid--meetings">
              {CALENDAR_WEEKDAY_LABELS.map((label) => (
                <div key={label} className="crm-calendar-weekday">
                  {label}
                </div>
              ))}

              {calendarDays.map((day) => {
                const dayKey = formatDayKey(day);
                const items = meetingsByDay.get(dayKey) || [];
                const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
                const isSelected = dayKey === activeDateKey;
                const isToday = dayKey === formatDayKey(new Date());
                const densityClass =
                  items.length >= 6
                    ? "crm-calendar-day--busy"
                    : items.length >= 3
                      ? "crm-calendar-day--active-load"
                      : "";

                return (
                  <button
                    key={dayKey}
                    type="button"
                    className={[
                      "crm-calendar-day",
                      "crm-calendar-day--meeting",
                      isCurrentMonth ? "" : "crm-calendar-day--muted",
                      isSelected ? "crm-calendar-day--selected" : "",
                      isToday ? "crm-calendar-day--today" : "",
                      densityClass
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setSelectedDateKey(dayKey);
                      setMonthCursor(new Date(day.getFullYear(), day.getMonth(), 1));
                    }}
                  >
                    <span>{day.getDate()}</span>
                    {items.length > 0 && <strong>{items.length}</strong>}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="crm-report-card crm-meeting-agenda-card">
            <div className="crm-drawer-card-header">
              <div>
                <h3>Agenda</h3>
                <span className="crm-drawer-helper-text">
                  {selectedDateLabel} | {agendaMeetings.length} meeting{agendaMeetings.length === 1 ? "" : "s"}
                </span>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => setSelectedDateKey("all")}
              >
                Show All
              </button>
            </div>

            {agendaMeetings.length === 0 ? (
              <div className="crm-empty-state crm-meeting-empty-state">
                <CalendarClock size={28} />
                <strong>No meetings scheduled for this view.</strong>
                <span>Pick another date or clear search filters to see more meetings.</span>
              </div>
            ) : (
              <Virtuoso
                className="crm-meeting-virtual-list"
                data={agendaMeetings}
                computeItemKey={(_index, meeting) => meeting._id}
                itemContent={renderMeetingCard}
              />
            )}
          </section>
        </div>
      )}

      {editingMeeting && (
        <div className="crm-meeting-modal-overlay" onClick={closeEditMeeting}>
          <form className="crm-meeting-modal" onSubmit={handleSaveMeeting} onClick={(event) => event.stopPropagation()}>
            <div className="crm-meeting-modal__header">
              <div>
                <h3>Edit Meeting</h3>
                <span>Changes sync with Google Calendar when this meeting is linked.</span>
              </div>
              <button type="button" className="crm-icon-btn" onClick={closeEditMeeting} disabled={savingMeeting}>
                <X size={17} />
              </button>
            </div>

            <label className="crm-field">
              <span>Meeting Title</span>
              <input
                className="crm-input"
                value={editForm.summary}
                onChange={(event) => setEditForm((previous) => ({ ...previous, summary: event.target.value }))}
                required
              />
            </label>

            <div className="crm-meeting-modal__grid">
              <label className="crm-field">
                <span>Start</span>
                <input
                  type="datetime-local"
                  className="crm-input"
                  value={editForm.startDateTime}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, startDateTime: event.target.value }))}
                  required
                />
              </label>
              <label className="crm-field">
                <span>End</span>
                <input
                  type="datetime-local"
                  className="crm-input"
                  value={editForm.endDateTime}
                  onChange={(event) => setEditForm((previous) => ({ ...previous, endDateTime: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label className="crm-field">
              <span>Description</span>
              <textarea
                className="crm-input crm-textarea"
                value={editForm.description}
                onChange={(event) => setEditForm((previous) => ({ ...previous, description: event.target.value }))}
                rows={4}
              />
            </label>

            <div className="crm-meeting-modal__footer">
              <button type="button" className="crm-btn crm-btn-secondary" onClick={closeEditMeeting} disabled={savingMeeting}>
                Cancel
              </button>
              <button type="submit" className="crm-btn crm-btn-primary" disabled={savingMeeting}>
                {savingMeeting ? "Saving..." : "Save Meeting"}
              </button>
            </div>
          </form>
        </div>
      )}

      <CrmContactDrawer
        contactId={selectedContactId}
        initialContact={selectedContact}
        onClose={() => {
          setSelectedContactId("");
          setSelectedContact(null);
        }}
        onTaskMutation={() => loadMeetings({ silent: true })}
      />
    </div>
  );
};

export default CrmMeetings;
