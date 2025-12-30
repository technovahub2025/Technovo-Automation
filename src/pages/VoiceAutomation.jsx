import React from "react";
import { PhoneCall, Mic, Bot } from "lucide-react";
import "./VoiceAutomation.css";

const VoiceAutomation = () => {
  return (
    <div className="voice-automation">
      <h2>Voice Automation</h2>
      <p className="subtitle">
        Setup AI voice calls, auto responses, and call workflows
      </p>

      <div className="voice-cards">
        <div className="voice-card">
          <PhoneCall size={28} />
          <h4>Inbound Calls</h4>
          <p>Automatically answer customer calls using AI voice bot.</p>
        </div>

        <div className="voice-card">
          <Mic size={28} />
          <h4>Outbound Calls</h4>
          <p>Trigger automated voice calls for reminders or follow-ups.</p>
        </div>

        <div className="voice-card">
          <Bot size={28} />
          <h4>Voice Bot Flow</h4>
          <p>Create voice conversation flows with AI logic.</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceAutomation;
