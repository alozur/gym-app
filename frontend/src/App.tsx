import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import TemplateBuilder from "@/pages/TemplateBuilder";
import Programs from "@/pages/Programs";
import ProgramBuilder from "@/pages/ProgramBuilder";
import Workout from "@/pages/Workout";
import ExerciseLog from "@/pages/ExerciseLog";
import Dashboard from "@/pages/Dashboard";
import Exercises from "@/pages/Exercises";
import Profile from "@/pages/Profile";

function AppContent() {
  const location = useLocation();
  const hideNav =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/register");

  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/programs" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/programs"
          element={
            <ProtectedRoute>
              <Programs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/programs/new"
          element={
            <ProtectedRoute>
              <ProgramBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/programs/:id"
          element={
            <ProtectedRoute>
              <ProgramBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/new"
          element={
            <ProtectedRoute>
              <TemplateBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/:id"
          element={
            <ProtectedRoute>
              <TemplateBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workout"
          element={
            <ProtectedRoute>
              <Workout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exercises"
          element={
            <ProtectedRoute>
              <Exercises />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exercises/:id/log"
          element={
            <ProtectedRoute>
              <ExerciseLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
      {!hideNav && <InstallPrompt />}
      {!hideNav && <BottomNav />}
    </>
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
