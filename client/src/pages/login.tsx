import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth-context";
import { isSupabaseConfigured, signIn as supabaseSignIn } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Loader2, Lock, Mail, ChevronRight } from "lucide-react";

interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    displayName: string;
    avatar: string | null;
    qaPercentage: number;
    isActive: boolean;
    orgId: string;
    supabaseId?: string | null;
    createdAt?: string | null;
    trialEndsAt?: string | null;
    approvalStatus?: string | null;
    approvedBy?: string | null;
    approvedAt?: string | null;
  };
  trialStatus?: {
    isTrialExpired: boolean;
    isApproved: boolean;
    trialEndsAt: string | null;
  } | null;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

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
      const configured = await isSupabaseConfigured();
      if (!configured) {
        form.setError("root", { message: "Authentication service not configured" });
        setIsLoading(false);
        return;
      }

      const { user: supabaseUser, session } = await supabaseSignIn(data.username, data.password);
      
      if (!supabaseUser || !session) {
        form.setError("root", { message: "Invalid email or password. Please check your credentials." });
        setIsLoading(false);
        return;
      }

      const backendResponse = await fetch("/api/auth/supabase-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      let backendResult;
      try {
        backendResult = await backendResponse.json();
      } catch {
        throw new Error("Could not sync with backend");
      }

      if (!backendResponse.ok) {
        if (backendResponse.status === 403 && backendResult?.trialExpired && backendResult?.user) {
          const expiredUser = backendResult.user;
          const expiredTrialStatus = backendResult.trialStatus;
          
          login({
            id: expiredUser.id,
            username: expiredUser.username,
            password: data.password,
            email: expiredUser.email || "",
            role: expiredUser.role as "admin" | "manager" | "researcher" | "annotator" | "qa" | "guest",
            displayName: expiredUser.displayName || expiredUser.username,
            avatar: expiredUser.avatar || null,
            qaPercentage: expiredUser.qaPercentage || 20,
            isActive: expiredUser.isActive,
            orgId: expiredUser.orgId || "",
            supabaseId: expiredUser.supabaseId || null,
            createdAt: expiredUser.createdAt ? new Date(expiredUser.createdAt) : new Date(),
            trialEndsAt: expiredUser.trialEndsAt ? new Date(expiredUser.trialEndsAt) : null,
            approvalStatus: expiredUser.approvalStatus || "pending",
            approvedBy: expiredUser.approvedBy || null,
            approvedAt: expiredUser.approvedAt ? new Date(expiredUser.approvedAt) : null,
          }, expiredTrialStatus ? {
            isTrialExpired: expiredTrialStatus.isTrialExpired,
            isApproved: expiredTrialStatus.isApproved,
            trialEndsAt: expiredTrialStatus.trialEndsAt ? new Date(expiredTrialStatus.trialEndsAt) : null,
          } : { isTrialExpired: true, isApproved: false, trialEndsAt: null });

          setLocation("/dashboard");
          return;
        }
        throw new Error(backendResult?.message || "Authentication failed");
      }

      const { user, trialStatus } = backendResult as LoginResponse;
      
      login({
        id: user.id,
        username: user.username,
        password: data.password,
        email: user.email || "",
        role: user.role as "admin" | "manager" | "researcher" | "annotator" | "qa" | "guest",
        displayName: user.displayName || user.username,
        avatar: user.avatar || null,
        qaPercentage: user.qaPercentage || 20,
        isActive: user.isActive,
        orgId: user.orgId || "",
        supabaseId: user.supabaseId || null,
        createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
        trialEndsAt: user.trialEndsAt ? new Date(user.trialEndsAt) : null,
        approvalStatus: user.approvalStatus as "pending" | "approved" | "rejected" | null,
        approvedBy: user.approvedBy || null,
        approvedAt: user.approvedAt ? new Date(user.approvedAt) : null,
      }, trialStatus ? {
        isTrialExpired: trialStatus.isTrialExpired,
        isApproved: trialStatus.isApproved,
        trialEndsAt: trialStatus.trialEndsAt ? new Date(trialStatus.trialEndsAt) : null,
      } : null);

      setLocation("/dashboard");
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Invalid email or password",
      });
    } finally {
      setIsLoading(false);
    }
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
                Enter your email and password to continue
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="Enter your email"
                              className="pl-10"
                              data-testid="input-email"
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
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          <Link 
                            href="/forgot-password" 
                            className="text-xs text-muted-foreground hover:text-foreground"
                            data-testid="link-forgot-password"
                          >
                            Forgot password?
                          </Link>
                        </div>
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

                  <div className="text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link href="/signup" className="text-primary hover:underline" data-testid="link-signup">
                      Sign up
                    </Link>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="p-4 text-center text-sm text-muted-foreground border-t border-border">
        AnnoNest Enterprise Platform - Data Annotation & Intelligence
      </footer>
    </div>
  );
}
