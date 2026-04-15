import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./pages/authcontext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import MainLayout from "./layout/MainLayout";
import Login from "./pages/login";
import Register from "./pages/register";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";
import AuthCallback from "./pages/AuthCallback";
const PublicWhatsAppOptInDemo = lazy(() => import("./pages/PublicWhatsAppOptInDemo"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const TeamInbox = lazy(() => import("./pages/TeamInbox"));
const Broadcast = lazy(() => import("./pages/Broadcast"));
const Templates = lazy(() => import("./pages/Templates"));
const CreateTemplate = lazy(() => import("./pages/CreateTemplate"));
const Contacts = lazy(() => import("./pages/Contacts"));
const MissedCallsCallsPage = lazy(() => import("./pages/MissedCallsCallsPage"));
const MissedCallsAutomationPage = lazy(() => import("./pages/MissedCallsAutomationPage"));
const MissedCallsOverviewPage = lazy(() => import("./pages/MissedCallsOverviewPage"));
const BroadcastDashboard = lazy(() => import("./pages/BroadcastDashboard"));
const CampaignManagement = lazy(() => import("./pages/campaignmanagement"));
const Insights = lazy(() => import("./pages/Insights"));
const MetaConnect = lazy(() => import("./pages/MetaConnect"));
const CrmPipeline = lazy(() => import("./pages/CrmPipeline"));
const CrmTasks = lazy(() => import("./pages/CrmTasks"));
const InboundCalls = lazy(() => import("./components/inbound/InboundCalls"));
const OutboundCall = lazy(() => import("./components/outbound/OutboundCall"));
const OutboundSchedules = lazy(() => import("./components/outbound/OutboundSchedules"));
const CallAnalytics = lazy(() => import("./components/inbound/ivr/CallAnalytics"));
const VoiceBroadcast = lazy(() => import("./pages/VoiceBroadcast/VoiceBroadcast"));
const EmailAutomation = lazy(() => import("./pages/EmailAutomation"));
const PDFExtractor = lazy(() => import("./pages/PDFExtractor"));
const MetaVerification = lazy(() => import("./pages/MetaVerification"));
const RegisterDocuments = lazy(() => import("./pages/RegisterDocuments"));
const WhatsAppWorkflow = lazy(() => import("./pages/WhatsAppWorkflow"));
const AdminMultiStep = lazy(() => import("./pages/admin"));
const UsersListPage = lazy(() => import("./pages/superadmin/UsersListPage"));
const AdminSetupPage = lazy(() => import("./pages/superadmin/AdminSetupPage"));
const PaymentsDetailsPage = lazy(() => import("./pages/superadmin/PaymentsDetailsPage"));

const renderLazyRoute = (element, label = "Loading page...") => (
  <Suspense fallback={<div style={{ padding: 24 }}>{label}</div>}>{element}</Suspense>
);





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
        <Route
          path="/whatsapp-opt-in-demo"
          element={renderLazyRoute(<PublicWhatsAppOptInDemo />, "Loading opt-in demo...")}
        />

        {/* App layout with nested routes */}
        <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}> 
          <Route index element={renderLazyRoute(<Dashboard />, "Loading dashboard...")} />
          <Route path="ads-manager" element={renderLazyRoute(<CampaignManagement />, "Loading ads manager...")} />
          <Route path="meta-connect" element={renderLazyRoute(<MetaConnect />, "Loading Meta connect...")} />
          <Route path="insights" element={renderLazyRoute(<Insights />, "Loading insights...")} />
          <Route path="inbox" element={renderLazyRoute(<TeamInbox />, "Loading inbox...")} />
          <Route path="inbox/:conversationId" element={renderLazyRoute(<TeamInbox />, "Loading inbox...")} />
          <Route path="broadcast-dashboard" element={renderLazyRoute(<BroadcastDashboard />, "Loading broadcast dashboard...")} />
          <Route path="broadcast" element={renderLazyRoute(<Broadcast />, "Loading broadcast...")} />
          <Route path="broadcast/new" element={renderLazyRoute(<Broadcast chooserMode />, "Loading broadcast composer...")} />
          <Route path="broadcast/new/template" element={renderLazyRoute(<Broadcast composerMode composerType="template" />, "Loading template composer...")} />
          <Route path="broadcast/new/message" element={renderLazyRoute(<Broadcast composerMode composerType="custom" />, "Loading message composer...")} />
          <Route path="templates" element={renderLazyRoute(<Templates />, "Loading templates...")} />
          <Route path="templates/create" element={renderLazyRoute(<CreateTemplate />, "Loading template editor...")} />
          <Route path="contacts" element={renderLazyRoute(<Contacts />, "Loading contacts...")} />
          <Route path="crm/pipeline" element={renderLazyRoute(<CrmPipeline />, "Loading CRM pipeline...")} />
          <Route path="crm/tasks" element={renderLazyRoute(<CrmTasks />, "Loading CRM tasks...")} />
          <Route path="campaignmanagement" element={renderLazyRoute(<CampaignManagement />, "Loading campaign manager...")} />
          <Route
            path="whatsapp-workflow"
            element={renderLazyRoute(<WhatsAppWorkflow />, "Loading workflow...")}
          />
          <Route path="voice-automation" element={<Navigate to="/voice-automation/inbound" replace />} />
          <Route path="voice-automation/inbound" element={renderLazyRoute(<InboundCalls />, "Loading inbound automation...")} />
          <Route path="voice-automation/outbound" element={renderLazyRoute(<OutboundCall />, "Loading outbound automation...")} />
          <Route path="voice-automation/outbound/schedules" element={renderLazyRoute(<OutboundSchedules />, "Loading outbound schedules...")} />
          <Route path="voice-automation/history" element={renderLazyRoute(<CallAnalytics />, "Loading call analytics...")} />

          <Route
            path="voice-broadcast"
            element={
              <ProtectedRoute requiredFeature="voiceCampaign">
                {renderLazyRoute(<VoiceBroadcast />, "Loading voice broadcast...")}
              </ProtectedRoute>
            }
          />
          <Route path="missedcalls" element={<Navigate to="/missedcalls/overview" replace />} />
          <Route path="missedcalls/overview" element={renderLazyRoute(<MissedCallsOverviewPage />, "Loading missed calls overview...")} />
          <Route path="missedcalls/calls" element={renderLazyRoute(<MissedCallsCallsPage />, "Loading missed calls...")} />
          <Route path="missedcalls/automation" element={renderLazyRoute(<MissedCallsAutomationPage />, "Loading missed call automation...")} />
          <Route path="email-automation" element={renderLazyRoute(<EmailAutomation />, "Loading email automation...")} />
          <Route path="pdf-extractor" element={renderLazyRoute(<PDFExtractor />, "Loading PDF extractor...")} />
          <Route path="verification" element={renderLazyRoute(<MetaVerification />, "Loading verification...")} />
          <Route path="register-docs" element={renderLazyRoute(<RegisterDocuments />, "Loading documents...")} />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredRole="superadmin">
                {renderLazyRoute(<AdminMultiStep />, "Loading admin dashboard...")}
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute requiredRole="superadmin">
                {renderLazyRoute(<UsersListPage />, "Loading users...")}
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/admin-setup"
            element={
              <ProtectedRoute requiredRole="superadmin">
                {renderLazyRoute(<AdminSetupPage />, "Loading admin setup...")}
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/payments"
            element={
              <ProtectedRoute requiredRole="superadmin">
                {renderLazyRoute(<PaymentsDetailsPage />, "Loading payments...")}
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

