import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = ["admin", "manager", "researcher", "annotator", "qa", "guest"] as const;
export type UserRole = typeof userRoles[number];

export const approvalStatuses = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = typeof approvalStatuses[number];

export const firmTypes = ["gp", "lp", "service_provider", "company"] as const;
export type FirmType = typeof firmTypes[number];

export const taskStatuses = ["pending", "in_progress", "review", "completed", "rejected"] as const;
export type TaskStatus = typeof taskStatuses[number];

export const annotationTypes = ["text", "image", "video", "transcription", "translation"] as const;
export type AnnotationType = typeof annotationTypes[number];

export const monitoringStatuses = ["running", "changed", "no_change", "error"] as const;
export type MonitoringStatus = typeof monitoringStatuses[number];

export const orgTypes = ["internal", "client", "partner"] as const;
export type OrgType = typeof orgTypes[number];

export const orgStatuses = ["active", "inactive", "pending"] as const;
export type OrgStatus = typeof orgStatuses[number];

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  orgType: text("org_type").$type<OrgType>().default("client"),
  status: text("status").$type<OrgStatus>().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().$type<UserRole>().default("annotator"),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  qaPercentage: integer("qa_percentage").default(20),
  isActive: boolean("is_active").default(true),
  supabaseId: varchar("supabase_id"),
  createdAt: timestamp("created_at").defaultNow(),
  trialEndsAt: timestamp("trial_ends_at"),
  approvalStatus: text("approval_status").$type<ApprovalStatus>(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
}, (table) => [
  index("users_org_id_idx").on(table.orgId),
]);

export const firms = pgTable("firms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<FirmType>(),
  website: text("website"),
  description: text("description"),
  headquarters: text("headquarters"),
  foundedYear: integer("founded_year"),
  aum: text("aum"),
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
  viewedBy: jsonb("viewed_by").$type<string[]>().default([]),
}, (table) => [
  index("firms_org_id_idx").on(table.orgId),
]);

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  firmId: varchar("firm_id").references(() => firms.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  linkedIn: text("linkedin"),
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
}, (table) => [
  index("contacts_org_id_idx").on(table.orgId),
]);

export const funds = pgTable("funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  firmId: varchar("firm_id").references(() => firms.id),
  name: text("name").notNull(),
  vintage: integer("vintage"),
  size: text("size"),
  strategy: text("strategy"),
  status: text("status"),
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
}, (table) => [
  index("funds_org_id_idx").on(table.orgId),
]);

export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  firmId: varchar("firm_id").references(() => firms.id),
  fundId: varchar("fund_id").references(() => funds.id),
  companyName: text("company_name").notNull(),
  dealType: text("deal_type"),
  amount: text("amount"),
  date: text("date"),
  status: text("status"),
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
}, (table) => [
  index("deals_org_id_idx").on(table.orgId),
]);

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().$type<AnnotationType>(),
  status: text("status").default("active"),
  createdBy: varchar("created_by").references(() => users.id),
  assignedTo: jsonb("assigned_to").$type<string[]>().default([]),
}, (table) => [
  index("projects_org_id_idx").on(table.orgId),
]);

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().$type<TaskStatus>().default("pending"),
  priority: text("priority").default("medium"),
  inputType: text("input_type"),
  inputUrl: text("input_url"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  confidenceScore: integer("confidence_score"),
  pipelineStep: text("pipeline_step").default("input"),
}, (table) => [
  index("tasks_org_id_idx").on(table.orgId),
]);

export const annotations = pgTable("annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  taskId: varchar("task_id").references(() => tasks.id),
  type: text("type").notNull().$type<AnnotationType>(),
  data: jsonb("data"),
  labels: jsonb("labels").$type<string[]>().default([]),
  entities: jsonb("entities"),
  confidenceScore: integer("confidence_score"),
  createdBy: varchar("created_by").references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewStatus: text("review_status"),
  reviewNotes: text("review_notes"),
}, (table) => [
  index("annotations_org_id_idx").on(table.orgId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("audit_logs_org_id_idx").on(table.orgId),
]);

export const monitoredUrls = pgTable("monitored_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  url: text("url").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  status: text("status").notNull().$type<MonitoringStatus>().default("running"),
  lastRunDate: timestamp("last_run_date"),
  lastChangeDate: timestamp("last_change_date"),
  changeDetails: jsonb("change_details"),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("monitored_urls_org_id_idx").on(table.orgId),
]);

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertFirmSchema = createInsertSchema(firms).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
export const insertFundSchema = createInsertSchema(funds).omit({ id: true });
export const insertDealSchema = createInsertSchema(deals).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export const insertAnnotationSchema = createInsertSchema(annotations).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true });
export const insertMonitoredUrlSchema = createInsertSchema(monitoredUrls).omit({ id: true });

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertFirm = z.infer<typeof insertFirmSchema>;
export type Firm = typeof firms.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertFund = z.infer<typeof insertFundSchema>;
export type Fund = typeof funds.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type Annotation = typeof annotations.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertMonitoredUrl = z.infer<typeof insertMonitoredUrlSchema>;
export type MonitoredUrl = typeof monitoredUrls.$inferSelect;

export const moduleAccessByRole: Record<UserRole, string[]> = {
  admin: ["nest_annotate", "data_nest", "extraction_engine", "contact_intelligence"],
  manager: ["nest_annotate", "data_nest", "extraction_engine", "contact_intelligence"],
  researcher: ["nest_annotate", "data_nest", "extraction_engine", "contact_intelligence"],
  annotator: ["nest_annotate", "data_nest", "contact_intelligence"],
  qa: ["nest_annotate", "data_nest", "contact_intelligence"],
  guest: ["guest_preview"],
};

export interface SuggestedEntity {
  type: string;
  examples: string[];
}

export interface AnnotationSuggestion {
  id: string;
  taskId: string;
  suggestedLabels: string[];
  suggestedEntities: SuggestedEntity[];
  confidence: number;
  reasoning: string;
  basedOnPatterns: string[];
  createdAt: Date;
}

export interface PatternMatch {
  pattern: string;
  frequency: number;
  examples: string[];
}

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1, "Display name is required"),
  supabaseId: z.string().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
