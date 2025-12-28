import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, UserRole } from "@shared/schema";
import { moduleAccessByRole } from "@shared/schema";

interface TrialStatus {
  isTrialExpired: boolean;
  isApproved: boolean;
  trialEndsAt: Date | null;
}

interface AuthContextType {
  user: User | null;
  login: (user: User, trialStatus?: TrialStatus | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasModuleAccess: (moduleId: string) => boolean;
  trialStatus: TrialStatus | null;
  isTrialLocked: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("annonest_user");
    const storedTrial = localStorage.getItem("annonest_trial_status");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        localStorage.setItem("userId", parsed.id);
        if (storedTrial) {
          const trialParsed = JSON.parse(storedTrial);
          setTrialStatus({
            ...trialParsed,
            trialEndsAt: trialParsed.trialEndsAt ? new Date(trialParsed.trialEndsAt) : null,
          });
        }
      } catch {
        localStorage.removeItem("annonest_user");
        localStorage.removeItem("annonest_trial_status");
        localStorage.removeItem("userId");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User, trialStatusData?: TrialStatus | null) => {
    setUser(userData);
    localStorage.setItem("annonest_user", JSON.stringify(userData));
    localStorage.setItem("userId", userData.id);
    if (trialStatusData !== undefined) {
      setTrialStatus(trialStatusData);
      if (trialStatusData) {
        localStorage.setItem("annonest_trial_status", JSON.stringify(trialStatusData));
      } else {
        localStorage.removeItem("annonest_trial_status");
      }
    }
  };

  const logout = () => {
    setUser(null);
    setTrialStatus(null);
    localStorage.removeItem("annonest_user");
    localStorage.removeItem("annonest_trial_status");
    localStorage.removeItem("userId");
  };

  const hasModuleAccess = (moduleId: string): boolean => {
    if (!user) return false;
    // Super admin has unrestricted access to ALL modules
    if (user.role === "super_admin") return true;
    const allowedModules = moduleAccessByRole[user.role as UserRole] || [];
    return allowedModules.includes(moduleId);
  };

  const isTrialLocked = Boolean(
    user?.role === "guest" && trialStatus?.isTrialExpired && !trialStatus?.isApproved
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
        hasModuleAccess,
        trialStatus,
        isTrialLocked,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
