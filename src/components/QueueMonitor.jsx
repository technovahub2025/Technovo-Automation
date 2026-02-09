import React, { useState, useEffect } from 'react';
import { Users, Clock, Phone, TrendingUp, AlertCircle, UserPlus, ArrowUpRight } from 'lucide-react';
import apiService from '../services/api';
import './QueueMonitor.css';

const QueueMonitor = ({ socket }) => {
  const [queues, setQueues] = useState({});
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [realTimeStats, setRealTimeStats] = useState({
    totalInQueue: 0,
    avgWaitTime: 0,
    longestWait: 0,
    abandonmentRate: 0
  });

  useEffect(() => {
    fetchQueueData();
    
    if (socket) {
      socket.on('queue_update', handleQueueUpdate);
      socket.on('caller_joined_queue', handleCallerJoined);
      socket.on('caller_left_queue', handleCallerLeft);
    }

    const interval = setInterval(fetchQueueData, 5000); // Refresh every 5 seconds

    return () => {
      if (socket) {
        socket.off('queue_update', handleQueueUpdate);
        socket.off('caller_joined_queue', handleCallerJoined);
        socket.off('caller_left_queue', handleCallerLeft);
      }
      clearInterval(interval);
    };
  }, [socket]);

  const fetchQueueData = async () => {
    try {
      const response = await apiService.getQueueStatus();
      const data = response.data;
      setQueues(data);
      calculateStats(data);
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
    }
  };

  const calculateStats = (queueData) => {
    let totalInQueue = 0;
    let totalWaitTime = 0;
    let longestWait = 0;
    let callerCount = 0;

    Object.values(queueData || {}).forEach(queue => {
      // Check if queue is an array
      if (Array.isArray(queue)) {
        totalInQueue += queue.length;
        
        queue.forEach(caller => {
          const waitTime = Math.floor((Date.now() - new Date(caller.queuedAt)) / 1000);
          totalWaitTime += waitTime;
          longestWait = Math.max(longestWait, waitTime);
          callerCount++;
        });
      }
    });

    const avgWaitTime = callerCount > 0 ? Math.floor(totalWaitTime / callerCount) : 0;

    setRealTimeStats({
      totalInQueue,
      avgWaitTime,
      longestWait,
      abandonmentRate: 5.2 // This would come from actual analytics
    });
  };

  const handleQueueUpdate = (data) => {
    setQueues(prev => ({ ...prev, ...data }));
    calculateStats({ ...queues, ...data });
  };

  const handleCallerJoined = (data) => {
    setQueues(prev => ({
      ...prev,
      [data.queueName]: [...(prev[data.queueName] || []), data.caller]
    }));
  };

  const handleCallerLeft = (data) => {
    setQueues(prev => ({
      ...prev,
      [data.queueName]: prev[data.queueName]?.filter(caller => caller.callSid !== data.callSid) || []
    }));
  };

  const formatWaitTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getQueueHealth = (queue) => {
    const length = queue.length;
    if (length === 0) return { status: 'empty', color: '#10b981', label: 'Available' };
    if (length <= 3) return { status: 'light', color: '#f59e0b', label: 'Light Load' };
    if (length <= 7) return { status: 'moderate', color: '#f97316', label: 'Moderate Load' };
    return { status: 'heavy', color: '#ef4444', label: 'Heavy Load' };
  };

  return (
    <div className="queue-monitor">
      <div className="queue-header">
        <h2>Queue Monitor</h2>
        <div className="queue-stats">
          <div className="stat-item">
            <Users size={16} />
            <span>{realTimeStats.totalInQueue} in queue</span>
          </div>
          <div className="stat-item">
            <Clock size={16} />
            <span>Avg wait: {formatWaitTime(realTimeStats.avgWaitTime)}</span>
          </div>
          <div className="stat-item">
            <AlertCircle size={16} />
            <span>{realTimeStats.abandonmentRate}% abandonment</span>
          </div>
        </div>
      </div>

      <div className="queue-grid">
        {Object.entries(queues).map(([queueName, queue]) => {
          const health = getQueueHealth(queue);
          const isSelected = selectedQueue === queueName;

          return (
            <div
              key={queueName}
              className={`queue-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedQueue(isSelected ? null : queueName)}
            >
              <div className="queue-card-header">
                <div className="queue-title">
                  <h3>{queueName.charAt(0).toUpperCase() + queueName.slice(1)}</h3>
                  <span className="queue-badge" style={{ backgroundColor: health.color }}>
                    {health.label}
                  </span>
                </div>
                <div className="queue-metrics">
                  <div className="metric">
                    <Users size={14} />
                    <span>{queue.length}</span>
                  </div>
                  <div className="metric">
                    <Clock size={14} />
                    <span>{queue.length > 0 ? formatWaitTime(
                      Math.floor((Date.now() - new Date(queue[0]?.queuedAt)) / 1000)
                    ) : '0s'}</span>
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="queue-details">
                  <div className="queue-callers">
                    {queue.length === 0 ? (
                      <div className="empty-queue">
                        <Phone size={24} />
                        <p>No callers in queue</p>
                      </div>
                    ) : (
                      queue.map((caller, index) => {
                        const waitTime = Math.floor((Date.now() - new Date(caller.queuedAt)) / 1000);
                        return (
                          <div key={caller.callSid} className="caller-item">
                            <div className="caller-info">
                              <div className="caller-position">#{index + 1}</div>
                              <div className="caller-details">
                                <span className="caller-phone">{caller.phoneNumber}</span>
                                <span className="caller-wait">Waiting {formatWaitTime(waitTime)}</span>
                              </div>
                            </div>
                            <div className="caller-actions">
                              <button className="btn-icon" title="Transfer to agent">
                                <ArrowUpRight size={16} />
                              </button>
                              <button className="btn-icon" title="Priority boost">
                                <TrendingUp size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="queue-actions">
                    <button className="btn btn-primary">
                      <UserPlus size={16} />
                      Add Agent
                    </button>
                    <button className="btn btn-secondary">
                      <AlertCircle size={16} />
                      Clear Queue
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(queues).length === 0 && (
        <div className="empty-state">
          <Users size={48} />
          <h3>No Active Queues</h3>
          <p>Queue data will appear when calls are received</p>
        </div>
      )}
    </div>
  );
};

export default QueueMonitor;
