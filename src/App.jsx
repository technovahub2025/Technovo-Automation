import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./pages/authcontext";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import MainLayout from "./layout/MainLayout";

import Dashboard from "./pages/Dashboard";
import TeamInbox from "./pages/TeamInbox";
import Broadcast from "./pages/Broadcast";
import Templates from "./pages/Templates";
import Contacts from "./pages/Contacts";
import VoiceAutomation from "./pages/VoiceAutomation";
import MissedCalls from "./pages/MissedCalls";
import EmailAutomation from "./pages/EmailAutomation";
import PDFExtractor from "./pages/PDFExtractor";

import Login from "./pages/login";
import Register from "./pages/register";
import AdminMultiStep from "./pages/admin";
import ForgotPassword from "./pages/forgotpassword";
import ResetPassword from "./pages/resetpassword";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* App layout */}
        <Route element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<TeamInbox />} />
          <Route path="broadcastdashboard" element={<Broadcast />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="templates" element={<Templates />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="voice-automation" element={<VoiceAutomation />} />
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
      </Routes>
    </AuthProvider>
  );
}

export default App;
