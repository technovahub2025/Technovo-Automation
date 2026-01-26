import React, { useState, useEffect } from 'react';
import { Bot, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import aiService from '../services/aiService';
import './SmartReplies.css';

const SmartReplies = ({ 
  conversationHistory, 
  lastMessage, 
  onReplySelect, 
  onSentimentAnalyzed,
  showSentiment = true 
}) => {
  const [replies, setReplies] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState({});

  useEffect(() => {
    if (lastMessage && lastMessage.trim()) {
      generateSmartReplies();
      if (showSentiment) {
        analyzeSentiment();
      }
    }
  }, [lastMessage]);

  const generateSmartReplies = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const smartReplies = await aiService.generateSmartReplies(
        conversationHistory || [], 
        lastMessage
      );
      setReplies(smartReplies);
    } catch (error) {
      console.error('Failed to generate smart replies:', error);
      setError('Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  const analyzeSentiment = async () => {
    try {
      const sentimentData = await aiService.analyzeSentiment(lastMessage);
      setSentiment(sentimentData);
      if (onSentimentAnalyzed) {
        onSentimentAnalyzed(sentimentData);
      }
    } catch (error) {
      console.error('Failed to analyze sentiment:', error);
    }
  };

  const handleReplySelect = (reply) => {
    if (onReplySelect) {
      onReplySelect(reply);
    }
    // Record feedback that this reply was used
    setFeedback(prev => ({ ...prev, [reply]: 'used' }));
  };

  const handleFeedback = (reply, isPositive) => {
    setFeedback(prev => ({ ...prev, [reply]: isPositive ? 'positive' : 'negative' }));
    // In a real app, you'd send this feedback to your analytics
    console.log(`Feedback for "${reply}": ${isPositive ? 'positive' : 'negative'}`);
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return '#22c55e';
      case 'negative': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  if (loading) {
    return (
      <div className="smart-replies loading">
        <div className="loading-content">
          <RefreshCw size={16} className="spinning" />
          <span>Generating smart replies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="smart-replies">
      {sentiment && showSentiment && (
        <div className="sentiment-analysis">
          <div className="sentiment-header">
            <Bot size={14} />
            <span>Message Analysis</span>
          </div>
          <div className="sentiment-details">
            <div className="sentiment-item">
              <span className="label">Sentiment:</span>
              <span 
                className="value" 
                style={{ color: getSentimentColor(sentiment.sentiment) }}
              >
                {sentiment.sentiment}
              </span>
              <span className="confidence">
                ({Math.round(sentiment.confidence * 100)}%)
              </span>
            </div>
            <div className="sentiment-item">
              <span className="label">Urgency:</span>
              <span 
                className="value"
                style={{ color: getUrgencyColor(sentiment.urgency) }}
              >
                {sentiment.urgency}
              </span>
            </div>
            {sentiment.keywords.length > 0 && (
              <div className="sentiment-item">
                <span className="label">Keywords:</span>
                <div className="keywords">
                  {sentiment.keywords.map((keyword, index) => (
                    <span key={index} className="keyword">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {replies.length > 0 && (
        <div className="smart-replies-container">
          <div className="replies-header">
            <Bot size={14} />
            <span>Suggested Replies</span>
            <button 
              className="refresh-btn"
              onClick={generateSmartReplies}
              disabled={loading}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="replies-list">
            {replies.map((reply, index) => (
              <div key={index} className="reply-item">
                <button
                  className="reply-button"
                  onClick={() => handleReplySelect(reply)}
                >
                  {reply}
                </button>
                <div className="reply-actions">
                  <button
                    className="feedback-btn"
                    onClick={() => handleFeedback(reply, true)}
                    title="Good suggestion"
                  >
                    <ThumbsUp 
                      size={12} 
                      className={feedback[reply] === 'positive' ? 'active' : ''}
                    />
                  </button>
                  <button
                    className="feedback-btn"
                    onClick={() => handleFeedback(reply, false)}
                    title="Bad suggestion"
                  >
                    <ThumbsDown 
                      size={12} 
                      className={feedback[reply] === 'negative' ? 'active' : ''}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="smart-replies-error">
          <span>{error}</span>
          <button onClick={generateSmartReplies}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartReplies;
