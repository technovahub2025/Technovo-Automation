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
import UsersListPage from "./pages/superadmin/UsersListPage";
import AdminSetupPage from "./pages/superadmin/AdminSetupPage";
import PaymentsDetailsPage from "./pages/superadmin/PaymentsDetailsPage";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";
import BroadcastDashboard from "./pages/BroadcastDashboard";
import AuthCallback from "./pages/AuthCallback";
import MetaVerification from "./pages/MetaVerification";
import RegisterDocuments from "./pages/RegisterDocuments";
import CampaignManagement from "./pages/campaignmanagement";
import Insights from "./pages/Insights";
import MetaConnect from "./pages/MetaConnect";





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
          <Route path="ads-manager" element={<ProtectedRoute requiredFeature="adsManager"><CampaignManagement /></ProtectedRoute>} />
          <Route path="meta-connect" element={<ProtectedRoute requiredFeature="metaConnect"><MetaConnect /></ProtectedRoute>} />
          <Route path="insights" element={<ProtectedRoute requiredFeature="analytics"><Insights /></ProtectedRoute>} />
          <Route path="inbox" element={<ProtectedRoute requiredFeature="teamInbox"><TeamInbox /></ProtectedRoute>} />
          <Route path="inbox/:conversationId" element={<ProtectedRoute requiredFeature="teamInbox"><TeamInbox /></ProtectedRoute>} />
          <Route path="broadcast-dashboard" element={<ProtectedRoute requiredFeature="broadcastDashboard"><BroadcastDashboard /></ProtectedRoute>} />
          <Route path="broadcast" element={<ProtectedRoute requiredFeature="broadcastMessaging"><Broadcast /></ProtectedRoute>} />
          <Route path="broadcast/new" element={<ProtectedRoute requiredFeature="broadcastMessaging"><Broadcast chooserMode /></ProtectedRoute>} />
          <Route path="broadcast/new/template" element={<ProtectedRoute requiredFeature="broadcastMessaging"><Broadcast composerMode composerType="template" /></ProtectedRoute>} />
          <Route path="broadcast/new/message" element={<ProtectedRoute requiredFeature="broadcastMessaging"><Broadcast composerMode composerType="custom" /></ProtectedRoute>} />
          <Route path="templates" element={<ProtectedRoute requiredFeature="templates"><Templates /></ProtectedRoute>} />
          <Route path="templates/create" element={<ProtectedRoute requiredFeature="templates"><CreateTemplate /></ProtectedRoute>} />
          <Route path="contacts" element={<ProtectedRoute requiredFeature="contacts"><Contacts /></ProtectedRoute>} />
          <Route path="campaignmanagement" element={<ProtectedRoute requiredFeature="adsManager"><CampaignManagement /></ProtectedRoute>} />
          <Route path="voice-automation" element={<Navigate to="/" replace />} />
          <Route path="voice-automation/inbound" element={<ProtectedRoute requiredFeature="inboundAutomation"><InboundCalls /></ProtectedRoute>} />
          <Route path="voice-automation/outbound" element={<ProtectedRoute requiredFeature="outboundVoice"><OutboundCall /></ProtectedRoute>} />
          <Route path="voice-automation/outbound/schedules" element={<ProtectedRoute requiredFeature="outboundVoice"><OutboundSchedules /></ProtectedRoute>} />
          <Route path="voice-automation/history" element={<ProtectedRoute requiredFeature="callAnalytics"><CallAnalytics /></ProtectedRoute>} />

          <Route path="voice-broadcast" element={<ProtectedRoute requiredFeature="voiceCampaign"><VoiceBroadcast /></ProtectedRoute>} />
          <Route path="missedcalls" element={<Navigate to="/missedcalls/overview" replace />} />
          <Route path="missedcalls/overview" element={<ProtectedRoute requiredFeature="missedCall"><MissedCallsOverviewPage /></ProtectedRoute>} />
          <Route path="missedcalls/calls" element={<ProtectedRoute requiredFeature="missedCall"><MissedCallsCallsPage /></ProtectedRoute>} />
          <Route path="missedcalls/automation" element={<ProtectedRoute requiredFeature="missedCall"><MissedCallsAutomationPage /></ProtectedRoute>} />
          <Route path="email-automation" element={<ProtectedRoute requiredFeature="workflowAutomation"><EmailAutomation /></ProtectedRoute>} />
          <Route path="pdf-extractor" element={<PDFExtractor />} />
          <Route path="verification" element={<MetaVerification />} />
          <Route path="register-docs" element={<RegisterDocuments />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredRole="superadmin">
                <AdminMultiStep />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute requiredRole="superadmin">
                <UsersListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/admin-setup"
            element={
              <ProtectedRoute requiredRole="superadmin">
                <AdminSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/payments"
            element={
              <ProtectedRoute requiredRole="superadmin">
                <PaymentsDetailsPage />
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

