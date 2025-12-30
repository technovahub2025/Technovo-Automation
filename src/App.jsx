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
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
