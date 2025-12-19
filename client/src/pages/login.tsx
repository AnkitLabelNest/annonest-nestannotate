import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginSchema, type LoginInput, userRoles, type UserRole } from "@shared/schema";
import { Loader2, Lock, User, ChevronRight } from "lucide-react";

const demoUsers: Record<UserRole, { username: string; password: string; displayName: string; email: string }> = {
  admin: { username: "admin", password: "admin123", displayName: "Alex Admin", email: "admin@annonest.com" },
  manager: { username: "manager", password: "manager123", displayName: "Morgan Manager", email: "manager@annonest.com" },
  annotator: { username: "annotator", password: "annotator123", displayName: "Anna Annotator", email: "annotator@annonest.com" },
  qa: { username: "qa", password: "qa123", displayName: "Quinn QA", email: "qa@annonest.com" },
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | "">("");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        form.setError("root", { message: error.message || "Invalid credentials" });
        setIsLoading(false);
        return;
      }

      const { user } = await response.json();
      login({
        ...user,
        password: data.password,
      });
      setLocation("/dashboard");
    } catch {
      form.setError("root", { message: "Connection error. Please try again." });
    }

    setIsLoading(false);
  };

  const handleQuickLogin = (role: UserRole) => {
    const user = demoUsers[role];
    form.setValue("username", user.username);
    form.setValue("password", user.password);
    setSelectedRole(role);
  };

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
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to your account to continue</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Enter your credentials or select a demo account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="Enter username"
                              className="pl-10"
                              data-testid="input-username"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter password"
                              className="pl-10"
                              data-testid="input-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.formState.errors.root && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                      {form.formState.errors.root.message}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or use demo account
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {userRoles.map((role) => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleQuickLogin(role)}
                    className="capitalize"
                    data-testid={`button-demo-${role}`}
                  >
                    {role}
                  </Button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Demo accounts have different module access levels
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="p-4 text-center text-sm text-muted-foreground border-t border-border">
        AnnoNest Enterprise Platform - Role-Based Access Control Demo
      </footer>
    </div>
  );
}
