import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/role-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Bell, Shield, Palette, Save, Moon, Sun, Users, Check, X, Clock } from "lucide-react";
import type { UserRole, User } from "@shared/schema";

type PendingGuest = Omit<User, "password">;

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const { data: pendingGuests = [], isLoading: loadingGuests } = useQuery<PendingGuest[]>({
    queryKey: ["/api/admin/pending-guests"],
    enabled: user?.role === "admin" || user?.role === "manager",
  });

  const approveMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/approve`, { newRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-guests"] });
      toast({ title: "User approved", description: "The user has been approved and can now access the platform." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve user", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-guests"] });
      toast({ title: "User rejected", description: "The user's access request has been rejected." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject user", variant: "destructive" });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information and role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {user ? getInitials(user.displayName) : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{user?.displayName || "Unknown"}</h3>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className="mt-1">
                <RoleBadge role={(user?.role as UserRole) || "annotator"} size="sm" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                defaultValue={user?.displayName}
                data-testid="input-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue={user?.email}
                data-testid="input-email"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize how the application looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark mode
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                data-testid="button-theme-light"
              >
                <Sun className="h-4 w-4 mr-1" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                data-testid="button-theme-dark"
              >
                <Moon className="h-4 w-4 mr-1" />
                Dark
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { id: "task", label: "Task Assignments", description: "Get notified when assigned new tasks", defaultChecked: true },
            { id: "review", label: "Review Requests", description: "Notifications for QA review requests", defaultChecked: true },
            { id: "changes", label: "URL Changes", description: "Alerts when monitored URLs have changes", defaultChecked: false },
            { id: "updates", label: "System Updates", description: "Information about new features and updates", defaultChecked: true },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={item.id}>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Switch id={item.id} defaultChecked={item.defaultChecked} data-testid={`switch-${item.id}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      {(user?.role === "admin" || user?.role === "manager") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              QA Settings
            </CardTitle>
            <CardDescription>Configure QA workflow settings (Manager/Admin only)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>QA Sampling Rate</Label>
                <span className="font-medium">20%</span>
              </div>
              <Slider defaultValue={[20]} max={100} step={5} data-testid="slider-qa-rate" />
              <p className="text-sm text-muted-foreground">
                Percentage of completed tasks that require QA review
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Confidence Score</Label>
                <p className="text-sm text-muted-foreground">
                  Annotators must provide confidence score for each task
                </p>
              </div>
              <Switch defaultChecked data-testid="switch-require-confidence" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-approve High Confidence</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically approve tasks with confidence above 95%
                </p>
              </div>
              <Switch data-testid="switch-auto-approve" />
            </div>
          </CardContent>
        </Card>
      )}

      {(user?.role === "admin" || user?.role === "manager") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pending User Approvals
              {pendingGuests.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingGuests.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review and approve new users who signed up for a trial
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingGuests ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : pendingGuests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending approvals</p>
                <p className="text-sm">New user signups will appear here for review</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                    data-testid={`pending-guest-${guest.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-muted">
                          {getInitials(guest.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{guest.displayName}</div>
                        <div className="text-sm text-muted-foreground">{guest.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Signed up {guest.createdAt ? new Date(guest.createdAt).toLocaleDateString() : "recently"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(guest.id)}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-${guest.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ userId: guest.id, newRole: "annotator" })}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${guest.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button data-testid="button-save-settings">
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
