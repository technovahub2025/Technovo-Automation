import React, { useState } from 'react';
import { Phone, ArrowLeft, Loader } from 'lucide-react';
import { apiService } from '../services/api';
import './OutboundCall.css';

const OutboundCall = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleMakeCall = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiService.makeOutboundCall(phoneNumber);
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to make call');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="outbound-call">
      <button 
        className="back-button"
        onClick={() => window.history.back()}
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="call-container">
        <div className="call-header">
          <Phone size={40} />
          <h2>Make Outbound Call</h2>
          <p>Trigger automated voice call with AI assistant</p>
        </div>

        <form onSubmit={handleMakeCall} className="call-form">
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              disabled={loading}
            />
            <small>Include country code (e.g., +1 for US)</small>
          </div>

          <button 
            type="submit" 
            className="call-button"
            disabled={loading || !phoneNumber}
          >
            {loading ? (
              <>
                <Loader size={20} className="spinner" />
                Calling...
              </>
            ) : (
              <>
                <Phone size={20} />
                Make Call
              </>
            )}
          </button>
        </form>

        {/* Success Result */}
        {result && (
          <div className="result success">
            <h3>✅ Call Initiated</h3>
            <p>Call SID: <code>{result.call_sid}</code></p>
            <p>Status: <strong>{result.status}</strong></p>
          </div>
        )}

        {/* Error Result */}
        {error && (
          <div className="result error">
            <h3>❌ Call Failed</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Info Box */}
        <div className="info-box">
          <h4>ℹ️ How it works</h4>
          <ul>
            <li>Enter the recipient's phone number</li>
            <li>Call is made via Twilio to the number</li>
            <li>AI assistant answers and has conversation</li>
            <li>Full conversation is saved to database</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OutboundCall;