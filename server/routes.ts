import type { Express, Request, Response } from "express";
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
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

  // Projects routes with org scoping
  app.get("/api/projects", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const projects = await storage.getProjects(orgId);
    return res.json(projects);
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    const orgId = await getUserOrgId(req);
    const project = await storage.getProject(req.params.id, orgId);
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
        UNION ALL SELECT 'entities_contact', count(*)::int FROM entities_contact
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
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_gp WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
        INSERT INTO entities_gp (org_id, gp_name, gp_legal_name, firm_type, headquarters_country, headquarters_city, total_aum, aum_currency, website, primary_asset_classes)
        VALUES (${orgId}, ${data.gp_name}, ${data.gp_legal_name || null}, ${data.firm_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.total_aum || null}, ${data.aum_currency || null}, ${data.website || null}, ${data.primary_asset_classes || null})
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
          gp_name = ${data.gp_name},
          gp_legal_name = ${data.gp_legal_name || null},
          gp_short_name = ${data.gp_short_name || null},
          firm_type = ${data.firm_type || null},
          year_founded = ${data.year_founded || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_regions = ${data.operating_regions || null},
          office_locations = ${data.office_locations || null},
          website = ${data.website || null},
          regulatory_status = ${data.regulatory_status || null},
          primary_regulator = ${data.primary_regulator || null},
          registration_number = ${data.registration_number || null},
          registration_jurisdiction = ${data.registration_jurisdiction || null},
          total_aum = ${data.total_aum || null},
          aum_currency = ${data.aum_currency || null},
          primary_asset_classes = ${data.primary_asset_classes || null},
          investment_stages = ${data.investment_stages || null},
          industry_focus = ${data.industry_focus || null},
          geographic_focus = ${data.geographic_focus || null},
          number_of_funds = ${data.number_of_funds || null},
          active_funds_count = ${data.active_funds_count || null},
          total_capital_raised = ${data.total_capital_raised || null},
          first_fund_vintage = ${data.first_fund_vintage || null},
          latest_fund_vintage = ${data.latest_fund_vintage || null},
          estimated_deal_count = ${data.estimated_deal_count || null},
          ownership_type = ${data.ownership_type || null},
          parent_company = ${data.parent_company || null},
          advisory_arms = ${data.advisory_arms || null},
          employee_count_band = ${data.employee_count_band || null},
          investment_professionals_count = ${data.investment_professionals_count || null},
          senior_investment_professionals_count = ${data.senior_investment_professionals_count || null},
          top_quartile_flag = ${data.top_quartile_flag || null},
          track_record_years = ${data.track_record_years || null},
          performance_data_available = ${data.performance_data_available ?? null},
          esg_policy_available = ${data.esg_policy_available ?? null},
          pri_signatory = ${data.pri_signatory ?? null},
          dei_policy_available = ${data.dei_policy_available ?? null},
          sustainability_report_url = ${data.sustainability_report_url || null},
          status = ${data.status || 'active'},
          email = ${data.email || null},
          phone = ${data.phone || null},
          linkedin_url = ${data.linkedin_url || null},
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
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_lp WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
        INSERT INTO entities_lp (org_id, lp_name, lp_legal_name, firm_type, investor_type, headquarters_country, headquarters_city, total_aum, aum_currency, website, status)
        VALUES (${orgId}, ${data.lp_name}, ${data.lp_legal_name || null}, ${data.firm_type || null}, ${data.investor_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.total_aum || null}, ${data.aum_currency || null}, ${data.website || null}, ${data.status || 'active'})
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
          lp_name = ${data.lp_name},
          lp_legal_name = ${data.lp_legal_name || null},
          lp_short_name = ${data.lp_short_name || null},
          firm_type = ${data.firm_type || null},
          investor_type = ${data.investor_type || null},
          year_founded = ${data.year_founded || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_regions = ${data.operating_regions || null},
          office_locations = ${data.office_locations || null},
          website = ${data.website || null},
          regulatory_status = ${data.regulatory_status || null},
          primary_regulator = ${data.primary_regulator || null},
          registration_number = ${data.registration_number || null},
          registration_jurisdiction = ${data.registration_jurisdiction || null},
          total_aum = ${data.total_aum || null},
          aum_currency = ${data.aum_currency || null},
          pe_allocation_percentage = ${data.pe_allocation_percentage || null},
          pe_allocation_amount = ${data.pe_allocation_amount || null},
          primary_asset_classes = ${data.primary_asset_classes || null},
          investment_stages = ${data.investment_stages || null},
          industry_focus = ${data.industry_focus || null},
          geographic_focus = ${data.geographic_focus || null},
          min_fund_size = ${data.min_fund_size || null},
          max_fund_size = ${data.max_fund_size || null},
          min_commitment_size = ${data.min_commitment_size || null},
          max_commitment_size = ${data.max_commitment_size || null},
          number_of_gp_relationships = ${data.number_of_gp_relationships || null},
          active_commitments_count = ${data.active_commitments_count || null},
          total_commitments = ${data.total_commitments || null},
          ownership_type = ${data.ownership_type || null},
          parent_organization = ${data.parent_organization || null},
          decision_makers_count = ${data.decision_makers_count || null},
          investment_professionals_count = ${data.investment_professionals_count || null},
          esg_policy_available = ${data.esg_policy_available ?? null},
          pri_signatory = ${data.pri_signatory ?? null},
          dei_policy_available = ${data.dei_policy_available ?? null},
          sustainability_report_url = ${data.sustainability_report_url || null},
          status = ${data.status || 'active'},
          email = ${data.email || null},
          phone = ${data.phone || null},
          linkedin_url = ${data.linkedin_url || null},
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
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_fund WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
        INSERT INTO entities_fund (org_id, fund_name, fund_legal_name, fund_type, gp_id, vintage_year, target_size, target_size_currency, fund_status, status)
        VALUES (${orgId}, ${data.fund_name}, ${data.fund_legal_name || null}, ${data.fund_type || null}, ${data.gp_id || null}, ${data.vintage_year || null}, ${data.target_size || null}, ${data.target_size_currency || 'USD'}, ${data.fund_status || null}, ${data.status || 'active'})
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
          fund_short_name = ${data.fund_short_name || null},
          fund_type = ${data.fund_type || null},
          strategy = ${data.strategy || null},
          gp_id = ${data.gp_id || null},
          vintage_year = ${data.vintage_year || null},
          fund_currency = ${data.fund_currency || 'USD'},
          fund_status = ${data.fund_status || null},
          target_fund_size = ${data.target_fund_size || null},
          hard_cap = ${data.hard_cap || null},
          fund_size_final = ${data.fund_size_final || null},
          capital_called = ${data.capital_called || null},
          capital_distributed = ${data.capital_distributed || null},
          remaining_value = ${data.remaining_value || null},
          first_close_date = ${data.first_close_date || null},
          final_close_date = ${data.final_close_date || null},
          fundraising_status = ${data.fundraising_status || null},
          number_of_lps = ${data.number_of_lps || null},
          cornerstone_investor_flag = ${data.cornerstone_investor_flag ?? null},
          primary_asset_class = ${data.primary_asset_class || null},
          investment_stage = ${data.investment_stage || null},
          industry_focus = ${data.industry_focus || null},
          geographic_focus = ${data.geographic_focus || null},
          net_irr = ${data.net_irr || null},
          gross_irr = ${data.gross_irr || null},
          tvpi = ${data.tvpi || null},
          dpi = ${data.dpi || null},
          rvpi = ${data.rvpi || null},
          performance_data_available = ${data.performance_data_available ?? null},
          performance_as_of_date = ${data.performance_as_of_date || null},
          deal_count = ${data.deal_count || null},
          active_portfolio_companies_count = ${data.active_portfolio_companies_count || null},
          realized_portfolio_companies_count = ${data.realized_portfolio_companies_count || null},
          esg_integration_flag = ${data.esg_integration_flag ?? null},
          impact_fund_flag = ${data.impact_fund_flag ?? null},
          sustainability_objective = ${data.sustainability_objective || null},
          data_confidence_score = ${data.data_confidence_score || null},
          verification_method = ${data.verification_method || null},
          last_verified_date = ${data.last_verified_date || null},
          source_coverage = ${data.source_coverage || null},
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
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_portfolio_company WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
          org_id, company_name, company_type, headquarters_country, headquarters_city, 
          primary_industry, business_model, website, business_description, founded_year, employee_count,
          revenue_band, valuation_band, current_owner_type, exit_type, exit_year,
          confidence_score, data_source, status
        )
        VALUES (
          ${orgId}, ${data.company_name}, ${data.company_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, 
          ${data.primary_industry || null}, ${data.business_model || null}, ${data.website || null}, ${data.business_description || null}, ${data.founded_year || null}, ${data.employee_count || null},
          ${data.revenue_band || null}, ${data.valuation_band || null}, ${data.current_owner_type || null}, ${data.exit_type || null}, ${data.exit_year || null},
          ${data.confidence_score || null}, ${data.data_source || null}, ${data.status || 'active'}
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
          legal_name = ${data.legal_name || data.company_legal_name || null},
          short_name = ${data.short_name || data.company_short_name || null},
          company_type = ${data.company_type || null},
          year_founded = ${data.year_founded || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_regions = ${data.operating_regions || null},
          website = ${data.website || null},
          primary_industry = ${data.primary_industry || null},
          sub_industry = ${data.sub_industry || data.secondary_industry || null},
          business_description = ${data.business_description || null},
          business_model = ${data.business_model || null},
          revenue_model = ${data.revenue_model || null},
          employee_count_band = ${data.employee_count_band || null},
          revenue_band = ${data.revenue_band || null},
          latest_revenue = ${data.latest_revenue || data.revenue || null},
          revenue_currency = ${data.revenue_currency || 'USD'},
          revenue_year = ${data.revenue_year || null},
          profitability_status = ${data.profitability_status || null},
          ebitda_margin = ${data.ebitda_margin || null},
          current_owner_type = ${data.current_owner_type || null},
          controlling_gp_id = ${data.controlling_gp_id || null},
          controlling_fund_id = ${data.controlling_fund_id || null},
          first_investment_year = ${data.first_investment_year || null},
          total_funding_raised = ${data.total_funding_raised || null},
          funding_currency = ${data.funding_currency || 'USD'},
          primary_markets = ${data.primary_markets || null},
          manufacturing_presence_flag = ${data.manufacturing_presence_flag ?? null},
          r_and_d_presence_flag = ${data.r_and_d_presence_flag ?? null},
          esg_policy_available = ${data.esg_policy_available ?? null},
          environmental_focus = ${data.environmental_focus || null},
          social_focus = ${data.social_focus || null},
          governance_focus = ${data.governance_focus || null},
          compliance_certifications = ${data.compliance_certifications || null},
          sustainability_report_url = ${data.sustainability_report_url || null},
          exit_status = ${data.exit_status || null},
          exit_type = ${data.exit_type || null},
          exit_year = ${data.exit_year || null},
          data_confidence_score = ${data.data_confidence_score || null},
          verification_method = ${data.verification_method || null},
          last_verified_date = ${data.last_verified_date || null},
          source_coverage = ${data.source_coverage || null},
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
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_service_provider WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
        INSERT INTO entities_service_provider (org_id, provider_name, provider_type, headquarters_country, headquarters_city, website, services_offered, sector_expertise, geographic_coverage, founded_year, status)
        VALUES (${orgId}, ${data.provider_name}, ${data.provider_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.website || null}, ${data.services_offered || null}, ${data.sector_expertise || null}, ${data.geographic_coverage || null}, ${data.founded_year || null}, ${data.status || 'active'})
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
          service_provider_name = ${data.service_provider_name || data.provider_name || null},
          service_provider_legal_name = ${data.service_provider_legal_name || data.provider_legal_name || null},
          service_provider_short_name = ${data.service_provider_short_name || data.provider_short_name || null},
          service_provider_type = ${data.service_provider_type || data.provider_type || null},
          specialization = ${data.specialization || null},
          year_founded = ${data.year_founded || null},
          headquarters_country = ${data.headquarters_country || null},
          headquarters_city = ${data.headquarters_city || null},
          operating_regions = ${data.operating_regions || null},
          website = ${data.website || null},
          primary_services = ${data.primary_services || data.services_offered || null},
          secondary_services = ${data.secondary_services || null},
          asset_class_coverage = ${data.asset_class_coverage || null},
          fund_stage_coverage = ${data.fund_stage_coverage || null},
          typical_client_type = ${data.typical_client_type || data.client_types || null},
          client_size_focus = ${data.client_size_focus || null},
          geographic_client_focus = ${data.geographic_client_focus || data.geographic_coverage || null},
          ownership_type = ${data.ownership_type || null},
          employee_count_band = ${data.employee_count_band || null},
          office_locations = ${data.office_locations || null},
          regulated_flag = ${data.regulated_flag ?? null},
          primary_regulator = ${data.primary_regulator || null},
          marquee_clients = ${data.marquee_clients || data.notable_clients || null},
          years_active_in_private_markets = ${data.years_active_in_private_markets || data.years_in_business || null},
          cross_border_capability_flag = ${data.cross_border_capability_flag ?? null},
          esg_policy_available = ${data.esg_policy_available ?? null},
          data_privacy_compliance = ${data.data_privacy_compliance || null},
          sustainability_report_url = ${data.sustainability_report_url || null},
          data_confidence_score = ${data.data_confidence_score || null},
          verification_method = ${data.verification_method || null},
          last_verified_date = ${data.last_verified_date || null},
          source_coverage = ${data.source_coverage || null},
          email = ${data.email || null},
          phone = ${data.phone || null},
          linkedin_url = ${data.linkedin_url || null},
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
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      const { linked_entity_type, linked_entity_id, unlinked } = req.query;
      
      let result;
      if (linked_entity_type && linked_entity_id) {
        result = await db.execute(sql`
          SELECT * FROM entities_contact 
          WHERE org_id = ${orgId} 
            AND linked_entity_type = ${linked_entity_type as string} 
            AND linked_entity_id = ${linked_entity_id as string}
          ORDER BY created_at DESC
        `);
      } else if (unlinked === 'true') {
        result = await db.execute(sql`
          SELECT * FROM entities_contact 
          WHERE org_id = ${orgId} 
            AND (linked_entity_id IS NULL OR linked_entity_id = '')
          ORDER BY created_at DESC
        `);
      } else {
        result = await db.execute(sql`SELECT * FROM entities_contact WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
        UPDATE entities_contact 
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
        INSERT INTO entities_contact (
          org_id, first_name, last_name, email, phone, title, company_name,
          entity_type, entity_id, linkedin_url, notes, status,
          role_category, seniority_level, asset_class_focus, sector_focus, geography_focus,
          verification_status, verification_source, associated_fund_ids, board_roles,
          confidence_score, importance_score
        )
        VALUES (
          ${orgId}, ${data.first_name}, ${data.last_name || null}, ${data.email || null}, ${data.phone || null}, 
          ${data.title || null}, ${data.company_name || null},
          ${data.entity_type || data.linked_entity_type || null}, ${data.entity_id || data.linked_entity_id || null}, 
          ${data.linkedin_url || null}, ${data.notes || null}, ${data.status || 'active'},
          ${data.role_category || null}, ${data.seniority_level || null}, ${data.asset_class_focus || null}, 
          ${data.sector_focus || null}, ${data.geography_focus || null},
          ${data.verification_status || null}, ${data.verification_source || null}, 
          ${data.associated_fund_ids || null}, ${data.board_roles || null},
          ${data.confidence_score || null}, ${data.importance_score || null}
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
          first_name = ${data.first_name || null},
          last_name = ${data.last_name || null},
          email = ${data.email || null},
          phone = ${data.phone || null},
          title = ${data.title || null},
          company_name = ${data.company_name || null},
          entity_type = ${data.entity_type || null},
          entity_id = ${data.entity_id || null},
          linkedin_url = ${data.linkedin_url || null},
          notes = ${data.notes || null},
          status = ${data.status || 'active'},
          role_category = ${data.role_category || null},
          seniority_level = ${data.seniority_level || null},
          asset_class_focus = ${data.asset_class_focus || null},
          sector_focus = ${data.sector_focus || null},
          geography_focus = ${data.geography_focus || null},
          verification_status = ${data.verification_status || null},
          verification_source = ${data.verification_source || null},
          last_verified_at = ${data.last_verified_at || null},
          associated_fund_ids = ${data.associated_fund_ids || null},
          board_roles = ${data.board_roles || null},
          confidence_score = ${data.confidence_score || null},
          importance_score = ${data.importance_score || null},
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
      const orgId = await getUserOrgId(req);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_deal WHERE org_id = ${orgId} ORDER BY created_at DESC`);
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
      const contacts = await storage.getEntityContacts(orgId);
      return res.json(contacts);
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

  return httpServer;
}
