import {
  type Organization, type InsertOrganization,
  type User, type InsertUser,
  type Firm, type InsertFirm,
  type Contact, type InsertContact,
  type Fund, type InsertFund,
  type Deal, type InsertDeal,
  type Project, type InsertProject,
  type Task, type InsertTask,
  type Annotation, type InsertAnnotation,
  type AuditLog, type InsertAuditLog,
  type MonitoredUrl, type InsertMonitoredUrl,
  organizations,
  users,
  firms,
  contacts,
  funds,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;

  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySupabaseId(supabaseId: string): Promise<User | undefined>;
  getUsers(orgId?: string): Promise<User[]>;
  getPendingGuests(orgId?: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  createUserWithId(id: string | undefined, user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  approveUser(id: string, approvedById: string, newRole?: string): Promise<User | undefined>;
  rejectUser(id: string, approvedById: string): Promise<User | undefined>;

  getFirms(orgId: string): Promise<Firm[]>;
  getFirm(id: string, orgId: string): Promise<Firm | undefined>;
  createFirm(firm: InsertFirm & { orgId: string }): Promise<Firm>;
  updateFirm(id: string, orgId: string, firm: Partial<InsertFirm>): Promise<Firm | undefined>;
  deleteFirm(id: string, orgId: string): Promise<boolean>;
  findDuplicateFirms(orgId: string, name: string, excludeId?: string): Promise<Firm[]>;

  getContacts(orgId: string, firmId?: string): Promise<Contact[]>;
  getContact(id: string, orgId: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact & { orgId: string }): Promise<Contact>;
  updateContact(id: string, orgId: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string, orgId: string): Promise<boolean>;

  getFunds(orgId: string, firmId?: string): Promise<Fund[]>;
  getFund(id: string, orgId: string): Promise<Fund | undefined>;
  createFund(fund: InsertFund & { orgId: string }): Promise<Fund>;
  updateFund(id: string, orgId: string, fund: Partial<InsertFund>): Promise<Fund | undefined>;
  deleteFund(id: string, orgId: string): Promise<boolean>;

  getDeals(orgId: string, firmId?: string, fundId?: string): Promise<Deal[]>;
  getDeal(id: string, orgId: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal & { orgId: string }): Promise<Deal>;
  updateDeal(id: string, orgId: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string, orgId: string): Promise<boolean>;

  getProjects(orgId: string): Promise<Project[]>;
  getProject(id: string, orgId: string): Promise<Project | undefined>;
  createProject(project: InsertProject & { orgId: string }): Promise<Project>;
  updateProject(id: string, orgId: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string, orgId: string): Promise<boolean>;

  getTasks(orgId: string, projectId?: string, assignedTo?: string, status?: string): Promise<Task[]>;
  getTask(id: string, orgId: string): Promise<Task | undefined>;
  createTask(task: InsertTask & { orgId: string }): Promise<Task>;
  updateTask(id: string, orgId: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string, orgId: string): Promise<boolean>;

  getAnnotations(orgId: string, taskId?: string): Promise<Annotation[]>;
  getAnnotation(id: string, orgId: string): Promise<Annotation | undefined>;
  createAnnotation(annotation: InsertAnnotation & { orgId: string }): Promise<Annotation>;
  updateAnnotation(id: string, orgId: string, annotation: Partial<InsertAnnotation>): Promise<Annotation | undefined>;

  getAuditLogs(orgId: string, entityType?: string, entityId?: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog & { orgId: string }): Promise<AuditLog>;

  getMonitoredUrls(orgId: string): Promise<MonitoredUrl[]>;
  getMonitoredUrl(id: string, orgId: string): Promise<MonitoredUrl | undefined>;
  createMonitoredUrl(url: InsertMonitoredUrl & { orgId: string }): Promise<MonitoredUrl>;
  updateMonitoredUrl(id: string, orgId: string, url: Partial<InsertMonitoredUrl>): Promise<MonitoredUrl | undefined>;
  deleteMonitoredUrl(id: string, orgId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private organizations: Map<string, Organization>;
  private users: Map<string, User>;
  private firms: Map<string, Firm>;
  private contacts: Map<string, Contact>;
  private funds: Map<string, Fund>;
  private deals: Map<string, Deal>;
  private projects: Map<string, Project>;
  private tasks: Map<string, Task>;
  private annotations: Map<string, Annotation>;
  private auditLogs: Map<string, AuditLog>;
  private monitoredUrls: Map<string, MonitoredUrl>;

  constructor() {
    this.organizations = new Map();
    this.users = new Map();
    this.firms = new Map();
    this.contacts = new Map();
    this.funds = new Map();
    this.deals = new Map();
    this.projects = new Map();
    this.tasks = new Map();
    this.annotations = new Map();
    this.auditLogs = new Map();
    this.monitoredUrls = new Map();
    
    this.seedData();
  }

  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const org: Organization = {
      id,
      isGuestOrg: false,
      isActive: true,
      createdAt: new Date(),
      settings: {},
      ...insertOrg,
    };
    this.organizations.set(id, org);
    return org;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const org = this.organizations.get(id);
    if (!org) return undefined;
    const updated = { ...org, ...updates };
    this.organizations.set(id, updated);
    return updated;
  }

  private seedData() {
    const defaultOrgId = "b650b699-16be-43bc-9119-0250cea2e44e";
    const adminId = randomUUID();
    const managerId = randomUUID();
    const annotatorId = randomUUID();
    const qaId = randomUUID();

    this.users.set(adminId, {
      id: adminId,
      orgId: defaultOrgId,
      username: "admin",
      password: "admin123",
      email: "admin@annonest.com",
      role: "admin",
      displayName: "Admin User",
      avatar: null,
      qaPercentage: 100,
      isActive: true,
      supabaseId: null,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: "approved",
      approvedBy: null,
      approvedAt: null,
    });

    this.users.set(managerId, {
      id: managerId,
      orgId: defaultOrgId,
      username: "manager",
      password: "manager123",
      email: "manager@annonest.com",
      role: "manager",
      displayName: "Project Manager",
      avatar: null,
      qaPercentage: 50,
      isActive: true,
      supabaseId: null,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: "approved",
      approvedBy: null,
      approvedAt: null,
    });

    this.users.set(annotatorId, {
      id: annotatorId,
      orgId: defaultOrgId,
      username: "annotator",
      password: "annotator123",
      email: "annotator@annonest.com",
      role: "annotator",
      displayName: "Data Annotator",
      avatar: null,
      qaPercentage: 20,
      isActive: true,
      supabaseId: null,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: "approved",
      approvedBy: null,
      approvedAt: null,
    });

    this.users.set(qaId, {
      id: qaId,
      orgId: defaultOrgId,
      username: "qa",
      password: "qa123",
      email: "qa@annonest.com",
      role: "qa",
      displayName: "QA Specialist",
      avatar: null,
      qaPercentage: 100,
      isActive: true,
      supabaseId: null,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: "approved",
      approvedBy: null,
      approvedAt: null,
    });

    const project1Id = randomUUID();
    const project2Id = randomUUID();

    this.projects.set(project1Id, {
      id: project1Id,
      orgId: defaultOrgId,
      name: "News Article Classification",
      description: "Classify news articles by topic and sentiment",
      type: "text",
      status: "active",
      createdBy: managerId,
      assignedTo: [annotatorId],
    });

    this.projects.set(project2Id, {
      id: project2Id,
      orgId: defaultOrgId,
      name: "Product Image Labeling",
      description: "Label products in e-commerce images",
      type: "image",
      status: "active",
      createdBy: managerId,
      assignedTo: [annotatorId],
    });

    const task1Id = randomUUID();
    const task2Id = randomUUID();
    const task3Id = randomUUID();

    this.tasks.set(task1Id, {
      id: task1Id,
      orgId: defaultOrgId,
      projectId: project1Id,
      title: "Classify Tech News Articles",
      description: "Label 100 tech news articles with categories",
      status: "in_progress",
      priority: "high",
      inputType: "text",
      inputUrl: null,
      assignedTo: annotatorId,
      createdBy: managerId,
      reviewedBy: null,
      confidenceScore: null,
      pipelineStep: "annotate",
    });

    this.tasks.set(task2Id, {
      id: task2Id,
      orgId: defaultOrgId,
      projectId: project1Id,
      title: "Review Sports Articles",
      description: "Review and approve sports article classifications",
      status: "review",
      priority: "medium",
      inputType: "text",
      inputUrl: null,
      assignedTo: qaId,
      createdBy: managerId,
      reviewedBy: null,
      confidenceScore: 85,
      pipelineStep: "qa",
    });

    this.tasks.set(task3Id, {
      id: task3Id,
      orgId: defaultOrgId,
      projectId: project2Id,
      title: "Label Electronics Products",
      description: "Draw bounding boxes around electronics in images",
      status: "pending",
      priority: "low",
      inputType: "image",
      inputUrl: null,
      assignedTo: annotatorId,
      createdBy: managerId,
      reviewedBy: null,
      confidenceScore: null,
      pipelineStep: "input",
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getUserBySupabaseId(supabaseId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.supabaseId === supabaseId,
    );
  }

  async getUsers(orgId?: string): Promise<User[]> {
    const users = Array.from(this.users.values());
    if (orgId) return users.filter(u => u.orgId === orgId);
    return users;
  }

  async getPendingGuests(orgId?: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role === "guest" && user.approvalStatus === "pending" && (!orgId || user.orgId === orgId)
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      avatar: null,
      qaPercentage: 20,
      isActive: true,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: null,
      approvedBy: null,
      approvedAt: null,
      ...insertUser,
    };
    this.users.set(id, user);
    return user;
  }

  async createUserWithId(providedId: string | undefined, insertUser: InsertUser): Promise<User> {
    const id = providedId || randomUUID();
    
    if (this.users.has(id)) {
      throw new Error("User with this ID already exists");
    }
    
    const user: User = { 
      id,
      avatar: null,
      qaPercentage: 20,
      isActive: true,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: null,
      approvedBy: null,
      approvedAt: null,
      ...insertUser,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async approveUser(id: string, approvedById: string, newRole?: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated: User = {
      ...user,
      role: (newRole || "annotator") as User["role"],
      approvalStatus: "approved",
      approvedBy: approvedById,
      approvedAt: new Date(),
      trialEndsAt: null,
    };
    this.users.set(id, updated);
    return updated;
  }

  async rejectUser(id: string, approvedById: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated: User = {
      ...user,
      approvalStatus: "rejected",
      approvedBy: approvedById,
      approvedAt: new Date(),
      isActive: false,
    };
    this.users.set(id, updated);
    return updated;
  }

  async getFirms(orgId: string): Promise<Firm[]> {
    return Array.from(this.firms.values()).filter(f => f.orgId === orgId);
  }

  async getFirm(id: string, orgId: string): Promise<Firm | undefined> {
    const firm = this.firms.get(id);
    if (!firm || firm.orgId !== orgId) return undefined;
    return firm;
  }

  async createFirm(insertFirm: InsertFirm & { orgId: string }): Promise<Firm> {
    const id = randomUUID();
    const firm: Firm = { 
      id,
      website: null,
      description: null,
      headquarters: null,
      foundedYear: null,
      aum: null,
      createdBy: null,
      lastEditedBy: null,
      viewedBy: [],
      ...insertFirm,
    };
    this.firms.set(id, firm);
    return firm;
  }

  async updateFirm(id: string, orgId: string, updates: Partial<InsertFirm>): Promise<Firm | undefined> {
    const firm = this.firms.get(id);
    if (!firm || firm.orgId !== orgId) return undefined;
    const updated = { ...firm, ...updates };
    this.firms.set(id, updated);
    return updated;
  }

  async deleteFirm(id: string, orgId: string): Promise<boolean> {
    const firm = this.firms.get(id);
    if (!firm || firm.orgId !== orgId) return false;
    return this.firms.delete(id);
  }

  async findDuplicateFirms(orgId: string, name: string, excludeId?: string): Promise<Firm[]> {
    const normalizedName = name.toLowerCase().trim();
    return Array.from(this.firms.values()).filter(firm => {
      if (firm.orgId !== orgId) return false;
      if (excludeId && firm.id === excludeId) return false;
      const firmName = firm.name.toLowerCase().trim();
      return firmName === normalizedName || 
             firmName.includes(normalizedName) || 
             normalizedName.includes(firmName);
    });
  }

  async getContacts(orgId: string, firmId?: string): Promise<Contact[]> {
    const contacts = Array.from(this.contacts.values()).filter(c => c.orgId === orgId);
    if (firmId) return contacts.filter(c => c.firmId === firmId);
    return contacts;
  }

  async getContact(id: string, orgId: string): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact || contact.orgId !== orgId) return undefined;
    return contact;
  }

  async createContact(insertContact: InsertContact & { orgId: string }): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = { 
      id,
      firmId: null,
      email: null,
      phone: null,
      title: null,
      linkedIn: null,
      createdBy: null,
      lastEditedBy: null,
      ...insertContact,
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, orgId: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact || contact.orgId !== orgId) return undefined;
    const updated = { ...contact, ...updates };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string, orgId: string): Promise<boolean> {
    const contact = this.contacts.get(id);
    if (!contact || contact.orgId !== orgId) return false;
    return this.contacts.delete(id);
  }

  async getFunds(orgId: string, firmId?: string): Promise<Fund[]> {
    const funds = Array.from(this.funds.values()).filter(f => f.orgId === orgId);
    if (firmId) return funds.filter(f => f.firmId === firmId);
    return funds;
  }

  async getFund(id: string, orgId: string): Promise<Fund | undefined> {
    const fund = this.funds.get(id);
    if (!fund || fund.orgId !== orgId) return undefined;
    return fund;
  }

  async createFund(insertFund: InsertFund & { orgId: string }): Promise<Fund> {
    const id = randomUUID();
    const fund: Fund = { 
      id,
      firmId: null,
      vintage: null,
      size: null,
      strategy: null,
      status: null,
      createdBy: null,
      lastEditedBy: null,
      ...insertFund,
    };
    this.funds.set(id, fund);
    return fund;
  }

  async updateFund(id: string, orgId: string, updates: Partial<InsertFund>): Promise<Fund | undefined> {
    const fund = this.funds.get(id);
    if (!fund || fund.orgId !== orgId) return undefined;
    const updated = { ...fund, ...updates };
    this.funds.set(id, updated);
    return updated;
  }

  async deleteFund(id: string, orgId: string): Promise<boolean> {
    const fund = this.funds.get(id);
    if (!fund || fund.orgId !== orgId) return false;
    return this.funds.delete(id);
  }

  async getDeals(orgId: string, firmId?: string, fundId?: string): Promise<Deal[]> {
    let deals = Array.from(this.deals.values()).filter(d => d.orgId === orgId);
    if (firmId) deals = deals.filter(d => d.firmId === firmId);
    if (fundId) deals = deals.filter(d => d.fundId === fundId);
    return deals;
  }

  async getDeal(id: string, orgId: string): Promise<Deal | undefined> {
    const deal = this.deals.get(id);
    if (!deal || deal.orgId !== orgId) return undefined;
    return deal;
  }

  async createDeal(insertDeal: InsertDeal & { orgId: string }): Promise<Deal> {
    const id = randomUUID();
    const deal: Deal = { 
      id,
      firmId: null,
      fundId: null,
      dealType: null,
      amount: null,
      date: null,
      status: null,
      createdBy: null,
      lastEditedBy: null,
      ...insertDeal,
    };
    this.deals.set(id, deal);
    return deal;
  }

  async updateDeal(id: string, orgId: string, updates: Partial<InsertDeal>): Promise<Deal | undefined> {
    const deal = this.deals.get(id);
    if (!deal || deal.orgId !== orgId) return undefined;
    const updated = { ...deal, ...updates };
    this.deals.set(id, updated);
    return updated;
  }

  async deleteDeal(id: string, orgId: string): Promise<boolean> {
    const deal = this.deals.get(id);
    if (!deal || deal.orgId !== orgId) return false;
    return this.deals.delete(id);
  }

  async getProjects(orgId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.orgId === orgId);
  }

  async getProject(id: string, orgId: string): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project || project.orgId !== orgId) return undefined;
    return project;
  }

  async createProject(insertProject: InsertProject & { orgId: string }): Promise<Project> {
    const id = randomUUID();
    const project: Project = { 
      id,
      description: null,
      status: "active",
      createdBy: null,
      assignedTo: [],
      ...insertProject,
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, orgId: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project || project.orgId !== orgId) return undefined;
    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string, orgId: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project || project.orgId !== orgId) return false;
    return this.projects.delete(id);
  }

  async getTasks(orgId: string, projectId?: string, assignedTo?: string, status?: string): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values()).filter(t => t.orgId === orgId);
    if (projectId) tasks = tasks.filter(t => t.projectId === projectId);
    if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);
    if (status) tasks = tasks.filter(t => t.status === status);
    return tasks;
  }

  async getTask(id: string, orgId: string): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task || task.orgId !== orgId) return undefined;
    return task;
  }

  async createTask(insertTask: InsertTask & { orgId: string }): Promise<Task> {
    const id = randomUUID();
    const task: Task = { 
      id,
      projectId: null,
      description: null,
      status: "pending",
      priority: "medium",
      inputType: null,
      inputUrl: null,
      assignedTo: null,
      createdBy: null,
      reviewedBy: null,
      confidenceScore: null,
      pipelineStep: "input",
      ...insertTask,
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, orgId: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task || task.orgId !== orgId) return undefined;
    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string, orgId: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task || task.orgId !== orgId) return false;
    return this.tasks.delete(id);
  }

  async getAnnotations(orgId: string, taskId?: string): Promise<Annotation[]> {
    const annotations = Array.from(this.annotations.values()).filter(a => a.orgId === orgId);
    if (taskId) return annotations.filter(a => a.taskId === taskId);
    return annotations;
  }

  async getAnnotation(id: string, orgId: string): Promise<Annotation | undefined> {
    const annotation = this.annotations.get(id);
    if (!annotation || annotation.orgId !== orgId) return undefined;
    return annotation;
  }

  async createAnnotation(insertAnnotation: InsertAnnotation & { orgId: string }): Promise<Annotation> {
    const id = randomUUID();
    const annotation: Annotation = { 
      id,
      taskId: null,
      data: null,
      labels: [],
      entities: null,
      confidenceScore: null,
      createdBy: null,
      reviewedBy: null,
      reviewStatus: null,
      reviewNotes: null,
      ...insertAnnotation,
    };
    this.annotations.set(id, annotation);
    return annotation;
  }

  async updateAnnotation(id: string, orgId: string, updates: Partial<InsertAnnotation>): Promise<Annotation | undefined> {
    const annotation = this.annotations.get(id);
    if (!annotation || annotation.orgId !== orgId) return undefined;
    const updated = { ...annotation, ...updates };
    this.annotations.set(id, updated);
    return updated;
  }

  async getAuditLogs(orgId: string, entityType?: string, entityId?: string): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values()).filter(l => l.orgId === orgId);
    if (entityType) logs = logs.filter(l => l.entityType === entityType);
    if (entityId) logs = logs.filter(l => l.entityId === entityId);
    return logs.sort((a, b) => {
      const aTime = a.timestamp?.getTime() || 0;
      const bTime = b.timestamp?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async createAuditLog(insertLog: InsertAuditLog & { orgId: string }): Promise<AuditLog> {
    const id = randomUUID();
    const log: AuditLog = { 
      id,
      userId: null,
      entityId: null,
      details: null,
      timestamp: new Date(),
      ...insertLog,
    };
    this.auditLogs.set(id, log);
    return log;
  }

  async getMonitoredUrls(orgId: string): Promise<MonitoredUrl[]> {
    return Array.from(this.monitoredUrls.values()).filter(u => u.orgId === orgId);
  }

  async getMonitoredUrl(id: string, orgId: string): Promise<MonitoredUrl | undefined> {
    const url = this.monitoredUrls.get(id);
    if (!url || url.orgId !== orgId) return undefined;
    return url;
  }

  async createMonitoredUrl(insertUrl: InsertMonitoredUrl & { orgId: string }): Promise<MonitoredUrl> {
    const id = randomUUID();
    const url: MonitoredUrl = { 
      id,
      entityType: "firm",
      entityId: null,
      status: "running",
      lastRunDate: null,
      lastChangeDate: null,
      changeDetails: null,
      createdBy: null,
      ...insertUrl,
    };
    this.monitoredUrls.set(id, url);
    return url;
  }

  async updateMonitoredUrl(id: string, orgId: string, updates: Partial<InsertMonitoredUrl>): Promise<MonitoredUrl | undefined> {
    const url = this.monitoredUrls.get(id);
    if (!url || url.orgId !== orgId) return undefined;
    const updated = { ...url, ...updates };
    this.monitoredUrls.set(id, updated);
    return updated;
  }

  async deleteMonitoredUrl(id: string, orgId: string): Promise<boolean> {
    const url = this.monitoredUrls.get(id);
    if (!url || url.orgId !== orgId) return false;
    return this.monitoredUrls.delete(id);
  }
}

export class DatabaseStorage extends MemStorage {
  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(eq(organizations.id, id));
    return result[0];
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const orgToInsert = {
      id,
      isGuestOrg: false,
      isActive: true,
      createdAt: new Date(),
      settings: {},
      ...insertOrg,
    };
    const result = await db.insert(organizations).values(orgToInsert).returning();
    return result[0];
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const result = await db.update(organizations)
      .set(updates)
      .where(eq(organizations.id, id))
      .returning();
    return result[0];
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUserBySupabaseId(supabaseId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.supabaseId, supabaseId));
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getPendingGuests(): Promise<User[]> {
    return await db.select().from(users).where(
      and(
        eq(users.role, "guest"),
        eq(users.approvalStatus, "pending")
      )
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const userToInsert = {
      id,
      avatar: null,
      qaPercentage: 20,
      isActive: true,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: null,
      approvedBy: null,
      approvedAt: null,
      ...insertUser,
    };
    
    const result = await db.insert(users).values(userToInsert).returning();
    return result[0];
  }

  async createUserWithId(providedId: string | undefined, insertUser: InsertUser): Promise<User> {
    const id = providedId || randomUUID();
    
    const existing = await this.getUser(id);
    if (existing) {
      throw new Error("User with this ID already exists");
    }
    
    const userToInsert = {
      id,
      avatar: null,
      qaPercentage: 20,
      isActive: true,
      createdAt: new Date(),
      trialEndsAt: null,
      approvalStatus: null,
      approvedBy: null,
      approvedAt: null,
      ...insertUser,
    };
    
    const result = await db.insert(users).values(userToInsert).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async approveUser(id: string, approvedById: string, newRole?: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        role: (newRole || "annotator") as User["role"],
        approvalStatus: "approved",
        approvedBy: approvedById,
        approvedAt: new Date(),
        trialEndsAt: null,
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async rejectUser(id: string, approvedById: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({
        approvalStatus: "rejected",
        approvedBy: approvedById,
        approvedAt: new Date(),
        isActive: false,
      })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async getFirms(orgId: string): Promise<Firm[]> {
    return await db.select().from(firms).where(eq(firms.orgId, orgId));
  }

  async getFirm(id: string, orgId: string): Promise<Firm | undefined> {
    const result = await db.select().from(firms).where(
      and(eq(firms.id, id), eq(firms.orgId, orgId))
    );
    return result[0];
  }

  async createFirm(insertFirm: InsertFirm & { orgId: string }): Promise<Firm> {
    const id = randomUUID();
    const firmToInsert = {
      id,
      website: insertFirm.website ?? null,
      description: insertFirm.description ?? null,
      headquarters: insertFirm.headquarters ?? null,
      foundedYear: insertFirm.foundedYear ?? null,
      aum: insertFirm.aum ?? null,
      createdBy: insertFirm.createdBy ?? null,
      lastEditedBy: insertFirm.lastEditedBy ?? null,
      viewedBy: insertFirm.viewedBy ?? [],
      ...insertFirm,
    };
    const result = await db.insert(firms).values(firmToInsert).returning();
    return result[0];
  }

  async updateFirm(id: string, orgId: string, updates: Partial<InsertFirm>): Promise<Firm | undefined> {
    const result = await db.update(firms)
      .set(updates)
      .where(and(eq(firms.id, id), eq(firms.orgId, orgId)))
      .returning();
    return result[0];
  }

  async deleteFirm(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(firms)
      .where(and(eq(firms.id, id), eq(firms.orgId, orgId)))
      .returning();
    return result.length > 0;
  }

  async findDuplicateFirms(orgId: string, name: string, excludeId?: string): Promise<Firm[]> {
    const allFirms = await this.getFirms(orgId);
    const normalizedName = name.toLowerCase().trim();
    return allFirms.filter(f => {
      if (excludeId && f.id === excludeId) return false;
      return f.name.toLowerCase().trim() === normalizedName;
    });
  }

  async getContacts(orgId: string, firmId?: string): Promise<Contact[]> {
    if (firmId) {
      return await db.select().from(contacts).where(
        and(eq(contacts.orgId, orgId), eq(contacts.firmId, firmId))
      );
    }
    return await db.select().from(contacts).where(eq(contacts.orgId, orgId));
  }

  async getContact(id: string, orgId: string): Promise<Contact | undefined> {
    const result = await db.select().from(contacts).where(
      and(eq(contacts.id, id), eq(contacts.orgId, orgId))
    );
    return result[0];
  }

  async createContact(insertContact: InsertContact & { orgId: string }): Promise<Contact> {
    const id = randomUUID();
    const contactToInsert = {
      id,
      firmId: insertContact.firmId ?? null,
      email: insertContact.email ?? null,
      phone: insertContact.phone ?? null,
      title: insertContact.title ?? null,
      linkedIn: insertContact.linkedIn ?? null,
      createdBy: insertContact.createdBy ?? null,
      lastEditedBy: insertContact.lastEditedBy ?? null,
      ...insertContact,
    };
    const result = await db.insert(contacts).values(contactToInsert).returning();
    return result[0];
  }

  async updateContact(id: string, orgId: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const result = await db.update(contacts)
      .set(updates)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();
    return result[0];
  }

  async deleteContact(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)))
      .returning();
    return result.length > 0;
  }

  async getFunds(orgId: string, firmId?: string): Promise<Fund[]> {
    if (firmId) {
      return await db.select().from(funds).where(
        and(eq(funds.orgId, orgId), eq(funds.firmId, firmId))
      );
    }
    return await db.select().from(funds).where(eq(funds.orgId, orgId));
  }

  async getFund(id: string, orgId: string): Promise<Fund | undefined> {
    const result = await db.select().from(funds).where(
      and(eq(funds.id, id), eq(funds.orgId, orgId))
    );
    return result[0];
  }

  async createFund(insertFund: InsertFund & { orgId: string }): Promise<Fund> {
    const id = randomUUID();
    const fundToInsert = {
      id,
      firmId: insertFund.firmId ?? null,
      vintage: insertFund.vintage ?? null,
      size: insertFund.size ?? null,
      strategy: insertFund.strategy ?? null,
      status: insertFund.status ?? null,
      createdBy: insertFund.createdBy ?? null,
      lastEditedBy: insertFund.lastEditedBy ?? null,
      ...insertFund,
    };
    const result = await db.insert(funds).values(fundToInsert).returning();
    return result[0];
  }

  async updateFund(id: string, orgId: string, updates: Partial<InsertFund>): Promise<Fund | undefined> {
    const result = await db.update(funds)
      .set(updates)
      .where(and(eq(funds.id, id), eq(funds.orgId, orgId)))
      .returning();
    return result[0];
  }

  async deleteFund(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(funds)
      .where(and(eq(funds.id, id), eq(funds.orgId, orgId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
