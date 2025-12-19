import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = ["admin", "manager", "annotator", "qa"] as const;
export type UserRole = typeof userRoles[number];

export const firmTypes = ["gp", "lp", "service_provider", "company"] as const;
export type FirmType = typeof firmTypes[number];

export const taskStatuses = ["pending", "in_progress", "review", "completed", "rejected"] as const;
export type TaskStatus = typeof taskStatuses[number];

export const annotationTypes = ["text", "image", "video", "transcription", "translation"] as const;
export type AnnotationType = typeof annotationTypes[number];

export const monitoringStatuses = ["running", "changed", "no_change", "error"] as const;
export type MonitoringStatus = typeof monitoringStatuses[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().$type<UserRole>().default("annotator"),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  qaPercentage: integer("qa_percentage").default(20),
  isActive: boolean("is_active").default(true),
});

export const firms = pgTable("firms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firmId: varchar("firm_id").references(() => firms.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  linkedIn: text("linkedin"),
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
});

export const funds = pgTable("funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firmId: varchar("firm_id").references(() => firms.id),
  name: text("name").notNull(),
  vintage: integer("vintage"),
  size: text("size"),
  strategy: text("strategy"),
  status: text("status"),
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
});

export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firmId: varchar("firm_id").references(() => firms.id),
  fundId: varchar("fund_id").references(() => funds.id),
  companyName: text("company_name").notNull(),
  dealType: text("deal_type"),
  amount: text("amount"),
  date: text("date"),
  status: text("status"),
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().$type<AnnotationType>(),
  status: text("status").default("active"),
  createdBy: varchar("created_by").references(() => users.id),
  assignedTo: jsonb("assigned_to").$type<string[]>().default([]),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
});

export const annotations = pgTable("annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const monitoredUrls = pgTable("monitored_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  status: text("status").notNull().$type<MonitoringStatus>().default("running"),
  lastRunDate: timestamp("last_run_date"),
  lastChangeDate: timestamp("last_change_date"),
  changeDetails: jsonb("change_details"),
  createdBy: varchar("created_by").references(() => users.id),
});

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
  manager: ["nest_annotate", "data_nest", "extraction_engine"],
  annotator: ["nest_annotate"],
  qa: ["nest_annotate", "data_nest"],
};

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
