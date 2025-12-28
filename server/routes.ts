import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import { storage } from "./storage";
import {
  loginSchema,
  signupSchema,
  insertOrganizationSchema,
  insertFirmSchema,
  insertContactSchema,
  insertFundSchema,
  insertDealSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertAnnotationSchema,
  insertMonitoredUrlSchema,
  insertEntityGpSchema,
  insertEntityLpSchema,
  insertEntityFundSchema,
  insertEntityPortfolioCompanySchema,
  insertEntityServiceProviderSchema,
  insertEntityContactSchema,
  insertEntityDealSchema,
  moduleAccessByRole,
  type UserRole,
  type Firm,
} from "@shared/schema";
import { z } from "zod";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured. Some features may not work.");
}

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Client config endpoint - provides Supabase credentials at runtime
  app.get("/api/config", (req: Request, res: Response) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    });
  });

  // Health check endpoint for debugging
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      const dbCheck = await storage.getUserByUsername("admin");
      return res.json({
        status: "ok",
        database: dbCheck ? "connected" : "no admin user",
        supabase: supabase !== null ? "configured" : "not configured",
        environment: process.env.NODE_ENV || "unknown"
      });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: error?.message,
        database: "error",
        supabase: supabase !== null ? "configured" : "not configured"
      });
    }
  });

  function checkTrialStatus(user: { role: string; trialEndsAt: Date | null; approvalStatus: string | null }) {
    if (user.role !== "guest") {
      return { isTrialExpired: false, isApproved: true };
    }
    
    const isApproved = user.approvalStatus === "approved";
    const isTrialExpired = user.trialEndsAt ? new Date() > user.trialEndsAt : false;
    
    return { isTrialExpired, isApproved };
  }

  function getOrgIdByEmailDomain(email: string): string {
    // Labelnest org for @labelnest.in emails, Guest Firm for others
    if (email.endsWith("@labelnest.in")) {
      return "b650b699-16be-43bc-9119-0250cea2e44e"; // Labelnest
    }
    return "f971a315-dec1-4bcf-b098-af6e5abd32b5"; // Guest Firm
  }

  async function getUserOrgId(req: Request): Promise<string> {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new Error("UNAUTHORIZED");
    }
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("UNAUTHORIZED");
    }
    return user.orgId;
  }
  
  async function getUserOrgIdSafe(req: Request, res: Response): Promise<string | null> {
    try {
      return await getUserOrgId(req);
    } catch {
      res.status(401).json({ message: "Authentication required" });
      return null;
    }
  }

  // Get user with role info - super_admin gets special access
  async function getUserWithRole(req: Request): Promise<{ userId: string; orgId: string; role: string; isSuperAdmin: boolean } | null> {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return null;
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return null;
    }
    return {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      isSuperAdmin: user.role === "super_admin"
    };
  }

  // Get org filter for queries - super_admin can see all orgs, others see only their org
  async function getOrgFilter(req: Request): Promise<{ orgId: string | null; isSuperAdmin: boolean }> {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      throw new Error("UNAUTHORIZED");
    }
    // Super admin sees all data (null orgId means no filter)
    if (userInfo.isSuperAdmin) {
      return { orgId: null, isSuperAdmin: true };
    }
    return { orgId: userInfo.orgId, isSuperAdmin: false };
  }

  function getUserIdFromRequest(req: Request): string | null {
    return (req.headers["x-user-id"] as string) || null;
  }

  function addSourceTrackingFields(data: any, userId: string | null): any {
    return {
      ...data,
      lastUpdatedBy: userId,
      lastUpdatedOn: new Date(),
    };
  }

  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(parsed.username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      let passwordValid = false;
      if (user.password.startsWith("$2")) {
        passwordValid = await bcrypt.compare(parsed.password, user.password);
      } else {
        passwordValid = user.password === parsed.password;
      }
      
      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      const { isTrialExpired, isApproved } = checkTrialStatus(user);
      
      if (user.role === "guest" && isTrialExpired && !isApproved) {
        const { password: _pw, ...userWithoutPassword } = user;
        return res.status(403).json({ 
          message: "Your trial has expired. Please wait for an administrator to approve your account.",
          trialExpired: true,
          user: userWithoutPassword,
          trialStatus: { isTrialExpired, isApproved, trialEndsAt: user.trialEndsAt }
        });
      }

      const { password, ...userWithoutPassword } = user;
      return res.json({ 
        user: userWithoutPassword,
        modules: moduleAccessByRole[user.role as UserRole] || [],
        trialStatus: user.role === "guest" ? { isTrialExpired, isApproved, trialEndsAt: user.trialEndsAt } : null
      });
    } catch (error) {
      console.error("[LOGIN ERROR]", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ message: "Internal server error", details: errorMessage });
    }
  });

  // Supabase login - authenticates via Supabase token and syncs/creates local user
  app.post("/api/auth/supabase-login", async (req: Request, res: Response) => {
    try {
      if (!supabase) {
        return res.status(503).json({ message: "Supabase authentication not configured" });
      }
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authorization token required" });
      }

      const token = authHeader.substring(7);
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

      if (error || !supabaseUser) {
        return res.status(401).json({ message: "Invalid Supabase token" });
      }

      // Try to find user by supabaseId first, then by email
      let user = await storage.getUserBySupabaseId(supabaseUser.id);
      
      if (!user && supabaseUser.email) {
        user = await storage.getUserByEmail(supabaseUser.email);
        // If found by email but no supabaseId, link the accounts
        if (user && !user.supabaseId) {
          user = await storage.updateUser(user.id, { supabaseId: supabaseUser.id });
        }
        // If user was invited and is logging in for first time, activate them
        if (user && user.inviteStatus === "sent" && !user.isActive) {
          user = await storage.updateUser(user.id, { 
            isActive: true, 
            inviteStatus: "accepted",
            supabaseId: supabaseUser.id 
          });
        }
      }

      // If still no user, create one
      if (!user) {
        const displayName = supabaseUser.user_metadata?.displayName || 
                           supabaseUser.user_metadata?.full_name ||
                           supabaseUser.email?.split("@")[0] || 
                           "User";
        
        const email = supabaseUser.email || "";
        const orgId = getOrgIdByEmailDomain(email);
        
        user = await storage.createUserWithId(supabaseUser.id, {
          orgId,
          username: email || supabaseUser.id,
          password: await bcrypt.hash(crypto.randomUUID(), 10), // Random password for Supabase users
          email,
          displayName,
          role: "annotator",
          isActive: true,
          avatar: supabaseUser.user_metadata?.avatar_url || null,
          qaPercentage: 20,
          supabaseId: supabaseUser.id,
          createdAt: new Date(),
          trialEndsAt: null,
          approvalStatus: "approved",
          approvedBy: null,
          approvedAt: null,
        });
      }

      if (!user) {
        return res.status(500).json({ message: "Could not create or find user" });
      }

      // Activate invited user on first successful Supabase login
      if (!user.isActive && user.inviteStatus === "sent") {
        user = await storage.updateUser(user.id, { 
          isActive: true, 
          inviteStatus: "accepted" 
        });
      }

      if (!user?.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      const { isTrialExpired, isApproved } = checkTrialStatus(user);

      if (user.role === "guest" && isTrialExpired && !isApproved) {
        const { password: _pw, ...userWithoutPassword } = user;
        return res.status(403).json({
          message: "Your trial has expired. Please wait for an administrator to approve your account.",
          trialExpired: true,
          user: userWithoutPassword,
          trialStatus: { isTrialExpired, isApproved, trialEndsAt: user.trialEndsAt }
        });
      }

      const { password: _pw, ...userWithoutPassword } = user;
      return res.json({
        user: userWithoutPassword,
        modules: moduleAccessByRole[user.role as UserRole] || [],
        trialStatus: user.role === "guest" ? { isTrialExpired, isApproved, trialEndsAt: user.trialEndsAt } : null
      });
    } catch (error: any) {
      console.error("Supabase login error:", error?.message || error);
      return res.status(500).json({ 
        message: "Internal server error", 
        details: process.env.NODE_ENV !== "production" ? error?.message : undefined 
      });
    }
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const parsed = signupSchema.parse(req.body);
      
      let verifiedSupabaseId: string | undefined = undefined;
      
      if (parsed.supabaseId) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ message: "Authorization token required for Supabase signup" });
        }
        
        if (!supabase) {
          return res.status(500).json({ message: "Supabase not configured on server" });
        }
        
        const token = authHeader.substring(7);
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
        
        if (error || !supabaseUser) {
          return res.status(401).json({ message: "Invalid Supabase token" });
        }
        
        if (supabaseUser.id !== parsed.supabaseId) {
          return res.status(403).json({ message: "Supabase ID mismatch" });
        }
        
        verifiedSupabaseId = supabaseUser.id;
      }
      
      const existingUser = await storage.getUserByEmail(parsed.email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(parsed.password, 10);

      const isSupabaseUser = !!verifiedSupabaseId;
      const trialDurationMs = 5 * 60 * 1000;
      const orgId = getOrgIdByEmailDomain(parsed.email);
      
      const newUser = await storage.createUserWithId(
        verifiedSupabaseId,
        {
          orgId,
          username: parsed.email,
          password: hashedPassword,
          email: parsed.email,
          displayName: parsed.displayName,
          role: isSupabaseUser ? "annotator" : "guest",
          isActive: true,
          qaPercentage: 20,
          trialEndsAt: isSupabaseUser ? null : new Date(Date.now() + trialDurationMs),
          approvalStatus: isSupabaseUser ? "approved" : "pending",
        }
      );

      const { password, ...userWithoutPassword } = newUser;
      const { isTrialExpired, isApproved } = checkTrialStatus(newUser);
      
      return res.status(201).json({ 
        user: userWithoutPassword,
        modules: moduleAccessByRole[newUser.role as UserRole] || [],
        trialStatus: newUser.role === "guest" ? { isTrialExpired, isApproved, trialEndsAt: newUser.trialEndsAt } : null
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Signup error:", error);
      return res.status(500).json({ message: "Could not create account" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const { isTrialExpired, isApproved } = checkTrialStatus(user);
    
    if (user.role === "guest" && isTrialExpired && !isApproved) {
      const { password: _pw, ...userWithoutPassword } = user;
      return res.status(403).json({ 
        message: "Your trial has expired. Please wait for an administrator to approve your account.",
        trialExpired: true,
        user: userWithoutPassword,
        trialStatus: { isTrialExpired, isApproved, trialEndsAt: user.trialEndsAt }
      });
    }
    
    const { password, ...userWithoutPassword } = user;
    return res.json({ 
      user: userWithoutPassword,
      modules: moduleAccessByRole[user.role as UserRole] || [],
      trialStatus: user.role === "guest" ? { isTrialExpired, isApproved, trialEndsAt: user.trialEndsAt } : null
    });
  });

  // Users routes
  app.get("/api/users", async (req: Request, res: Response) => {
    const requesterId = req.headers["x-user-id"] as string;
    if (!requesterId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const requester = await storage.getUser(requesterId);
    if (!requester) {
      return res.status(403).json({ message: "User not found" });
    }
    
    let users;
    if (requester.role === "super_admin") {
      users = await storage.getUsers();
    } else if (requester.role === "admin" || requester.role === "manager") {
      users = await storage.getUsersByOrgId(requester.orgId);
    } else {
      return res.status(403).json({ message: "Not authorized to view users" });
    }
    
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    return res.json(usersWithoutPasswords);
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  });

  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin) {
      return res.status(403).json({ message: "Admin user not found" });
    }

    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (admin.role !== "super_admin" && targetUser.orgId !== admin.orgId) {
      return res.status(403).json({ message: "Cannot modify users from other organizations" });
    }
    
    if (req.body.orgId) {
      if (admin.role !== "super_admin") {
        return res.status(403).json({ message: "Only super admins can change user organizations" });
      }
      const targetOrg = await storage.getOrganization(req.body.orgId);
      if (!targetOrg) {
        return res.status(400).json({ message: "Target organization does not exist" });
      }
    }
    
    if (req.body.role && !["super_admin", "admin", "manager"].includes(admin.role)) {
      return res.status(403).json({ message: "Only super admins, admins and managers can change user roles" });
    }
    
    const updated = await storage.updateUser(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password, ...userWithoutPassword } = updated;
    return res.json(userWithoutPassword);
  });

  // Admin routes for guest management
  app.post("/api/admin/users/:id/approve", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || !["super_admin", "admin", "manager"].includes(admin.role)) {
      return res.status(403).json({ message: "Only super admins, admins and managers can approve users" });
    }

    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (admin.role !== "super_admin" && targetUser.orgId !== admin.orgId) {
      return res.status(403).json({ message: "Cannot approve users from other organizations" });
    }
    
    const { newRole } = req.body;
    const approved = await storage.approveUser(req.params.id, adminId, newRole);
    
    if (!approved) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const { password, ...userWithoutPassword } = approved;
    return res.json(userWithoutPassword);
  });

  app.post("/api/admin/users/:id/reject", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || !["super_admin", "admin", "manager"].includes(admin.role)) {
      return res.status(403).json({ message: "Only super admins, admins and managers can reject users" });
    }

    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (admin.role !== "super_admin" && targetUser.orgId !== admin.orgId) {
      return res.status(403).json({ message: "Cannot reject users from other organizations" });
    }
    
    const rejected = await storage.rejectUser(req.params.id, adminId);
    
    if (!rejected) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const { password, ...userWithoutPassword } = rejected;
    return res.json(userWithoutPassword);
  });

  app.post("/api/admin/users/invite", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || !["super_admin", "admin", "manager"].includes(admin.role)) {
      return res.status(403).json({ message: "Only super admins, admins and managers can invite users" });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ message: "Supabase admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY." });
    }

    const { email, displayName, orgId, role } = req.body;

    if (!email || !displayName || !orgId) {
      return res.status(400).json({ message: "Email, displayName, and orgId are required" });
    }

    if (admin.role !== "super_admin" && orgId !== admin.orgId) {
      return res.status(403).json({ message: "Cannot invite users to other organizations" });
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: `User with email ${email} already exists` });
    }

    const assignedRole = role || "annotator";
    const placeholderPassword = await bcrypt.hash(crypto.randomUUID(), 10);
    const pendingUser = await storage.createUser({
      username: email.split("@")[0] + "_" + Date.now(),
      email,
      displayName,
      password: placeholderPassword,
      role: assignedRole as UserRole,
      orgId,
      isActive: false,
      inviteStatus: "pending",
      invitedBy: adminId,
      invitedAt: new Date(),
    });

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        displayName,
        orgId,
        role: assignedRole,
        localUserId: pendingUser.id,
      },
    });

    if (error) {
      await storage.deleteUser(pendingUser.id);
      console.error("Supabase invite error:", error);
      return res.status(500).json({ message: `Failed to send invite: ${error.message}` });
    }

    const updatedUser = await storage.updateUser(pendingUser.id, {
      supabaseId: data.user.id,
      inviteStatus: "sent",
    });

    const { password, ...userWithoutPassword } = updatedUser!;
    return res.status(201).json({ 
      user: userWithoutPassword, 
      message: `Invitation sent to ${email}` 
    });
  });

  app.post("/api/admin/users/invite/:id/resend", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || !["super_admin", "admin", "manager"].includes(admin.role)) {
      return res.status(403).json({ message: "Only super admins, admins and managers can resend invites" });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ message: "Supabase admin client not configured" });
    }

    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (admin.role !== "super_admin" && targetUser.orgId !== admin.orgId) {
      return res.status(403).json({ message: "Cannot resend invites to users from other organizations" });
    }

    if (!targetUser.supabaseId) {
      return res.status(400).json({ message: "User was not invited via Supabase" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(targetUser.email, {
      data: {
        displayName: targetUser.displayName,
        orgId: targetUser.orgId,
        role: targetUser.role,
        localUserId: targetUser.id,
      },
    });

    if (error) {
      console.error("Supabase resend invite error:", error);
      return res.status(500).json({ message: `Failed to resend invite: ${error.message}` });
    }

    await storage.updateUser(targetUser.id, {
      inviteStatus: "sent",
      invitedAt: new Date(),
    });

    return res.json({ message: `Invitation resent to ${targetUser.email}` });
  });

  app.post("/api/admin/users/bulk", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || !["super_admin", "admin", "manager"].includes(admin.role)) {
      return res.status(403).json({ message: "Only super admins, admins and managers can add users" });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ message: "Supabase admin client not configured. Check SUPABASE_SERVICE_ROLE_KEY." });
    }

    const { users: usersToCreate } = req.body;

    if (!Array.isArray(usersToCreate) || usersToCreate.length === 0) {
      return res.status(400).json({ message: "No users provided" });
    }

    if (usersToCreate.length > 5) {
      return res.status(400).json({ message: "Maximum 5 users can be created at a time" });
    }

    const validatedUsers: Array<{email: string; displayName: string; orgId: string; role?: string}> = [];

    for (const u of usersToCreate) {
      if (!u.email || !u.displayName || !u.orgId) {
        return res.status(400).json({ message: "Each user must have email, displayName, and orgId" });
      }

      if (admin.role !== "super_admin" && u.orgId !== admin.orgId) {
        return res.status(403).json({ message: "Cannot add users to other organizations" });
      }

      const existingUser = await storage.getUserByEmail(u.email);
      if (existingUser) {
        return res.status(400).json({ message: `User with email ${u.email} already exists` });
      }

      validatedUsers.push({
        email: u.email,
        displayName: u.displayName,
        orgId: u.orgId,
        role: u.role || "annotator",
      });
    }

    const createdUsers = [];
    const inviteResults = [];

    for (const userData of validatedUsers) {
      const placeholderPassword = await bcrypt.hash(crypto.randomUUID(), 10);
      
      const newUser = await storage.createUser({
        username: userData.email.split("@")[0] + "_" + Date.now(),
        email: userData.email,
        displayName: userData.displayName,
        password: placeholderPassword,
        role: userData.role as UserRole,
        orgId: userData.orgId,
        isActive: false,
        inviteStatus: "pending",
        invitedBy: adminId,
        invitedAt: new Date(),
      });
      
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(userData.email, {
        data: {
          displayName: userData.displayName,
          orgId: userData.orgId,
          role: userData.role,
          localUserId: newUser.id,
        },
      });

      if (error) {
        await storage.deleteUser(newUser.id);
        inviteResults.push({ email: userData.email, success: false, error: error.message });
      } else {
        await storage.updateUser(newUser.id, {
          supabaseId: data.user.id,
          inviteStatus: "sent",
        });
        const { password, ...userWithoutPassword } = newUser;
        createdUsers.push({ ...userWithoutPassword, inviteStatus: "sent" });
        inviteResults.push({ email: userData.email, success: true });
      }
    }

    const successCount = inviteResults.filter(r => r.success).length;
    const failedInvites = inviteResults.filter(r => !r.success);

    return res.status(201).json({ 
      users: createdUsers, 
      message: `Successfully invited ${successCount} user(s)`,
      inviteResults,
      failedInvites: failedInvites.length > 0 ? failedInvites : undefined
    });
  });

  app.get("/api/admin/pending-guests", async (req: Request, res: Response) => {
    const requesterId = req.headers["x-user-id"] as string;
    if (!requesterId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const requester = await storage.getUser(requesterId);
    if (!requester) {
      return res.status(403).json({ message: "User not found" });
    }

    let pendingGuests;
    if (requester.role === "super_admin") {
      pendingGuests = await storage.getPendingGuests();
    } else if (requester.role === "admin" || requester.role === "manager") {
      pendingGuests = await storage.getPendingGuestsByOrgId(requester.orgId);
    } else {
      return res.status(403).json({ message: "Not authorized" });
    }

    const guestsWithoutPasswords = pendingGuests.map(({ password, ...user }) => user);
    return res.json(guestsWithoutPasswords);
  });

  // Organizations routes - admin only, returns orgs user can see
  app.get("/api/organizations", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || !["super_admin", "admin", "manager"].includes(admin.role)) {
      return res.status(403).json({ message: "Only super admins, admins and managers can view organizations" });
    }
    
    if (admin.role === "super_admin") {
      const orgs = await storage.getOrganizations();
      return res.json(orgs);
    } else {
      const org = await storage.getOrganization(admin.orgId);
      return res.json(org ? [org] : []);
    }
  });

  app.get("/api/organizations/user-counts", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || admin.role !== "super_admin") {
      return res.status(403).json({ message: "Only super admins can view organization user counts" });
    }
    
    const organizations = await storage.getOrganizations();
    const userCounts: Record<string, number> = {};
    
    for (const org of organizations) {
      const users = await storage.getUsersByOrgId(org.id);
      userCounts[org.id] = users.length;
    }
    
    return res.json(userCounts);
  });

  app.get("/api/organizations/:id", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || (admin.role !== "admin" && admin.role !== "manager")) {
      return res.status(403).json({ message: "Only admins and managers can view organizations" });
    }
    
    const org = await storage.getOrganization(req.params.id);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }
    return res.json(org);
  });

  app.post("/api/organizations", async (req: Request, res: Response) => {
    try {
      const adminId = req.headers["x-user-id"] as string;
      if (!adminId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const admin = await storage.getUser(adminId);
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ message: "Only admins can create organizations" });
      }
      
      const name = req.body.name;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Organization name is required" });
      }
      
      const org = await storage.createOrganization({ name: name.trim() });
      return res.status(201).json(org);
    } catch (error: any) {
      console.error("Error creating organization:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: error?.message || "Failed to create organization" });
    }
  });

  app.patch("/api/organizations/:id", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update organizations" });
    }
    
    const updated = await storage.updateOrganization(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Organization not found" });
    }
    return res.json(updated);
  });

  // Firms routes - using in-memory storage with org scoping
  app.get("/api/firms", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const firms = await storage.getFirms(orgId);
    return res.json(firms);
  });

  app.get("/api/firms/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const firm = await storage.getFirm(req.params.id, orgId);
    if (!firm) {
      return res.status(404).json({ message: "Firm not found" });
    }
    return res.json(firm);
  });

  app.post("/api/firms", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertFirmSchema.parse(req.body);
      
      const duplicates = await storage.findDuplicateFirms(orgId, parsed.name);
      
      if (duplicates.length > 0) {
        return res.status(409).json({ 
          message: "Potential duplicate firm found",
          duplicates
        });
      }
      
      const firm = await storage.createFirm({ ...parsed, orgId });
      
      await storage.createAuditLog({
        orgId,
        userId: req.headers["x-user-id"] as string || null,
        action: "create",
        entityType: "firm",
        entityId: firm.id,
        details: { name: firm.name },
      });
      
      return res.status(201).json(firm);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating firm:", error?.message || error);
      console.error("Full error stack:", error?.stack);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.post("/api/firms/force", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertFirmSchema.parse(req.body);
      const firm = await storage.createFirm({ ...parsed, orgId });
      
      await storage.createAuditLog({
        orgId,
        userId: req.headers["x-user-id"] as string || null,
        action: "create",
        entityType: "firm",
        entityId: firm.id,
        details: { name: firm.name },
      });
      
      return res.status(201).json(firm);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating firm (force):", error?.message || error);
      console.error("Full error stack:", error?.stack);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/firms/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateFirm(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Firm not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/firms/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deleted = await storage.deleteFirm(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ message: "Firm not found" });
    }
    return res.status(204).send();
  });

  app.get("/api/firms/:id/duplicates", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const firm = await storage.getFirm(req.params.id, orgId);
    if (!firm) {
      return res.status(404).json({ message: "Firm not found" });
    }
    
    const duplicates = await storage.findDuplicateFirms(orgId, firm.name, firm.id);
    
    return res.json(duplicates);
  });

  // Contacts routes with org scoping
  app.get("/api/contacts", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const firmId = req.query.firmId as string | undefined;
    const contacts = await storage.getContacts(orgId, firmId);
    return res.json(contacts);
  });

  app.get("/api/contacts/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const contact = await storage.getContact(req.params.id, orgId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    return res.json(contact);
  });

  app.post("/api/contacts", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertContactSchema.parse(req.body);
      const contact = await storage.createContact({ ...parsed, orgId });
      
      await storage.createAuditLog({
        orgId,
        userId: req.headers["x-user-id"] as string || null,
        action: "create",
        entityType: "contact",
        entityId: contact.id,
        details: { name: `${contact.firstName} ${contact.lastName}` },
      });
      
      return res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/contacts/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateContact(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Contact not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/contacts/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deleted = await storage.deleteContact(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ message: "Contact not found" });
    }
    return res.status(204).send();
  });

  // Funds routes with org scoping
  app.get("/api/funds", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const firmId = req.query.firmId as string | undefined;
    const funds = await storage.getFunds(orgId, firmId);
    return res.json(funds);
  });

  app.get("/api/funds/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const fund = await storage.getFund(req.params.id, orgId);
    if (!fund) {
      return res.status(404).json({ message: "Fund not found" });
    }
    return res.json(fund);
  });

  app.post("/api/funds", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertFundSchema.parse(req.body);
      const fund = await storage.createFund({ ...parsed, orgId });
      
      await storage.createAuditLog({
        orgId,
        userId: req.headers["x-user-id"] as string || null,
        action: "create",
        entityType: "fund",
        entityId: fund.id,
        details: { name: fund.name },
      });
      
      return res.status(201).json(fund);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/funds/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateFund(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Fund not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/funds/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deleted = await storage.deleteFund(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ message: "Fund not found" });
    }
    return res.status(204).send();
  });

  // Deals routes with org scoping
  app.get("/api/deals", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const firmId = req.query.firmId as string | undefined;
    const fundId = req.query.fundId as string | undefined;
    const deals = await storage.getDeals(orgId, firmId, fundId);
    return res.json(deals);
  });

  app.get("/api/deals/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deal = await storage.getDeal(req.params.id, orgId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }
    return res.json(deal);
  });

  app.post("/api/deals", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertDealSchema.parse(req.body);
      const deal = await storage.createDeal({ ...parsed, orgId });
      
      await storage.createAuditLog({
        orgId,
        userId: req.headers["x-user-id"] as string || null,
        action: "create",
        entityType: "deal",
        entityId: deal.id,
        details: { companyName: deal.companyName },
      });
      
      return res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/deals/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateDeal(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Deal not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/deals/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deleted = await storage.deleteDeal(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ message: "Deal not found" });
    }
    return res.status(204).send();
  });

  // Projects routes with org scoping (super_admin sees all)
  app.get("/api/projects", async (req: Request, res: Response) => {
    const { orgId, isSuperAdmin } = await getOrgFilter(req);
    // Super admin sees all projects
    if (isSuperAdmin) {
      const allProjects = await storage.getAllProjects();
      return res.json(allProjects);
    }
    const projects = await storage.getProjects(orgId!);
    return res.json(projects);
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    const { orgId, isSuperAdmin } = await getOrgFilter(req);
    // Super admin can access any project
    if (isSuperAdmin) {
      const project = await storage.getProjectById(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      return res.json(project);
    }
    const project = await storage.getProject(req.params.id, orgId!);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(project);
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertProjectSchema.parse(req.body);
      const project = await storage.createProject({ ...parsed, orgId });
      return res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/projects/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateProject(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deleted = await storage.deleteProject(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.status(204).send();
  });

  // Tasks routes with org scoping
  app.get("/api/tasks", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const projectId = req.query.projectId as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const status = req.query.status as string | undefined;
    const tasks = await storage.getTasks(orgId, projectId, assignedTo, status);
    return res.json(tasks);
  });

  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const task = await storage.getTask(req.params.id, orgId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json(task);
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertTaskSchema.parse(req.body);
      const task = await storage.createTask({ ...parsed, orgId });
      return res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateTask(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deleted = await storage.deleteTask(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.status(204).send();
  });

  // Annotations routes with org scoping
  app.get("/api/annotations", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const taskId = req.query.taskId as string | undefined;
    const annotations = await storage.getAnnotations(orgId, taskId);
    return res.json(annotations);
  });

  app.get("/api/annotations/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const annotation = await storage.getAnnotation(req.params.id, orgId);
    if (!annotation) {
      return res.status(404).json({ message: "Annotation not found" });
    }
    return res.json(annotation);
  });

  app.post("/api/annotations", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertAnnotationSchema.parse(req.body);
      const annotation = await storage.createAnnotation({ ...parsed, orgId });
      return res.status(201).json(annotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/annotations/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateAnnotation(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Annotation not found" });
    }
    return res.json(updated);
  });

  // Audit logs routes with org scoping
  app.get("/api/audit-logs", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const logs = await storage.getAuditLogs(orgId, entityType, entityId);
    return res.json(logs);
  });

  // Monitored URLs routes with org scoping
  app.get("/api/monitored-urls", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const urls = await storage.getMonitoredUrls(orgId);
    return res.json(urls);
  });

  app.get("/api/monitored-urls/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const url = await storage.getMonitoredUrl(req.params.id, orgId);
    if (!url) {
      return res.status(404).json({ message: "Monitored URL not found" });
    }
    return res.json(url);
  });

  app.post("/api/monitored-urls", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const parsed = insertMonitoredUrlSchema.parse(req.body);
      const url = await storage.createMonitoredUrl({ ...parsed, orgId });
      return res.status(201).json(url);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/monitored-urls/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const updated = await storage.updateMonitoredUrl(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Monitored URL not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/monitored-urls/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const deleted = await storage.deleteMonitoredUrl(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ message: "Monitored URL not found" });
    }
    return res.status(204).send();
  });

  // AI Annotation Suggestions with org scoping
  app.get("/api/suggestions/:taskId", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const task = await storage.getTask(req.params.taskId, orgId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const allAnnotations = await storage.getAnnotations(orgId);
      const completedAnnotations = allAnnotations.filter(a => 
        a.reviewStatus === "approved" || (a.labels && a.labels.length > 0)
      );

      const labelFrequency: Record<string, number> = {};
      const entityPatterns: Record<string, { type: string; examples: string[] }> = {};
      
      completedAnnotations.forEach(annotation => {
        if (annotation.labels && Array.isArray(annotation.labels)) {
          annotation.labels.forEach((label: string) => {
            labelFrequency[label] = (labelFrequency[label] || 0) + 1;
          });
        }
        
        if (annotation.entities && typeof annotation.entities === 'object') {
          const entities = annotation.entities as Record<string, string>;
          Object.entries(entities).forEach(([type, value]) => {
            if (!entityPatterns[type]) {
              entityPatterns[type] = { type, examples: [] };
            }
            if (entityPatterns[type].examples.length < 5 && typeof value === 'string') {
              entityPatterns[type].examples.push(value);
            }
          });
        }
      });

      const sortedLabels = Object.entries(labelFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([label]) => label);

      const suggestedEntities = Object.values(entityPatterns).slice(0, 5);

      const totalAnnotations = completedAnnotations.length;
      const confidence = Math.min(95, Math.max(30, 30 + (totalAnnotations * 5)));

      const patterns = sortedLabels.slice(0, 3).map(label => 
        `Label "${label}" used ${labelFrequency[label]} times`
      );

      const suggestion = {
        id: `sug-${req.params.taskId}`,
        taskId: req.params.taskId,
        suggestedLabels: sortedLabels,
        suggestedEntities,
        confidence,
        reasoning: totalAnnotations > 0 
          ? `Based on analysis of ${totalAnnotations} historical annotations with similar patterns.`
          : "No historical data available yet. Suggestions will improve as more annotations are completed.",
        basedOnPatterns: patterns,
        createdAt: new Date(),
      };

      return res.json(suggestion);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/patterns", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const allAnnotations = await storage.getAnnotations(orgId);
      const completedAnnotations = allAnnotations.filter(a => 
        a.reviewStatus === "approved" || (a.labels && a.labels.length > 0)
      );

      const labelFrequency: Record<string, { count: number; examples: string[] }> = {};
      
      completedAnnotations.forEach(annotation => {
        if (annotation.labels && Array.isArray(annotation.labels)) {
          annotation.labels.forEach((label: string) => {
            if (!labelFrequency[label]) {
              labelFrequency[label] = { count: 0, examples: [] };
            }
            labelFrequency[label].count += 1;
          });
        }
      });

      const patterns = Object.entries(labelFrequency)
        .map(([pattern, data]) => ({
          pattern,
          frequency: data.count,
          examples: data.examples,
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20);

      return res.json({
        patterns,
        totalAnnotations: completedAnnotations.length,
        uniqueLabels: Object.keys(labelFrequency).length,
      });
    } catch (error) {
      console.error("Error fetching patterns:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==========================================
  // CRM Routes - New Entity Tables
  // ==========================================
  
  // CRM entity counts
  app.get("/api/crm/counts", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const counts = await db.execute(sql`
        SELECT 'entities_gp' as entity, count(*)::int as count FROM entities_gp
        UNION ALL SELECT 'entities_fund', count(*)::int FROM entities_fund
        UNION ALL SELECT 'entities_lp', count(*)::int FROM entities_lp
        UNION ALL SELECT 'entities_service_provider', count(*)::int FROM entities_service_provider
        UNION ALL SELECT 'entities_deal', count(*)::int FROM entities_deal
        UNION ALL SELECT 'entities_contacts', count(*)::int FROM entities_contacts
        UNION ALL SELECT 'entities_portfolio_company', count(*)::int FROM entities_portfolio_company
        UNION ALL SELECT 'public_company_snapshot', count(*)::int FROM public_company_snapshot
        UNION ALL SELECT 'relationships', count(*)::int FROM relationships
        UNION ALL SELECT 'ext_agritech', CASE WHEN to_regclass('ext_agritech_portfolio_company') IS NOT NULL THEN (SELECT count(*)::int FROM ext_agritech_portfolio_company) ELSE 0 END
        UNION ALL SELECT 'ext_blockchain', CASE WHEN to_regclass('ext_blockchain_portfolio_company') IS NOT NULL THEN (SELECT count(*)::int FROM ext_blockchain_portfolio_company) ELSE 0 END
        UNION ALL SELECT 'ext_healthcare', CASE WHEN to_regclass('ext_healthcare_portfolio_company') IS NOT NULL THEN (SELECT count(*)::int FROM ext_healthcare_portfolio_company) ELSE 0 END
        UNION ALL SELECT 'entities_public_market', CASE WHEN to_regclass('entities_public_market') IS NOT NULL THEN (SELECT count(*)::int FROM entities_public_market) ELSE 0 END
      `);
      
      return res.json(counts.rows);
    } catch (error) {
      console.error("Error fetching CRM counts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // GP Routes
  app.get("/api/crm/gps", async (req: Request, res: Response) => {
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      // Super admin sees all GPs, others see only their org's
      const result = isSuperAdmin 
        ? await db.execute(sql`SELECT * FROM entities_gp ORDER BY created_at DESC`)
        : await db.execute(sql`SELECT * FROM entities_gp WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching GPs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/gps", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_gp (org_id, gp_name, gp_legal_name, gp_type, headquarters_country, headquarters_city, total_aum, aum_currency, description, year_established, assigned_to, status)
        VALUES (${orgId}, ${data.gp_name}, ${data.gp_legal_name || null}, ${data.gp_type || data.firm_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.total_aum || null}, ${data.aum_currency || null}, ${data.description || null}, ${data.year_established || null}, ${data.assigned_to || null}, ${data.status || 'active'})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating GP:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/gps/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_gp SET
          gp_name = ${data.gp_name || null},
          gp_legal_name = ${data.gp_legal_name || null},
          former_names = ${data.former_names || null},
          gp_type = ${data.gp_type || data.firm_type || null},
          legal_structure = ${data.legal_structure || null},
          year_established = ${data.year_established || data.year_founded || null},
          primary_jurisdiction = ${data.primary_jurisdiction || null},
          secondary_jurisdictions = ${data.secondary_jurisdictions || null},
          description = ${data.description || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_countries = ${data.operating_countries || null},
          operating_regions = ${data.operating_regions || null},
          number_of_offices = ${data.number_of_offices || null},
          office_locations = ${data.office_locations || null},
          ownership_type = ${data.ownership_type || null},
          total_aum = ${data.total_aum || null},
          aum_currency = ${data.aum_currency || null},
          aum_as_of_date = ${data.aum_as_of_date || null},
          asset_classes = ${data.asset_classes || data.primary_asset_classes || null},
          fund_strategies = ${data.fund_strategies || null},
          sector_focus = ${data.sector_focus || data.industry_focus || null},
          geographic_focus = ${data.geographic_focus || null},
          total_team_size = ${data.total_team_size || null},
          investment_team_size = ${data.investment_team_size || null},
          esg_policy_exists = ${data.esg_policy_exists ?? null},
          un_pri_signatory = ${data.un_pri_signatory ?? data.pri_signatory ?? null},
          assigned_to = ${data.assigned_to || null},
          last_updated_by = ${data.last_updated_by || null},
          last_updated_on = NOW(),
          status = ${data.status || 'active'},
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "GP not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating GP:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // LP Routes
  app.get("/api/crm/lps", async (req: Request, res: Response) => {
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = isSuperAdmin
        ? await db.execute(sql`SELECT * FROM entities_lp ORDER BY created_at DESC`)
        : await db.execute(sql`SELECT * FROM entities_lp WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching LPs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/lps", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_lp (org_id, lp_name, lp_legal_name, lp_type, lp_firm_type, headquarters_country, headquarters_city, headquarters_state, total_aum, aum_currency, website, linkedin_url, description, year_established, assigned_to, status)
        VALUES (${orgId}, ${data.lp_name}, ${data.lp_legal_name || null}, ${data.lp_type || data.investor_type || 'Institutional'}, ${data.lp_firm_type || data.firm_type || 'Other'}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.headquarters_state || null}, ${data.total_aum || null}, ${data.aum_currency || null}, ${data.website || null}, ${data.linkedin_url || null}, ${data.description || null}, ${data.year_established || null}, ${data.assigned_to || null}, ${data.status || 'active'})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating LP:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/lps/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_lp SET
          lp_name = ${data.lp_name || null},
          lp_legal_name = ${data.lp_legal_name || null},
          former_names = ${data.former_names || null},
          lp_type = ${data.lp_type || data.investor_type || null},
          lp_firm_type = ${data.lp_firm_type || data.firm_type || null},
          legal_structure = ${data.legal_structure || null},
          year_established = ${data.year_established || data.year_founded || null},
          primary_jurisdiction = ${data.primary_jurisdiction || null},
          secondary_jurisdictions = ${data.secondary_jurisdictions || null},
          description = ${data.description || null},
          website = ${data.website || null},
          linkedin_url = ${data.linkedin_url || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_state = ${data.headquarters_state || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_countries = ${data.operating_countries || null},
          operating_regions = ${data.operating_regions || null},
          ownership_type = ${data.ownership_type || null},
          total_aum = ${data.total_aum || null},
          aum_currency = ${data.aum_currency || null},
          aum_as_of_date = ${data.aum_as_of_date || null},
          private_markets_aum = ${data.private_markets_aum || null},
          private_markets_allocation_percent = ${data.private_markets_allocation_percent || null},
          annual_commitment_budget = ${data.annual_commitment_budget || null},
          preferred_asset_classes = ${data.preferred_asset_classes || data.primary_asset_classes || null},
          ticket_size_min = ${data.ticket_size_min || data.min_commitment_size || null},
          ticket_size_max = ${data.ticket_size_max || data.max_commitment_size || null},
          sector_preferences = ${data.sector_preferences || data.industry_focus || null},
          primary_regions = ${data.primary_regions || data.geographic_focus || null},
          esg_policy_exists = ${data.esg_policy_exists ?? null},
          un_pri_signatory = ${data.un_pri_signatory ?? data.pri_signatory ?? null},
          assigned_to = ${data.assigned_to || null},
          last_updated_by = ${data.last_updated_by || null},
          last_updated_on = NOW(),
          status = ${data.status || 'active'},
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "LP not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating LP:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Fund Routes
  app.get("/api/crm/funds", async (req: Request, res: Response) => {
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = isSuperAdmin
        ? await db.execute(sql`SELECT * FROM entities_fund ORDER BY created_at DESC`)
        : await db.execute(sql`SELECT * FROM entities_fund WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching funds:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/funds", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_fund (org_id, fund_name, fund_legal_name, fund_type, gp_id, vintage_year, target_fund_size, currency, fundraising_status, description, assigned_to, status)
        VALUES (${orgId}, ${data.fund_name}, ${data.fund_legal_name || null}, ${data.fund_type || null}, ${data.gp_id || null}, ${data.vintage_year || null}, ${data.target_fund_size || data.target_size || null}, ${data.currency || data.target_size_currency || 'USD'}, ${data.fundraising_status || data.fund_status || null}, ${data.description || null}, ${data.assigned_to || null}, ${data.status || 'active'})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating fund:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/funds/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_fund SET
          fund_name = ${data.fund_name || null},
          fund_legal_name = ${data.fund_legal_name || null},
          former_names = ${data.former_names || null},
          fund_type = ${data.fund_type || null},
          vintage_year = ${data.vintage_year || null},
          description = ${data.description || null},
          gp_id = ${data.gp_id || null},
          legal_structure = ${data.legal_structure || null},
          domicile_country = ${data.domicile_country || null},
          domicile_jurisdiction = ${data.domicile_jurisdiction || null},
          target_fund_size = ${data.target_fund_size || null},
          hard_cap = ${data.hard_cap || null},
          final_fund_size = ${data.final_fund_size || data.fund_size_final || null},
          currency = ${data.currency || data.fund_currency || 'USD'},
          first_close_date = ${data.first_close_date || null},
          final_close_date = ${data.final_close_date || null},
          fundraising_status = ${data.fundraising_status || data.fund_status || null},
          investment_strategy = ${data.investment_strategy || data.strategy || null},
          sector_focus = ${data.sector_focus || data.industry_focus || null},
          geographic_focus = ${data.geographic_focus || null},
          stage_focus = ${data.stage_focus || data.investment_stage || null},
          number_of_lps = ${data.number_of_lps || null},
          anchor_lp_present = ${data.anchor_lp_present ?? data.cornerstone_investor_flag ?? null},
          net_irr = ${data.net_irr || null},
          gross_irr = ${data.gross_irr || null},
          tvpi = ${data.tvpi || null},
          dpi = ${data.dpi || null},
          rvpi = ${data.rvpi || null},
          performance_as_of_date = ${data.performance_as_of_date || null},
          number_of_portfolio_companies = ${data.number_of_portfolio_companies || data.deal_count || null},
          number_of_exits = ${data.number_of_exits || data.realized_portfolio_companies_count || null},
          esg_policy_exists = ${data.esg_policy_exists ?? data.esg_integration_flag ?? null},
          impact_fund_flag = ${data.impact_fund_flag ?? null},
          assigned_to = ${data.assigned_to || null},
          last_updated_by = ${data.last_updated_by || null},
          last_updated_on = NOW(),
          status = ${data.status || 'active'},
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Fund not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating fund:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Portfolio Company Routes
  app.get("/api/crm/portfolio-companies", async (req: Request, res: Response) => {
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = isSuperAdmin
        ? await db.execute(sql`SELECT * FROM entities_portfolio_company ORDER BY created_at DESC`)
        : await db.execute(sql`SELECT * FROM entities_portfolio_company WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching portfolio companies:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/portfolio-companies", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_portfolio_company (
          org_id, company_name, company_legal_name, company_type, headquarters_country, headquarters_city, 
          headquarters_state, primary_industry, secondary_industry, business_model, website, linkedin_url,
          description, year_founded, ownership_status, assigned_to, status
        )
        VALUES (
          ${orgId}, ${data.company_name}, ${data.company_legal_name || null}, ${data.company_type || null}, 
          ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.headquarters_state || null},
          ${data.primary_industry || null}, ${data.secondary_industry || null}, ${data.business_model || null}, 
          ${data.website || null}, ${data.linkedin_url || null}, ${data.description || data.business_description || null}, 
          ${data.year_founded || data.founded_year || null}, ${data.ownership_status || data.current_owner_type || null}, 
          ${data.assigned_to || null}, ${data.status || 'active'}
        )
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating portfolio company:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/portfolio-companies/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_portfolio_company SET
          company_name = ${data.company_name || null},
          company_legal_name = ${data.company_legal_name || data.legal_name || null},
          former_names = ${data.former_names || null},
          company_type = ${data.company_type || null},
          year_founded = ${data.year_founded || null},
          description = ${data.description || data.business_description || null},
          website = ${data.website || null},
          linkedin_url = ${data.linkedin_url || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_state = ${data.headquarters_state || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_countries = ${data.operating_countries || null},
          primary_industry = ${data.primary_industry || null},
          secondary_industry = ${data.secondary_industry || data.sub_industry || null},
          business_model = ${data.business_model || null},
          employee_count_range = ${data.employee_count_range || data.employee_count_band || null},
          latest_revenue = ${data.latest_revenue || data.revenue || null},
          revenue_currency = ${data.revenue_currency || 'USD'},
          latest_revenue_year = ${data.latest_revenue_year || data.revenue_year || null},
          ownership_status = ${data.ownership_status || data.current_owner_type || null},
          lead_investor_gp_id = ${data.lead_investor_gp_id || data.controlling_gp_id || null},
          lead_fund_id = ${data.lead_fund_id || data.controlling_fund_id || null},
          initial_investment_year = ${data.initial_investment_year || data.first_investment_year || null},
          total_funding_raised = ${data.total_funding_raised || null},
          funding_currency = ${data.funding_currency || 'USD'},
          exit_status = ${data.exit_status || null},
          exit_type = ${data.exit_type || null},
          exit_year = ${data.exit_year || null},
          assigned_to = ${data.assigned_to || null},
          last_updated_by = ${data.last_updated_by || null},
          last_updated_on = NOW(),
          status = ${data.status || 'active'},
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Portfolio company not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating portfolio company:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Service Provider Routes
  app.get("/api/crm/service-providers", async (req: Request, res: Response) => {
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = isSuperAdmin
        ? await db.execute(sql`SELECT * FROM entities_service_provider ORDER BY created_at DESC`)
        : await db.execute(sql`SELECT * FROM entities_service_provider WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching service providers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/service-providers", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_service_provider (org_id, sp_name, sp_legal_name, sp_category, headquarters_country, headquarters_city, primary_services, operating_regions, year_established, status)
        VALUES (${orgId}, ${data.sp_name || data.provider_name}, ${data.sp_legal_name || null}, ${data.sp_category || data.provider_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.primary_services || data.services_offered || null}, ${data.operating_regions || data.geographic_coverage || null}, ${data.year_established || data.founded_year || null}, ${data.status || 'active'})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating service provider:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/service-providers/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_service_provider SET
          sp_name = ${data.sp_name || data.service_provider_name || data.provider_name || null},
          sp_legal_name = ${data.sp_legal_name || data.service_provider_legal_name || null},
          sp_category = ${data.sp_category || data.service_provider_type || data.provider_type || null},
          former_names = ${data.former_names || null},
          legal_structure = ${data.legal_structure || null},
          year_established = ${data.year_established || data.year_founded || null},
          primary_jurisdiction = ${data.primary_jurisdiction || null},
          secondary_jurisdictions = ${data.secondary_jurisdictions || null},
          description = ${data.description || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_countries = ${data.operating_countries || null},
          operating_regions = ${data.operating_regions || null},
          number_of_offices = ${data.number_of_offices || null},
          office_locations = ${data.office_locations || null},
          primary_services = ${data.primary_services || data.services_offered || null},
          secondary_services = ${data.secondary_services || null},
          asset_class_expertise = ${data.asset_class_expertise || null},
          fund_stage_coverage = ${data.fund_stage_coverage || null},
          client_type_focus = ${data.client_type_focus || null},
          total_employees = ${data.total_employees || null},
          relevant_team_size = ${data.relevant_team_size || null},
          years_in_private_markets = ${data.years_in_private_markets || null},
          number_of_funds_served = ${data.number_of_funds_served || null},
          number_of_gps_served = ${data.number_of_gps_served || null},
          cross_border_support = ${data.cross_border_support ?? null},
          esg_policy_exists = ${data.esg_policy_exists ?? null},
          data_privacy_policy = ${data.data_privacy_policy ?? null},
          assigned_to = ${data.assigned_to || null},
          last_updated_by = ${data.last_updated_by || null},
          last_updated_on = NOW(),
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Service provider not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating service provider:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Contact Routes (CRM version)
  app.get("/api/crm/contacts", async (req: Request, res: Response) => {
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const { linked_entity_type, linked_entity_id, unlinked } = req.query;
      
      let result;
      if (linked_entity_type && linked_entity_id) {
        result = isSuperAdmin
          ? await db.execute(sql`
              SELECT * FROM entities_contacts 
              WHERE linked_entity_type = ${linked_entity_type as string} 
                AND linked_entity_id = ${linked_entity_id as string}
              ORDER BY created_at DESC
            `)
          : await db.execute(sql`
              SELECT * FROM entities_contacts 
              WHERE org_id = ${orgId} 
                AND linked_entity_type = ${linked_entity_type as string} 
                AND linked_entity_id = ${linked_entity_id as string}
              ORDER BY created_at DESC
            `);
      } else if (unlinked === 'true') {
        result = isSuperAdmin
          ? await db.execute(sql`
              SELECT * FROM entities_contacts 
              WHERE (linked_entity_id IS NULL OR linked_entity_id = '')
              ORDER BY created_at DESC
            `)
          : await db.execute(sql`
              SELECT * FROM entities_contacts 
              WHERE org_id = ${orgId} 
                AND (linked_entity_id IS NULL OR linked_entity_id = '')
              ORDER BY created_at DESC
            `);
      } else {
        result = isSuperAdmin
          ? await db.execute(sql`SELECT * FROM entities_contacts ORDER BY created_at DESC`)
          : await db.execute(sql`SELECT * FROM entities_contacts WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      }
      
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching CRM contacts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/crm/contacts/:id/link", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const { linked_entity_type, linked_entity_id, relationship_type } = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_contacts 
        SET linked_entity_type = ${linked_entity_type}, 
            linked_entity_id = ${linked_entity_id},
            relationship_type = ${relationship_type || null}
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error linking contact:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.post("/api/crm/contacts", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_contacts (
          org_id, first_name, last_name, middle_name, full_name, salutation, gender,
          email, phone_number, phone_extension, job_title, functional_role,
          linkedin_url, primary_profile_url, profile_urls, contact_priority,
          verification_status, notes, status, assigned_to
        )
        VALUES (
          ${orgId}, ${data.first_name}, ${data.last_name || null}, ${data.middle_name || null},
          ${data.full_name || null}, ${data.salutation || null}, ${data.gender || null},
          ${data.email || null}, ${data.phone_number || data.phone || null}, ${data.phone_extension || null},
          ${data.job_title || data.title || null}, ${data.functional_role || null},
          ${data.linkedin_url || null}, ${data.primary_profile_url || null}, ${data.profile_urls || null},
          ${data.contact_priority || null}, ${data.verification_status || null},
          ${data.notes || null}, ${data.status || 'active'}, ${data.assigned_to || null}
        )
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating contact:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/contacts/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_contacts SET
          first_name = ${data.first_name || null},
          last_name = ${data.last_name || null},
          middle_name = ${data.middle_name || null},
          full_name = ${data.full_name || null},
          salutation = ${data.salutation || null},
          gender = ${data.gender || null},
          email = ${data.email || null},
          phone_number = ${data.phone_number || data.phone || null},
          phone_extension = ${data.phone_extension || null},
          job_title = ${data.job_title || data.title || null},
          functional_role = ${data.functional_role || null},
          linkedin_url = ${data.linkedin_url || null},
          primary_profile_url = ${data.primary_profile_url || null},
          profile_urls = ${data.profile_urls || null},
          contact_priority = ${data.contact_priority || null},
          verification_status = ${data.verification_status || null},
          last_verified_on = ${data.last_verified_on || null},
          last_verified_by = ${data.last_verified_by || null},
          notes = ${data.notes || null},
          status = ${data.status || 'active'},
          assigned_to = ${data.assigned_to || null},
          last_updated_by = ${data.last_updated_by || null},
          last_updated_on = NOW(),
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating contact:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Deal Routes (CRM version)
  app.get("/api/crm/deals", async (req: Request, res: Response) => {
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = isSuperAdmin
        ? await db.execute(sql`SELECT * FROM entities_deal ORDER BY created_at DESC`)
        : await db.execute(sql`SELECT * FROM entities_deal WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching CRM deals:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/deals", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_deal (
          org_id, deal_name, deal_type, deal_status, deal_amount, deal_currency, deal_date,
          target_company, acquirer_company, investor_ids, sector, notes,
          deal_round, asset_class, target_company_id, acquirer_company_id,
          lead_investor, ownership_percentage, verification_status, confidence_score, source_urls
        )
        VALUES (
          ${orgId}, ${data.deal_name}, ${data.deal_type || null}, ${data.deal_status || null}, 
          ${data.deal_amount || null}, ${data.deal_currency || null}, ${data.deal_date || null},
          ${data.target_company || null}, ${data.acquirer_company || null}, ${data.investor_ids || null}, 
          ${data.sector || null}, ${data.notes || null},
          ${data.deal_round || null}, ${data.asset_class || null}, ${data.target_company_id || null}, ${data.acquirer_company_id || null},
          ${data.lead_investor ?? null}, ${data.ownership_percentage || null}, ${data.verification_status || null}, 
          ${data.confidence_score || null}, ${data.source_urls || null}
        )
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating deal:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/deals/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_deal SET
          deal_name = ${data.deal_name || null},
          deal_type = ${data.deal_type || null},
          deal_status = ${data.deal_status || null},
          deal_amount = ${data.deal_amount || null},
          deal_currency = ${data.deal_currency || null},
          deal_date = ${data.deal_date || null},
          target_company = ${data.target_company || null},
          acquirer_company = ${data.acquirer_company || null},
          investor_ids = ${data.investor_ids || null},
          sector = ${data.sector || null},
          notes = ${data.notes || null},
          deal_round = ${data.deal_round || null},
          asset_class = ${data.asset_class || null},
          target_company_id = ${data.target_company_id || null},
          acquirer_company_id = ${data.acquirer_company_id || null},
          lead_investor = ${data.lead_investor ?? null},
          ownership_percentage = ${data.ownership_percentage || null},
          verification_status = ${data.verification_status || null},
          confidence_score = ${data.confidence_score || null},
          source_urls = ${data.source_urls || null},
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Deal not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating deal:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Entity URLs Routes
  app.get("/api/crm/entity-urls", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { entity_type, entity_id } = req.query;
      
      let result;
      if (entity_type && entity_id) {
        result = await db.execute(sql`
          SELECT * FROM entity_urls 
          WHERE org_id = ${orgId} 
            AND entity_type = ${entity_type as string} 
            AND entity_id = ${entity_id as string}
          ORDER BY added_date DESC
        `);
      } else {
        result = await db.execute(sql`SELECT * FROM entity_urls WHERE org_id = ${orgId} ORDER BY added_date DESC`);
      }
      
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching entity URLs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/entity-urls", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entity_urls (org_id, entity_type, entity_id, url_type, url_link, added_date, status)
        VALUES (${orgId}, ${data.entity_type}, ${data.entity_id}, ${data.url_type}, ${data.url_link}, ${data.added_date || null}, ${data.status || 'active'})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating entity URL:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.patch("/api/crm/entity-urls/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE entity_urls SET
          url_type = ${data.url_type || null},
          url_link = ${data.url_link || null},
          status = ${data.status || 'active'},
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Entity URL not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error updating entity URL:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  app.delete("/api/crm/entity-urls/:id", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      
      const result = await db.execute(sql`
        DELETE FROM entity_urls WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Entity URL not found" });
      }
      
      return res.json({ message: "Entity URL deleted successfully" });
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error deleting entity URL:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Relationships Routes
  app.get("/api/crm/relationships", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM relationships WHERE org_id = ${orgId} ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error fetching relationships:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/relationships", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO relationships (org_id, from_entity_type, from_entity_id, from_entity_name_snapshot, to_entity_type, to_entity_id, to_entity_name_snapshot, relationship_type, relationship_subtype, relationship_status)
        VALUES (${orgId}, ${data.from_entity_type}, ${data.from_entity_id}, ${data.from_entity_name_snapshot || null}, ${data.to_entity_type}, ${data.to_entity_id}, ${data.to_entity_name_snapshot || null}, ${data.relationship_type}, ${data.relationship_subtype || null}, ${data.relationship_status || 'Active'})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      console.error("Error creating relationship:", error?.message || error);
      return res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Public Company Snapshots (shared across all orgs for now - public data)
  app.get("/api/crm/public-companies", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM public_company_snapshot ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching public companies:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==========================================
  // Sector Entity Routes - Extensions to Portfolio Companies
  // ==========================================

  // Initialize sector tables if they don't exist
  app.post("/api/crm/init-sector-tables", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      // Create ext_agritech_portfolio_company
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ext_agritech_portfolio_company (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          portfolio_company_id UUID REFERENCES entities_portfolio_company(id) ON DELETE CASCADE,
          crop_types TEXT,
          farming_method TEXT,
          tech_stack TEXT,
          sustainability_certifications TEXT,
          geographic_focus TEXT,
          target_market TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create ext_blockchain_portfolio_company
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ext_blockchain_portfolio_company (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          portfolio_company_id UUID REFERENCES entities_portfolio_company(id) ON DELETE CASCADE,
          blockchain_platform TEXT,
          token_ticker TEXT,
          consensus_mechanism TEXT,
          smart_contract_language TEXT,
          defi_category TEXT,
          tvl_usd NUMERIC,
          audit_status TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create ext_healthcare_portfolio_company
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ext_healthcare_portfolio_company (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          portfolio_company_id UUID REFERENCES entities_portfolio_company(id) ON DELETE CASCADE,
          healthcare_segment TEXT,
          therapeutic_area TEXT,
          regulatory_status TEXT,
          fda_approval_stage TEXT,
          clinical_trial_phase TEXT,
          target_patient_population TEXT,
          reimbursement_model TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create entities_public_market (standalone)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS entities_public_market (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_name TEXT NOT NULL,
          ticker TEXT,
          exchange TEXT,
          isin TEXT,
          cusip TEXT,
          sector TEXT,
          industry TEXT,
          market_cap NUMERIC,
          enterprise_value NUMERIC,
          revenue_ttm NUMERIC,
          ebitda_ttm NUMERIC,
          pe_ratio NUMERIC,
          headquarters_country TEXT,
          headquarters_city TEXT,
          website TEXT,
          description TEXT,
          snapshot_date DATE DEFAULT CURRENT_DATE,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create link_public_market_entity (polymorphic link)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS link_public_market_entity (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          public_market_id UUID REFERENCES entities_public_market(id) ON DELETE CASCADE,
          entity_type TEXT NOT NULL,
          entity_id UUID NOT NULL,
          relationship_type TEXT DEFAULT 'related',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      return res.json({ message: "Sector tables initialized successfully" });
    } catch (error) {
      console.error("Error initializing sector tables:", error);
      return res.status(500).json({ message: "Error initializing sector tables" });
    }
  });

  // Agritech Routes
  app.get("/api/crm/agritech", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const tableExists = await db.execute(sql`SELECT to_regclass('ext_agritech_portfolio_company') IS NOT NULL as exists`);
      if (!tableExists.rows[0]?.exists) {
        return res.json([]);
      }
      const result = await db.execute(sql`
        SELECT a.*, p.company_name, p.headquarters_country, p.headquarters_city, p.website
        FROM ext_agritech_portfolio_company a
        LEFT JOIN entities_portfolio_company p ON a.portfolio_company_id = p.id
        ORDER BY a.created_at DESC
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching agritech:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/agritech", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO ext_agritech_portfolio_company 
        (portfolio_company_id, crop_types, farming_method, tech_stack, sustainability_certifications, geographic_focus, target_market, notes)
        VALUES (${data.portfolio_company_id || null}, ${data.crop_types || null}, ${data.farming_method || null}, ${data.tech_stack || null}, ${data.sustainability_certifications || null}, ${data.geographic_focus || null}, ${data.target_market || null}, ${data.notes || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating agritech:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/crm/agritech/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE ext_agritech_portfolio_company SET
          crop_types = COALESCE(${data.crop_types}, crop_types),
          farming_method = COALESCE(${data.farming_method}, farming_method),
          tech_stack = COALESCE(${data.tech_stack}, tech_stack),
          sustainability_certifications = COALESCE(${data.sustainability_certifications}, sustainability_certifications),
          geographic_focus = COALESCE(${data.geographic_focus}, geographic_focus),
          target_market = COALESCE(${data.target_market}, target_market),
          notes = COALESCE(${data.notes}, notes),
          sources_used = COALESCE(${data.sources_used}, sources_used),
          source_urls = COALESCE(${data.source_urls}, source_urls),
          last_updated_by = COALESCE(${data.last_updated_by}, last_updated_by),
          last_updated_on = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating agritech:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Blockchain Routes
  app.get("/api/crm/blockchain", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const tableExists = await db.execute(sql`SELECT to_regclass('ext_blockchain_portfolio_company') IS NOT NULL as exists`);
      if (!tableExists.rows[0]?.exists) {
        return res.json([]);
      }
      const result = await db.execute(sql`
        SELECT b.*, p.company_name, p.headquarters_country, p.headquarters_city, p.website
        FROM ext_blockchain_portfolio_company b
        LEFT JOIN entities_portfolio_company p ON b.portfolio_company_id = p.id
        ORDER BY b.created_at DESC
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching blockchain:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/blockchain", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO ext_blockchain_portfolio_company 
        (portfolio_company_id, blockchain_platform, token_ticker, consensus_mechanism, smart_contract_language, defi_category, tvl_usd, audit_status, notes)
        VALUES (${data.portfolio_company_id || null}, ${data.blockchain_platform || null}, ${data.token_ticker || null}, ${data.consensus_mechanism || null}, ${data.smart_contract_language || null}, ${data.defi_category || null}, ${data.tvl_usd || null}, ${data.audit_status || null}, ${data.notes || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating blockchain:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/crm/blockchain/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE ext_blockchain_portfolio_company SET
          blockchain_platform = COALESCE(${data.blockchain_platform}, blockchain_platform),
          token_ticker = COALESCE(${data.token_ticker}, token_ticker),
          consensus_mechanism = COALESCE(${data.consensus_mechanism}, consensus_mechanism),
          smart_contract_language = COALESCE(${data.smart_contract_language}, smart_contract_language),
          defi_category = COALESCE(${data.defi_category}, defi_category),
          tvl_usd = COALESCE(${data.tvl_usd}, tvl_usd),
          audit_status = COALESCE(${data.audit_status}, audit_status),
          notes = COALESCE(${data.notes}, notes),
          sources_used = COALESCE(${data.sources_used}, sources_used),
          source_urls = COALESCE(${data.source_urls}, source_urls),
          last_updated_by = COALESCE(${data.last_updated_by}, last_updated_by),
          last_updated_on = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating blockchain:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Healthcare Routes
  app.get("/api/crm/healthcare", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const tableExists = await db.execute(sql`SELECT to_regclass('ext_healthcare_portfolio_company') IS NOT NULL as exists`);
      if (!tableExists.rows[0]?.exists) {
        return res.json([]);
      }
      const result = await db.execute(sql`
        SELECT h.*, p.company_name, p.headquarters_country, p.headquarters_city, p.website
        FROM ext_healthcare_portfolio_company h
        LEFT JOIN entities_portfolio_company p ON h.portfolio_company_id = p.id
        ORDER BY h.created_at DESC
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching healthcare:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/healthcare", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO ext_healthcare_portfolio_company 
        (portfolio_company_id, healthcare_segment, therapeutic_area, regulatory_status, fda_approval_stage, clinical_trial_phase, target_patient_population, reimbursement_model, notes)
        VALUES (${data.portfolio_company_id || null}, ${data.healthcare_segment || null}, ${data.therapeutic_area || null}, ${data.regulatory_status || null}, ${data.fda_approval_stage || null}, ${data.clinical_trial_phase || null}, ${data.target_patient_population || null}, ${data.reimbursement_model || null}, ${data.notes || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating healthcare:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/crm/healthcare/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE ext_healthcare_portfolio_company SET
          healthcare_segment = COALESCE(${data.healthcare_segment}, healthcare_segment),
          therapeutic_area = COALESCE(${data.therapeutic_area}, therapeutic_area),
          regulatory_status = COALESCE(${data.regulatory_status}, regulatory_status),
          fda_approval_stage = COALESCE(${data.fda_approval_stage}, fda_approval_stage),
          clinical_trial_phase = COALESCE(${data.clinical_trial_phase}, clinical_trial_phase),
          target_patient_population = COALESCE(${data.target_patient_population}, target_patient_population),
          reimbursement_model = COALESCE(${data.reimbursement_model}, reimbursement_model),
          notes = COALESCE(${data.notes}, notes),
          sources_used = COALESCE(${data.sources_used}, sources_used),
          source_urls = COALESCE(${data.source_urls}, source_urls),
          last_updated_by = COALESCE(${data.last_updated_by}, last_updated_by),
          last_updated_on = NOW(),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating healthcare:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public Market Routes (standalone entity)
  app.get("/api/crm/public-market", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const tableExists = await db.execute(sql`SELECT to_regclass('entities_public_market') IS NOT NULL as exists`);
      if (!tableExists.rows[0]?.exists) {
        return res.json([]);
      }
      const result = await db.execute(sql`
        SELECT * FROM entities_public_market ORDER BY created_at DESC
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching public market:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/public-market", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_public_market 
        (company_name, ticker, exchange, isin, cusip, sector, industry, market_cap, enterprise_value, revenue_ttm, ebitda_ttm, pe_ratio, headquarters_country, headquarters_city, website, description, notes)
        VALUES (${data.company_name}, ${data.ticker || null}, ${data.exchange || null}, ${data.isin || null}, ${data.cusip || null}, ${data.sector || null}, ${data.industry || null}, ${data.market_cap || null}, ${data.enterprise_value || null}, ${data.revenue_ttm || null}, ${data.ebitda_ttm || null}, ${data.pe_ratio || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.website || null}, ${data.description || null}, ${data.notes || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating public market:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public Market Entity Links
  app.get("/api/crm/public-market/:id/links", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`
        SELECT * FROM link_public_market_entity WHERE public_market_id = ${req.params.id}
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching public market links:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/public-market/:id/links", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO link_public_market_entity 
        (public_market_id, entity_type, entity_id, relationship_type, notes)
        VALUES (${req.params.id}, ${data.entity_type}, ${data.entity_id}, ${data.relationship_type || 'related'}, ${data.notes || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating public market link:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard stats
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId(req);
      const [firms, contacts, funds, deals, tasks, projects, urls] = await Promise.all([
        storage.getFirms(orgId),
        storage.getContacts(orgId),
        storage.getFunds(orgId),
        storage.getDeals(orgId),
        storage.getTasks("", orgId),
        storage.getProjects(orgId),
        storage.getMonitoredUrls(orgId),
      ]);

    const tasksByStatus = {
      pending: tasks.filter(t => t.status === "pending").length,
      in_progress: tasks.filter(t => t.status === "in_progress").length,
      review: tasks.filter(t => t.status === "review").length,
      completed: tasks.filter(t => t.status === "completed").length,
      rejected: tasks.filter(t => t.status === "rejected").length,
    };

    const urlsByStatus = {
      running: urls.filter(u => u.status === "running").length,
      changed: urls.filter(u => u.status === "changed").length,
      no_change: urls.filter(u => u.status === "no_change").length,
      error: urls.filter(u => u.status === "error").length,
    };

    return res.json({
      firms: firms.length,
      contacts: contacts.length,
      funds: funds.length,
      deals: deals.length,
      tasks: tasks.length,
      projects: projects.length,
      monitoredUrls: urls.length,
      tasksByStatus,
      urlsByStatus,
    });
    } catch (error) {
      console.error("Error fetching stats:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================
  // Location Reference Tables (Countries/States/Cities)
  // ============================================

  // Initialize location reference tables
  app.post("/api/locations/init", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      // Create ref_countries table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ref_countries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          iso_code_2 CHAR(2) UNIQUE,
          iso_code_3 CHAR(3) UNIQUE,
          phone_code TEXT,
          currency_code CHAR(3),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create ref_states table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ref_states (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          country_id UUID REFERENCES ref_countries(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          state_code TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(country_id, name)
        )
      `);

      // Create ref_cities table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ref_cities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          state_id UUID REFERENCES ref_states(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(state_id, name)
        )
      `);

      return res.json({ message: "Location reference tables initialized successfully" });
    } catch (error) {
      console.error("Error initializing location tables:", error);
      return res.status(500).json({ message: "Error initializing location tables" });
    }
  });

  // Get all countries
  app.get("/api/locations/countries", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const tableExists = await db.execute(sql`SELECT to_regclass('ref_countries') IS NOT NULL as exists`);
      if (!tableExists.rows[0]?.exists) {
        return res.json([]);
      }
      const result = await db.execute(sql`
        SELECT * FROM ref_countries WHERE is_active = TRUE ORDER BY name ASC
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching countries:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get states by country
  app.get("/api/locations/states/:countryId", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const tableExists = await db.execute(sql`SELECT to_regclass('ref_states') IS NOT NULL as exists`);
      if (!tableExists.rows[0]?.exists) {
        return res.json([]);
      }
      const { countryId } = req.params;
      const result = await db.execute(sql`
        SELECT * FROM ref_states WHERE country_id = ${countryId} AND is_active = TRUE ORDER BY name ASC
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching states:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get cities by state
  app.get("/api/locations/cities/:stateId", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const tableExists = await db.execute(sql`SELECT to_regclass('ref_cities') IS NOT NULL as exists`);
      if (!tableExists.rows[0]?.exists) {
        return res.json([]);
      }
      const { stateId } = req.params;
      const result = await db.execute(sql`
        SELECT * FROM ref_cities WHERE state_id = ${stateId} AND is_active = TRUE ORDER BY name ASC
      `);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching cities:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // CRUD routes for countries (Manager only)
  app.post("/api/locations/countries", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO ref_countries (name, iso_code_2, iso_code_3, phone_code, currency_code)
        VALUES (${data.name}, ${data.iso_code_2 || null}, ${data.iso_code_3 || null}, ${data.phone_code || null}, ${data.currency_code || null})
        RETURNING *
      `);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating country:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/locations/countries/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE ref_countries SET 
          name = ${data.name},
          iso_code_2 = ${data.iso_code_2 || null},
          iso_code_3 = ${data.iso_code_3 || null},
          phone_code = ${data.phone_code || null},
          currency_code = ${data.currency_code || null},
          is_active = ${data.is_active ?? true},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating country:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/locations/countries/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      
      await db.execute(sql`DELETE FROM ref_countries WHERE id = ${id}`);
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting country:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // CRUD routes for states (Manager only)
  app.post("/api/locations/states", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO ref_states (country_id, name, state_code)
        VALUES (${data.country_id}, ${data.name}, ${data.state_code || null})
        RETURNING *
      `);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating state:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/locations/states/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE ref_states SET 
          name = ${data.name},
          state_code = ${data.state_code || null},
          is_active = ${data.is_active ?? true},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating state:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/locations/states/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      
      await db.execute(sql`DELETE FROM ref_states WHERE id = ${id}`);
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting state:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // CRUD routes for cities (Manager only)
  app.post("/api/locations/cities", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO ref_cities (state_id, name)
        VALUES (${data.state_id}, ${data.name})
        RETURNING *
      `);
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating city:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/locations/cities/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      const data = req.body;
      
      const result = await db.execute(sql`
        UPDATE ref_cities SET 
          name = ${data.name},
          is_active = ${data.is_active ?? true},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating city:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/locations/cities/:id", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { id } = req.params;
      
      await db.execute(sql`DELETE FROM ref_cities WHERE id = ${id}`);
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting city:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============== GP Firms ==============
  app.get("/api/entities/gp", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const gps = await storage.getGpFirms(orgId);
      return res.json(gps);
    } catch (error) {
      console.error("Error fetching GP firms:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entities/gp/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const gp = await storage.getGpFirm(req.params.id, orgId);
      if (!gp) return res.status(404).json({ message: "Not found" });
      return res.json(gp);
    } catch (error) {
      console.error("Error fetching GP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entities/gp", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields({ ...req.body, orgId }, userId);
      const parsed = insertEntityGpSchema.parse(dataWithTracking);
      const gp = await storage.createGpFirm(parsed);
      return res.status(201).json(gp);
    } catch (error) {
      console.error("Error creating GP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/entities/gp/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields(req.body, userId);
      const gp = await storage.updateGpFirm(req.params.id, orgId, dataWithTracking);
      if (!gp) return res.status(404).json({ message: "Not found" });
      return res.json(gp);
    } catch (error) {
      console.error("Error updating GP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/entities/gp/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deleted = await storage.deleteGpFirm(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting GP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============== LP Firms ==============
  app.get("/api/entities/lp", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const lps = await storage.getLpFirms(orgId);
      return res.json(lps);
    } catch (error) {
      console.error("Error fetching LP firms:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entities/lp/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const lp = await storage.getLpFirm(req.params.id, orgId);
      if (!lp) return res.status(404).json({ message: "Not found" });
      return res.json(lp);
    } catch (error) {
      console.error("Error fetching LP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entities/lp", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields({ ...req.body, orgId }, userId);
      const parsed = insertEntityLpSchema.parse(dataWithTracking);
      const lp = await storage.createLpFirm(parsed);
      return res.status(201).json(lp);
    } catch (error) {
      console.error("Error creating LP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/entities/lp/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields(req.body, userId);
      const lp = await storage.updateLpFirm(req.params.id, orgId, dataWithTracking);
      if (!lp) return res.status(404).json({ message: "Not found" });
      return res.json(lp);
    } catch (error) {
      console.error("Error updating LP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/entities/lp/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deleted = await storage.deleteLpFirm(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting LP firm:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============== Funds (Entity) ==============
  app.get("/api/entities/funds", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const funds = await storage.getEntityFunds(orgId);
      return res.json(funds);
    } catch (error) {
      console.error("Error fetching entity funds:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entities/funds/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const fund = await storage.getEntityFund(req.params.id, orgId);
      if (!fund) return res.status(404).json({ message: "Not found" });
      return res.json(fund);
    } catch (error) {
      console.error("Error fetching entity fund:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entities/funds", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields({ ...req.body, orgId }, userId);
      const parsed = insertEntityFundSchema.parse(dataWithTracking);
      const fund = await storage.createEntityFund(parsed);
      return res.status(201).json(fund);
    } catch (error) {
      console.error("Error creating entity fund:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/entities/funds/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields(req.body, userId);
      const fund = await storage.updateEntityFund(req.params.id, orgId, dataWithTracking);
      if (!fund) return res.status(404).json({ message: "Not found" });
      return res.json(fund);
    } catch (error) {
      console.error("Error updating entity fund:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/entities/funds/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deleted = await storage.deleteEntityFund(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting entity fund:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============== Portfolio Companies ==============
  app.get("/api/entities/portfolio-companies", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const pcs = await storage.getPortfolioCompanies(orgId);
      return res.json(pcs);
    } catch (error) {
      console.error("Error fetching portfolio companies:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entities/portfolio-companies/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const pc = await storage.getPortfolioCompany(req.params.id, orgId);
      if (!pc) return res.status(404).json({ message: "Not found" });
      return res.json(pc);
    } catch (error) {
      console.error("Error fetching portfolio company:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entities/portfolio-companies", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields({ ...req.body, orgId }, userId);
      const parsed = insertEntityPortfolioCompanySchema.parse(dataWithTracking);
      const pc = await storage.createPortfolioCompany(parsed);
      return res.status(201).json(pc);
    } catch (error) {
      console.error("Error creating portfolio company:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/entities/portfolio-companies/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields(req.body, userId);
      const pc = await storage.updatePortfolioCompany(req.params.id, orgId, dataWithTracking);
      if (!pc) return res.status(404).json({ message: "Not found" });
      return res.json(pc);
    } catch (error) {
      console.error("Error updating portfolio company:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/entities/portfolio-companies/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deleted = await storage.deletePortfolioCompany(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting portfolio company:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============== Service Providers ==============
  app.get("/api/entities/service-providers", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const sps = await storage.getServiceProviders(orgId);
      return res.json(sps);
    } catch (error) {
      console.error("Error fetching service providers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entities/service-providers/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const sp = await storage.getServiceProvider(req.params.id, orgId);
      if (!sp) return res.status(404).json({ message: "Not found" });
      return res.json(sp);
    } catch (error) {
      console.error("Error fetching service provider:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entities/service-providers", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields({ ...req.body, orgId }, userId);
      const parsed = insertEntityServiceProviderSchema.parse(dataWithTracking);
      const sp = await storage.createServiceProvider(parsed);
      return res.status(201).json(sp);
    } catch (error) {
      console.error("Error creating service provider:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/entities/service-providers/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields(req.body, userId);
      const sp = await storage.updateServiceProvider(req.params.id, orgId, dataWithTracking);
      if (!sp) return res.status(404).json({ message: "Not found" });
      return res.json(sp);
    } catch (error) {
      console.error("Error updating service provider:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/entities/service-providers/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deleted = await storage.deleteServiceProvider(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting service provider:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============== Contacts (Entity) ==============
  app.get("/api/entities/contacts", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const { pool, getTableName } = await import("./db");
      const contactsTable = getTableName("contacts");
      // Note: Local contacts table uses created_by, production uses created_at
      const result = await pool.query(
        `SELECT * FROM ${contactsTable} WHERE org_id = $1`,
        [orgId]
      );
      
      // Convert snake_case keys to camelCase for frontend compatibility
      const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const camelCaseRows = result.rows.map(row => {
        const camelCaseRow: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          camelCaseRow[snakeToCamel(key)] = row[key];
        }
        return camelCaseRow;
      });
      
      return res.json(camelCaseRows);
    } catch (error) {
      console.error("Error fetching entity contacts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entities/contacts/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const contact = await storage.getEntityContact(req.params.id, orgId);
      if (!contact) return res.status(404).json({ message: "Not found" });
      return res.json(contact);
    } catch (error) {
      console.error("Error fetching entity contact:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entities/contacts", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields({ ...req.body, orgId }, userId);
      const parsed = insertEntityContactSchema.parse(dataWithTracking);
      const contact = await storage.createEntityContact(parsed);
      return res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating entity contact:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/entities/contacts/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields(req.body, userId);
      const contact = await storage.updateEntityContact(req.params.id, orgId, dataWithTracking);
      if (!contact) return res.status(404).json({ message: "Not found" });
      return res.json(contact);
    } catch (error) {
      console.error("Error updating entity contact:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/entities/contacts/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deleted = await storage.deleteEntityContact(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting entity contact:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============== Deals (Entity) ==============
  app.get("/api/entities/deals", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deals = await storage.getEntityDeals(orgId);
      return res.json(deals);
    } catch (error) {
      console.error("Error fetching entity deals:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entities/deals/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deal = await storage.getEntityDeal(req.params.id, orgId);
      if (!deal) return res.status(404).json({ message: "Not found" });
      return res.json(deal);
    } catch (error) {
      console.error("Error fetching entity deal:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/entities/deals", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields({ ...req.body, orgId }, userId);
      const parsed = insertEntityDealSchema.parse(dataWithTracking);
      const deal = await storage.createEntityDeal(parsed);
      return res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating entity deal:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/entities/deals/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const userId = getUserIdFromRequest(req);
      const dataWithTracking = addSourceTrackingFields(req.body, userId);
      const deal = await storage.updateEntityDeal(req.params.id, orgId, dataWithTracking);
      if (!deal) return res.status(404).json({ message: "Not found" });
      return res.json(deal);
    } catch (error) {
      console.error("Error updating entity deal:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/entities/deals/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    try {
      const deleted = await storage.deleteEntityDeal(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting entity deal:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // NestAnnotate API endpoints
  app.get("/api/nest-annotate/projects", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, userId, isSuperAdmin, role: userRole } = userInfo;
    
    try {
      const { db } = await import("./db");
      const { labelProjects, annotationTasks } = await import("@shared/schema");
      const { eq, and, inArray, sql } = await import("drizzle-orm");
      
      let projects;
      
      // Super admin sees ALL projects across all orgs
      if (isSuperAdmin) {
        projects = await db.select().from(labelProjects);
      } else if (userRole === "annotator") {
        const assignedTasks = await db
          .select({ projectId: annotationTasks.projectId, status: annotationTasks.status })
          .from(annotationTasks)
          .where(eq(annotationTasks.assignedTo, userId));
        
        if (assignedTasks.length === 0) {
          return res.json([]);
        }
        
        const projectIds = Array.from(new Set(assignedTasks.map(t => t.projectId)));
        projects = await db
          .select()
          .from(labelProjects)
          .where(and(eq(labelProjects.orgId, orgId), inArray(labelProjects.id, projectIds)));
      } else {
        // admin, manager see all projects in their org
        projects = await db.select().from(labelProjects).where(eq(labelProjects.orgId, orgId));
      }
      
      const projectIds = projects.map(p => p.id);
      if (projectIds.length === 0) {
        return res.json([]);
      }
      
      const tasks = await db
        .select()
        .from(annotationTasks)
        .where(inArray(annotationTasks.projectId, projectIds));
      
      const projectsWithStats = projects.map(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const totalItems = projectTasks.length;
        const completedItems = projectTasks.filter(t => t.status === "completed").length;
        
        let projectStatus = "not_started";
        if (totalItems > 0 && completedItems === totalItems) {
          projectStatus = "completed";
        } else if (completedItems > 0) {
          projectStatus = "in_progress";
        }
        
        return {
          id: project.id,
          name: project.name,
          labelType: project.labelType,
          projectCategory: project.projectCategory,
          orgId: project.orgId,
          workContext: project.workContext,
          createdAt: project.createdAt,
          totalItems,
          completedItems,
          projectStatus,
        };
      });
      
      return res.json(projectsWithStats);
    } catch (error) {
      console.error("Error fetching NestAnnotate projects:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/nest-annotate/summary", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    const userRole = req.query.role as string || "annotator";
    
    try {
      const { db } = await import("./db");
      const { labelProjects, annotationTasks } = await import("@shared/schema");
      const { eq, and, ne, inArray } = await import("drizzle-orm");
      
      const projects = await db
        .select({ id: labelProjects.id, labelType: labelProjects.labelType })
        .from(labelProjects)
        .where(eq(labelProjects.orgId, orgId));
      
      if (projects.length === 0) {
        return res.json({
          labelTypeCounts: { text: 0, image: 0, video: 0, audio: 0, transcription: 0, translation: 0 },
          newsCount: 0
        });
      }
      
      const projectIds = projects.map(p => p.id);
      
      let tasksQuery = db
        .select({ projectId: annotationTasks.projectId, assignedTo: annotationTasks.assignedTo })
        .from(annotationTasks)
        .where(and(inArray(annotationTasks.projectId, projectIds), ne(annotationTasks.status, "completed")));
      
      const openTasks = await tasksQuery;
      
      const filteredTasks = userRole === "annotator" && userId
        ? openTasks.filter(t => t.assignedTo === userId)
        : openTasks;
      
      const projectLabelTypeMap = new Map(projects.map(p => [p.id, p.labelType]));
      const labelTypeCounts: Record<string, number> = { text: 0, image: 0, video: 0, audio: 0, transcription: 0, translation: 0 };
      
      filteredTasks.forEach(task => {
        const labelType = projectLabelTypeMap.get(task.projectId);
        if (labelType && labelType in labelTypeCounts) {
          labelTypeCounts[labelType]++;
        }
      });
      
      return res.json({
        labelTypeCounts,
        newsCount: 0
      });
    } catch (error) {
      console.error("Error fetching NestAnnotate summary:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/nest-annotate/news-count", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    const userRole = req.query.role as string || "annotator";
    
    try {
      const { db } = await import("./db");
      const { labelProjects, annotationTasks } = await import("@shared/schema");
      const { eq, and, ne, inArray } = await import("drizzle-orm");
      
      const newsProjects = await db
        .select({ id: labelProjects.id })
        .from(labelProjects)
        .where(and(
          eq(labelProjects.orgId, orgId),
          eq(labelProjects.labelType, "text"),
          eq(labelProjects.projectCategory, "news")
        ));
      
      if (newsProjects.length === 0) {
        return res.json({ count: 0 });
      }
      
      const projectIds = newsProjects.map(p => p.id);
      
      let openTasks = await db
        .select({ id: annotationTasks.id, assignedTo: annotationTasks.assignedTo })
        .from(annotationTasks)
        .where(and(inArray(annotationTasks.projectId, projectIds), ne(annotationTasks.status, "completed")));
      
      if (userRole === "annotator" && userId) {
        openTasks = openTasks.filter(t => t.assignedTo === userId);
      }
      
      return res.json({ count: openTasks.length });
    } catch (error) {
      console.error("Error fetching news count:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/nest-annotate/news-items", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    const userRole = req.query.role as string || "annotator";
    
    try {
      const { db } = await import("./db");
      const { labelProjects, annotationTasks, users } = await import("@shared/schema");
      const { eq, and, ne, inArray, desc } = await import("drizzle-orm");
      
      const newsProjects = await db
        .select({ id: labelProjects.id, name: labelProjects.name })
        .from(labelProjects)
        .where(and(
          eq(labelProjects.orgId, orgId),
          eq(labelProjects.labelType, "text"),
          eq(labelProjects.projectCategory, "news")
        ));
      
      if (newsProjects.length === 0) {
        return res.json([]);
      }
      
      const projectIds = newsProjects.map(p => p.id);
      const projectNameMap = new Map(newsProjects.map(p => [p.id, p.name]));
      
      let tasks = await db
        .select()
        .from(annotationTasks)
        .where(and(inArray(annotationTasks.projectId, projectIds), ne(annotationTasks.status, "completed")))
        .orderBy(desc(annotationTasks.createdAt));
      
      if (userRole === "annotator" && userId) {
        tasks = tasks.filter(t => t.assignedTo === userId);
      }
      
      const assignedUserIds = Array.from(new Set(tasks.map(t => t.assignedTo).filter((id): id is string => id !== null)));
      
      let userNameMap = new Map<string, string>();
      if (assignedUserIds.length > 0) {
        const usersData = await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, assignedUserIds));
        userNameMap = new Map(usersData.map(u => [u.id, u.displayName]));
      }
      
      const newsItems = tasks.map(task => {
        const projectName = projectNameMap.get(task.projectId) || "Unknown Project";
        const metadata = (task.metadata as { headline?: string; source_name?: string; publish_date?: string }) || {};
        
        return {
          id: task.id,
          projectId: task.projectId,
          projectName,
          headline: metadata.headline || projectName,
          sourceName: metadata.source_name || null,
          publishDate: metadata.publish_date || null,
          status: task.status,
          assignedTo: task.assignedTo,
          assignedToName: task.assignedTo ? userNameMap.get(task.assignedTo) || null : null,
        };
      });
      
      return res.json(newsItems);
    } catch (error) {
      console.error("Error fetching news items:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================================
  // NestAnnotate Project Management
  // ============================================================

  // Create new NestAnnotate project (manager/admin only)
  app.post("/api/nest-annotate/projects", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    
    if (!await checkManagerRole(req, res)) return;
    
    try {
      const { pool } = await import("./db");
      const { z } = await import("zod");
      
      const createSchema = z.object({
        name: z.string().min(1),
        labelType: z.enum(["text", "image", "video", "audio", "transcription", "translation"]),
        projectCategory: z.enum(["general", "news", "research", "training"]).default("general"),
        workContext: z.enum(["internal", "external"]).default("internal"),
      });
      
      const parsed = createSchema.parse(req.body);
      
      const result = await pool.query(
        `INSERT INTO label_projects (name, label_type, project_category, org_id, work_context)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, label_type as "labelType", project_category as "projectCategory", 
                   org_id as "orgId", work_context as "workContext", created_at as "createdAt"`,
        [parsed.name, parsed.labelType, parsed.projectCategory, orgId, parsed.workContext]
      );
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating NestAnnotate project:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input", errors: error });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single NestAnnotate project with tasks
  app.get("/api/nest-annotate/projects/:id", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin } = userInfo;
    const projectId = req.params.id;
    
    try {
      const { db } = await import("./db");
      const { labelProjects, annotationTasks, users } = await import("@shared/schema");
      const { eq, and, desc, inArray } = await import("drizzle-orm");
      
      // Super admin can access any project; others only their org's projects
      const project = isSuperAdmin
        ? await db.select().from(labelProjects).where(eq(labelProjects.id, projectId))
        : await db.select().from(labelProjects).where(and(eq(labelProjects.id, projectId), eq(labelProjects.orgId, orgId)));
      
      if (project.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const tasks = await db
        .select()
        .from(annotationTasks)
        .where(eq(annotationTasks.projectId, projectId))
        .orderBy(desc(annotationTasks.createdAt));
      
      const assignedUserIds = Array.from(new Set(tasks.map(t => t.assignedTo).filter(Boolean))) as string[];
      let userNameMap = new Map<string, string>();
      
      if (assignedUserIds.length > 0) {
        const usersData = await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, assignedUserIds));
        userNameMap = new Map(usersData.map(u => [u.id, u.displayName]));
      }
      
      const tasksWithUsers = tasks.map(task => ({
        ...task,
        assignedToName: task.assignedTo ? userNameMap.get(task.assignedTo) || null : null,
      }));
      
      return res.json({
        ...project[0],
        tasks: tasksWithUsers,
      });
    } catch (error) {
      console.error("Error fetching NestAnnotate project:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload news to a project (manager/admin only)
  app.post("/api/nest-annotate/projects/:id/upload-news", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin, userId, role } = userInfo;
    const projectId = req.params.id;
    
    // Super admin or manager/admin can upload
    if (!isSuperAdmin && role !== "admin" && role !== "manager") {
      return res.status(403).json({ message: "Only managers and admins can upload news" });
    }
    
    try {
      const { pool } = await import("./db");
      const { z } = await import("zod");
      
      // Validate that this is a news project (super admin bypasses org check)
      const projectCheck = isSuperAdmin
        ? await pool.query(`SELECT id, project_category FROM label_projects WHERE id = $1`, [projectId])
        : await pool.query(`SELECT id, project_category FROM label_projects WHERE id = $1 AND org_id = $2`, [projectId, orgId]);
      
      if (projectCheck.rows.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (projectCheck.rows[0].project_category !== "news") {
        return res.status(400).json({ message: "This project is not a News project" });
      }
      
      const newsItemSchema = z.object({
        headline: z.string().min(1),
        url: z.string().optional(),
        sourceName: z.string().optional(),
        publishDate: z.string().optional(),
        rawText: z.string().min(1),
        cleanedText: z.string().optional(),
        language: z.string().optional(),
        articleState: z.enum(["pending", "completed", "not_relevant"]).optional().default("pending"),
      });
      
      const uploadSchema = z.object({
        articles: z.array(newsItemSchema),
      });
      
      const parsed = uploadSchema.parse(req.body);
      const results = { created: 0, skipped: 0, tasks: 0 };
      
      for (const article of parsed.articles) {
        // Insert into news table
        const newsResult = await pool.query(
          `INSERT INTO news (headline, url, source_name, publish_date, raw_text, cleaned_text, org_id, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [article.headline, article.url || null, article.sourceName || null, article.publishDate || null, 
           article.rawText, article.cleanedText || null, orgId, userId]
        );
        
        const newsId = newsResult.rows[0].id;
        results.created++;
        
        // Only create task if articleState is 'pending'
        if (article.articleState === "pending") {
          const metadata = {
            headline: article.headline,
            source_name: article.sourceName || null,
            publish_date: article.publishDate || null,
            news_id: newsId,
          };
          
          await pool.query(
            `INSERT INTO annotation_tasks (project_id, status, metadata)
             VALUES ($1, $2, $3)`,
            [projectId, "pending", JSON.stringify(metadata)]
          );
          results.tasks++;
        } else {
          results.skipped++;
        }
      }
      
      return res.status(201).json({
        message: `Uploaded ${results.created} articles, created ${results.tasks} tasks, skipped ${results.skipped} (completed/not_relevant)`,
        ...results,
      });
    } catch (error) {
      console.error("Error uploading news:", error);
      if (error instanceof Error && error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input format", errors: error });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Assign task to user (manager/admin only)
  app.patch("/api/nest-annotate/tasks/:taskId/assign", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin, role } = userInfo;
    
    // Super admin or manager/admin can assign
    if (!isSuperAdmin && role !== "admin" && role !== "manager") {
      return res.status(403).json({ message: "Only managers and admins can assign tasks" });
    }
    
    const taskId = req.params.taskId;
    const { userId: assigneeId } = req.body;
    
    try {
      const { pool } = await import("./db");
      
      // Super admin can assign tasks across all orgs
      const result = isSuperAdmin
        ? await pool.query(
            `UPDATE annotation_tasks SET assigned_to = $1 WHERE id = $2 RETURNING id`,
            [assigneeId || null, taskId]
          )
        : await pool.query(
            `UPDATE annotation_tasks SET assigned_to = $1 
             WHERE id = $2 AND project_id IN (SELECT id FROM label_projects WHERE org_id = $3)
             RETURNING id`,
            [assigneeId || null, taskId, orgId]
          );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      return res.json({ message: "Task assigned successfully" });
    } catch (error) {
      console.error("Error assigning task:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Claim task (contributor picks unassigned task)
  app.patch("/api/nest-annotate/tasks/:taskId/claim", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const taskId = req.params.taskId;
    
    try {
      const { pool } = await import("./db");
      
      // Only claim if unassigned
      const result = await pool.query(
        `UPDATE annotation_tasks SET assigned_to = $1, status = 'in_progress'
         WHERE id = $2 AND assigned_to IS NULL 
         AND project_id IN (SELECT id FROM label_projects WHERE org_id = $3)
         RETURNING id`,
        [userId, taskId, orgId]
      );
      
      if (result.rows.length === 0) {
        return res.status(400).json({ message: "Task not available for claiming" });
      }
      
      return res.json({ message: "Task claimed successfully" });
    } catch (error) {
      console.error("Error claiming task:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Submit task (contributor submits after tagging)
  app.patch("/api/nest-annotate/tasks/:taskId/submit", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const taskId = req.params.taskId;
    
    try {
      const { pool } = await import("./db");
      
      // Only submit if assigned to current user
      const result = await pool.query(
        `UPDATE annotation_tasks SET status = 'review'
         WHERE id = $1 AND assigned_to = $2
         AND project_id IN (SELECT id FROM label_projects WHERE org_id = $3)
         RETURNING id`,
        [taskId, userId, orgId]
      );
      
      if (result.rows.length === 0) {
        return res.status(400).json({ message: "Cannot submit this task" });
      }
      
      return res.json({ message: "Task submitted for review" });
    } catch (error) {
      console.error("Error submitting task:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Complete task (manager/admin approves)
  app.patch("/api/nest-annotate/tasks/:taskId/complete", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin, role } = userInfo;
    
    // Super admin or manager/admin can complete tasks
    if (!isSuperAdmin && role !== "admin" && role !== "manager") {
      return res.status(403).json({ message: "Only managers and admins can complete tasks" });
    }
    
    const taskId = req.params.taskId;
    
    try {
      const { pool } = await import("./db");
      
      // Super admin can complete tasks across all orgs
      const result = isSuperAdmin
        ? await pool.query(
            `UPDATE annotation_tasks SET status = 'completed' WHERE id = $1 RETURNING id`,
            [taskId]
          )
        : await pool.query(
            `UPDATE annotation_tasks SET status = 'completed'
             WHERE id = $1 AND project_id IN (SELECT id FROM label_projects WHERE org_id = $2)
             RETURNING id`,
            [taskId, orgId]
          );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      return res.json({ message: "Task completed" });
    } catch (error) {
      console.error("Error completing task:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get available users for assignment (within same org, or all for super admin)
  app.get("/api/nest-annotate/available-users", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin } = userInfo;
    
    try {
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Super admin sees all users across all orgs
      const orgUsers = isSuperAdmin
        ? await db.select({ id: users.id, displayName: users.displayName, role: users.role }).from(users)
        : await db.select({ id: users.id, displayName: users.displayName, role: users.role }).from(users).where(eq(users.orgId, orgId));
      
      return res.json(orgUsers);
    } catch (error) {
      console.error("Error fetching available users:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================================
  // Shell Profile Queue - Manage new entities from tagging
  // ============================================================

  // Get shell profiles (pending ones for manager review)
  app.get("/api/nest-annotate/shell-profiles", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin } = userInfo;
    
    try {
      const { pool } = await import("./db");
      const status = req.query.status || "pending";
      
      // Super admin sees all shell profiles across all orgs
      const result = isSuperAdmin
        ? await pool.query(
            `SELECT sp.*, u.display_name as created_by_name
             FROM shell_profiles sp
             LEFT JOIN users u ON sp.created_by = u.id
             WHERE sp.status = $1
             ORDER BY sp.created_at DESC`,
            [status]
          )
        : await pool.query(
            `SELECT sp.*, u.display_name as created_by_name
             FROM shell_profiles sp
             LEFT JOIN users u ON sp.created_by = u.id
             WHERE sp.org_id = $1 AND sp.status = $2
             ORDER BY sp.created_at DESC`,
            [orgId, status]
          );
      
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching shell profiles:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a shell profile (when tagging a new entity)
  app.post("/api/nest-annotate/shell-profiles", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const { entityType, entityName, sourceTaskId, sourceNewsId, textSpan } = req.body;
      
      if (!entityType || !entityName) {
        return res.status(400).json({ message: "Entity type and name are required" });
      }
      
      const { pool } = await import("./db");
      
      const result = await pool.query(
        `INSERT INTO shell_profiles (org_id, entity_type, entity_name, source_task_id, source_news_id, text_span, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [orgId, entityType, entityName, sourceTaskId || null, sourceNewsId || null, textSpan || null, userId]
      );
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating shell profile:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Approve a shell profile (manager action)
  app.patch("/api/nest-annotate/shell-profiles/:id/approve", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin, role, userId } = userInfo;
    
    // Super admin or manager/admin can approve
    if (!isSuperAdmin && role !== "admin" && role !== "manager") {
      return res.status(403).json({ message: "Only managers and admins can approve shell profiles" });
    }
    
    const profileId = req.params.id;
    const { approvedEntityId } = req.body;
    
    try {
      const { pool } = await import("./db");
      
      // Super admin can approve across all orgs
      const result = isSuperAdmin
        ? await pool.query(
            `UPDATE shell_profiles 
             SET status = 'approved', approved_entity_id = $1, reviewed_by = $2, reviewed_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [approvedEntityId || null, userId, profileId]
          )
        : await pool.query(
            `UPDATE shell_profiles 
             SET status = 'approved', approved_entity_id = $1, reviewed_by = $2, reviewed_at = NOW()
             WHERE id = $3 AND org_id = $4
             RETURNING *`,
            [approvedEntityId || null, userId, profileId, orgId]
          );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Shell profile not found" });
      }
      
      return res.json({ message: "Shell profile approved", profile: result.rows[0] });
    } catch (error) {
      console.error("Error approving shell profile:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reject a shell profile (manager action)
  app.patch("/api/nest-annotate/shell-profiles/:id/reject", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, isSuperAdmin, role, userId } = userInfo;
    
    // Super admin or manager/admin can reject
    if (!isSuperAdmin && role !== "admin" && role !== "manager") {
      return res.status(403).json({ message: "Only managers and admins can reject shell profiles" });
    }
    
    const profileId = req.params.id;
    
    try {
      const { pool } = await import("./db");
      
      // Super admin can reject across all orgs
      const result = isSuperAdmin
        ? await pool.query(
            `UPDATE shell_profiles 
             SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [userId, profileId]
          )
        : await pool.query(
            `UPDATE shell_profiles 
             SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
             WHERE id = $2 AND org_id = $3
             RETURNING *`,
            [userId, profileId, orgId]
          );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Shell profile not found" });
      }
      
      return res.json({ message: "Shell profile rejected", profile: result.rows[0] });
    } catch (error) {
      console.error("Error rejecting shell profile:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ============================================================
  // Entity Edit Lock Routes - Prevent concurrent editing
  // ============================================================
  
  const LOCK_TIMEOUT_MINUTES = 30;

  // Check if a lock exists for an entity
  app.get("/api/locks/:entityType/:entityId", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    
    const { entityType, entityId } = req.params;
    
    try {
      const { db } = await import("./db");
      const { entityEditLocks, entityTypes } = await import("@shared/schema");
      const { eq, and, gt } = await import("drizzle-orm");
      
      // Validate entityType
      if (!entityTypes.includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      const typedEntityType = entityType as typeof entityTypes[number];
      
      const cutoffTime = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000);
      
      const locks = await db
        .select()
        .from(entityEditLocks)
        .where(and(
          eq(entityEditLocks.entityType, typedEntityType),
          eq(entityEditLocks.entityId, entityId),
          eq(entityEditLocks.orgId, orgId),
          gt(entityEditLocks.lockedAt, cutoffTime)
        ));
      
      if (locks.length > 0) {
        return res.json({
          isLocked: true,
          lock: locks[0]
        });
      }
      
      return res.json({ isLocked: false, lock: null });
    } catch (error) {
      console.error("Error checking lock:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Acquire a lock for editing
  app.post("/api/locks/:entityType/:entityId/acquire", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const { entityType, entityId } = req.params;
    
    try {
      const { db } = await import("./db");
      const { entityEditLocks, users, entityTypes } = await import("@shared/schema");
      const { eq, and, gt, lt } = await import("drizzle-orm");
      
      // Validate entityType
      if (!entityTypes.includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      const typedEntityType = entityType as typeof entityTypes[number];
      
      const cutoffTime = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000);
      
      // Clean up expired locks first
      await db
        .delete(entityEditLocks)
        .where(and(
          eq(entityEditLocks.entityType, typedEntityType),
          eq(entityEditLocks.entityId, entityId),
          lt(entityEditLocks.lockedAt, cutoffTime)
        ));
      
      // Check for existing active lock
      const existingLocks = await db
        .select()
        .from(entityEditLocks)
        .where(and(
          eq(entityEditLocks.entityType, typedEntityType),
          eq(entityEditLocks.entityId, entityId),
          eq(entityEditLocks.orgId, orgId),
          gt(entityEditLocks.lockedAt, cutoffTime)
        ));
      
      if (existingLocks.length > 0) {
        const existingLock = existingLocks[0];
        // If user already owns the lock, refresh it
        if (existingLock.lockedBy === userId) {
          await db
            .update(entityEditLocks)
            .set({ lockedAt: new Date() })
            .where(eq(entityEditLocks.id, existingLock.id));
          
          return res.json({
            acquired: true,
            lock: { ...existingLock, lockedAt: new Date() }
          });
        }
        // Another user has the lock
        return res.json({
          acquired: false,
          lock: existingLock
        });
      }
      
      // Get user's display name
      const userData = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId));
      
      const displayName = userData.length > 0 ? userData[0].displayName : "Unknown User";
      
      // Create new lock
      const newLock = await db
        .insert(entityEditLocks)
        .values({
          entityType: entityType as any,
          entityId,
          lockedBy: userId,
          lockedByName: displayName,
          orgId,
        })
        .returning();
      
      return res.json({
        acquired: true,
        lock: newLock[0]
      });
    } catch (error) {
      console.error("Error acquiring lock:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Release a lock
  app.delete("/api/locks/:entityType/:entityId", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const { entityType, entityId } = req.params;
    
    try {
      const { db } = await import("./db");
      const { entityEditLocks, entityTypes } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Validate entityType
      if (!entityTypes.includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      const typedEntityType = entityType as typeof entityTypes[number];
      
      // Only allow releasing own locks
      await db
        .delete(entityEditLocks)
        .where(and(
          eq(entityEditLocks.entityType, typedEntityType),
          eq(entityEditLocks.entityId, entityId),
          eq(entityEditLocks.lockedBy, userId),
          eq(entityEditLocks.orgId, orgId)
        ));
      
      return res.json({ released: true });
    } catch (error) {
      console.error("Error releasing lock:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Heartbeat to keep lock alive
  app.post("/api/locks/:entityType/:entityId/heartbeat", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const { entityType, entityId } = req.params;
    
    try {
      const { db } = await import("./db");
      const { entityEditLocks, entityTypes } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Validate entityType
      if (!entityTypes.includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      const typedEntityType = entityType as typeof entityTypes[number];
      
      const result = await db
        .update(entityEditLocks)
        .set({ lockedAt: new Date() })
        .where(and(
          eq(entityEditLocks.entityType, typedEntityType),
          eq(entityEditLocks.entityId, entityId),
          eq(entityEditLocks.lockedBy, userId),
          eq(entityEditLocks.orgId, orgId)
        ))
        .returning();
      
      if (result.length === 0) {
        return res.json({ renewed: false, message: "Lock not found or expired" });
      }
      
      return res.json({ renewed: true, lock: result[0] });
    } catch (error) {
      console.error("Error renewing lock:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Beacon endpoint for releasing locks on tab close (sendBeacon API)
  // Handle both text/plain (sendBeacon default) and application/json (Blob with type)
  app.post("/api/locks/release-beacon", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    let entityType: string, entityId: string;
    try {
      let parsed;
      if (typeof req.body === "string") {
        parsed = JSON.parse(req.body);
      } else if (typeof req.body === "object" && req.body !== null) {
        parsed = req.body;
      } else {
        return res.status(400).json({ message: "Invalid payload format" });
      }
      entityType = parsed.entityType;
      entityId = parsed.entityId;
    } catch {
      return res.status(400).json({ message: "Invalid JSON payload" });
    }
    
    if (!entityType || !entityId) {
      return res.status(400).json({ message: "entityType and entityId required" });
    }
    
    try {
      const { db } = await import("./db");
      const { entityEditLocks, entityTypes } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      if (!entityTypes.includes(entityType as any)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      const typedEntityType = entityType as typeof entityTypes[number];
      
      await db
        .delete(entityEditLocks)
        .where(and(
          eq(entityEditLocks.entityType, typedEntityType),
          eq(entityEditLocks.entityId, entityId),
          eq(entityEditLocks.lockedBy, userId),
          eq(entityEditLocks.orgId, orgId)
        ));
      
      return res.json({ released: true });
    } catch (error) {
      console.error("Error releasing lock via beacon:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =====================================================
  // DataNest Entities API Routes (for entity picker)
  // =====================================================

  // Get available entities by type for entity picker
  app.get("/api/datanest/entities/:entityType", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    
    const { entityType } = req.params;
    const search = (req.query.search as string) || "";
    const limit = parseInt(req.query.limit as string) || 50;
    
    try {
      const { pool } = await import("./db");
      
      // Map entity type to table and name column (matching Supabase schema)
      const entityTableMap: Record<string, { table: string; nameCol: string }> = {
        gp: { table: "entities_gp", nameCol: "gp_name" },
        lp: { table: "entities_lp", nameCol: "lp_name" },
        fund: { table: "entities_fund", nameCol: "fund_name" },
        portfolio_company: { table: "entities_portfolio_company", nameCol: "company_name" },
        service_provider: { table: "entities_service_provider", nameCol: "sp_name" },
        contact: { table: "entities_contacts", nameCol: "full_name" },
        deal: { table: "entities_deal", nameCol: "deal_name" },
      };
      
      const config = entityTableMap[entityType];
      if (!config) {
        return res.status(400).json({ message: `Invalid entity type: ${entityType}` });
      }
      
      // SECURITY: Filter by org_id for multi-tenant isolation
      let query = `SELECT id, ${config.nameCol} as name FROM ${config.table} WHERE org_id = $1`;
      const params: any[] = [orgId];
      let paramIndex = 2;
      
      if (search) {
        query += ` AND LOWER(${config.nameCol}) LIKE $${paramIndex}`;
        params.push(`%${search.toLowerCase()}%`);
        paramIndex++;
      }
      
      query += ` ORDER BY ${config.nameCol} LIMIT $${paramIndex}`;
      params.push(limit);
      
      const result = await pool.query(query, params);
      
      return res.json(result.rows.map((row: any) => ({
        id: row.id,
        name: row.name || `${entityType.toUpperCase()}-${row.id.slice(0, 8)}`,
        entityType,
      })));
    } catch (error) {
      console.error("Error fetching entities:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a new entity
  app.post("/api/datanest/entities/:entityType", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    
    const { entityType } = req.params;
    const data = req.body;
    
    try {
      const { pool } = await import("./db");
      
      // Define columns for each entity type (matching Supabase schema exactly)
      const entityColumnMap: Record<string, { table: string; columns: string[]; required: string[] }> = {
        gp: { 
          table: "entities_gp", 
          columns: ["gp_name", "gp_legal_name", "gp_type", "headquarters_country", "headquarters_city", "total_aum", "aum_currency", "description", "year_established", "assigned_to", "status"],
          required: ["gp_name"]
        },
        lp: { 
          table: "entities_lp", 
          columns: ["lp_name", "lp_legal_name", "lp_type", "lp_firm_type", "headquarters_country", "headquarters_city", "headquarters_state", "total_aum", "aum_currency", "website", "linkedin_url", "description", "year_established", "assigned_to", "status"],
          required: ["lp_name", "lp_type", "lp_firm_type"]
        },
        fund: { 
          table: "entities_fund", 
          columns: ["fund_name", "fund_legal_name", "fund_type", "gp_id", "vintage_year", "currency", "fundraising_status", "target_fund_size", "final_fund_size", "description", "assigned_to", "status"],
          required: ["fund_name"]
        },
        portfolio_company: { 
          table: "entities_portfolio_company", 
          columns: ["company_name", "legal_name", "company_type", "headquarters_country", "headquarters_city", "industry", "business_model", "website", "description", "year_founded", "assigned_to", "status"],
          required: ["company_name"]
        },
        service_provider: { 
          table: "entities_service_provider", 
          columns: ["sp_name", "sp_legal_name", "sp_category", "headquarters_country", "headquarters_city", "primary_services", "operating_regions", "year_established", "description", "assigned_to", "status"],
          required: ["sp_name"]
        },
        contact: { 
          table: "entities_contacts", 
          columns: ["first_name", "last_name", "middle_name", "full_name", "email", "phone_number", "job_title", "functional_role", "linkedin_url", "contact_priority", "verification_status", "notes", "assigned_to", "status"],
          required: ["first_name", "last_name"]
        },
        deal: { 
          table: "entities_deal", 
          columns: ["deal_name", "deal_type", "deal_stage", "deal_value", "deal_currency", "announcement_date", "completion_date", "fund_id", "portfolio_company_id", "description", "assigned_to", "status"],
          required: ["deal_name"]
        },
      };
      
      const config = entityColumnMap[entityType];
      if (!config) {
        return res.status(400).json({ message: `Invalid entity type: ${entityType}` });
      }
      
      // Map camelCase to snake_case
      const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      // Build insert query dynamically - let PostgreSQL generate UUID via gen_random_uuid()
      const insertColumns = ["id", "org_id"];
      const insertValues: any[] = [orgId];
      let paramIndex = 2;
      
      for (const col of config.columns) {
        // Convert snake_case column to camelCase for lookup in data
        const camelCol = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (data[camelCol] !== undefined && data[camelCol] !== "") {
          insertColumns.push(col);
          insertValues.push(data[camelCol]);
          paramIndex++;
        }
      }
      
      // Check required fields with robust validation
      for (const reqCol of config.required) {
        const camelCol = reqCol.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const value = data[camelCol];
        // Allow 0 and false but reject null, undefined, empty strings
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
          return res.status(400).json({ message: `Missing required field: ${camelCol}` });
        }
      }
      
      // Validate types and sanitize inputs
      const numericColumns = ['vintage_year', 'founded_year', 'employee_count'];
      for (const col of insertColumns) {
        if (numericColumns.includes(col)) {
          const camelCol = col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          const idx = insertColumns.indexOf(col);
          if (insertValues[idx] !== undefined && insertValues[idx] !== null) {
            const num = parseInt(insertValues[idx], 10);
            if (isNaN(num)) {
              return res.status(400).json({ message: `Invalid numeric value for field: ${camelCol}` });
            }
            insertValues[idx] = num;
          }
        }
      }
      
      // Use gen_random_uuid() for id, then parameter placeholders for other values
      const placeholders = ["gen_random_uuid()", ...insertValues.map((_, i) => `$${i + 1}`)].join(", ");
      const query = `INSERT INTO ${config.table} (${insertColumns.join(", ")}) VALUES (${placeholders}) RETURNING *`;
      
      const result = await pool.query(query, insertValues);
      
      // Convert snake_case keys to camelCase for frontend compatibility
      const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      const row = result.rows[0];
      const camelCaseRow: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        camelCaseRow[snakeToCamel(key)] = row[key];
      }
      
      return res.status(201).json(camelCaseRow);
    } catch (error) {
      console.error("Error creating entity:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // =====================================================
  // DataNest Projects API Routes
  // =====================================================

  // Get all projects (with role-based visibility)
  app.get("/api/datanest/projects", async (req: Request, res: Response) => {
    const userInfo = await getUserWithRole(req);
    if (!userInfo) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { orgId, role: userRole, userId, isSuperAdmin } = userInfo;
    
    try {
      const { pool, getProjectTableName } = await import("./db");
      const projectTable = getProjectTableName();
      
      let projects;
      
      // Super Admin sees ALL projects across all orgs
      // Manager/Admin see all projects in their org
      // Use raw pg pool.query to avoid Drizzle schema mapping issues
      // Note: entities_project uses project_name, notes, project_type and has NO assigned_to column
      if (isSuperAdmin) {
        const result = await pool.query(
          `SELECT id, project_name as name, notes as description, project_type as type, status, created_by as "createdBy", org_id as "orgId"
           FROM ${projectTable} ORDER BY created_at DESC`
        );
        projects = result.rows;
      } else if (["admin", "manager"].includes(userRole)) {
        const result = await pool.query(
          `SELECT id, project_name as name, notes as description, project_type as type, status, created_by as "createdBy", org_id as "orgId"
           FROM ${projectTable} WHERE org_id = $1`,
          [orgId]
        );
        projects = result.rows;
      } else {
        // Researcher/Annotator see only projects they are members of
        if (!userId) {
          return res.json([]);
        }
        // Get project memberships using raw SQL
        const { getTableName } = await import("./db");
        const memberResult = await pool.query(
          `SELECT project_id as "projectId" FROM ${getTableName("project_members")} WHERE user_id = $1 AND org_id = $2`,
          [userId, orgId]
        );
        const memberProjects = memberResult.rows as { projectId: string }[];
        
        if (memberProjects.length === 0) {
          return res.json([]);
        }
        
        const projectIds = memberProjects.map(m => m.projectId);
        const result = await pool.query(
          `SELECT id, project_name as name, notes as description, project_type as type, status, created_by as "createdBy", org_id as "orgId"
           FROM ${projectTable} WHERE org_id = $1 AND id = ANY($2)`,
          [orgId, projectIds]
        );
        projects = result.rows;
      }
      
      // Get task counts for each project
      const projectIds = projects.map((p: any) => p.id);
      if (projectIds.length === 0) {
        return res.json([]);
      }
      
      // Get items using raw SQL since tables were just created
      const { getTableName } = await import("./db");
      const itemsTable = getTableName("project_items");
      const itemsResult = await pool.query(
        `SELECT id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                entity_name_snapshot as "entityNameSnapshot", assigned_to as "assignedTo",
                task_status as "taskStatus", notes, org_id as "orgId", created_at as "createdAt"
         FROM ${itemsTable} WHERE project_id = ANY($1)`,
        [projectIds]
      );
      const items = itemsResult.rows as any[];
      
      const projectsWithStats = (projects as any[]).map(project => {
        const projectItems = items.filter(i => i.projectId === project.id);
        const totalItems = projectItems.length;
        const pendingItems = projectItems.filter(i => i.taskStatus === "pending").length;
        const completedItems = projectItems.filter(i => i.taskStatus === "completed").length;
        
        return {
          ...project,
          totalItems,
          pendingItems,
          completedItems,
        };
      });
      
      return res.json(projectsWithStats);
    } catch (error) {
      console.error("Error fetching DataNest projects:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get single project with items
  app.get("/api/datanest/projects/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const projectId = req.params.id;
    
    try {
      const { pool, getProjectTableName, getTableName } = await import("./db");
      const projectTable = getProjectTableName();
      const itemsTable = getTableName("project_items");
      const membersTable = getTableName("project_members");
      
      // Fetch project using raw SQL (entities_project uses project_name, notes, project_type and has NO assigned_to)
      const projectResult = await pool.query(
        `SELECT id, project_name as name, notes as description, project_type as type, status, created_by as "createdBy", org_id as "orgId"
         FROM ${projectTable} WHERE id = $1 AND org_id = $2`,
        [projectId, orgId]
      );
      
      if (projectResult.rows.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }
      const project = projectResult.rows;
      
      // Fetch items using raw SQL (project_items HAS assigned_to)
      const itemsResult = await pool.query(
        `SELECT id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                entity_name_snapshot as "entityNameSnapshot", assigned_to as "assignedTo",
                task_status as "taskStatus", notes, org_id as "orgId", created_at as "createdAt"
         FROM ${itemsTable} WHERE project_id = $1`,
        [projectId]
      );
      const items = itemsResult.rows;
      
      // Fetch members using raw SQL with user names
      const membersResult = await pool.query(
        `SELECT m.id, m.user_id as "userId", m.role, u.display_name as "userName"
         FROM ${membersTable} m LEFT JOIN users u ON m.user_id = u.id
         WHERE m.project_id = $1`,
        [projectId]
      );
      const members = membersResult.rows;
      
      return res.json({
        ...project[0],
        items,
        members,
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper to check if user has manager/admin role
  async function checkManagerRole(req: Request, res: Response): Promise<boolean> {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return false;
    }
    const { db } = await import("./db");
    const { users } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const user = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (user.length === 0 || !["super_admin", "admin", "manager"].includes(user[0].role)) {
      res.status(403).json({ message: "Insufficient permissions - manager role required" });
      return false;
    }
    return true;
  }

  // Create new project (manager/admin only)
  app.post("/api/datanest/projects", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    try {
      const { pool, getProjectTableName } = await import("./db");
      const projectTable = getProjectTableName();
      const { z } = await import("zod");
      
      // Validate input (frontend sends 'name', we map to project_name for Supabase)
      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.string(),
        status: z.string().optional().default("active"),
      });
      
      const parsed = createSchema.parse(req.body);
      
      // Use raw pool.query to insert - let PostgreSQL generate UUID via gen_random_uuid()
      // Note: entities_project uses project_name (not name) and has NO assigned_to column
      const result = await pool.query(
        `INSERT INTO ${projectTable} (id, project_name, notes, project_type, status, created_by, org_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
         RETURNING id, project_name as name, notes as description, project_type as type, status, created_by as "createdBy", org_id as "orgId"`,
        [parsed.name, parsed.description || null, parsed.type, parsed.status, userId, orgId]
      );
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating project:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update project (manager/admin only, whitelisted fields)
  app.put("/api/datanest/projects/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const projectId = req.params.id;
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    try {
      const { pool, getProjectTableName } = await import("./db");
      const projectTable = getProjectTableName();
      
      // Whitelist only mutable fields - never allow orgId, id, createdBy
      // Map frontend field names to Supabase column names
      const { name, description, type, status } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (name !== undefined) { updates.push(`project_name = $${paramIndex++}`); values.push(name); }
      if (description !== undefined) { updates.push(`notes = $${paramIndex++}`); values.push(description); }
      if (type !== undefined) { updates.push(`project_type = $${paramIndex++}`); values.push(type); }
      if (status !== undefined) { updates.push(`status = $${paramIndex++}`); values.push(status); }
      
      if (updates.length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      // Add WHERE clause params
      values.push(projectId, orgId);
      
      const result = await pool.query(
        `UPDATE ${projectTable} SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
         RETURNING id, project_name as name, notes as description, project_type as type, status, created_by as "createdBy", org_id as "orgId"`,
        values
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error updating project:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get project items (tasks)
  app.get("/api/datanest/projects/:id/items", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    const userRole = req.query.role as string || "annotator";
    const projectId = req.params.id;
    
    try {
      const { pool, getTableName } = await import("./db");
      const itemsTable = getTableName("project_items");
      
      // Use raw pool.query to get items with user display names
      const result = await pool.query(
        `SELECT i.id, i.project_id as "projectId", i.entity_type as "entityType", 
                i.entity_id as "entityId", i.entity_name_snapshot as "entityNameSnapshot",
                i.assigned_to as "assignedTo", i.task_status as "taskStatus", 
                i.notes, i.created_at as "createdAt", i.updated_at as "updatedAt",
                u.display_name as "assignedToName"
         FROM ${itemsTable} i LEFT JOIN users u ON i.assigned_to = u.id
         WHERE i.project_id = $1`,
        [projectId]
      );
      const items = result.rows as any[];
      
      // Filter by assigned user for non-admin roles
      if (!["super_admin", "admin", "manager"].includes(userRole) && userId) {
        return res.json(items.filter(i => i.assignedTo === userId));
      }
      
      return res.json(items);
    } catch (error) {
      console.error("Error fetching project items:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add project item (manager/admin only)
  app.post("/api/datanest/projects/:id/items", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const projectId = req.params.id;
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    try {
      const { pool, getTableName } = await import("./db");
      const itemsTable = getTableName("project_items");
      const { z } = await import("zod");
      
      // Validate input
      const itemSchema = z.object({
        entityType: z.string(),
        entityId: z.string(),
        entityNameSnapshot: z.string().optional(),
        assignedTo: z.string().optional(),
        taskStatus: z.string().optional().default("pending"),
        notes: z.string().optional(),
      });
      
      const parsed = itemSchema.parse(req.body);
      
      // Use raw pool.query to insert
      const result = await pool.query(
        `INSERT INTO ${itemsTable} (project_id, entity_type, entity_id, entity_name_snapshot, assigned_to, task_status, notes, org_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                   entity_name_snapshot as "entityNameSnapshot", assigned_to as "assignedTo", 
                   task_status as "taskStatus", notes, org_id as "orgId", created_at as "createdAt"`,
        [projectId, parsed.entityType, parsed.entityId, parsed.entityNameSnapshot || null, 
         parsed.assignedTo || null, parsed.taskStatus, parsed.notes || null, orgId]
      );
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error adding project item:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk add project items (CSV upload) - manager/admin only
  app.post("/api/datanest/projects/:id/items/bulk", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    const projectId = req.params.id;
    const items = req.body.items as Array<{
      entity_type: string;
      entity_id: string;
      assigned_to: string;
      task_status?: string;
    }>;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array required" });
    }
    
    try {
      const { db } = await import("./db");
      const { entitiesProjectItems, entityTypes } = await import("@shared/schema");
      
      // Validate all items first
      const validationErrors: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.entity_type || !entityTypes.includes(item.entity_type as any)) {
          validationErrors.push(`Row ${i + 1}: Invalid entity_type "${item.entity_type}"`);
        }
        if (!item.entity_id) {
          validationErrors.push(`Row ${i + 1}: entity_id is required`);
        }
        if (!item.assigned_to) {
          validationErrors.push(`Row ${i + 1}: assigned_to is required`);
        }
      }
      
      if (validationErrors.length > 0) {
        return res.status(400).json({ message: "Validation failed", errors: validationErrors });
      }
      
      // Insert all items
      const insertData = items.map(item => ({
        projectId,
        entityType: item.entity_type as any,
        entityId: item.entity_id,
        assignedTo: item.assigned_to,
        taskStatus: (item.task_status || "pending") as any,
        orgId,
      }));
      
      const result = await db.insert(entitiesProjectItems).values(insertData).returning();
      return res.status(201).json({ inserted: result.length, items: result });
    } catch (error) {
      console.error("Error bulk adding items:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update project item (manager/admin only, whitelisted fields)
  app.put("/api/datanest/projects/:projectId/items/:itemId", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const { itemId } = req.params;
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    try {
      const { db } = await import("./db");
      const { entitiesProjectItems } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Whitelist only mutable fields - never allow orgId, id, projectId, createdAt
      const allowedFields = ["assignedTo", "taskStatus", "notes", "entityNameSnapshot"];
      const updateData: Record<string, any> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      const result = await db
        .update(entitiesProjectItems)
        .set(updateData)
        .where(and(eq(entitiesProjectItems.id, itemId), eq(entitiesProjectItems.orgId, orgId)))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      return res.json(result[0]);
    } catch (error) {
      console.error("Error updating item:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Bulk assign items (manager/admin only)
  app.post("/api/datanest/projects/:id/items/assign", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    const { itemIds, assignedTo } = req.body;
    
    if (!Array.isArray(itemIds) || itemIds.length === 0 || !assignedTo) {
      return res.status(400).json({ message: "itemIds array and assignedTo required" });
    }
    
    try {
      const { db } = await import("./db");
      const { entitiesProjectItems } = await import("@shared/schema");
      const { inArray, eq, and } = await import("drizzle-orm");
      
      const result = await db
        .update(entitiesProjectItems)
        .set({ assignedTo, updatedAt: new Date() })
        .where(and(inArray(entitiesProjectItems.id, itemIds), eq(entitiesProjectItems.orgId, orgId)))
        .returning();
      
      return res.json({ updated: result.length });
    } catch (error) {
      console.error("Error bulk assigning:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add project member (manager/admin only)
  app.post("/api/datanest/projects/:id/members", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    const projectId = req.params.id;
    const { userId, role } = req.body;
    
    try {
      const { db } = await import("./db");
      const { entitiesProjectMembers } = await import("@shared/schema");
      
      const result = await db.insert(entitiesProjectMembers).values({
        projectId,
        userId,
        role: role || "member",
        orgId,
      }).returning();
      
      return res.status(201).json(result[0]);
    } catch (error) {
      console.error("Error adding member:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get My Work (all tasks assigned to current user)
  app.get("/api/datanest/my-work", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const { db } = await import("./db");
      const { entitiesProjectItems, entitiesProject } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      const items = await db
        .select({
          id: entitiesProjectItems.id,
          projectId: entitiesProjectItems.projectId,
          entityType: entitiesProjectItems.entityType,
          entityId: entitiesProjectItems.entityId,
          entityNameSnapshot: entitiesProjectItems.entityNameSnapshot,
          taskStatus: entitiesProjectItems.taskStatus,
          notes: entitiesProjectItems.notes,
          updatedAt: entitiesProjectItems.updatedAt,
          projectName: entitiesProject.name,
        })
        .from(entitiesProjectItems)
        .leftJoin(entitiesProject, eq(entitiesProjectItems.projectId, entitiesProject.id))
        .where(and(
          eq(entitiesProjectItems.assignedTo, userId),
          eq(entitiesProjectItems.orgId, orgId)
        ));
      
      // Sort: pending first, then completed
      const sorted = items.sort((a, b) => {
        if (a.taskStatus === "pending" && b.taskStatus !== "pending") return -1;
        if (a.taskStatus !== "pending" && b.taskStatus === "pending") return 1;
        return 0;
      });
      
      return res.json(sorted);
    } catch (error) {
      console.error("Error fetching my work:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get entity counts for dashboard cards
  app.get("/api/datanest/entity-counts", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const result = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM entities_lp WHERE org_id = ${orgId}) as lp_count,
          (SELECT COUNT(*) FROM entities_gp WHERE org_id = ${orgId}) as gp_count,
          (SELECT COUNT(*) FROM entities_fund WHERE org_id = ${orgId}) as fund_count,
          (SELECT COUNT(*) FROM entities_portfolio_company WHERE org_id = ${orgId}) as portfolio_company_count,
          (SELECT COUNT(*) FROM entities_deal WHERE org_id = ${orgId}) as deal_count,
          (SELECT COUNT(*) FROM entities_contacts WHERE org_id = ${orgId}) as contact_count
      `);
      
      const counts = result.rows[0] || {};
      return res.json({
        lp: Number(counts.lp_count) || 0,
        gp: Number(counts.gp_count) || 0,
        fund: Number(counts.fund_count) || 0,
        portfolio_company: Number(counts.portfolio_company_count) || 0,
        deal: Number(counts.deal_count) || 0,
        contact: Number(counts.contact_count) || 0,
      });
    } catch (error) {
      console.error("Error fetching entity counts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
