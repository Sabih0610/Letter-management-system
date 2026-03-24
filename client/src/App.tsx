import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { useAuth } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { IncomingPage } from "./pages/IncomingPage";
import { LoginPage } from "./pages/LoginPage";
import { NewEntryPage } from "./pages/NewEntryPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OutgoingDraftPage } from "./pages/OutgoingDraftPage";
import { ApprovalsWorkbenchPage } from "./pages/ApprovalsWorkbenchPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SearchPage } from "./pages/SearchPage";
import { SeriesDetailPage } from "./pages/SeriesDetailPage";
import { SeriesListPage } from "./pages/SeriesListPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";

function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="p-6 text-slate-600">Loading...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/new-entry" element={<NewEntryPage />} />
          <Route path="/series" element={<SeriesListPage />} />
          <Route path="/series/:seriesId" element={<SeriesDetailPage />} />
          <Route path="/incoming" element={<IncomingPage />} />
          <Route path="/outgoing" element={<OutgoingDraftPage />} />
          <Route path="/approvals" element={<ApprovalsWorkbenchPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
