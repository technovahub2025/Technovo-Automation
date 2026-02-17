import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./pages/authcontext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import TeamInbox from "./pages/TeamInbox";
import Broadcast from "./pages/Broadcast";
import Templates from "./pages/Templates";
import CreateTemplate from "./pages/CreateTemplate";
import Contacts from "./pages/Contacts";
import VoiceAutomation from "./pages/VoiceAutomation";
import InboundCalls from "./components/inbound/InboundCalls";
import OutboundCall from "./pages/OutboundCall";
import CallHistory from "./pages/CallHistory";
import VoiceBroadcast from "./pages/VoiceBroadcast/VoiceBroadcast";
import MissedCalls from "./pages/MissedCalls";
import EmailAutomation from "./pages/EmailAutomation";
import PDFExtractor from "./pages/PDFExtractor";
import Login from "./pages/login";
import Register from "./pages/register";
import AdminMultiStep from "./pages/admin";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";
import BroadcastDashboard from "./pages/BroadcastDashboard";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* App layout with nested routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<TeamInbox />} />
          <Route path="inbox/:conversationId" element={<TeamInbox />} />
          <Route path="broadcast-dashboard" element={<BroadcastDashboard />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="broadcast/new" element={<Broadcast chooserMode />} />
          <Route path="broadcast/new/template" element={<Broadcast composerMode composerType="template" />} />
          <Route path="broadcast/new/message" element={<Broadcast composerMode composerType="custom" />} />
          <Route path="templates" element={<Templates />} />
          <Route path="templates/create" element={<CreateTemplate />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="voice-automation" element={<VoiceAutomation />} />
          <Route path="voice-automation/inbound" element={<InboundCalls />} />
          <Route path="voice-automation/outbound" element={<OutboundCall />} />
          <Route path="voice-automation/history" element={<CallHistory />} />
          <Route path="voice-broadcast" element={<VoiceBroadcast />} />
          <Route path="missedcalls" element={<MissedCalls />} />
          <Route path="email-automation" element={<EmailAutomation />} />
          <Route path="pdf-extractor" element={<PDFExtractor />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredRole="superadmin">
                <AdminMultiStep />
              </ProtectedRoute>
            }
          />
        </Route>
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
