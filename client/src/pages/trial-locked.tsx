import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Clock, LogOut, Mail } from "lucide-react";

export default function TrialLockedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            AN
          </div>
          <div>
            <h1 className="font-semibold text-lg">AnnoNest</h1>
            <p className="text-xs text-muted-foreground">Data Annotation & Intelligence Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={logout} data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-1" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-xl">Trial Period Ended</CardTitle>
              <CardDescription>
                Your 5-minute trial has expired
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center text-muted-foreground">
                <p className="mb-4">
                  Thank you for trying AnnoNest, <span className="font-medium text-foreground">{user?.displayName}</span>!
                </p>
                <p className="text-sm">
                  Your account is pending approval from an administrator. 
                  Once approved, you will be able to access the full platform.
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50 text-sm">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">What happens next?</p>
                    <p className="text-muted-foreground mt-1">
                      An administrator will review your registration and grant you access.
                      You will be able to log in once your account is approved.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button variant="outline" onClick={logout} className="w-full" data-testid="button-sign-out">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out and Try Again Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
