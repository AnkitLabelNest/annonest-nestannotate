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
import TrialLockedPage from "@/pages/trial-locked";
import DashboardPage from "@/pages/dashboard";
import AnnotatePage from "@/pages/annotate/index";
import TextLabelPage from "@/pages/annotate/text";
import ImageLabelPage from "@/pages/annotate/image";
import VideoLabelPage from "@/pages/annotate/video";
import TranscriptionPage from "@/pages/annotate/transcription";
import TranslationPage from "@/pages/annotate/translation";
import DataNestPage from "@/pages/data/index";
import FirmsPage from "@/pages/data/firms";
import ContactsPage from "@/pages/data/contacts";
import FundsPage from "@/pages/data/funds";
import DealsPage from "@/pages/data/deals";
import ExtractionPage from "@/pages/extraction";
import IntelligencePage from "@/pages/intelligence";
import SettingsPage from "@/pages/settings";
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
        <Route path="/annotate/text" component={TextLabelPage} />
        <Route path="/annotate/image" component={ImageLabelPage} />
        <Route path="/annotate/video" component={VideoLabelPage} />
        <Route path="/annotate/transcription" component={TranscriptionPage} />
        <Route path="/annotate/translation" component={TranslationPage} />
        <Route path="/data" component={DataNestPage} />
        <Route path="/data/firms" component={FirmsPage} />
        <Route path="/data/contacts" component={ContactsPage} />
        <Route path="/data/funds" component={FundsPage} />
        <Route path="/data/deals" component={DealsPage} />
        <Route path="/extraction" component={ExtractionPage} />
        <Route path="/intelligence" component={IntelligencePage} />
        <Route path="/settings" component={SettingsPage} />
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
