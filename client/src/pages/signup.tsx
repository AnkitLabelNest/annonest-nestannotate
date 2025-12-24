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
import { isSupabaseConfigured, signUp as supabaseSignUp } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { signupSchema, type SignupInput } from "@shared/schema";
import { Loader2, Lock, Mail, ChevronRight, User } from "lucide-react";

interface SignupResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    displayName: string;
    avatar: string | null;
    qaPercentage: number;
    isActive: boolean;
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

async function signUpWithBackend(data: SignupInput, accessToken?: string): Promise<SignupResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Signup failed" }));
    throw new Error(error.message || "Could not create account");
  }
  
  return response.json();
}

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
    },
  });

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);
    
    try {
      let backendResponse;
      const configured = await isSupabaseConfigured();
      
      if (configured) {
        const { user: supabaseUser, session } = await supabaseSignUp(data.email, data.password, data.displayName);
        
        if (!supabaseUser) {
          form.setError("root", { message: "Could not create account" });
          setIsLoading(false);
          return;
        }

        backendResponse = await signUpWithBackend(
          {
            email: data.email,
            password: data.password,
            displayName: data.displayName,
            supabaseId: supabaseUser.id,
          },
          session?.access_token
        );
      } else {
        backendResponse = await signUpWithBackend({
          email: data.email,
          password: data.password,
          displayName: data.displayName,
        });
      }
      
      const { user, trialStatus } = backendResponse;
      
      login({
        id: user.id,
        username: user.username || data.email,
        password: data.password,
        email: user.email || data.email,
        role: (user.role || "annotator") as "admin" | "manager" | "researcher" | "annotator" | "qa" | "guest",
        displayName: user.displayName || data.displayName,
        avatar: user.avatar || null,
        qaPercentage: user.qaPercentage || 20,
        isActive: user.isActive ?? true,
        orgId: (user as any).orgId || "",
        supabaseId: (user as any).supabaseId || null,
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
        message: error instanceof Error ? error.message : "Could not create account" 
      });
    }

    setIsLoading(false);
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
            <h2 className="text-2xl font-bold">Create an Account</h2>
            <p className="text-muted-foreground mt-1">Sign up to get started with AnnoNest</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign Up</CardTitle>
              <CardDescription>
                Enter your details to create a new account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="text"
                              placeholder="Enter your name"
                              className="pl-10"
                              data-testid="input-display-name"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
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
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Create a password (min 6 characters)"
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
                    data-testid="button-signup"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/" className="text-primary hover:underline" data-testid="link-login">
                      Sign in
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
