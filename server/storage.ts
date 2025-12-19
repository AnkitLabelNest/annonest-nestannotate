import {
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
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;

  getFirms(): Promise<Firm[]>;
  getFirm(id: string): Promise<Firm | undefined>;
  createFirm(firm: InsertFirm): Promise<Firm>;
  updateFirm(id: string, firm: Partial<InsertFirm>): Promise<Firm | undefined>;
  deleteFirm(id: string): Promise<boolean>;
  findDuplicateFirms(name: string, excludeId?: string): Promise<Firm[]>;

  getContacts(firmId?: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;

  getFunds(firmId?: string): Promise<Fund[]>;
  getFund(id: string): Promise<Fund | undefined>;
  createFund(fund: InsertFund): Promise<Fund>;
  updateFund(id: string, fund: Partial<InsertFund>): Promise<Fund | undefined>;
  deleteFund(id: string): Promise<boolean>;

  getDeals(firmId?: string, fundId?: string): Promise<Deal[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<boolean>;

  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  getTasks(projectId?: string, assignedTo?: string, status?: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  getAnnotations(taskId?: string): Promise<Annotation[]>;
  getAnnotation(id: string): Promise<Annotation | undefined>;
  createAnnotation(annotation: InsertAnnotation): Promise<Annotation>;
  updateAnnotation(id: string, annotation: Partial<InsertAnnotation>): Promise<Annotation | undefined>;

  getAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  getMonitoredUrls(): Promise<MonitoredUrl[]>;
  getMonitoredUrl(id: string): Promise<MonitoredUrl | undefined>;
  createMonitoredUrl(url: InsertMonitoredUrl): Promise<MonitoredUrl>;
  updateMonitoredUrl(id: string, url: Partial<InsertMonitoredUrl>): Promise<MonitoredUrl | undefined>;
  deleteMonitoredUrl(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
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

  private seedData() {
    const adminId = randomUUID();
    const managerId = randomUUID();
    const annotatorId = randomUUID();
    const qaId = randomUUID();

    this.users.set(adminId, {
      id: adminId,
      username: "admin",
      password: "admin123",
      email: "admin@annonest.com",
      role: "admin",
      displayName: "Admin User",
      avatar: null,
      qaPercentage: 100,
      isActive: true,
    });

    this.users.set(managerId, {
      id: managerId,
      username: "manager",
      password: "manager123",
      email: "manager@annonest.com",
      role: "manager",
      displayName: "Project Manager",
      avatar: null,
      qaPercentage: 50,
      isActive: true,
    });

    this.users.set(annotatorId, {
      id: annotatorId,
      username: "annotator",
      password: "annotator123",
      email: "annotator@annonest.com",
      role: "annotator",
      displayName: "Data Annotator",
      avatar: null,
      qaPercentage: 20,
      isActive: true,
    });

    this.users.set(qaId, {
      id: qaId,
      username: "qa",
      password: "qa123",
      email: "qa@annonest.com",
      role: "qa",
      displayName: "QA Specialist",
      avatar: null,
      qaPercentage: 100,
      isActive: true,
    });

    const firm1Id = randomUUID();
    const firm2Id = randomUUID();
    const firm3Id = randomUUID();

    this.firms.set(firm1Id, {
      id: firm1Id,
      name: "Sequoia Capital",
      type: "gp",
      website: "https://sequoiacap.com",
      description: "Leading venture capital firm",
      headquarters: "Menlo Park, CA",
      foundedYear: 1972,
      aum: "$85B",
      createdBy: adminId,
      lastEditedBy: adminId,
      viewedBy: [adminId],
    });

    this.firms.set(firm2Id, {
      id: firm2Id,
      name: "BlackRock",
      type: "lp",
      website: "https://blackrock.com",
      description: "Global investment management corporation",
      headquarters: "New York, NY",
      foundedYear: 1988,
      aum: "$10T",
      createdBy: adminId,
      lastEditedBy: adminId,
      viewedBy: [],
    });

    this.firms.set(firm3Id, {
      id: firm3Id,
      name: "TechCorp Inc",
      type: "company",
      website: "https://techcorp.example.com",
      description: "Technology company",
      headquarters: "San Francisco, CA",
      foundedYear: 2015,
      aum: null,
      createdBy: managerId,
      lastEditedBy: managerId,
      viewedBy: [],
    });

    const contact1Id = randomUUID();
    this.contacts.set(contact1Id, {
      id: contact1Id,
      firmId: firm1Id,
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@sequoiacap.com",
      phone: "+1 650-555-0100",
      title: "Partner",
      linkedIn: "https://linkedin.com/in/johnsmith",
      createdBy: adminId,
      lastEditedBy: adminId,
    });

    const fund1Id = randomUUID();
    this.funds.set(fund1Id, {
      id: fund1Id,
      firmId: firm1Id,
      name: "Sequoia Fund XV",
      vintage: 2023,
      size: "$2.8B",
      strategy: "Growth Equity",
      status: "Active",
      createdBy: adminId,
      lastEditedBy: adminId,
    });

    const deal1Id = randomUUID();
    this.deals.set(deal1Id, {
      id: deal1Id,
      firmId: firm1Id,
      fundId: fund1Id,
      companyName: "OpenAI",
      dealType: "Series B",
      amount: "$300M",
      date: "2023-06-15",
      status: "Closed",
      createdBy: adminId,
      lastEditedBy: adminId,
    });

    const project1Id = randomUUID();
    const project2Id = randomUUID();

    this.projects.set(project1Id, {
      id: project1Id,
      name: "News Article Classification",
      description: "Classify news articles by topic and sentiment",
      type: "text",
      status: "active",
      createdBy: managerId,
      assignedTo: [annotatorId],
    });

    this.projects.set(project2Id, {
      id: project2Id,
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

    const url1Id = randomUUID();
    const url2Id = randomUUID();

    this.monitoredUrls.set(url1Id, {
      id: url1Id,
      url: "https://sequoiacap.com/about",
      entityType: "firm",
      entityId: firm1Id,
      status: "running",
      lastRunDate: new Date(),
      lastChangeDate: null,
      changeDetails: null,
      createdBy: adminId,
    });

    this.monitoredUrls.set(url2Id, {
      id: url2Id,
      url: "https://blackrock.com/team",
      entityType: "firm",
      entityId: firm2Id,
      status: "changed",
      lastRunDate: new Date(),
      lastChangeDate: new Date(),
      changeDetails: { field: "team", oldValue: "15 members", newValue: "17 members" },
      createdBy: adminId,
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

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      avatar: null,
      qaPercentage: 20,
      isActive: true,
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

  async getFirms(): Promise<Firm[]> {
    return Array.from(this.firms.values());
  }

  async getFirm(id: string): Promise<Firm | undefined> {
    return this.firms.get(id);
  }

  async createFirm(insertFirm: InsertFirm): Promise<Firm> {
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

  async updateFirm(id: string, updates: Partial<InsertFirm>): Promise<Firm | undefined> {
    const firm = this.firms.get(id);
    if (!firm) return undefined;
    const updated = { ...firm, ...updates };
    this.firms.set(id, updated);
    return updated;
  }

  async deleteFirm(id: string): Promise<boolean> {
    return this.firms.delete(id);
  }

  async findDuplicateFirms(name: string, excludeId?: string): Promise<Firm[]> {
    const normalizedName = name.toLowerCase().trim();
    return Array.from(this.firms.values()).filter(firm => {
      if (excludeId && firm.id === excludeId) return false;
      const firmName = firm.name.toLowerCase().trim();
      return firmName === normalizedName || 
             firmName.includes(normalizedName) || 
             normalizedName.includes(firmName);
    });
  }

  async getContacts(firmId?: string): Promise<Contact[]> {
    const contacts = Array.from(this.contacts.values());
    if (firmId) return contacts.filter(c => c.firmId === firmId);
    return contacts;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
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

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    const updated = { ...contact, ...updates };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.contacts.delete(id);
  }

  async getFunds(firmId?: string): Promise<Fund[]> {
    const funds = Array.from(this.funds.values());
    if (firmId) return funds.filter(f => f.firmId === firmId);
    return funds;
  }

  async getFund(id: string): Promise<Fund | undefined> {
    return this.funds.get(id);
  }

  async createFund(insertFund: InsertFund): Promise<Fund> {
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

  async updateFund(id: string, updates: Partial<InsertFund>): Promise<Fund | undefined> {
    const fund = this.funds.get(id);
    if (!fund) return undefined;
    const updated = { ...fund, ...updates };
    this.funds.set(id, updated);
    return updated;
  }

  async deleteFund(id: string): Promise<boolean> {
    return this.funds.delete(id);
  }

  async getDeals(firmId?: string, fundId?: string): Promise<Deal[]> {
    let deals = Array.from(this.deals.values());
    if (firmId) deals = deals.filter(d => d.firmId === firmId);
    if (fundId) deals = deals.filter(d => d.fundId === fundId);
    return deals;
  }

  async getDeal(id: string): Promise<Deal | undefined> {
    return this.deals.get(id);
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
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

  async updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal | undefined> {
    const deal = this.deals.get(id);
    if (!deal) return undefined;
    const updated = { ...deal, ...updates };
    this.deals.set(id, updated);
    return updated;
  }

  async deleteDeal(id: string): Promise<boolean> {
    return this.deals.delete(id);
  }

  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
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

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async getTasks(projectId?: string, assignedTo?: string, status?: string): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    if (projectId) tasks = tasks.filter(t => t.projectId === projectId);
    if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);
    if (status) tasks = tasks.filter(t => t.status === status);
    return tasks;
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
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

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async getAnnotations(taskId?: string): Promise<Annotation[]> {
    const annotations = Array.from(this.annotations.values());
    if (taskId) return annotations.filter(a => a.taskId === taskId);
    return annotations;
  }

  async getAnnotation(id: string): Promise<Annotation | undefined> {
    return this.annotations.get(id);
  }

  async createAnnotation(insertAnnotation: InsertAnnotation): Promise<Annotation> {
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

  async updateAnnotation(id: string, updates: Partial<InsertAnnotation>): Promise<Annotation | undefined> {
    const annotation = this.annotations.get(id);
    if (!annotation) return undefined;
    const updated = { ...annotation, ...updates };
    this.annotations.set(id, updated);
    return updated;
  }

  async getAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values());
    if (entityType) logs = logs.filter(l => l.entityType === entityType);
    if (entityId) logs = logs.filter(l => l.entityId === entityId);
    return logs.sort((a, b) => {
      const aTime = a.timestamp?.getTime() || 0;
      const bTime = b.timestamp?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
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

  async getMonitoredUrls(): Promise<MonitoredUrl[]> {
    return Array.from(this.monitoredUrls.values());
  }

  async getMonitoredUrl(id: string): Promise<MonitoredUrl | undefined> {
    return this.monitoredUrls.get(id);
  }

  async createMonitoredUrl(insertUrl: InsertMonitoredUrl): Promise<MonitoredUrl> {
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

  async updateMonitoredUrl(id: string, updates: Partial<InsertMonitoredUrl>): Promise<MonitoredUrl | undefined> {
    const url = this.monitoredUrls.get(id);
    if (!url) return undefined;
    const updated = { ...url, ...updates };
    this.monitoredUrls.set(id, updated);
    return updated;
  }

  async deleteMonitoredUrl(id: string): Promise<boolean> {
    return this.monitoredUrls.delete(id);
  }
}

export const storage = new MemStorage();
