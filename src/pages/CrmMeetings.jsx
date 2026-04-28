import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Video
} from "lucide-react";
import CrmContactDrawer from "../components/crm/CrmContactDrawer";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmToast from "../components/crm/CrmToast";
import { crmService } from "../services/crmService";
import { googleCalendarService } from "../services/googleCalendarService";
import { startLoadingTimeoutGuard } from "../utils/loadingGuard";
import { addCrmContactSyncListener } from "../utils/crmSyncEvents";
import { resolveApiBaseUrl } from "../services/apiBaseUrl";
import {
  buildGoogleOAuthTrustedOrigins,
  isGoogleOAuthEventOriginTrusted,
  isOAuthPopupOpen,
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

const sanitizeMeeting = (meeting = {}) => ({
  _id: String(meeting?._id || "").trim(),
  summary: String(meeting?.summary || "").trim(),
  meetingUrl: String(meeting?.meetingUrl || "").trim(),
  eventHtmlLink: String(meeting?.eventHtmlLink || "").trim(),
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

const CrmMeetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [meta, setMeta] = useState({ total: 0, upcoming: 0, past: 0 });
  const [googleStatus, setGoogleStatus] = useState(null);
  const [bucket, setBucket] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => getMonthStart(new Date()));
  const [toast, setToast] = useState(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const oauthPopupRef = useRef(null);
  const lastExternalSyncAtRef = useRef(0);

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadMeetings = useCallback(
    async ({ silent = false } = {}) => {
      const releaseLoadingGuard = startLoadingTimeoutGuard(
        () => {
          if (silent) setRefreshing(false);
          else setLoading(false);
        },
        CRM_MEETINGS_LOADING_TIMEOUT_MS
      );

      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
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
          search: searchQuery.trim(),
          limit: 240
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
        setRefreshing(false);
      }
    },
    [bucket, searchQuery]
  );

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMeetings({ silent: true });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [bucket, loadMeetings, searchQuery]);

  useEffect(() => {
    const unsubscribe = addCrmContactSyncListener(() => {
      const now = Date.now();
      if (now - lastExternalSyncAtRef.current < 900) return;
      lastExternalSyncAtRef.current = now;
      loadMeetings({ silent: true });
    });

    return () => {
      unsubscribe();
    };
  }, [loadMeetings]);

  const upcomingMeetings = useMemo(
    () =>
      meetings.filter((meeting) => {
        const parsed = safeDate(meeting?.start?.dateTime);
        return !parsed || parsed >= new Date();
      }),
    [meetings]
  );

  const meetingsByDay = useMemo(() => {
    const map = new Map();
    meetings.forEach((meeting) => {
      const key = formatDayKey(meeting?.start?.dateTime || meeting?.createdAt);
      if (!key) return;
      const existing = map.get(key) || [];
      existing.push(meeting);
      map.set(key, existing);
    });

    for (const value of map.values()) {
      value.sort((left, right) => {
        const leftTime = safeDate(left?.start?.dateTime)?.getTime() || 0;
        const rightTime = safeDate(right?.start?.dateTime)?.getTime() || 0;
        return leftTime - rightTime;
      });
    }

    return map;
  }, [meetings]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const activeDateKey = selectedDateKey || formatDayKey(new Date());
  const selectedDayMeetings = meetingsByDay.get(activeDateKey) || [];
  const selectedDateLabel = activeDateKey
    ? formatDateTime(`${activeDateKey}T00:00:00`)
    : "All matching meetings";

  useEffect(() => {
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
        if (isOAuthPopupOpen(oauthPopupRef.current)) oauthPopupRef.current.close();
        setToast({ type: "success", message: oauthEvent.message });
        await loadMeetings({ silent: true });
      } else if (oauthEvent.type === "error") {
        setGoogleConnecting(false);
        if (isOAuthPopupOpen(oauthPopupRef.current)) oauthPopupRef.current.close();
        setToast({ type: "error", message: oauthEvent.message });
      }
    };

    window.addEventListener("message", handleGoogleOAuthMessage);
    return () => {
      window.removeEventListener("message", handleGoogleOAuthMessage);
      if (isOAuthPopupOpen(oauthPopupRef.current)) oauthPopupRef.current.close();
    };
  }, [loadMeetings]);

  useEffect(() => {
    if (!googleConnecting) return undefined;
    const watcher = window.setInterval(() => {
      if (!oauthPopupRef.current) return;
      if (isOAuthPopupOpen(oauthPopupRef.current)) return;
      setGoogleConnecting(false);
      oauthPopupRef.current = null;
    }, 500);
    return () => window.clearInterval(watcher);
  }, [googleConnecting]);

  return (
    <div className="crm-workspace">
        <div className="crm-workspace-header">
        <CrmToast toast={toast} />
        <div>
          <h1>CRM Meetings</h1>
          <p>Track scheduled Google Meet sessions, day-level load, and contact context in one workspace.</p>
        </div>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => {
            loadMeetings({ silent: true });
            setToast({ type: "success", message: "Refreshing meeting workspace..." });
          }}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="crm-metric-grid">
        <div className="crm-metric-card">
          <CalendarDays size={18} />
          <div>
            <strong>{meta.total ?? meetings.length}</strong>
            <span>Total Meetings</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <Video size={18} />
          <div>
            <strong>{meta.upcoming ?? upcomingMeetings.length}</strong>
            <span>Upcoming</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <CalendarDays size={18} />
          <div>
            <strong>{meta.past ?? Math.max((meta.total ?? meetings.length) - (meta.upcoming ?? upcomingMeetings.length), 0)}</strong>
            <span>Past Meetings</span>
          </div>
        </div>
        <div className="crm-metric-card">
          <ExternalLink size={18} />
          <div>
            <strong>{googleStatus?.connected ? "Connected" : "Not Connected"}</strong>
            <span>Google Calendar</span>
          </div>
        </div>
      </div>

      <div className="crm-toolbar">
        <div className="crm-filter-group">
          <button
            type="button"
            className={`crm-filter-chip ${bucket === "upcoming" ? "active" : ""}`}
            onClick={() => setBucket("upcoming")}
          >
            Upcoming
          </button>
          <button
            type="button"
            className={`crm-filter-chip ${bucket === "past" ? "active" : ""}`}
            onClick={() => setBucket("past")}
          >
            Past
          </button>
          <button
            type="button"
            className={`crm-filter-chip ${bucket === "all" ? "active" : ""}`}
            onClick={() => setBucket("all")}
          >
            All
          </button>
        </div>

        <input
          type="search"
          className="crm-search-input"
          placeholder="Search contact, phone, or meeting title"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {!googleStatus?.connected && !loading && (
        <div className="crm-empty-state">
          <strong>Connect Google first to access Meetings.</strong>
          <span>Only after connecting Google Calendar, meeting pages and scheduling features will be shown.</span>
          <button type="button" className="crm-btn crm-btn-primary" onClick={handleGoogleConnect} disabled={googleConnecting}>
            {googleConnecting ? "Connecting..." : "Connect Google"}
          </button>
        </div>
      )}

      {error && <div className="crm-alert crm-alert-error">{error}</div>}
      {loading && <CrmPageSkeleton variant="calendar" />}

      {!loading && googleStatus?.connected && meetings.length === 0 && (
        <div className="crm-empty-state">
          <strong>No meetings found yet.</strong>
          <span>Schedule the next meeting from Contact 360 or connect Google Calendar if it is not linked.</span>
        </div>
      )}

      {!loading && googleStatus?.connected && meetings.length > 0 && (
        <div className="crm-report-two-column crm-report-two-column--meetings">
          <section className="crm-report-card">
            <div className="crm-drawer-card-header">
              <div>
                <h3>Meeting Calendar</h3>
                <span className="crm-drawer-helper-text">
                  Click a day to focus the agenda and jump into the contact drawer.
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
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="crm-calendar-grid">
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

                return (
                  <button
                    key={dayKey}
                    type="button"
                    className={[
                      "crm-calendar-day",
                      isCurrentMonth ? "" : "crm-calendar-day--muted",
                      isSelected ? "crm-calendar-day--selected" : "",
                      isToday ? "crm-calendar-day--today" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setSelectedDateKey(dayKey);
                      setMonthCursor(new Date(day.getFullYear(), day.getMonth(), 1));
                    }}
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
                <h3>Agenda</h3>
                <span className="crm-drawer-helper-text">{selectedDateLabel}</span>
              </div>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                onClick={() => setSelectedDateKey("")}
              >
                Show Default Day
              </button>
            </div>

            {selectedDayMeetings.length === 0 ? (
              <div className="crm-empty-state">
                <strong>No meetings scheduled for this day.</strong>
                <span>Pick another date from the calendar or create the next meeting from Contact 360.</span>
              </div>
            ) : (
              <div className="crm-meeting-list">
                {selectedDayMeetings.map((meeting) => (
                  <article key={meeting._id} className="crm-meeting-card">
                    <div className="crm-meeting-card-main">
                      <div>
                        <h4>{meeting.summary || "Meeting"}</h4>
                        <p>
                          {meeting.contact?.name || "Unknown contact"}
                          {meeting.contact?.phone ? ` | ${meeting.contact.phone}` : ""}
                        </p>
                      </div>
                      <div className="crm-meeting-card-meta">
                        <span>{formatDateTime(meeting?.start?.dateTime)}</span>
                        <span>{meeting.contact?.stage || "No stage"}</span>
                        <span>Lead score: {meeting.contact?.leadScore || 0}</span>
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
                        Open Contact
                      </button>
                      {meeting.eventHtmlLink && (
                        <a
                          className="crm-btn crm-btn-secondary"
                          href={meeting.eventHtmlLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Calendar Event
                        </a>
                      )}
                      {meeting.meetingUrl && (
                        <a
                          className="crm-btn crm-btn-primary"
                          href={meeting.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Join Meet
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
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
