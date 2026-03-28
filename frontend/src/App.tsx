import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import TemplateBuilder from "@/pages/TemplateBuilder";
import Programs from "@/pages/Programs";
import ProgramBuilder from "@/pages/ProgramBuilder";
import ProgramDetail from "@/pages/ProgramDetail";
import Workout from "@/pages/Workout";
import ExerciseLog from "@/pages/ExerciseLog";
import Dashboard from "@/pages/Dashboard";
import Exercises from "@/pages/Exercises";
import Profile from "@/pages/Profile";

function AppContent() {
  return (
    <ProtectedRoute>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Navigate to="/programs" replace />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/new" element={<ProgramBuilder />} />
        <Route path="/programs/:id" element={<ProgramDetail />} />
        <Route path="/templates/new" element={<TemplateBuilder />} />
        <Route path="/templates/:id" element={<TemplateBuilder />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/:id/log" element={<ExerciseLog />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <InstallPrompt />
      <BottomNav />
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
