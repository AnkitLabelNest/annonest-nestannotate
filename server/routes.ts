import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import { storage } from "./storage";
import {
  loginSchema,
  signupSchema,
  insertFirmSchema,
  insertContactSchema,
  insertFundSchema,
  insertDealSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertAnnotationSchema,
  insertMonitoredUrlSchema,
  moduleAccessByRole,
  type UserRole,
  type Firm,
} from "@shared/schema";
import { z } from "zod";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured. Some features may not work.");
}

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
      }

      // If still no user, create one
      if (!user) {
        const displayName = supabaseUser.user_metadata?.displayName || 
                           supabaseUser.user_metadata?.full_name ||
                           supabaseUser.email?.split("@")[0] || 
                           "User";
        
        user = await storage.createUserWithId(supabaseUser.id, {
          orgId: "default-org-001",
          username: supabaseUser.email || supabaseUser.id,
          password: await bcrypt.hash(crypto.randomUUID(), 10), // Random password for Supabase users
          email: supabaseUser.email || "",
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
      
      const newUser = await storage.createUserWithId(
        verifiedSupabaseId,
        {
          orgId: isSupabaseUser ? "default-org-001" : "guest-org-001",
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
  app.get("/api/users", async (_req: Request, res: Response) => {
    const users = await storage.getUsers();
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
    const updated = await storage.updateUser(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password, ...userWithoutPassword } = updated;
    return res.json(userWithoutPassword);
  });

  // Admin routes for guest management
  app.get("/api/admin/pending-guests", async (_req: Request, res: Response) => {
    const pendingGuests = await storage.getPendingGuests();
    const guestsWithoutPasswords = pendingGuests.map(({ password, ...user }) => user);
    return res.json(guestsWithoutPasswords);
  });

  app.post("/api/admin/users/:id/approve", async (req: Request, res: Response) => {
    const adminId = req.headers["x-user-id"] as string;
    if (!adminId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const admin = await storage.getUser(adminId);
    if (!admin || (admin.role !== "admin" && admin.role !== "manager")) {
      return res.status(403).json({ message: "Only admins and managers can approve users" });
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
    if (!admin || (admin.role !== "admin" && admin.role !== "manager")) {
      return res.status(403).json({ message: "Only admins and managers can reject users" });
    }
    
    const rejected = await storage.rejectUser(req.params.id, adminId);
    
    if (!rejected) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const { password, ...userWithoutPassword } = rejected;
    return res.json(userWithoutPassword);
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
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
        a.reviewStatus === "approved" || a.labels?.length > 0
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
        a.reviewStatus === "approved" || a.labels?.length > 0
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
  app.get("/api/crm/gps", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_gp ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching GPs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/gps", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_gp (gp_name, gp_legal_name, firm_type, headquarters_country, headquarters_city, total_aum, aum_currency, website, primary_asset_classes)
        VALUES (${data.gp_name}, ${data.gp_legal_name || null}, ${data.firm_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.total_aum || null}, ${data.aum_currency || null}, ${data.website || null}, ${data.primary_asset_classes || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating GP:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // LP Routes
  app.get("/api/crm/lps", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_lp ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching LPs:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/lps", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_lp (lp_name, lp_type, headquarters_country, headquarters_city, total_aum, aum_currency, private_markets_allocation_percent)
        VALUES (${data.lp_name}, ${data.lp_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.total_aum || null}, ${data.aum_currency || null}, ${data.private_markets_allocation_percent || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating LP:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Fund Routes
  app.get("/api/crm/funds", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_fund ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching funds:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Portfolio Company Routes
  app.get("/api/crm/portfolio-companies", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_portfolio_company ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching portfolio companies:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/portfolio-companies", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO entities_portfolio_company (company_name, company_type, headquarters_country, headquarters_city, primary_industry, business_model, website, business_description)
        VALUES (${data.company_name}, ${data.company_type || null}, ${data.headquarters_country || null}, ${data.headquarters_city || null}, ${data.primary_industry || null}, ${data.business_model || null}, ${data.website || null}, ${data.business_description || null})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating portfolio company:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Service Provider Routes
  app.get("/api/crm/service-providers", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_service_provider ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching service providers:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contact Routes (CRM version)
  app.get("/api/crm/contacts", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_contact ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching CRM contacts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Deal Routes (CRM version)
  app.get("/api/crm/deals", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM entities_deal ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching CRM deals:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Relationships Routes
  app.get("/api/crm/relationships", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM relationships ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
      console.error("Error fetching relationships:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/crm/relationships", async (req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const data = req.body;
      
      const result = await db.execute(sql`
        INSERT INTO relationships (from_entity_type, from_entity_id, from_entity_name_snapshot, to_entity_type, to_entity_id, to_entity_name_snapshot, relationship_type, relationship_subtype, relationship_status)
        VALUES (${data.from_entity_type}, ${data.from_entity_id}, ${data.from_entity_name_snapshot || null}, ${data.to_entity_type}, ${data.to_entity_id}, ${data.to_entity_name_snapshot || null}, ${data.relationship_type}, ${data.relationship_subtype || null}, ${data.relationship_status || 'Active'})
        RETURNING *
      `);
      
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating relationship:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public Company Snapshots
  app.get("/api/crm/public-companies", async (_req: Request, res: Response) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`SELECT * FROM public_company_snapshot ORDER BY created_at DESC`);
      return res.json(result.rows);
    } catch (error) {
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
  app.get("/api/stats", async (_req: Request, res: Response) => {
    const [firms, contacts, funds, deals, tasks, projects, urls] = await Promise.all([
      storage.getFirms(),
      storage.getContacts(),
      storage.getFunds(),
      storage.getDeals(),
      storage.getTasks(),
      storage.getProjects(),
      storage.getMonitoredUrls(),
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

  return httpServer;
}
