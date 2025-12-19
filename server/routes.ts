import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  loginSchema,
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
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(parsed.username);
      
      if (!user || user.password !== parsed.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      const { password, ...userWithoutPassword } = user;
      return res.json({ 
        user: userWithoutPassword,
        modules: moduleAccessByRole[user.role as UserRole] || []
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
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
    
    const { password, ...userWithoutPassword } = user;
    return res.json({ 
      user: userWithoutPassword,
      modules: moduleAccessByRole[user.role as UserRole] || []
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

  // Firms routes
  app.get("/api/firms", async (_req: Request, res: Response) => {
    const firms = await storage.getFirms();
    return res.json(firms);
  });

  app.get("/api/firms/:id", async (req: Request, res: Response) => {
    const firm = await storage.getFirm(req.params.id);
    if (!firm) {
      return res.status(404).json({ message: "Firm not found" });
    }
    return res.json(firm);
  });

  app.post("/api/firms", async (req: Request, res: Response) => {
    try {
      const parsed = insertFirmSchema.parse(req.body);
      
      const duplicates = await storage.findDuplicateFirms(parsed.name);
      if (duplicates.length > 0) {
        return res.status(409).json({ 
          message: "Potential duplicate firm found",
          duplicates
        });
      }
      
      const firm = await storage.createFirm(parsed);
      
      await storage.createAuditLog({
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
      const parsed = insertFirmSchema.parse(req.body);
      const firm = await storage.createFirm(parsed);
      
      await storage.createAuditLog({
        userId: req.headers["x-user-id"] as string || null,
        action: "create",
        entityType: "firm",
        entityId: firm.id,
        details: { name: firm.name, forcedCreation: true },
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
    const updated = await storage.updateFirm(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Firm not found" });
    }
    
    await storage.createAuditLog({
      userId: req.headers["x-user-id"] as string || null,
      action: "update",
      entityType: "firm",
      entityId: updated.id,
      details: req.body,
    });
    
    return res.json(updated);
  });

  app.delete("/api/firms/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteFirm(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Firm not found" });
    }
    
    await storage.createAuditLog({
      userId: req.headers["x-user-id"] as string || null,
      action: "delete",
      entityType: "firm",
      entityId: req.params.id,
      details: null,
    });
    
    return res.status(204).send();
  });

  app.get("/api/firms/:id/duplicates", async (req: Request, res: Response) => {
    const firm = await storage.getFirm(req.params.id);
    if (!firm) {
      return res.status(404).json({ message: "Firm not found" });
    }
    const duplicates = await storage.findDuplicateFirms(firm.name, firm.id);
    return res.json(duplicates);
  });

  // Contacts routes
  app.get("/api/contacts", async (req: Request, res: Response) => {
    const firmId = req.query.firmId as string | undefined;
    const contacts = await storage.getContacts(firmId);
    return res.json(contacts);
  });

  app.get("/api/contacts/:id", async (req: Request, res: Response) => {
    const contact = await storage.getContact(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    return res.json(contact);
  });

  app.post("/api/contacts", async (req: Request, res: Response) => {
    try {
      const parsed = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(parsed);
      
      await storage.createAuditLog({
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
    const updated = await storage.updateContact(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Contact not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/contacts/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteContact(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Contact not found" });
    }
    return res.status(204).send();
  });

  // Funds routes
  app.get("/api/funds", async (req: Request, res: Response) => {
    const firmId = req.query.firmId as string | undefined;
    const funds = await storage.getFunds(firmId);
    return res.json(funds);
  });

  app.get("/api/funds/:id", async (req: Request, res: Response) => {
    const fund = await storage.getFund(req.params.id);
    if (!fund) {
      return res.status(404).json({ message: "Fund not found" });
    }
    return res.json(fund);
  });

  app.post("/api/funds", async (req: Request, res: Response) => {
    try {
      const parsed = insertFundSchema.parse(req.body);
      const fund = await storage.createFund(parsed);
      
      await storage.createAuditLog({
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
    const updated = await storage.updateFund(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Fund not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/funds/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteFund(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Fund not found" });
    }
    return res.status(204).send();
  });

  // Deals routes
  app.get("/api/deals", async (req: Request, res: Response) => {
    const firmId = req.query.firmId as string | undefined;
    const fundId = req.query.fundId as string | undefined;
    const deals = await storage.getDeals(firmId, fundId);
    return res.json(deals);
  });

  app.get("/api/deals/:id", async (req: Request, res: Response) => {
    const deal = await storage.getDeal(req.params.id);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }
    return res.json(deal);
  });

  app.post("/api/deals", async (req: Request, res: Response) => {
    try {
      const parsed = insertDealSchema.parse(req.body);
      const deal = await storage.createDeal(parsed);
      
      await storage.createAuditLog({
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
    const updated = await storage.updateDeal(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Deal not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/deals/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteDeal(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Deal not found" });
    }
    return res.status(204).send();
  });

  // Projects routes
  app.get("/api/projects", async (_req: Request, res: Response) => {
    const projects = await storage.getProjects();
    return res.json(projects);
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(project);
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const parsed = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(parsed);
      return res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/projects/:id", async (req: Request, res: Response) => {
    const updated = await storage.updateProject(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteProject(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.status(204).send();
  });

  // Tasks routes
  app.get("/api/tasks", async (req: Request, res: Response) => {
    const projectId = req.query.projectId as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const status = req.query.status as string | undefined;
    const tasks = await storage.getTasks(projectId, assignedTo, status);
    return res.json(tasks);
  });

  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    const task = await storage.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json(task);
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const parsed = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(parsed);
      return res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    const updated = await storage.updateTask(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteTask(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.status(204).send();
  });

  // Annotations routes
  app.get("/api/annotations", async (req: Request, res: Response) => {
    const taskId = req.query.taskId as string | undefined;
    const annotations = await storage.getAnnotations(taskId);
    return res.json(annotations);
  });

  app.get("/api/annotations/:id", async (req: Request, res: Response) => {
    const annotation = await storage.getAnnotation(req.params.id);
    if (!annotation) {
      return res.status(404).json({ message: "Annotation not found" });
    }
    return res.json(annotation);
  });

  app.post("/api/annotations", async (req: Request, res: Response) => {
    try {
      const parsed = insertAnnotationSchema.parse(req.body);
      const annotation = await storage.createAnnotation(parsed);
      return res.status(201).json(annotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/annotations/:id", async (req: Request, res: Response) => {
    const updated = await storage.updateAnnotation(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Annotation not found" });
    }
    return res.json(updated);
  });

  // Audit logs routes
  app.get("/api/audit-logs", async (req: Request, res: Response) => {
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const logs = await storage.getAuditLogs(entityType, entityId);
    return res.json(logs);
  });

  // Monitored URLs routes
  app.get("/api/monitored-urls", async (_req: Request, res: Response) => {
    const urls = await storage.getMonitoredUrls();
    return res.json(urls);
  });

  app.get("/api/monitored-urls/:id", async (req: Request, res: Response) => {
    const url = await storage.getMonitoredUrl(req.params.id);
    if (!url) {
      return res.status(404).json({ message: "Monitored URL not found" });
    }
    return res.json(url);
  });

  app.post("/api/monitored-urls", async (req: Request, res: Response) => {
    try {
      const parsed = insertMonitoredUrlSchema.parse(req.body);
      const url = await storage.createMonitoredUrl(parsed);
      return res.status(201).json(url);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/monitored-urls/:id", async (req: Request, res: Response) => {
    const updated = await storage.updateMonitoredUrl(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Monitored URL not found" });
    }
    return res.json(updated);
  });

  app.delete("/api/monitored-urls/:id", async (req: Request, res: Response) => {
    const deleted = await storage.deleteMonitoredUrl(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Monitored URL not found" });
    }
    return res.status(204).send();
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

  return httpServer;
}
