import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import TeamInbox from './pages/TeamInbox';
import Broadcast from './pages/Broadcast';
import Templates from './pages/Templates';
import Contacts from './pages/Contacts';
import Automation from './pages/Automation';
import VoiceAutomation from "./pages/VoiceAutomation"
import OutboundCall from './pages/OutboundCall';
import CallHistory from './pages/CallHistory';
import MissedCalls from './pages/MissedCalls';
import EmailAutomation from './pages/EmailAutomation';
import PDFExtractor from './pages/PDFExtractor';
import VoiceBroadcast from './pages/VoiceBroadcast/VoiceBroadcast';

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<TeamInbox />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/voice-automation" element={<VoiceAutomation />} />
          <Route path="/missedcalls" element={<MissedCalls />} />
          <Route path="/email-automation" element={<EmailAutomation />} />
          <Route path="/pdf-extractor" element={<PDFExtractor />} />
          <Route path="/voice-automation/outbound" element={<OutboundCall />} />
          <Route path="/voice-automation/history" element={<CallHistory />} />
          <Route path="/voice-broadcast" element={<VoiceBroadcast />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
