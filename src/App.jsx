import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./pages/authcontext";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import TeamInbox from "./pages/TeamInbox";
import Broadcast from "./pages/Broadcast";
import Templates from "./pages/Templates";
import Contacts from "./pages/Contacts";
import Automation from "./pages/Automation";
import VoiceAutomation from "./pages/VoiceAutomation";
import OutboundCall from "./pages/OutboundCall";
import CallHistory from "./pages/CallHistory";
import MissedCalls from "./pages/MissedCalls";
import EmailAutomation from "./pages/EmailAutomation";
import PDFExtractor from "./pages/PDFExtractor";
import VoiceBroadcast from "./pages/VoiceBroadcast/VoiceBroadcast";
import InboundCalls from "./pages/InboundCalls";

import Login from "./pages/login";
import Register from "./pages/register";
import AdminMultiStep from "./pages/admin";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ===== PUBLIC ROUTES ===== */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* ===== PROTECTED APP ROUTES ===== */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="inbox" element={<TeamInbox />} />
            <Route path="broadcast" element={<Broadcast />} />
            <Route path="templates" element={<Templates />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="automation" element={<Automation />} />

            {/* Voice Automation */}
            <Route path="voice-automation" element={<VoiceAutomation />} />
            <Route path="voice-automation/inbound" element={<InboundCalls />} />
            <Route path="voice-automation/outbound" element={<OutboundCall />} />
            <Route path="voice-automation/history" element={<CallHistory />} />

            {/* Other Modules */}
            <Route path="inbound-calls" element={<InboundCalls />} />
            <Route path="missedcalls" element={<MissedCalls />} />
            <Route path="email-automation" element={<EmailAutomation />} />
            <Route path="pdf-extractor" element={<PDFExtractor />} />
            <Route path="voice-broadcast" element={<VoiceBroadcast />} />

            {/* Admin (role based) */}
            <Route
              path="admin"
              element={
                <ProtectedRoute requiredRole="superadmin">
                  <AdminMultiStep />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
