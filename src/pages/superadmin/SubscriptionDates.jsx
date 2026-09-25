import { useEffect, useState } from "react";
import apiService from "../../services/api";
import socketService from "../../services/socketService";
import "./SubscriptionDates.css";

const dateInputValue = (value) => {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function SubscriptionRow({ subscription, backendUrl }) {
  const [start, setStart] = useState(dateInputValue(subscription.startsAt));
  const [end, setEnd] = useState(dateInputValue(subscription.endsAt));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(subscription);
  const dirty = start !== dateInputValue(saved.startsAt) || end !== dateInputValue(saved.endsAt);

  const save = async (event) => {
    event.preventDefault();
    if (!start || !end || end < start) {
      setMessage("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await apiService.put(`${backendUrl}/api/admin/subscriptions/${subscription._id}/dates`, {
        startsAt: start === dateInputValue(saved.startsAt) ? saved.startsAt : new Date(`${start}T00:00:00`).toISOString(),
        endsAt: end === dateInputValue(saved.endsAt) ? saved.endsAt : new Date(`${end}T23:59:59.999`).toISOString()
      });
      setSaved(res.data.data);
      setMessage("Dates saved.");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Could not save dates. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="subscription-dates-row">
      <div><strong>{subscription.userId?.username || subscription.userId?.email || subscription.companyId}</strong><div>{subscription.planCode} · {saved.status}</div></div>
      <label>Start date<input type="date" required value={start} disabled={saving} onChange={(event) => setStart(event.target.value)} /></label>
      <label>End date<input type="date" required min={start} value={end} disabled={saving} onChange={(event) => setEnd(event.target.value)} /></label>
      <button type="submit" className="tab-btn" disabled={saving || !dirty}>{saving ? "Saving..." : "Save dates"}</button>
      {message && <span role="status">{message}</span>}
    </form>
  );
}

export default function SubscriptionDates({ backendUrl }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const fetchSubscriptions = async () => {
      try {
        const res = await apiService.get(`${backendUrl}/api/admin/subscriptions`);
        if (active) { setSubscriptions(res.data.data || []); setError(""); }
      } catch {
        if (active) setError("Could not load subscription dates. Reopen the Payments tab to retry.");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSubscriptions();
    socketService.on("payment.updated", fetchSubscriptions);
    return () => { active = false; socketService.off("payment.updated", fetchSubscriptions); };
  }, [backendUrl]);

  return (
    <section className="subscription-dates-panel" aria-label="Subscription dates">
      <h3>Subscription dates</h3>
      <p>Edit the subscription period for each account. Dates use your local time; a changed end date includes the full day.</p>
      {error && <p role="alert">{error}</p>}
      {loading ? <p>Loading subscriptions...</p> : !error && subscriptions.length === 0 ? <p>No subscriptions found.</p> : subscriptions.map((subscription) => (
        <SubscriptionRow key={`${subscription._id}:${subscription.startsAt}:${subscription.endsAt}`} subscription={subscription} backendUrl={backendUrl} />
      ))}
    </section>
  );
}
