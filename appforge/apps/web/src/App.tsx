import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { routes } from '@/routes';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import {
  AccessDeniedPage, ForgotPasswordPage, InvitationPage, RegisterPage, ResetPasswordPage,
  SessionExpiredPage, SignInPage, SuspendedPage, TwoFactorPlaceholderPage, VerifyEmailPage,
} from '@/pages/auth/auth-pages';
import { WorkspaceSelectPage } from '@/pages/WorkspaceSelectPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ApplicationsPage } from '@/pages/applications/ApplicationsPage';
import { NewApplicationPage } from '@/pages/applications/NewApplicationPage';
import { AiGeneratorPage } from '@/pages/applications/AiGeneratorPage';
import { BuilderPage } from '@/pages/builder/BuilderPage';
import { WorkflowEditorPage } from '@/pages/builder/WorkflowEditorPage';
import { PreviewPage } from '@/pages/PreviewPage';
import { AppDataPage, DataHubPage } from '@/pages/data/DataPages';
import { AuditLogsPage, NotificationsPage, UsersPage, WorkflowsOverviewPage } from '@/pages/workspace/WorkspacePages';
import { MarketplacePage, PurchasesPage, SellerDashboardPage, TemplateDetailPage } from '@/pages/marketplace/MarketplacePages';
import { SettingsPage } from '@/pages/settings/SettingsPages';
import { PortalAppPage, PortalHomePage } from '@/pages/portal/PortalPages';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Route guard: requires a session; sends the user to sign-in otherwise. */
function RequireAuth() {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to={routes.signIn} state={{ from: location.pathname }} replace />;
  return <Outlet />;
}

/** Route guard: additionally requires a selected workspace. */
function RequireWorkspace() {
  const { session, workspace } = useAuth();
  if (!session) return <Navigate to={routes.signIn} replace />;
  if (!workspace) return <Navigate to={routes.selectWorkspace} replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      {/* Authentication */}
      <Route element={<AuthLayout />}>
        <Route path={routes.signIn} element={<SignInPage />} />
        <Route path={routes.register} element={<RegisterPage />} />
        <Route path={routes.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={routes.resetPassword} element={<ResetPasswordPage />} />
        <Route path={routes.verifyEmail} element={<VerifyEmailPage />} />
        <Route path={routes.invitation} element={<InvitationPage />} />
        <Route path={routes.accessDenied} element={<AccessDeniedPage />} />
        <Route path={routes.suspended} element={<SuspendedPage />} />
        <Route path={routes.sessionExpired} element={<SessionExpiredPage />} />
        <Route path="/auth/two-factor" element={<TwoFactorPlaceholderPage />} />
      </Route>

      {/* Workspace selection */}
      <Route element={<RequireAuth />}>
        <Route path={routes.selectWorkspace} element={<WorkspaceSelectPage />} />
      </Route>

      {/* Full-screen builder and preview (workspace required, own chrome) */}
      <Route element={<RequireWorkspace />}>
        <Route path={routes.builder()} element={<BuilderPage />} />
        <Route path={routes.builderWorkflow()} element={<WorkflowEditorPage />} />
        <Route path={routes.preview()} element={<PreviewPage />} />
      </Route>

      {/* Customer portal runtime */}
      <Route element={<RequireAuth />}>
        <Route path={routes.portal()} element={<PortalHomePage />} />
        <Route path={routes.portalApp()} element={<PortalAppPage />} />
        <Route path={routes.portalPage()} element={<PortalAppPage />} />
      </Route>

      {/* Main dashboard shell */}
      <Route element={<RequireWorkspace />}>
        <Route element={<DashboardLayout />}>
          <Route path={routes.dashboard} element={<DashboardPage />} />
          <Route path={routes.applications} element={<ApplicationsPage />} />
          <Route path={routes.newApplication} element={<NewApplicationPage />} />
          <Route path={routes.aiGenerator} element={<AiGeneratorPage />} />
          <Route path={routes.data} element={<DataHubPage />} />
          <Route path={routes.appData()} element={<AppDataPage />} />
          <Route path={routes.workflows} element={<WorkflowsOverviewPage />} />
          <Route path={routes.users} element={<UsersPage />} />
          <Route path={routes.marketplace} element={<MarketplacePage />} />
          <Route path={routes.template()} element={<TemplateDetailPage />} />
          <Route path={routes.purchases} element={<PurchasesPage />} />
          <Route path={routes.seller} element={<SellerDashboardPage />} />
          <Route path={routes.notifications} element={<NotificationsPage />} />
          <Route path={routes.auditLogs} element={<AuditLogsPage />} />
          <Route path={routes.settings} element={<SettingsPage />} />
          <Route path={routes.billing} element={<SettingsPage initialTab="billing" />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
