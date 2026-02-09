import React from "react";
import { Routes, Route } from "react-router-dom";

import { AuthProvider } from "./pages/authcontext";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import BroadcastDashboard from "./pages/BroadcastDashboard";
import TeamInbox from "./pages/TeamInbox";
import Broadcast from "./pages/Broadcast";
import Templates from "./pages/Templates";
import Contacts from "./pages/Contacts";
import VoiceAutomation from "./pages/VoiceAutomation";
import OutboundCall from "./pages/OutboundCall";
import CallLogs from "./pages/CallLogs";
import MissedCalls from "./pages/MissedCalls";
import EmailAutomation from "./pages/EmailAutomation";
import PDFExtractor from "./pages/PDFExtractor";
import VoiceBroadcast from "./pages/VoiceBroadcast/VoiceBroadcast";
import InboundCalls from "./components/inbound/InboundCalls";
import LeadsPage from "./pages/LeadsPage";

import Login from "./pages/login";
import Register from "./pages/register";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";
import AdminMultiStep from "./pages/admin";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<Login key={Date.now()} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />


          {/* App routes */}
          <Route
            path="/*"
            element={
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requiredRole="superadmin">
                        <AdminMultiStep />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/inbox" element={<TeamInbox />} />
                  <Route path="/broadcast" element={<Broadcast />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/automation" element={<Automation />} />
                  <Route path="/voice-automation" element={<VoiceAutomation />} />
                  <Route path="/missedcalls" element={<MissedCalls />} />
                  <Route path="/email-automation" element={<EmailAutomation />} />
                  <Route path="/pdf-extractor" element={<PDFExtractor />} />
                </Routes>
              </MainLayout>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
