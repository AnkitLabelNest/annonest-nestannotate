import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { signIn as supabaseSignIn } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginSchema, type LoginInput } from "@shared/schema";
import { Loader2, Lock, Mail, ChevronRight } from "lucide-react";

interface LoginResponse {
  user: any;
  modules?: any[];
  trialStatus?: {
    isTrialExpired: boolean;
    isApproved: boolean;
    trialEndsAt: string | null;
  } | null;
  message?: string;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      /** 1️⃣ Supabase authentication */
      const { user: supabaseUser, session } = await supabaseSignIn(
        data.username,
        data.password
      );

      if (!supabaseUser || !session) {
        throw new Error("Invalid email or password");
      }

      /** 2️⃣ Backend sync */
      const res = await fetch("/api/auth/supabase-login", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

const text = await res.text();
const result: LoginResponse = text ? JSON.parse(text) : {};

console.log("backend login result", result);


      /** ❗ Handle backend errors but KEEP payload */
      if (!res.ok && !result?.user) {
        throw new Error(result?.message || "Authentication failed");
      }

     if (!result?.user) {
  throw new Error(result?.message || "Could not sync with backend");
}

      const { user, trialStatus } = result;

      /** 3️⃣ Final login */
      login(
        {
          id: user.id,
          username: user.username || user.email,
          password: data.password,
          email: user.email,
          role: user.role,
          displayName: user.displayName || user.username || user.email,
          avatar: user.avatar || null,
          qaPercentage: user.qaPercentage ?? 20,
          isActive: user.isActive,
          orgId: user.orgId || "",
          supabaseId: user.supabaseId || null,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          trialEndsAt: user.trialEndsAt
            ? new Date(user.trialEndsAt)
            : null,
          approvalStatus: user.approvalStatus ?? null,
          approvedBy: user.approvedBy ?? null,
          approvedAt: user.approvedAt
            ? new Date(user.approvedAt)
            : null,
        },
        trialStatus
          ? {
              isTrialExpired: trialStatus.isTrialExpired,
              isApproved: trialStatus.isApproved,
              trialEndsAt: trialStatus.trialEndsAt
                ? new Date(trialStatus.trialEndsAt)
                : null,
            }
          : null
      );

      setLocation("/dashboard");
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Login failed",
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
            <p className="text-xs text-muted-foreground">
              Data Annotation & Intelligence Platform
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Enter your email and password to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                            <Input
                              {...field}
                              type="email"
                              className="pl-10"
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
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                            <Input
                              {...field}
                              type="password"
                              className="pl-10"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.formState.errors.root && (
                    <div className="text-sm text-destructive">
                      {form.formState.errors.root.message}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
