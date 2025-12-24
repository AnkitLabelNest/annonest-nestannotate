import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { updatePassword } from "@/lib/auth";
import { Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(true);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) {
      setHasValidToken(false);
    }
  }, []);

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    
    try {
      await updatePassword(data.password);
      setIsSuccess(true);
      setTimeout(() => {
        setLocation("/");
      }, 3000);
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Failed to reset password",
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
            <h2 className="text-2xl font-bold">Set New Password</h2>
            <p className="text-muted-foreground mt-1">Enter your new password below</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Choose a strong password for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasValidToken ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium">Invalid or Expired Link</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This password reset link is invalid or has expired.
                    </p>
                  </div>
                  <Link href="/forgot-password">
                    <Button className="w-full" data-testid="button-request-new">
                      Request New Link
                    </Button>
                  </Link>
                </div>
              ) : isSuccess ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">Password Updated</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your password has been reset successfully. Redirecting to login...
                    </p>
                  </div>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="password"
                                placeholder="Enter new password"
                                className="pl-10"
                                data-testid="input-password"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="password"
                                placeholder="Confirm new password"
                                className="pl-10"
                                data-testid="input-confirm-password"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.formState.errors.root && (
                      <p className="text-sm text-destructive" data-testid="text-error">
                        {form.formState.errors.root.message}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                      data-testid="button-reset-password"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
