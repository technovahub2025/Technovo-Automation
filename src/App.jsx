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
import OutboundCall from "./components/outbound/OutboundCall";
import OutboundSchedules from "./components/outbound/OutboundSchedules";
import CallAnalytics from "./components/inbound/ivr/CallAnalytics";

import VoiceBroadcast from "./pages/VoiceBroadcast/VoiceBroadcast";
import MissedCallsCallsPage from "./pages/MissedCallsCallsPage";
import MissedCallsAutomationPage from "./pages/MissedCallsAutomationPage";
import MissedCallsOverviewPage from "./pages/MissedCallsOverviewPage";
import EmailAutomation from "./pages/EmailAutomation";
import PDFExtractor from "./pages/PDFExtractor";
import Login from "./pages/login";
import Register from "./pages/register";
import AdminMultiStep from "./pages/admin";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";
import BroadcastDashboard from "./pages/BroadcastDashboard";
import AuthCallback from "./pages/AuthCallback";
import Billing from "./pages/Billing";
import Analytics from "./pages/Analytics";
import MetaVerification from "./pages/MetaVerification";
import WhatsAppCampaignBuilder from "./pages/WhatsAppCampaignBuilder";
import VoiceCampaignBuilder from "./pages/VoiceCampaignBuilder";
import RegisterDocuments from "./pages/RegisterDocuments";
import CampaignManagement from "./pages/campaignmanagement";





function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* App layout with nested routes */}
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}> 
          <Route index element={<Dashboard />} />
          <Route path="ads-manager" element={<CampaignManagement />} />
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
          <Route path="campaignmanagement" element={<CampaignManagement />} />
          <Route path="voice-automation" element={<VoiceAutomation />} />
          <Route path="voice-automation/inbound" element={<InboundCalls />} />
          <Route path="voice-automation/outbound" element={<OutboundCall />} />
          <Route path="voice-automation/outbound/schedules" element={<OutboundSchedules />} />
          <Route path="voice-automation/history" element={<CallAnalytics />} />

          <Route path="voice-broadcast" element={<VoiceBroadcast />} />
          <Route path="missedcalls" element={<Navigate to="/missedcalls/overview" replace />} />
          <Route path="missedcalls/overview" element={<MissedCallsOverviewPage />} />
          <Route path="missedcalls/calls" element={<MissedCallsCallsPage />} />
          <Route path="missedcalls/automation" element={<MissedCallsAutomationPage />} />
          <Route path="email-automation" element={<EmailAutomation />} />
          <Route path="pdf-extractor" element={<PDFExtractor />} />
          <Route path="billing" element={<Billing />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="verification" element={<MetaVerification />} />
          <Route path="register-docs" element={<RegisterDocuments />} />
          <Route path="whatsapp-builder" element={<WhatsAppCampaignBuilder />} />
          <Route path="voice-builder" element={<VoiceCampaignBuilder />} />
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

