
import React, { useEffect, useState } from "react";
import "./missedcall.css";
import { 
  PhoneMissed, 
  RefreshCcw, 
  CheckCircle, 
  Clock, 
  Phone,
  Calendar,
  User,
  ChevronRight,
  Search,
  Filter,
  Plus,
  X,
  Mail,
  MapPin,
  FileText,
  MessageCircle,
  ArrowLeft,
  PhoneOutgoing
} from "lucide-react";

const MissedCalls = () => {
  const [allCalls, setAllCalls] = useState([]);
  const [filteredCalls, setFilteredCalls] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    status: "missed",
    duration: "",
    callType: "inbound",
    location: "",
    notes: "",
    email: "",
    priority: "medium"
  });

  const sampleCalls = [
    {
      id: 1,
      phone: "+1 (555) 123-4567",
      name: "John Smith",
      date: new Date().toISOString().split('T')[0],
      displayDate: formatDate(new Date().toISOString().split('T')[0]),
      time: "09:30 AM",
      status: "missed",
      duration: "45s",
      callType: "inbound",
      location: "New York, NY",
      notes: "Called about product inquiry",
      email: "john.smith@email.com",
      priority: "high"
    },
    {
      id: 2,
      phone: "+1 (555) 987-6543",
      name: "Sarah Johnson",
      date: new Date().toISOString().split('T')[0],
      displayDate: formatDate(new Date().toISOString().split('T')[0]),
      time: "10:15 AM",
      status: "resolved",
      duration: "1m 20s",
      callType: "inbound",
      location: "Los Angeles, CA",
      notes: "Service complaint - resolved",
      email: "sarah.j@email.com",
      priority: "medium"
    },
    {
      id: 3,
      phone: "+1 (555) 456-7890",
      name: "Michael Chen",
      date: "2024-12-14",
      displayDate: "Dec 14, 2024",
      time: "02:45 PM",
      status: "missed",
      duration: "30s",
      callType: "outbound",
      location: "Chicago, IL",
      notes: "Technical support follow-up",
      email: "m.chen@email.com",
      priority: "high"
    },
    {
      id: 4,
      phone: "+1 (555) 789-1234",
      name: "Emma Wilson",
      date: "2024-12-13",
      displayDate: "Dec 13, 2024",
      time: "11:30 AM",
      status: "resolved",
      duration: "2m 15s",
      callType: "outbound",
      location: "Miami, FL",
      notes: "Sales call - interested",
      email: "emma.w@email.com",
      priority: "medium"
    },
    {
      id: 5,
      phone: "+1 (555) 321-6547",
      name: "Robert Davis",
      date: new Date().toISOString().split('T')[0],
      displayDate: formatDate(new Date().toISOString().split('T')[0]),
      time: "03:45 PM",
      status: "missed",
      duration: "50s",
      callType: "inbound",
      location: "Seattle, WA",
      notes: "Customer support query",
      email: "robert.d@email.com",
      priority: "low"
    },
    {
      id: 6,
      phone: "+1 (555) 111-2222",
      name: "Lisa Anderson",
      date: new Date().toISOString().split('T')[0],
      displayDate: formatDate(new Date().toISOString().split('T')[0]),
      time: "11:00 AM",
      status: "missed",
      duration: "25s",
      callType: "inbound",
      location: "Boston, MA",
      notes: "Urgent sales inquiry",
      email: "lisa.a@email.com",
      priority: "high"
    }
  ];

  const fetchCalls = () => {
    setLoading(true);
    
    setTimeout(() => {
      const callsWithDisplayDate = sampleCalls.map(call => ({
        ...call,
        displayDate: formatDate(call.date)
      }));
      setAllCalls(callsWithDisplayDate);
      setFilteredCalls(callsWithDisplayDate);
      setActiveFilter("all");
      setLoading(false);
    }, 200);
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const applyFilter = (filter) => {
    setActiveFilter(filter);
    let filtered = [...allCalls];

    if (filter === "inbound") {
      filtered = filtered.filter(call => call.callType === "inbound");
    } else if (filter === "outbound") {
      filtered = filtered.filter(call => call.callType === "outbound");
    } else if (filter === "missed") {
      filtered = filtered.filter(call => call.status === "missed");
    } else if (filter === "resolved") {
      filtered = filtered.filter(call => call.status === "resolved");
    } else if (filter === "today") {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(call => call.date === today);
    }

    // Apply date range filter
    if (dateRange.startDate && dateRange.endDate) {
      filtered = filtered.filter(call => {
        const callDate = new Date(call.date);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        return callDate >= startDate && callDate <= endDate;
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(call =>
        call.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredCalls(filtered);
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyDateFilter = () => {
    applyFilter(activeFilter);
  };

  const clearDateFilter = () => {
    setDateRange({
      startDate: "",
      endDate: ""
    });
    // Reset to show all calls
    setFilteredCalls(allCalls);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    let filtered = [...allCalls];
    
    // Apply active filter first
    if (activeFilter === "inbound") {
      filtered = filtered.filter(call => call.callType === "inbound");
    } else if (activeFilter === "outbound") {
      filtered = filtered.filter(call => call.callType === "outbound");
    } else if (activeFilter === "missed") {
      filtered = filtered.filter(call => call.status === "missed");
    } else if (activeFilter === "resolved") {
      filtered = filtered.filter(call => call.status === "resolved");
    } else if (activeFilter === "today") {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(call => call.date === today);
    }
    
    // Apply date range filter
    if (dateRange.startDate && dateRange.endDate) {
      filtered = filtered.filter(call => {
        const callDate = new Date(call.date);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        return callDate >= startDate && callDate <= endDate;
      });
    }
    
    // Apply search query
    if (query) {
      filtered = filtered.filter(call =>
        call.phone.toLowerCase().includes(query.toLowerCase()) ||
        call.name.toLowerCase().includes(query.toLowerCase()) ||
        call.location.toLowerCase().includes(query.toLowerCase()) ||
        call.email?.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    setFilteredCalls(filtered);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newCall = {
      id: allCalls.length + 1,
      ...formData,
      displayDate: formatDate(formData.date)
    };
    
    const updatedCalls = [newCall, ...allCalls];
    setAllCalls(updatedCalls);
    setFilteredCalls(updatedCalls);
    setShowForm(false);
    resetForm();
    applyFilter(activeFilter);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      status: "missed",
      duration: "",
      callType: "inbound",
      location: "",
      notes: "",
      email: "",
      priority: "medium"
    });
  };

  const handleViewDetails = (call) => {
    setSelectedCall(call);
    setViewMode("details");
  };

  const stats = {
    total: allCalls.length,
    missed: allCalls.filter(call => call.status === "missed").length,
    resolved: allCalls.filter(call => call.status === "resolved").length,
    inbound: allCalls.filter(call => call.callType === "inbound").length,
    outbound: allCalls.filter(call => call.callType === "outbound").length,
    today: allCalls.filter(call => call.date === new Date().toISOString().split('T')[0]).length
  };

  return (
    <div className="missedcalls-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h2>
            <PhoneMissed size={24} className="header-icon" />
            Missed Calls
          </h2>
          <p>Track and manage all inbound and outbound calls</p>
        </div>
       
      </div>

      {/* Stats */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon total">
            <Phone size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Calls</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon inbound">
            <PhoneMissed size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.inbound}</h3>
            <p>Inbound</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon outbound">
            <PhoneOutgoing size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.outbound}</h3>
            <p>Outbound</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon missed">
            <Clock size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.missed}</h3>
            <p>Missed</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon resolved">
            <CheckCircle size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.resolved}</h3>
            <p>Resolved</p>
          </div>
        </div>
      </div>

      {/* Main Content (List/Grid View) */}
      {viewMode !== "details" && (
        <>
          {/* Controls */}
          <div className="controls-container">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by phone, name, email, or location..."
                value={searchQuery}
                onChange={handleSearch}
                className="search-input"
              />
            </div>

            {/* Date Range Filter */}
            <div className="date-filter-container">
              <div className="filter-group">
                <Calendar size={16} />
                <span>Filter by Date Range:</span>
              </div>
              <div className="date-range-inputs">
                <input
                  type="date"
                  name="startDate"
                  value={dateRange.startDate}
                  onChange={handleDateRangeChange}
                  className="date-input"
                  placeholder="Start Date"
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  name="endDate"
                  value={dateRange.endDate}
                  onChange={handleDateRangeChange}
                  className="date-input"
                  placeholder="End Date"
                />
                <button 
                  className="date-filter-btn primary"
                  onClick={applyDateFilter}
                >
                  Apply
                </button>
                <button 
                  className="date-filter-btn secondary"
                  onClick={clearDateFilter}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Call Type & Status Filters */}
            <div className="filters-container">
              <div className="filter-group">
                <Filter size={16} />
                <span>Filter by:</span>
              </div>
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${activeFilter === "all" ? "active" : ""}`}
                  onClick={() => {
                    setActiveFilter("all");
                    setFilteredCalls(allCalls);
                  }}
                >
                  All ({stats.total})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "inbound" ? "active" : ""}`}
                  onClick={() => applyFilter("inbound")}
                >
                  Inbound ({stats.inbound})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "outbound" ? "active" : ""}`}
                  onClick={() => applyFilter("outbound")}
                >
                  Outbound ({stats.outbound})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "missed" ? "active" : ""}`}
                  onClick={() => applyFilter("missed")}
                >
                  Missed ({stats.missed})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "resolved" ? "active" : ""}`}
                  onClick={() => applyFilter("resolved")}
                >
                  Resolved ({stats.resolved})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "today" ? "active" : ""}`}
                  onClick={() => applyFilter("today")}
                >
                  Today ({stats.today})
                </button>
              </div>
            </div>
          </div>

          {/* Calls List */}
          <div className="calls-container">
            {loading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading calls...</p>
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="empty-state">
                <PhoneMissed size={48} className="empty-icon" />
                <h3>No calls found</h3>
                <p>Try changing your filters or search terms</p>
              </div>
            ) : (
              <div className="calls-list">
                <table className="calls-table">
                  <thead>
                    <tr>
                      <th>Caller</th>
                      <th>Phone</th>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Location</th>
                      <th>Priority</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCalls.map((call) => (
                      <tr key={call.id} className="call-row">
                        <td>
                          <div className="caller-cell">
                            <div className="caller-avatar small">
                              <User size={14} />
                            </div>
                            <div>
                              <div className="caller-name">{call.name}</div>
                              {call.email && (
                                <div className="caller-email">{call.email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="phone-cell">
                            <Phone size={12} />
                            {call.phone}
                          </div>
                        </td>
                        <td>
                          <div className="datetime-cell">
                            <div>{call.displayDate}</div>
                            <div className="time">{call.time}</div>
                          </div>
                        </td>
                        <td>
                          <div className={`calltype-cell ${call.callType}`}>
                            {call.callType === "inbound" ? (
                              <>
                                <PhoneMissed size={12} /> Inbound
                              </>
                            ) : (
                              <>
                                <PhoneOutgoing size={12} /> Outbound
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={`status-cell ${call.status}`}>
                            {call.status === "resolved" ? (
                              <>
                                <CheckCircle size={12} /> Resolved
                              </>
                            ) : (
                              <>
                                <Clock size={12} /> Missed
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="duration-cell">
                            {call.duration}
                          </div>
                        </td>
                        <td>
                          <div className="location-cell">
                            <MapPin size={12} />
                            {call.location}
                          </div>
                        </td>
                        <td>
                          <div className={`priority-cell ${call.priority}`}>
                            {call.priority}
                          </div>
                        </td>
                        <td>
                          <div className="action-cell">
                            <button 
                              className="view-btn"
                              onClick={() => handleViewDetails(call)}
                            >
                              View Details
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Call Details View */}
      {viewMode === "details" && selectedCall && (
        <div className="details-container">
          <div className="details-header">
            <button className="back-btn" onClick={() => setViewMode("list")}>
              <ArrowLeft size={20} />
              Back to List
            </button>
            <h2>Call Details</h2>
          </div>
          
          <div className="details-content">
            <div className="details-card">
              <div className="details-header-section">
                <div className="caller-details">
                  <div className="caller-avatar large">
                    <User size={24} />
                  </div>
                  <div>
                    <h2>{selectedCall.name}</h2>
                    <p className="caller-phone-large">
                      <Phone size={16} /> {selectedCall.phone}
                    </p>
                  </div>
                </div>
                
                <div className="status-section">
                  <div className={`status-badge large ${selectedCall.status}`}>
                    {selectedCall.status === "resolved" ? (
                      <>
                        <CheckCircle size={16} /> Resolved
                      </>
                    ) : (
                      <>
                        <Clock size={16} /> Missed
                      </>
                    )}
                  </div>
                  <div className={`priority-badge ${selectedCall.priority}`}>
                    {selectedCall.priority} Priority
                  </div>
                  <div className={`calltype-badge ${selectedCall.callType}`}>
                    {selectedCall.callType === "inbound" ? (
                      <PhoneMissed size={14} />
                    ) : (
                      <PhoneOutgoing size={14} />
                    )}
                    {selectedCall.callType}
                  </div>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-section">
                  <h3><Calendar size={18} /> Call Information</h3>
                  <div className="detail-row">
                    <span className="detail-label">Date & Time:</span>
                    <span className="detail-value">{selectedCall.displayDate} at {selectedCall.time}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">{selectedCall.duration}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Call Type:</span>
                    <span className="detail-value capitalize">{selectedCall.callType}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h3><User size={18} /> Contact Details</h3>
                  {selectedCall.email && (
                    <div className="detail-row">
                      <span className="detail-label"><Mail size={16} /> Email:</span>
                      <span className="detail-value">{selectedCall.email}</span>
                    </div>
                  )}
                  {selectedCall.location && (
                    <div className="detail-row">
                      <span className="detail-label"><MapPin size={16} /> Location:</span>
                      <span className="detail-value">{selectedCall.location}</span>
                    </div>
                  )}
                </div>

                <div className="detail-section full-width">
                  <h3><FileText size={18} /> Notes</h3>
                  <div className="notes-content">
                    {selectedCall.notes || "No notes available"}
                  </div>
                </div>

                <div className="detail-section full-width">
                  <h3><MessageCircle size={18} /> Actions</h3>
                  <div className="action-buttons">
                    <button className="action-btn primary">
                      <Phone size={16} /> Call Back
                    </button>
                    <button className="action-btn secondary">
                      <MessageCircle size={16} /> Send SMS
                    </button>
                    <button className="action-btn outline">
                      <Mail size={16} /> Send Email
                    </button>
                    <button className="action-btn outline">
                      <FileText size={16} /> Add Note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissedCalls;