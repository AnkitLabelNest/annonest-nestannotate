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
      console.log("[auth] No x-user-id header found");
      return null;
    }
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`[auth] User not found in database for id: ${userId}`);
      return null;
    }
    console.log(`[auth] User found: ${user.displayName}, role: ${user.role}, orgId: ${user.orgId}`);
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

  // Tasks routes with org scoping (super_admin sees all)
  app.get("/api/tasks", async (req: Request, res: Response) => {
    const { orgId, isSuperAdmin } = await getOrgFilter(req);
    const projectId = req.query.projectId as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const status = req.query.status as string | undefined;
    // Super admin sees all tasks
    if (isSuperAdmin) {
      const allTasks = await storage.getAllTasks(projectId, assignedTo, status);
      return res.json(allTasks);
    }
    const tasks = await storage.getTasks(orgId!, projectId, assignedTo, status);
    return res.json(tasks);
  });

  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    const { orgId, isSuperAdmin } = await getOrgFilter(req);
    // Super admin can access any task
    if (isSuperAdmin) {
      const task = await storage.getTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      return res.json(task);
    }
    const task = await storage.getTask(req.params.id, orgId!);
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
        UNION ALL SELECT 'entities_contact', count(*)::int FROM entities_contact
        UNION ALL SELECT 'entities_portfolio_company', count(*)::int FROM entities_portfolio_company
        UNION ALL SELECT 'public_company_snapshot', CASE WHEN to_regclass('public_company_snapshot') IS NOT NULL THEN (SELECT count(*)::int FROM public_company_snapshot) ELSE 0 END
        UNION ALL SELECT 'relationships', CASE WHEN to_regclass('relationships') IS NOT NULL THEN (SELECT count(*)::int FROM relationships) ELSE 0 END
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
        INSERT INTO entities_gp (
          org_id, gp_name, gp_legal_name, gp_short_name, firm_type, year_founded,
          headquarters_country, headquarters_city, operating_regions, website,
          regulatory_status, primary_regulator, registration_number, registration_jurisdiction,
          total_aum, aum_currency, primary_asset_classes, investment_stages,
          industry_focus, geographic_focus, number_of_funds, active_funds_count,
          total_capital_raised, first_fund_vintage, latest_fund_vintage, estimated_deal_count,
          ownership_type, parent_company, advisory_arms, office_locations,
          employee_count_band, investment_professionals_count, senior_investment_professionals_count,
          top_quartile_flag, track_record_years, performance_data_available,
          esg_policy_available, pri_signatory, dei_policy_available, sustainability_report_url,
          data_confidence_score, verification_method, last_verified_date, source_coverage,
          email, phone, linkedin_url, assigned_to
        ) VALUES (
          ${orgId}, ${data.gp_name}, ${data.gp_legal_name || null}, ${data.gp_short_name || null},
          ${data.firm_type || null}, ${data.year_founded || null},
          ${data.headquarters_country || null}, ${data.headquarters_city || null},
          ${data.operating_regions || null}, ${data.website || null},
          ${data.regulatory_status || null}, ${data.primary_regulator || null},
          ${data.registration_number || null}, ${data.registration_jurisdiction || null},
          ${data.total_aum || null}, ${data.aum_currency || null},
          ${data.primary_asset_classes || null}, ${data.investment_stages || null},
          ${data.industry_focus || null}, ${data.geographic_focus || null},
          ${data.number_of_funds || null}, ${data.active_funds_count || null},
          ${data.total_capital_raised || null}, ${data.first_fund_vintage || null},
          ${data.latest_fund_vintage || null}, ${data.estimated_deal_count || null},
          ${data.ownership_type || null}, ${data.parent_company || null},
          ${data.advisory_arms || null}, ${data.office_locations || null},
          ${data.employee_count_band || null}, ${data.investment_professionals_count || null},
          ${data.senior_investment_professionals_count || null}, ${data.top_quartile_flag || null},
          ${data.track_record_years || null}, ${data.performance_data_available || null},
          ${data.esg_policy_available || null}, ${data.pri_signatory || null},
          ${data.dei_policy_available || null}, ${data.sustainability_report_url || null},
          ${data.data_confidence_score || null}, ${data.verification_method || null},
          ${data.last_verified_date || null}, ${data.source_coverage || null},
          ${data.email || null}, ${data.phone || null}, ${data.linkedin_url || null},
          ${data.assigned_to || null}
        )
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
          gp_name = COALESCE(${data.gp_name}, gp_name),
          gp_legal_name = COALESCE(${data.gp_legal_name}, gp_legal_name),
          gp_short_name = COALESCE(${data.gp_short_name}, gp_short_name),
          firm_type = COALESCE(${data.firm_type}, firm_type),
          year_founded = COALESCE(${data.year_founded}, year_founded),
          headquarters_country = COALESCE(${data.headquarters_country}, headquarters_country),
          headquarters_city = COALESCE(${data.headquarters_city}, headquarters_city),
          operating_regions = COALESCE(${data.operating_regions}, operating_regions),
          website = COALESCE(${data.website}, website),
          regulatory_status = COALESCE(${data.regulatory_status}, regulatory_status),
          primary_regulator = COALESCE(${data.primary_regulator}, primary_regulator),
          registration_number = COALESCE(${data.registration_number}, registration_number),
          registration_jurisdiction = COALESCE(${data.registration_jurisdiction}, registration_jurisdiction),
          total_aum = COALESCE(${data.total_aum}, total_aum),
          aum_currency = COALESCE(${data.aum_currency}, aum_currency),
          primary_asset_classes = COALESCE(${data.primary_asset_classes}, primary_asset_classes),
          investment_stages = COALESCE(${data.investment_stages}, investment_stages),
          industry_focus = COALESCE(${data.industry_focus}, industry_focus),
          geographic_focus = COALESCE(${data.geographic_focus}, geographic_focus),
          number_of_funds = COALESCE(${data.number_of_funds}, number_of_funds),
          active_funds_count = COALESCE(${data.active_funds_count}, active_funds_count),
          total_capital_raised = COALESCE(${data.total_capital_raised}, total_capital_raised),
          first_fund_vintage = COALESCE(${data.first_fund_vintage}, first_fund_vintage),
          latest_fund_vintage = COALESCE(${data.latest_fund_vintage}, latest_fund_vintage),
          estimated_deal_count = COALESCE(${data.estimated_deal_count}, estimated_deal_count),
          ownership_type = COALESCE(${data.ownership_type}, ownership_type),
          parent_company = COALESCE(${data.parent_company}, parent_company),
          advisory_arms = COALESCE(${data.advisory_arms}, advisory_arms),
          office_locations = COALESCE(${data.office_locations}, office_locations),
          employee_count_band = COALESCE(${data.employee_count_band}, employee_count_band),
          investment_professionals_count = COALESCE(${data.investment_professionals_count}, investment_professionals_count),
          senior_investment_professionals_count = COALESCE(${data.senior_investment_professionals_count}, senior_investment_professionals_count),
          top_quartile_flag = COALESCE(${data.top_quartile_flag}, top_quartile_flag),
          track_record_years = COALESCE(${data.track_record_years}, track_record_years),
          performance_data_available = COALESCE(${data.performance_data_available}, performance_data_available),
          esg_policy_available = COALESCE(${data.esg_policy_available}, esg_policy_available),
          pri_signatory = COALESCE(${data.pri_signatory}, pri_signatory),
          dei_policy_available = COALESCE(${data.dei_policy_available}, dei_policy_available),
          sustainability_report_url = COALESCE(${data.sustainability_report_url}, sustainability_report_url),
          data_confidence_score = COALESCE(${data.data_confidence_score}, data_confidence_score),
          verification_method = COALESCE(${data.verification_method}, verification_method),
          last_verified_date = COALESCE(${data.last_verified_date}, last_verified_date),
          source_coverage = COALESCE(${data.source_coverage}, source_coverage),
          email = COALESCE(${data.email}, email),
          phone = COALESCE(${data.phone}, phone),
          linkedin_url = COALESCE(${data.linkedin_url}, linkedin_url),
          assigned_to = COALESCE(${data.assigned_to}, assigned_to),
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
        INSERT INTO entities_lp (
          org_id, lp_name, lp_legal_name, lp_short_name, lp_type, year_established,
          headquarters_country, headquarters_city, operating_regions, website,
          total_aum, aum_currency, private_markets_allocation_percent, target_allocation_percent,
          asset_class_preferences, geographic_preferences, industry_preferences,
          active_fund_commitments_count, total_fund_commitments_lifetime,
          direct_investment_flag, co_investment_flag, average_commitment_size, commitment_size_currency,
          ownership_type, employee_count_band, investment_team_size,
          internal_management_flag, outsourcing_flag, fund_stage_preference, fund_size_preference,
          ticket_size_band, esg_policy_available, pri_signatory, impact_investing_flag,
          exclusions_policy, sustainability_report_url, data_confidence_score,
          verification_method, last_verified_date, source_coverage,
          email, phone, linkedin_url, assigned_to
        ) VALUES (
          ${orgId}, ${data.lp_name}, ${data.lp_legal_name || null}, ${data.lp_short_name || null},
          ${data.lp_type || data.investor_type || null}, ${data.year_established || null},
          ${data.headquarters_country || null}, ${data.headquarters_city || null},
          ${data.operating_regions || null}, ${data.website || null},
          ${data.total_aum || null}, ${data.aum_currency || null},
          ${data.private_markets_allocation_percent || null}, ${data.target_allocation_percent || null},
          ${data.asset_class_preferences || null}, ${data.geographic_preferences || null},
          ${data.industry_preferences || null}, ${data.active_fund_commitments_count || null},
          ${data.total_fund_commitments_lifetime || null}, ${data.direct_investment_flag || null},
          ${data.co_investment_flag || null}, ${data.average_commitment_size || null},
          ${data.commitment_size_currency || null}, ${data.ownership_type || null},
          ${data.employee_count_band || null}, ${data.investment_team_size || null},
          ${data.internal_management_flag || null}, ${data.outsourcing_flag || null},
          ${data.fund_stage_preference || null}, ${data.fund_size_preference || null},
          ${data.ticket_size_band || null}, ${data.esg_policy_available || null},
          ${data.pri_signatory || null}, ${data.impact_investing_flag || null},
          ${data.exclusions_policy || null}, ${data.sustainability_report_url || null},
          ${data.data_confidence_score || null}, ${data.verification_method || null},
          ${data.last_verified_date || null}, ${data.source_coverage || null},
          ${data.email || null}, ${data.phone || null}, ${data.linkedin_url || null},
          ${data.assigned_to || null}
        )
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
          lp_name = COALESCE(${data.lp_name}, lp_name),
          lp_legal_name = COALESCE(${data.lp_legal_name}, lp_legal_name),
          lp_short_name = COALESCE(${data.lp_short_name}, lp_short_name),
          lp_type = COALESCE(${data.lp_type}, lp_type),
          year_established = COALESCE(${data.year_established}, year_established),
          headquarters_country = COALESCE(${data.headquarters_country}, headquarters_country),
          headquarters_city = COALESCE(${data.headquarters_city}, headquarters_city),
          operating_regions = COALESCE(${data.operating_regions}, operating_regions),
          website = COALESCE(${data.website}, website),
          total_aum = COALESCE(${data.total_aum}, total_aum),
          aum_currency = COALESCE(${data.aum_currency}, aum_currency),
          private_markets_allocation_percent = COALESCE(${data.private_markets_allocation_percent}, private_markets_allocation_percent),
          target_allocation_percent = COALESCE(${data.target_allocation_percent}, target_allocation_percent),
          asset_class_preferences = COALESCE(${data.asset_class_preferences}, asset_class_preferences),
          geographic_preferences = COALESCE(${data.geographic_preferences}, geographic_preferences),
          industry_preferences = COALESCE(${data.industry_preferences}, industry_preferences),
          active_fund_commitments_count = COALESCE(${data.active_fund_commitments_count}, active_fund_commitments_count),
          total_fund_commitments_lifetime = COALESCE(${data.total_fund_commitments_lifetime}, total_fund_commitments_lifetime),
          direct_investment_flag = COALESCE(${data.direct_investment_flag}, direct_investment_flag),
          co_investment_flag = COALESCE(${data.co_investment_flag}, co_investment_flag),
          average_commitment_size = COALESCE(${data.average_commitment_size}, average_commitment_size),
          commitment_size_currency = COALESCE(${data.commitment_size_currency}, commitment_size_currency),
          ownership_type = COALESCE(${data.ownership_type}, ownership_type),
          employee_count_band = COALESCE(${data.employee_count_band}, employee_count_band),
          investment_team_size = COALESCE(${data.investment_team_size}, investment_team_size),
          internal_management_flag = COALESCE(${data.internal_management_flag}, internal_management_flag),
          outsourcing_flag = COALESCE(${data.outsourcing_flag}, outsourcing_flag),
          fund_stage_preference = COALESCE(${data.fund_stage_preference}, fund_stage_preference),
          fund_size_preference = COALESCE(${data.fund_size_preference}, fund_size_preference),
          ticket_size_band = COALESCE(${data.ticket_size_band}, ticket_size_band),
          esg_policy_available = COALESCE(${data.esg_policy_available}, esg_policy_available),
          pri_signatory = COALESCE(${data.pri_signatory}, pri_signatory),
          impact_investing_flag = COALESCE(${data.impact_investing_flag}, impact_investing_flag),
          exclusions_policy = COALESCE(${data.exclusions_policy}, exclusions_policy),
          sustainability_report_url = COALESCE(${data.sustainability_report_url}, sustainability_report_url),
          data_confidence_score = COALESCE(${data.data_confidence_score}, data_confidence_score),
          verification_method = COALESCE(${data.verification_method}, verification_method),
          last_verified_date = COALESCE(${data.last_verified_date}, last_verified_date),
          source_coverage = COALESCE(${data.source_coverage}, source_coverage),
          email = COALESCE(${data.email}, email),
          phone = COALESCE(${data.phone}, phone),
          linkedin_url = COALESCE(${data.linkedin_url}, linkedin_url),
          assigned_to = COALESCE(${data.assigned_to}, assigned_to),
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
        INSERT INTO entities_fund (
          org_id, fund_name, fund_legal_name, fund_short_name, fund_type, strategy, vintage_year,
          fund_currency, fund_status, gp_id, gp_name_snapshot, target_fund_size, hard_cap,
          fund_size_final, capital_called, capital_distributed, remaining_value,
          first_close_date, final_close_date, fundraising_status, number_of_lps,
          cornerstone_investor_flag, primary_asset_class, investment_stage, industry_focus,
          geographic_focus, net_irr, gross_irr, tvpi, dpi, rvpi,
          performance_data_available, performance_as_of_date, deal_count,
          active_portfolio_companies_count, realized_portfolio_companies_count,
          esg_integration_flag, impact_fund_flag, sustainability_objective,
          data_confidence_score, verification_method, last_verified_date, source_coverage, assigned_to
        ) VALUES (
          ${orgId}, ${data.fund_name}, ${data.fund_legal_name || null}, ${data.fund_short_name || null},
          ${data.fund_type || null}, ${data.strategy || null}, ${data.vintage_year || null},
          ${data.fund_currency || null}, ${data.fund_status || null}, ${data.gp_id || null},
          ${data.gp_name_snapshot || null}, ${data.target_fund_size || null}, ${data.hard_cap || null},
          ${data.fund_size_final || null}, ${data.capital_called || null}, ${data.capital_distributed || null},
          ${data.remaining_value || null}, ${data.first_close_date || null}, ${data.final_close_date || null},
          ${data.fundraising_status || null}, ${data.number_of_lps || null},
          ${data.cornerstone_investor_flag || null}, ${data.primary_asset_class || null},
          ${data.investment_stage || null}, ${data.industry_focus || null}, ${data.geographic_focus || null},
          ${data.net_irr || null}, ${data.gross_irr || null}, ${data.tvpi || null},
          ${data.dpi || null}, ${data.rvpi || null}, ${data.performance_data_available || null},
          ${data.performance_as_of_date || null}, ${data.deal_count || null},
          ${data.active_portfolio_companies_count || null}, ${data.realized_portfolio_companies_count || null},
          ${data.esg_integration_flag || null}, ${data.impact_fund_flag || null},
          ${data.sustainability_objective || null}, ${data.data_confidence_score || null},
          ${data.verification_method || null}, ${data.last_verified_date || null},
          ${data.source_coverage || null}, ${data.assigned_to || null}
        )
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
          fund_name = COALESCE(${data.fund_name}, fund_name),
          fund_legal_name = COALESCE(${data.fund_legal_name}, fund_legal_name),
          fund_short_name = COALESCE(${data.fund_short_name}, fund_short_name),
          fund_type = COALESCE(${data.fund_type}, fund_type),
          strategy = COALESCE(${data.strategy}, strategy),
          vintage_year = COALESCE(${data.vintage_year}, vintage_year),
          fund_currency = COALESCE(${data.fund_currency}, fund_currency),
          fund_status = COALESCE(${data.fund_status}, fund_status),
          gp_id = COALESCE(${data.gp_id}, gp_id),
          gp_name_snapshot = COALESCE(${data.gp_name_snapshot}, gp_name_snapshot),
          target_fund_size = COALESCE(${data.target_fund_size}, target_fund_size),
          hard_cap = COALESCE(${data.hard_cap}, hard_cap),
          fund_size_final = COALESCE(${data.fund_size_final}, fund_size_final),
          capital_called = COALESCE(${data.capital_called}, capital_called),
          capital_distributed = COALESCE(${data.capital_distributed}, capital_distributed),
          remaining_value = COALESCE(${data.remaining_value}, remaining_value),
          first_close_date = COALESCE(${data.first_close_date}, first_close_date),
          final_close_date = COALESCE(${data.final_close_date}, final_close_date),
          fundraising_status = COALESCE(${data.fundraising_status}, fundraising_status),
          number_of_lps = COALESCE(${data.number_of_lps}, number_of_lps),
          cornerstone_investor_flag = COALESCE(${data.cornerstone_investor_flag}, cornerstone_investor_flag),
          primary_asset_class = COALESCE(${data.primary_asset_class}, primary_asset_class),
          investment_stage = COALESCE(${data.investment_stage}, investment_stage),
          industry_focus = COALESCE(${data.industry_focus}, industry_focus),
          geographic_focus = COALESCE(${data.geographic_focus}, geographic_focus),
          net_irr = COALESCE(${data.net_irr}, net_irr),
          gross_irr = COALESCE(${data.gross_irr}, gross_irr),
          tvpi = COALESCE(${data.tvpi}, tvpi),
          dpi = COALESCE(${data.dpi}, dpi),
          rvpi = COALESCE(${data.rvpi}, rvpi),
          performance_data_available = COALESCE(${data.performance_data_available}, performance_data_available),
          performance_as_of_date = COALESCE(${data.performance_as_of_date}, performance_as_of_date),
          deal_count = COALESCE(${data.deal_count}, deal_count),
          active_portfolio_companies_count = COALESCE(${data.active_portfolio_companies_count}, active_portfolio_companies_count),
          realized_portfolio_companies_count = COALESCE(${data.realized_portfolio_companies_count}, realized_portfolio_companies_count),
          esg_integration_flag = COALESCE(${data.esg_integration_flag}, esg_integration_flag),
          impact_fund_flag = COALESCE(${data.impact_fund_flag}, impact_fund_flag),
          sustainability_objective = COALESCE(${data.sustainability_objective}, sustainability_objective),
          data_confidence_score = COALESCE(${data.data_confidence_score}, data_confidence_score),
          verification_method = COALESCE(${data.verification_method}, verification_method),
          last_verified_date = COALESCE(${data.last_verified_date}, last_verified_date),
          source_coverage = COALESCE(${data.source_coverage}, source_coverage),
          assigned_to = COALESCE(${data.assigned_to}, assigned_to),
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
          org_id, company_name, company_legal_name, company_short_name, founded_year,
          headquarters_country, headquarters_city, operating_regions, website, linkedin_url,
          primary_industry, sub_industry, business_description, business_model_type,
          revenue_model, employee_count_band, latest_revenue, revenue_currency, revenue_year,
          growth_stage, current_owner_type, controlling_gp_id, controlling_fund_id,
          first_investment_year, investment_status, total_capital_invested, investment_currency,
          entry_valuation, current_valuation, ownership_percentage,
          revenue_growth_percent, ebitda, ebitda_margin_percent, net_debt,
          exit_type, exit_date, exit_valuation, moic_realized,
          data_confidence_score, verification_method, last_verified_date, source_coverage, assigned_to
        )
        VALUES (
          ${orgId}, ${data.company_name}, ${data.company_legal_name || null}, ${data.company_short_name || null},
          ${data.founded_year || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null},
          ${data.operating_regions || null}, ${data.website || null}, ${data.linkedin_url || null},
          ${data.primary_industry || null}, ${data.sub_industry || null}, ${data.business_description || null},
          ${data.business_model_type || null}, ${data.revenue_model || null}, ${data.employee_count_band || null},
          ${data.latest_revenue || null}, ${data.revenue_currency || null}, ${data.revenue_year || null},
          ${data.growth_stage || null}, ${data.current_owner_type || null}, ${data.controlling_gp_id || null},
          ${data.controlling_fund_id || null}, ${data.first_investment_year || null}, ${data.investment_status || null},
          ${data.total_capital_invested || null}, ${data.investment_currency || null},
          ${data.entry_valuation || null}, ${data.current_valuation || null}, ${data.ownership_percentage || null},
          ${data.revenue_growth_percent || null}, ${data.ebitda || null}, ${data.ebitda_margin_percent || null},
          ${data.net_debt || null}, ${data.exit_type || null}, ${data.exit_date || null},
          ${data.exit_valuation || null}, ${data.moic_realized || null}, ${data.data_confidence_score || null},
          ${data.verification_method || null}, ${data.last_verified_date || null},
          ${data.source_coverage || null}, ${data.assigned_to || null}
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
          company_name = COALESCE(${data.company_name}, company_name),
          company_legal_name = COALESCE(${data.company_legal_name}, company_legal_name),
          company_short_name = COALESCE(${data.company_short_name}, company_short_name),
          founded_year = COALESCE(${data.founded_year}, founded_year),
          headquarters_country = COALESCE(${data.headquarters_country}, headquarters_country),
          headquarters_city = COALESCE(${data.headquarters_city}, headquarters_city),
          operating_regions = COALESCE(${data.operating_regions}, operating_regions),
          website = COALESCE(${data.website}, website),
          linkedin_url = COALESCE(${data.linkedin_url}, linkedin_url),
          primary_industry = COALESCE(${data.primary_industry}, primary_industry),
          sub_industry = COALESCE(${data.sub_industry}, sub_industry),
          business_description = COALESCE(${data.business_description}, business_description),
          business_model_type = COALESCE(${data.business_model_type}, business_model_type),
          revenue_model = COALESCE(${data.revenue_model}, revenue_model),
          employee_count_band = COALESCE(${data.employee_count_band}, employee_count_band),
          latest_revenue = COALESCE(${data.latest_revenue}, latest_revenue),
          revenue_currency = COALESCE(${data.revenue_currency}, revenue_currency),
          revenue_year = COALESCE(${data.revenue_year}, revenue_year),
          growth_stage = COALESCE(${data.growth_stage}, growth_stage),
          current_owner_type = COALESCE(${data.current_owner_type}, current_owner_type),
          controlling_gp_id = COALESCE(${data.controlling_gp_id}, controlling_gp_id),
          controlling_fund_id = COALESCE(${data.controlling_fund_id}, controlling_fund_id),
          first_investment_year = COALESCE(${data.first_investment_year}, first_investment_year),
          investment_status = COALESCE(${data.investment_status}, investment_status),
          total_capital_invested = COALESCE(${data.total_capital_invested}, total_capital_invested),
          investment_currency = COALESCE(${data.investment_currency}, investment_currency),
          entry_valuation = COALESCE(${data.entry_valuation}, entry_valuation),
          current_valuation = COALESCE(${data.current_valuation}, current_valuation),
          ownership_percentage = COALESCE(${data.ownership_percentage}, ownership_percentage),
          revenue_growth_percent = COALESCE(${data.revenue_growth_percent}, revenue_growth_percent),
          ebitda = COALESCE(${data.ebitda}, ebitda),
          ebitda_margin_percent = COALESCE(${data.ebitda_margin_percent}, ebitda_margin_percent),
          net_debt = COALESCE(${data.net_debt}, net_debt),
          exit_type = COALESCE(${data.exit_type}, exit_type),
          exit_date = COALESCE(${data.exit_date}, exit_date),
          exit_valuation = COALESCE(${data.exit_valuation}, exit_valuation),
          moic_realized = COALESCE(${data.moic_realized}, moic_realized),
          data_confidence_score = COALESCE(${data.data_confidence_score}, data_confidence_score),
          verification_method = COALESCE(${data.verification_method}, verification_method),
          last_verified_date = COALESCE(${data.last_verified_date}, last_verified_date),
          source_coverage = COALESCE(${data.source_coverage}, source_coverage),
          assigned_to = COALESCE(${data.assigned_to}, assigned_to),
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
        INSERT INTO entities_service_provider (
          org_id, service_provider_name, service_provider_legal_name, service_provider_short_name,
          service_provider_type, year_founded, headquarters_country, headquarters_city,
          operating_regions, website, primary_services, secondary_services,
          asset_class_focus, fund_stage_focus, gp_type_focus, geographic_focus,
          employee_count_band, relevant_professionals_count, years_in_market,
          notable_clients_count, regulatory_status, primary_regulator,
          data_confidence_score, verification_method, last_verified_date, source_coverage,
          email, phone, linkedin_url, assigned_to
        ) VALUES (
          ${orgId}, ${data.service_provider_name || data.sp_name}, ${data.service_provider_legal_name || null},
          ${data.service_provider_short_name || null}, ${data.service_provider_type || data.sp_category || null},
          ${data.year_founded || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null},
          ${data.operating_regions || null}, ${data.website || null}, ${data.primary_services || null},
          ${data.secondary_services || null}, ${data.asset_class_focus || null}, ${data.fund_stage_focus || null},
          ${data.gp_type_focus || null}, ${data.geographic_focus || null}, ${data.employee_count_band || null},
          ${data.relevant_professionals_count || null}, ${data.years_in_market || null},
          ${data.notable_clients_count || null}, ${data.regulatory_status || null},
          ${data.primary_regulator || null}, ${data.data_confidence_score || null},
          ${data.verification_method || null}, ${data.last_verified_date || null},
          ${data.source_coverage || null}, ${data.email || null}, ${data.phone || null},
          ${data.linkedin_url || null}, ${data.assigned_to || null}
        )
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
          service_provider_name = COALESCE(${data.service_provider_name || data.sp_name}, service_provider_name),
          service_provider_legal_name = COALESCE(${data.service_provider_legal_name}, service_provider_legal_name),
          service_provider_short_name = COALESCE(${data.service_provider_short_name}, service_provider_short_name),
          service_provider_type = COALESCE(${data.service_provider_type}, service_provider_type),
          year_founded = COALESCE(${data.year_founded}, year_founded),
          headquarters_country = COALESCE(${data.headquarters_country}, headquarters_country),
          headquarters_city = COALESCE(${data.headquarters_city}, headquarters_city),
          operating_regions = COALESCE(${data.operating_regions}, operating_regions),
          website = COALESCE(${data.website}, website),
          primary_services = COALESCE(${data.primary_services}, primary_services),
          secondary_services = COALESCE(${data.secondary_services}, secondary_services),
          asset_class_focus = COALESCE(${data.asset_class_focus}, asset_class_focus),
          fund_stage_focus = COALESCE(${data.fund_stage_focus}, fund_stage_focus),
          gp_type_focus = COALESCE(${data.gp_type_focus}, gp_type_focus),
          geographic_focus = COALESCE(${data.geographic_focus}, geographic_focus),
          employee_count_band = COALESCE(${data.employee_count_band}, employee_count_band),
          relevant_professionals_count = COALESCE(${data.relevant_professionals_count}, relevant_professionals_count),
          years_in_market = COALESCE(${data.years_in_market}, years_in_market),
          notable_clients_count = COALESCE(${data.notable_clients_count}, notable_clients_count),
          regulatory_status = COALESCE(${data.regulatory_status}, regulatory_status),
          primary_regulator = COALESCE(${data.primary_regulator}, primary_regulator),
          data_confidence_score = COALESCE(${data.data_confidence_score}, data_confidence_score),
          verification_method = COALESCE(${data.verification_method}, verification_method),
          last_verified_date = COALESCE(${data.last_verified_date}, last_verified_date),
          source_coverage = COALESCE(${data.source_coverage}, source_coverage),
          email = COALESCE(${data.email}, email),
          phone = COALESCE(${data.phone}, phone),
          linkedin_url = COALESCE(${data.linkedin_url}, linkedin_url),
          assigned_to = COALESCE(${data.assigned_to}, assigned_to),
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
              SELECT * FROM entities_contact 
              WHERE primary_affiliation_type = ${linked_entity_type as string} 
                AND primary_affiliation_id = ${linked_entity_id as string}
              ORDER BY created_at DESC
            `)
          : await db.execute(sql`
              SELECT * FROM entities_contact 
              WHERE org_id = ${orgId} 
                AND primary_affiliation_type = ${linked_entity_type as string} 
                AND primary_affiliation_id = ${linked_entity_id as string}
              ORDER BY created_at DESC
            `);
      } else if (unlinked === 'true') {
        result = isSuperAdmin
          ? await db.execute(sql`
              SELECT * FROM entities_contact 
              WHERE (primary_affiliation_id IS NULL OR primary_affiliation_id = '')
              ORDER BY created_at DESC
            `)
          : await db.execute(sql`
              SELECT * FROM entities_contact 
              WHERE org_id = ${orgId} 
                AND (primary_affiliation_id IS NULL OR primary_affiliation_id = '')
              ORDER BY created_at DESC
            `);
      } else {
        result = isSuperAdmin
          ? await db.execute(sql`SELECT * FROM entities_contact ORDER BY created_at DESC`)
          : await db.execute(sql`SELECT * FROM entities_contact WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
      const { linked_entity_type, linked_entity_id, linked_entity_name } = req.body;
      
      const result = await db.execute(sql`
        UPDATE entities_contact 
        SET primary_affiliation_type = ${linked_entity_type}, 
            primary_affiliation_id = ${linked_entity_id},
            primary_affiliation_name_snapshot = ${linked_entity_name || null},
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
        INSERT INTO entities_contact (
          org_id, first_name, last_name, full_name_override, job_title, seniority_level,
          work_email, personal_email, phone_number, linkedin_url,
          primary_affiliation_type, primary_affiliation_id, primary_affiliation_name_snapshot,
          is_key_contact, relationship_strength, last_contacted_date, preferred_contact_method,
          investment_focus_areas, deal_role_types, board_seats,
          data_confidence_score, verification_method, last_verified_date, source_coverage, assigned_to
        )
        VALUES (
          ${orgId}, ${data.first_name}, ${data.last_name || null}, ${data.full_name_override || null},
          ${data.job_title || null}, ${data.seniority_level || null},
          ${data.work_email || data.email || null}, ${data.personal_email || null},
          ${data.phone_number || data.phone || null}, ${data.linkedin_url || null},
          ${data.primary_affiliation_type || null}, ${data.primary_affiliation_id || null},
          ${data.primary_affiliation_name_snapshot || null}, ${data.is_key_contact || null},
          ${data.relationship_strength || null}, ${data.last_contacted_date || null},
          ${data.preferred_contact_method || null}, ${data.investment_focus_areas || null},
          ${data.deal_role_types || null}, ${data.board_seats || null},
          ${data.data_confidence_score || null}, ${data.verification_method || null},
          ${data.last_verified_date || null}, ${data.source_coverage || null},
          ${data.assigned_to || null}
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
        UPDATE entities_contact SET
          first_name = COALESCE(${data.first_name}, first_name),
          last_name = COALESCE(${data.last_name}, last_name),
          full_name_override = COALESCE(${data.full_name_override}, full_name_override),
          job_title = COALESCE(${data.job_title}, job_title),
          seniority_level = COALESCE(${data.seniority_level}, seniority_level),
          work_email = COALESCE(${data.work_email || data.email}, work_email),
          personal_email = COALESCE(${data.personal_email}, personal_email),
          phone_number = COALESCE(${data.phone_number}, phone_number),
          linkedin_url = COALESCE(${data.linkedin_url}, linkedin_url),
          primary_affiliation_type = COALESCE(${data.primary_affiliation_type}, primary_affiliation_type),
          primary_affiliation_id = COALESCE(${data.primary_affiliation_id}, primary_affiliation_id),
          primary_affiliation_name_snapshot = COALESCE(${data.primary_affiliation_name_snapshot}, primary_affiliation_name_snapshot),
          is_key_contact = COALESCE(${data.is_key_contact}, is_key_contact),
          relationship_strength = COALESCE(${data.relationship_strength}, relationship_strength),
          last_contacted_date = COALESCE(${data.last_contacted_date}, last_contacted_date),
          preferred_contact_method = COALESCE(${data.preferred_contact_method}, preferred_contact_method),
          investment_focus_areas = COALESCE(${data.investment_focus_areas}, investment_focus_areas),
          deal_role_types = COALESCE(${data.deal_role_types}, deal_role_types),
          board_seats = COALESCE(${data.board_seats}, board_seats),
          data_confidence_score = COALESCE(${data.data_confidence_score}, data_confidence_score),
          verification_method = COALESCE(${data.verification_method}, verification_method),
          last_verified_date = COALESCE(${data.last_verified_date}, last_verified_date),
          source_coverage = COALESCE(${data.source_coverage}, source_coverage),
          assigned_to = COALESCE(${data.assigned_to}, assigned_to),
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
          org_id, deal_name, transaction_type, announcement_date, close_date, deal_status,
          target_company_id, target_company_name_snapshot, acquirer_id, acquirer_name_snapshot,
          lead_investor_gp_id, lead_investor_gp_name_snapshot, lead_fund_id, lead_fund_name_snapshot,
          co_investors, deal_size, deal_currency, equity_value, enterprise_value,
          stake_acquired_percent, pre_money_valuation, post_money_valuation,
          revenue_at_deal, ebitda_at_deal, revenue_multiple, ebitda_multiple,
          deal_stage, industry, sub_industry, geographic_focus,
          esg_angle_flag, impact_deal_flag, add_on_flag, platform_deal_flag, carve_out_flag,
          data_confidence_score, verification_method, last_verified_date, source_coverage, assigned_to
        )
        VALUES (
          ${orgId}, ${data.deal_name}, ${data.transaction_type || null},
          ${data.announcement_date || null}, ${data.close_date || null}, ${data.deal_status || null},
          ${data.target_company_id || null}, ${data.target_company_name_snapshot || null},
          ${data.acquirer_id || null}, ${data.acquirer_name_snapshot || null},
          ${data.lead_investor_gp_id || null}, ${data.lead_investor_gp_name_snapshot || null},
          ${data.lead_fund_id || null}, ${data.lead_fund_name_snapshot || null},
          ${data.co_investors || null}, ${data.deal_size || null}, ${data.deal_currency || null},
          ${data.equity_value || null}, ${data.enterprise_value || null},
          ${data.stake_acquired_percent || null}, ${data.pre_money_valuation || null},
          ${data.post_money_valuation || null}, ${data.revenue_at_deal || null},
          ${data.ebitda_at_deal || null}, ${data.revenue_multiple || null}, ${data.ebitda_multiple || null},
          ${data.deal_stage || null}, ${data.industry || null}, ${data.sub_industry || null},
          ${data.geographic_focus || null}, ${data.esg_angle_flag || null}, ${data.impact_deal_flag || null},
          ${data.add_on_flag || null}, ${data.platform_deal_flag || null}, ${data.carve_out_flag || null},
          ${data.data_confidence_score || null}, ${data.verification_method || null},
          ${data.last_verified_date || null}, ${data.source_coverage || null}, ${data.assigned_to || null}
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
          deal_name = COALESCE(${data.deal_name}, deal_name),
          transaction_type = COALESCE(${data.transaction_type}, transaction_type),
          announcement_date = COALESCE(${data.announcement_date}, announcement_date),
          close_date = COALESCE(${data.close_date}, close_date),
          deal_status = COALESCE(${data.deal_status}, deal_status),
          target_company_id = COALESCE(${data.target_company_id}, target_company_id),
          target_company_name_snapshot = COALESCE(${data.target_company_name_snapshot}, target_company_name_snapshot),
          acquirer_id = COALESCE(${data.acquirer_id}, acquirer_id),
          acquirer_name_snapshot = COALESCE(${data.acquirer_name_snapshot}, acquirer_name_snapshot),
          lead_investor_gp_id = COALESCE(${data.lead_investor_gp_id}, lead_investor_gp_id),
          lead_investor_gp_name_snapshot = COALESCE(${data.lead_investor_gp_name_snapshot}, lead_investor_gp_name_snapshot),
          lead_fund_id = COALESCE(${data.lead_fund_id}, lead_fund_id),
          lead_fund_name_snapshot = COALESCE(${data.lead_fund_name_snapshot}, lead_fund_name_snapshot),
          co_investors = COALESCE(${data.co_investors}, co_investors),
          deal_size = COALESCE(${data.deal_size}, deal_size),
          deal_currency = COALESCE(${data.deal_currency}, deal_currency),
          equity_value = COALESCE(${data.equity_value}, equity_value),
          enterprise_value = COALESCE(${data.enterprise_value}, enterprise_value),
          stake_acquired_percent = COALESCE(${data.stake_acquired_percent}, stake_acquired_percent),
          pre_money_valuation = COALESCE(${data.pre_money_valuation}, pre_money_valuation),
          post_money_valuation = COALESCE(${data.post_money_valuation}, post_money_valuation),
          revenue_at_deal = COALESCE(${data.revenue_at_deal}, revenue_at_deal),
          ebitda_at_deal = COALESCE(${data.ebitda_at_deal}, ebitda_at_deal),
          revenue_multiple = COALESCE(${data.revenue_multiple}, revenue_multiple),
          ebitda_multiple = COALESCE(${data.ebitda_multiple}, ebitda_multiple),
          deal_stage = COALESCE(${data.deal_stage}, deal_stage),
          industry = COALESCE(${data.industry}, industry),
          sub_industry = COALESCE(${data.sub_industry}, sub_industry),
          geographic_focus = COALESCE(${data.geographic_focus}, geographic_focus),
          esg_angle_flag = COALESCE(${data.esg_angle_flag}, esg_angle_flag),
          impact_deal_flag = COALESCE(${data.impact_deal_flag}, impact_deal_flag),
          add_on_flag = COALESCE(${data.add_on_flag}, add_on_flag),
          platform_deal_flag = COALESCE(${data.platform_deal_flag}, platform_deal_flag),
          carve_out_flag = COALESCE(${data.carve_out_flag}, carve_out_flag),
          data_confidence_score = COALESCE(${data.data_confidence_score}, data_confidence_score),
          verification_method = COALESCE(${data.verification_method}, verification_method),
          last_verified_date = COALESCE(${data.last_verified_date}, last_verified_date),
          source_coverage = COALESCE(${data.source_coverage}, source_coverage),
          assigned_to = COALESCE(${data.assigned_to}, assigned_to),
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
      const { pool, getTableName } = await import("./db");
      
      // Map entity type to table and name column (uses getTableName for proper local/Supabase resolution)
      const entityTableMap: Record<string, { table: string; nameCol: string }> = {
        gp: { table: getTableName("gp"), nameCol: "gp_name" },
        lp: { table: getTableName("lp"), nameCol: "lp_name" },
        fund: { table: getTableName("fund"), nameCol: "fund_name" },
        portfolio_company: { table: getTableName("portfolio_company"), nameCol: "company_name" },
        service_provider: { table: getTableName("service_provider"), nameCol: "service_provider_name" },
        contact: { table: getTableName("contact"), nameCol: "full_name_override" },
        deal: { table: getTableName("deal"), nameCol: "deal_name" },
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
      const { pool, getTableName } = await import("./db");
      
      // Define columns for each entity type (uses getTableName for proper local/Supabase resolution)
      const entityColumnMap: Record<string, { table: string; columns: string[]; required: string[] }> = {
        gp: { 
          table: getTableName("gp"), 
          columns: ["gp_name", "gp_legal_name", "firm_type", "headquarters_country", "headquarters_city", "total_aum", "aum_currency", "year_founded", "assigned_to"],
          required: ["gp_name"]
        },
        lp: { 
          table: getTableName("lp"), 
          columns: ["lp_name", "lp_legal_name", "lp_type", "headquarters_country", "headquarters_city", "total_aum", "aum_currency", "year_established", "assigned_to"],
          required: ["lp_name"]
        },
        fund: { 
          table: getTableName("fund"), 
          columns: ["fund_name", "fund_legal_name", "fund_type", "gp_id", "vintage_year", "fund_currency", "fund_status", "target_fund_size", "fund_size_final", "assigned_to"],
          required: ["fund_name"]
        },
        portfolio_company: { 
          table: getTableName("portfolio_company"), 
          columns: ["company_name", "company_legal_name", "headquarters_country", "headquarters_city", "primary_industry", "business_model_type", "founded_year", "assigned_to"],
          required: ["company_name"]
        },
        service_provider: { 
          table: getTableName("service_provider"), 
          columns: ["service_provider_name", "service_provider_legal_name", "service_provider_type", "headquarters_country", "headquarters_city", "primary_services", "operating_regions", "year_founded", "assigned_to"],
          required: ["service_provider_name"]
        },
        contact: { 
          table: getTableName("contact"), 
          columns: ["first_name", "last_name", "full_name_override", "work_email", "personal_email", "phone_number", "job_title", "seniority_level", "linkedin_url", "assigned_to"],
          required: ["first_name", "last_name"]
        },
        deal: { 
          table: getTableName("deal"), 
          columns: ["deal_name", "transaction_type", "deal_status", "deal_size", "deal_currency", "announcement_date", "close_date", "target_company_id", "lead_investor_gp_id", "lead_fund_id", "assigned_to"],
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
      const { pool, getProjectTableName, getProjectColumns, isSupabase } = await import("./db");
      const projectTable = getProjectTableName();
      const cols = getProjectColumns();
      
      let projects;
      
      // Super Admin sees ALL projects across all orgs
      // Manager/Admin see all projects in their org
      // Use raw pg pool.query to avoid Drizzle schema mapping issues
      // Column names differ between local (name, description, type) and Supabase (project_name, notes, project_type)
      const selectCols = `id, ${cols.name} as name, ${cols.description} as description, ${cols.type} as type, status, created_by as "createdBy", org_id as "orgId"`;
      // Supabase has created_at column, local DB doesn't
      const orderBy = isSupabase ? " ORDER BY created_at DESC" : "";
      
      if (isSuperAdmin) {
        const result = await pool.query(
          `SELECT ${selectCols} FROM ${projectTable}${orderBy}`
        );
        projects = result.rows;
      } else if (["admin", "manager"].includes(userRole)) {
        const result = await pool.query(
          `SELECT ${selectCols} FROM ${projectTable} WHERE org_id = $1${orderBy}`,
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
          `SELECT ${selectCols} FROM ${projectTable} WHERE org_id = $1 AND id = ANY($2)${orderBy}`,
          [orgId, projectIds]
        );
        projects = result.rows;
      }
      
      // Return projects from entities_project ONLY
      // ARCHITECTURAL RULE: Project listing must NEVER query entities_project_items
      // Stats (totalItems, pendingItems, completedItems) moved to project detail endpoint
      return res.json(projects);
    } catch (error: any) {
      console.error("Error fetching DataNest projects:", error);
      // Return detailed error in development/for debugging
      return res.status(500).json({ 
        message: "Internal server error", 
        detail: error?.message || String(error),
        hint: error?.hint || null
      });
    }
  });

  // Get single project (NO items - items loaded separately via /items endpoint)
  // ARCHITECTURAL RULE: Project detail must NOT depend on entities_project_items
  app.get("/api/datanest/projects/:id", async (req: Request, res: Response) => {
    const projectId = req.params.id;
    const userId = getUserIdFromRequest(req);
    
    try {
      const { orgId, isSuperAdmin } = await getOrgFilter(req);
      console.log(`[project-detail] User ${userId} (orgId: ${orgId}, superAdmin: ${isSuperAdmin}) requesting project ${projectId}`);
      
      const { pool, getProjectTableName, getTableName, getProjectColumns, isSupabase } = await import("./db");
      const projectTable = getProjectTableName();
      const cols = getProjectColumns();
      const membersTable = getTableName("project_members");
      
      console.log(`[project-detail] Using table: ${projectTable}, isSupabase: ${isSupabase}`);
      console.log(`[project-detail] Column mapping: name=${cols.name}, desc=${cols.description}, type=${cols.type}`);
      
      // Fetch project ONLY from entities_project - no items join
      // Super admin can see any project, regular users only see their org's projects
      const selectCols = `id, ${cols.name} as name, ${cols.description} as description, ${cols.type} as type, status, created_by as "createdBy", org_id as "orgId"`;
      let projectResult;
      if (isSuperAdmin) {
        console.log(`[project-detail] Super admin query: SELECT ... FROM ${projectTable} WHERE id = '${projectId}'`);
        projectResult = await pool.query(
          `SELECT ${selectCols} FROM ${projectTable} WHERE id = $1`,
          [projectId]
        );
      } else {
        console.log(`[project-detail] Regular user query: SELECT ... FROM ${projectTable} WHERE id = '${projectId}' AND org_id = '${orgId}'`);
        projectResult = await pool.query(
          `SELECT ${selectCols} FROM ${projectTable} WHERE id = $1 AND org_id = $2`,
          [projectId, orgId]
        );
      }
      
      console.log(`[project-detail] Query returned ${projectResult.rows.length} rows`);
      
      if (projectResult.rows.length === 0) {
        console.log(`[project-detail] Project not found for id=${projectId}, orgId=${orgId}, superAdmin=${isSuperAdmin}`);
        return res.status(404).json({ message: "Project not found" });
      }
      const project = projectResult.rows[0];
      console.log(`[project-detail] Found project: ${project.name}`);
      
      // Fetch members using raw SQL with user names (separate from items)
      const membersResult = await pool.query(
        `SELECT m.id, m.user_id as "userId", m.role, u.display_name as "userName"
         FROM ${membersTable} m LEFT JOIN users u ON m.user_id = u.id
         WHERE m.project_id = $1`,
        [projectId]
      );
      const members = membersResult.rows;
      
      // Return project data WITHOUT items - items loaded via separate endpoint
      return res.json({
        ...project,
        members,
      });
    } catch (error: any) {
      console.error(`[project-detail] Error for project ${projectId}:`, error?.message || error);
      if (error?.message === "UNAUTHORIZED") {
        return res.status(401).json({ message: "Authentication required" });
      }
      return res.status(500).json({ 
        message: "Internal server error",
        detail: process.env.NODE_ENV === "development" ? error?.message : undefined
      });
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
      const { pool, getProjectTableName, getProjectColumns } = await import("./db");
      const projectTable = getProjectTableName();
      const cols = getProjectColumns();
      const { z } = await import("zod");
      
      // Validate input (frontend sends 'name', we map to correct column name)
      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.string(),
        status: z.string().optional().default("active"),
      });
      
      const parsed = createSchema.parse(req.body);
      
      // Use raw pool.query to insert - column names differ between local and Supabase
      const insertCols = `id, ${cols.name}, ${cols.description}, ${cols.type}, status, created_by, org_id`;
      const selectCols = `id, ${cols.name} as name, ${cols.description} as description, ${cols.type} as type, status, created_by as "createdBy", org_id as "orgId"`;
      
      const result = await pool.query(
        `INSERT INTO ${projectTable} (${insertCols})
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
         RETURNING ${selectCols}`,
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
      const { pool, getProjectTableName, getProjectColumns } = await import("./db");
      const projectTable = getProjectTableName();
      const cols = getProjectColumns();
      
      // Whitelist only mutable fields - never allow orgId, id, createdBy
      // Map frontend field names to correct database column names
      const { name, description, type, status } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (name !== undefined) { updates.push(`${cols.name} = $${paramIndex++}`); values.push(name); }
      if (description !== undefined) { updates.push(`${cols.description} = $${paramIndex++}`); values.push(description); }
      if (type !== undefined) { updates.push(`${cols.type} = $${paramIndex++}`); values.push(type); }
      if (status !== undefined) { updates.push(`status = $${paramIndex++}`); values.push(status); }
      
      if (updates.length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      
      // Add WHERE clause params
      values.push(projectId, orgId);
      
      const selectCols = `id, ${cols.name} as name, ${cols.description} as description, ${cols.type} as type, status, created_by as "createdBy", org_id as "orgId"`;
      const result = await pool.query(
        `UPDATE ${projectTable} SET ${updates.join(", ")}, updated_at = NOW()
         WHERE id = $${paramIndex++} AND org_id = $${paramIndex}
         RETURNING ${selectCols}`,
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
      const { pool, getTableName, getProjectItemColumns } = await import("./db");
      const itemsTable = getTableName("project_items");
      const itemCols = getProjectItemColumns();
      // Supabase doesn't have entity_name_snapshot column - conditionally include it
      const entityNameCol = itemCols.hasEntityNameSnapshot 
        ? `, i.${itemCols.entityNameSnapshot} as "entityNameSnapshot"` 
        : "";
      
      // Build SELECT columns based on what exists in the table
      const notesCol = itemCols.hasNotes ? ', i.notes' : '';
      const updatedAtCol = itemCols.updatedAt ? `, i.${itemCols.updatedAt} as "updatedAt"` : '';
      // Use raw pool.query to get items with user display names
      const result = await pool.query(
        `SELECT i.id, i.project_id as "projectId", i.entity_type as "entityType", 
                i.entity_id as "entityId"${entityNameCol},
                i.assigned_to as "assignedTo", i.task_status as "taskStatus"${notesCol}, 
                i.created_at as "createdAt"${updatedAtCol},
                u.display_name as "assignedToName"
         FROM ${itemsTable} i LEFT JOIN users u ON i.assigned_to = u.id
         WHERE i.project_id = $1`,
        [projectId]
      );
      // Ensure all optional fields are always present (null for Supabase)
      const items = (result.rows as any[]).map(item => ({
        ...item,
        entityNameSnapshot: item.entityNameSnapshot ?? null,
        notes: item.notes ?? null,
        updatedAt: item.updatedAt ?? null,
      }));
      
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
      const { pool, getTableName, getProjectItemColumns } = await import("./db");
      const itemsTable = getTableName("project_items");
      const itemCols = getProjectItemColumns();
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
      
      // Use raw pool.query to insert - Supabase has different columns
      // Local: project_id, entity_type, entity_id, entity_name_snapshot, assigned_to, task_status, notes, org_id
      // Supabase: project_id, entity_type, entity_id, assigned_to, task_status (NO notes, NO org_id, NO entity_name_snapshot)
      let result;
      if (itemCols.hasOrgId) {
        // Local dev database - has entity_name_snapshot, notes, org_id
        result = await pool.query(
          `INSERT INTO ${itemsTable} (project_id, entity_type, entity_id, entity_name_snapshot, assigned_to, task_status, notes, org_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                     entity_name_snapshot as "entityNameSnapshot", assigned_to as "assignedTo", 
                     task_status as "taskStatus", notes, org_id as "orgId", created_at as "createdAt"`,
          [projectId, parsed.entityType, parsed.entityId, parsed.entityNameSnapshot || null, 
           parsed.assignedTo || null, parsed.taskStatus, parsed.notes || null, orgId]
        );
      } else {
        // Supabase - no entity_name_snapshot, notes, or org_id columns
        result = await pool.query(
          `INSERT INTO ${itemsTable} (project_id, entity_type, entity_id, assigned_to, task_status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                     assigned_to as "assignedTo", task_status as "taskStatus", created_at as "createdAt"`,
          [projectId, parsed.entityType, parsed.entityId, 
           parsed.assignedTo || null, parsed.taskStatus]
        );
      }
      
      // Ensure entityNameSnapshot is always present (null for Supabase)
      const item = { ...result.rows[0], entityNameSnapshot: result.rows[0].entityNameSnapshot ?? null };
      return res.status(201).json(item);
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
      const { pool, getTableName, getProjectItemColumns } = await import("./db");
      const itemsTable = getTableName("project_items");
      const itemCols = getProjectItemColumns();
      const { entityTypes } = await import("@shared/schema");
      
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
      
      // Insert all items using raw SQL - different columns for local vs Supabase
      const insertedItems = [];
      for (const item of items) {
        let insertResult;
        if (itemCols.hasOrgId) {
          // Local dev database - has org_id column
          insertResult = await pool.query(
            `INSERT INTO ${itemsTable} (project_id, entity_type, entity_id, assigned_to, task_status, org_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                       assigned_to as "assignedTo", task_status as "taskStatus", org_id as "orgId", created_at as "createdAt"`,
            [projectId, item.entity_type, item.entity_id, item.assigned_to, item.task_status || "pending", orgId]
          );
        } else {
          // Supabase - no org_id column
          insertResult = await pool.query(
            `INSERT INTO ${itemsTable} (project_id, entity_type, entity_id, assigned_to, task_status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                       assigned_to as "assignedTo", task_status as "taskStatus", created_at as "createdAt"`,
            [projectId, item.entity_type, item.entity_id, item.assigned_to, item.task_status || "pending"]
          );
        }
        // Ensure optional fields are always present (null for Supabase)
        insertedItems.push({ 
          ...insertResult.rows[0], 
          entityNameSnapshot: insertResult.rows[0].entityNameSnapshot ?? null,
          orgId: insertResult.rows[0].orgId ?? null,
        });
      }
      return res.status(201).json({ inserted: insertedItems.length, items: insertedItems });
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
      const { pool, getTableName, getProjectItemColumns, isSupabase } = await import("./db");
      const itemsTable = getTableName("project_items");
      const itemCols = getProjectItemColumns();
      
      // Whitelist only mutable fields - never allow orgId, id, projectId, createdAt
      // Map JS field names to SQL column names (only fields that exist in this DB)
      const fieldMapping: Record<string, string> = {
        assignedTo: "assigned_to",
        taskStatus: "task_status",
      };
      // Only include notes if it exists in this database
      if (itemCols.hasNotes) {
        fieldMapping.notes = "notes";
      }
      // Only include entityNameSnapshot if the column exists in this database
      if (itemCols.hasEntityNameSnapshot && itemCols.entityNameSnapshot) {
        fieldMapping.entityNameSnapshot = itemCols.entityNameSnapshot;
      }
      
      // Use correct updated timestamp column name
      const updates: string[] = [`${itemCols.updatedAt} = NOW()`];
      const values: any[] = [];
      let paramIndex = 1;
      
      for (const [jsField, sqlCol] of Object.entries(fieldMapping)) {
        if (req.body[jsField] !== undefined) {
          updates.push(`${sqlCol} = $${paramIndex++}`);
          values.push(req.body[jsField]);
        }
      }
      
      values.push(itemId);
      
      // Build WHERE clause - Supabase has no org_id column in project_items
      let whereClause = `id = $${paramIndex++}`;
      if (itemCols.hasOrgId) {
        values.push(orgId);
        whereClause += ` AND org_id = $${paramIndex}`;
      }
      
      // Build RETURNING clause with only existing columns
      const notesRet = itemCols.hasNotes ? ', notes' : '';
      const orgIdRet = itemCols.hasOrgId ? ', org_id as "orgId"' : '';
      const result = await pool.query(
        `UPDATE ${itemsTable} SET ${updates.join(", ")}
         WHERE ${whereClause}
         RETURNING id, project_id as "projectId", entity_type as "entityType", entity_id as "entityId",
                   assigned_to as "assignedTo", task_status as "taskStatus"${notesRet}${orgIdRet}, 
                   created_at as "createdAt", ${itemCols.updatedAt} as "updatedAt"`,
        values
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Ensure entityNameSnapshot is always present (null for Supabase)
      const item = { ...result.rows[0], entityNameSnapshot: result.rows[0].entityNameSnapshot ?? null };
      return res.json(item);
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
      const { pool, getTableName, getProjectItemColumns } = await import("./db");
      const itemsTable = getTableName("project_items");
      const itemCols = getProjectItemColumns();
      
      // Use raw SQL with correct column names for this database
      let result;
      if (itemCols.hasOrgId) {
        // Local dev - has org_id and updated_at
        result = await pool.query(
          `UPDATE ${itemsTable} SET assigned_to = $1, updated_at = NOW()
           WHERE id = ANY($2) AND org_id = $3
           RETURNING id`,
          [assignedTo, itemIds, orgId]
        );
      } else {
        // Supabase - no org_id, uses last_updated_on
        result = await pool.query(
          `UPDATE ${itemsTable} SET assigned_to = $1, last_updated_on = NOW()
           WHERE id = ANY($2)
           RETURNING id`,
          [assignedTo, itemIds]
        );
      }
      
      return res.json({ updated: result.rows.length });
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
    
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    
    try {
      const { db } = await import("./db");
      const { entitiesProjectMembers, users } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Verify the target user belongs to the same org (security check)
      const targetUser = await db.select({ id: users.id, orgId: users.orgId })
        .from(users)
        .where(eq(users.id, userId));
      
      if (targetUser.length === 0 || targetUser[0].orgId !== orgId) {
        return res.status(400).json({ message: "Invalid user or user not in your organization" });
      }
      
      // Check if member already exists
      const existing = await db.select().from(entitiesProjectMembers)
        .where(and(
          eq(entitiesProjectMembers.projectId, projectId),
          eq(entitiesProjectMembers.userId, userId)
        ));
      
      if (existing.length > 0) {
        return res.status(409).json({ message: "User is already a member of this project" });
      }
      
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

  // Remove project member (manager/admin only)
  app.delete("/api/datanest/projects/:id/members/:memberId", async (req: Request, res: Response) => {
    const orgId = await getUserOrgIdSafe(req, res);
    if (!orgId) return;
    
    // Server-side RBAC check
    if (!await checkManagerRole(req, res)) return;
    
    const { id: projectId, memberId } = req.params;
    
    try {
      const { db } = await import("./db");
      const { entitiesProjectMembers } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      const result = await db.delete(entitiesProjectMembers)
        .where(and(
          eq(entitiesProjectMembers.id, memberId),
          eq(entitiesProjectMembers.projectId, projectId),
          eq(entitiesProjectMembers.orgId, orgId)
        ))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ message: "Member not found" });
      }
      
      return res.json({ message: "Member removed successfully" });
    } catch (error) {
      console.error("Error removing member:", error);
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
      const { pool, getTableName } = await import("./db");
      
      // Use getTableName for proper local/Supabase table resolution
      const contactTable = getTableName("contact");
      const lpTable = getTableName("lp");
      const gpTable = getTableName("gp");
      const fundTable = getTableName("fund");
      const pcTable = getTableName("portfolio_company");
      const dealTable = getTableName("deal");
      
      const result = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM ${lpTable} WHERE org_id = $1) as lp_count,
          (SELECT COUNT(*) FROM ${gpTable} WHERE org_id = $1) as gp_count,
          (SELECT COUNT(*) FROM ${fundTable} WHERE org_id = $1) as fund_count,
          (SELECT COUNT(*) FROM ${pcTable} WHERE org_id = $1) as portfolio_company_count,
          (SELECT COUNT(*) FROM ${dealTable} WHERE org_id = $1) as deal_count,
          (SELECT COUNT(*) FROM ${contactTable} WHERE org_id = $1) as contact_count
      `, [orgId]);
      
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
