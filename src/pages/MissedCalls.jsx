import React, { useEffect, useState } from "react";
import { PhoneMissed, RefreshCcw, CheckCircle, Clock } from "lucide-react";

const MissedCalls = () => {
  const [allCalls, setAllCalls] = useState([]);
  const [filteredCalls, setFilteredCalls] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchCalls = () => {
    setLoading(true);
    fetch("http://192.168.1.112:5678/webhook/missedcall-data")
      .then(res => res.json())
      .then(data => {
        setAllCalls(data);
        setFilteredCalls(data);
        setActiveFilter("all");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  // 🔹 Helper: check if call is today
  const isToday = (dateStr) => {
  if (!dateStr) return false;

  const today = new Date();

  // Handle "Dec 30, 2025"
  const parts = dateStr.split(" "); // ["Dec", "30,", "2025"]
  const monthName = parts[0];
  const day = parseInt(parts[1].replace(",", ""), 10);
  const year = parseInt(parts[2], 10);

  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3,
    May: 4, Jun: 5, Jul: 6, Aug: 7,
    Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  const callDate = new Date(year, monthMap[monthName], day);

  return (
    callDate.getDate() === today.getDate() &&
    callDate.getMonth() === today.getMonth() &&
    callDate.getFullYear() === today.getFullYear()
  );
};


  // 🔹 Filter handler
  const applyFilter = (filter) => {
    setActiveFilter(filter);

    if (filter === "all") {
      setFilteredCalls(allCalls);
    }

    if (filter === "today") {
      setFilteredCalls(allCalls.filter(call => isToday(call.date)));
    }

    if (filter === "missed") {
      setFilteredCalls(allCalls.filter(call => call.status !== "resolved"));
    }

    if (filter === "resolved") {
      setFilteredCalls(allCalls.filter(call => call.status === "resolved"));
    }
  };

  return (
    <div className="missedcalls-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Missed Calls</h2>
          <p>Incoming missed call leads from WhatsApp</p>
        </div>

        <button className="primary-btn" onClick={fetchCalls}>
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="templates-filters">
        <button
          className={`filter-btn ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => applyFilter("all")}
        >
          All
        </button>

        <button
          className={`filter-btn ${activeFilter === "today" ? "active" : ""}`}
          onClick={() => applyFilter("today")}
        >
          Today
        </button>

        <button
          className={`filter-btn ${activeFilter === "missed" ? "active" : ""}`}
          onClick={() => applyFilter("missed")}
        >
          Missed
        </button>

        <button
          className={`filter-btn ${activeFilter === "resolved" ? "active" : ""}`}
          onClick={() => applyFilter("resolved")}
        >
          Resolved
        </button>
      </div>

      {/* Cards */}
      <div className="templates-grid">
        {loading && <p>Loading missed calls...</p>}

        {!loading && filteredCalls.length === 0 && (
          <p>No missed calls found</p>
        )}

        {filteredCalls.map((call, index) => (
          <div className="template-card" key={index}>
            <div className="card-header">
              <span className="template-name">
                <PhoneMissed size={14} /> {call.phone}
              </span>

              {call.status === "resolved" ? (
                <span className="status-badge approved">
                  <CheckCircle size={12} /> Resolved
                </span>
              ) : (
                <span className="status-badge pending">
                  <Clock size={12} /> Missed
                </span>
              )}
            </div>

            <p className="template-content">
              Missed call received on <b>{call.date}</b> at <b>{call.time}</b>
            </p>

            <div className="card-footer">
              <span className="lang-tag">Inbound</span>
              <span className="category-tag">Missed Call</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MissedCalls;
