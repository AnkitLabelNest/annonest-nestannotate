import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";

import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import TrialLockedPage from "@/pages/trial-locked";
import DashboardPage from "@/pages/dashboard";
import AnnotatePage from "@/pages/annotate/index";
import TextLabelPage from "@/pages/annotate/text";
import ImageLabelPage from "@/pages/annotate/image";
import VideoLabelPage from "@/pages/annotate/video";
import TranscriptionPage from "@/pages/annotate/transcription";
import TranslationPage from "@/pages/annotate/translation";
import DemoDataNestPage from "@/pages/data/index";
import FirmsPage from "@/pages/data/firms";
import ContactsPage from "@/pages/data/contacts";
import FundsPage from "@/pages/data/funds";
import DealsPage from "@/pages/data/deals";
import ExtractionPage from "@/pages/extraction";
import IntelligencePage from "@/pages/intelligence";
import SettingsPage from "@/pages/settings";
import AdminUsersPage from "@/pages/admin/users";
import AdminOrganizationsPage from "@/pages/admin/organizations";
import DataNestDashboard from "@/pages/crm/index";
import PublicCompaniesPage from "@/pages/crm/public-companies";
import RelationshipsPage from "@/pages/crm/relationships";
import AgritechPage from "@/pages/crm/agritech";
import BlockchainPage from "@/pages/crm/blockchain";
import HealthcarePage from "@/pages/crm/healthcare";
import PublicMarketPage from "@/pages/crm/public-market";
import LocationManagementPage from "@/pages/settings/locations";
import NestAnnotatePage from "@/pages/nest-annotate";
import NestAnnotateProjectsPage from "@/pages/annotate/projects";
import NestAnnotateProjectDetailPage from "@/pages/annotate/project-detail";
import ShellProfilesPage from "@/pages/annotate/shell-profiles";
import NewsIntelligencePage from "@/pages/news-intelligence";
import NewsItemDetailPage from "@/pages/news-item-detail";
import ProjectViewPage from "@/pages/project-view";
import EntityProfilePage from "@/pages/entity-profile";
import DataNestProjectView from "@/pages/data/project-view";
import MyWorkPage from "@/pages/data/my-work";
import NewEntityPage from "@/pages/entity/new";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-3 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, isTrialLocked } = useAuth();

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    );
  }

  if (isTrialLocked) {
    return <TrialLockedPage />;
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/annotate" component={AnnotatePage} />
        <Route path="/annotate/text/:taskId" component={TextLabelPage} />
        <Route path="/annotate/image" component={ImageLabelPage} />
        <Route path="/annotate/video" component={VideoLabelPage} />
        <Route path="/annotate/transcription" component={TranscriptionPage} />
        <Route path="/annotate/translation" component={TranslationPage} />
        <Route path="/nest-annotate" component={NestAnnotatePage} />
        <Route path="/annotate/projects" component={NestAnnotateProjectsPage} />
        <Route path="/annotate/projects/:id" component={NestAnnotateProjectDetailPage} />
        <Route path="/annotate/shell-profiles" component={ShellProfilesPage} />
        <Route path="/news-intelligence" component={NewsIntelligencePage} />
        <Route path="/news/:taskId" component={NewsItemDetailPage} />
        <Route path="/projects/:projectId" component={ProjectViewPage} />
        <Route path="/demo" component={DemoDataNestPage} />
        <Route path="/demo/firms" component={() => <FirmsPage />} />
        <Route path="/demo/contacts" component={ContactsPage} />
        <Route path="/demo/funds" component={FundsPage} />
        <Route path="/demo/deals" component={DealsPage} />
        <Route path="/extraction" component={ExtractionPage} />
        <Route path="/intelligence" component={IntelligencePage} />
        <Route path="/data" component={DemoDataNestPage} />
        <Route path="/data/project/:id" component={DataNestProjectView} />
        <Route path="/data/my-work" component={MyWorkPage} />
        <Route path="/data/gps" component={() => <FirmsPage defaultTab="gp" />} />
        <Route path="/data/lps" component={() => <FirmsPage defaultTab="lp" />} />
        <Route path="/data/funds" component={FundsPage} />
        <Route path="/data/portfolio-companies" component={() => <FirmsPage defaultTab="portfolio-company" />} />
        <Route path="/data/service-providers" component={() => <FirmsPage defaultTab="service-provider" />} />
        <Route path="/data/contacts" component={ContactsPage} />
        <Route path="/data/deals" component={DealsPage} />
        <Route path="/data/public-companies" component={PublicCompaniesPage} />
        <Route path="/data/relationships" component={RelationshipsPage} />
        <Route path="/data/agritech" component={AgritechPage} />
        <Route path="/data/blockchain" component={BlockchainPage} />
        <Route path="/data/healthcare" component={HealthcarePage} />
        <Route path="/data/public-market" component={PublicMarketPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/organizations" component={AdminOrganizationsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/settings/locations" component={LocationManagementPage} />
        <Route path="/entity/:entityType/new" component={NewEntityPage} />
        <Route path="/entity/:entityType/:entityId" component={EntityProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
