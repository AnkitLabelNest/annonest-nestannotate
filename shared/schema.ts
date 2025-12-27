import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, index, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = ["super_admin", "admin", "manager", "researcher", "annotator", "qa", "guest"] as const;
export type UserRole = typeof userRoles[number];

export const approvalStatuses = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = typeof approvalStatuses[number];

export const firmTypes = ["gp", "lp", "service_provider", "company"] as const;
export type FirmType = typeof firmTypes[number];

export const taskStatuses = ["pending", "in_progress", "review", "completed", "rejected"] as const;
export type TaskStatus = typeof taskStatuses[number];

export const labelTypes = ["text", "image", "video", "audio", "transcription", "translation"] as const;
export type LabelType = typeof labelTypes[number];

export const annotationTypes = ["text", "image", "video", "transcription", "translation"] as const;
export type AnnotationType = typeof annotationTypes[number];

export const workContexts = ["internal", "client"] as const;
export type WorkContext = typeof workContexts[number];

export const monitoringStatuses = ["running", "changed", "no_change", "error"] as const;
export type MonitoringStatus = typeof monitoringStatuses[number];

export const orgTypes = ["internal", "client", "partner"] as const;
export type OrgType = typeof orgTypes[number];

export const orgStatuses = ["active", "inactive", "pending"] as const;
export type OrgStatus = typeof orgStatuses[number];

export const sourceTypes = [
  "Website",
  "Regulatory Filing",
  "News / Press Release",
  "Company Deck / PDF",
  "Database",
  "LinkedIn",
  "Email / Direct Confirmation",
  "Internal Research",
  "Client Provided",
  "Other"
] as const;
export type SourceType = typeof sourceTypes[number];

export const sourceTrackingSchema = z.object({
  sourcesUsed: z.array(z.enum(sourceTypes)).max(5, "Maximum 5 sources allowed").optional().default([]),
  sourceUrls: z.array(z.string().url("Invalid URL format")).max(5, "Maximum 5 source URLs allowed").optional().default([]),
  lastUpdatedBy: z.string().uuid().optional().nullable(),
  lastUpdatedOn: z.union([z.string(), z.date()]).optional().nullable(),
});

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  orgType: text("org_type").$type<OrgType>().default("client"),
  status: text("status").$type<OrgStatus>().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export type InviteStatus = "pending" | "sent" | "accepted" | "expired";

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
  inviteStatus: text("invite_status").$type<InviteStatus>(),
  invitedBy: varchar("invited_by"),
  invitedAt: timestamp("invited_at"),
}, (table) => [
  index("users_org_id_idx").on(table.orgId),
]);

export const projectCategories = ["general", "news", "research", "training"] as const;
export type ProjectCategory = typeof projectCategories[number];

export const labelProjects = pgTable("label_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  labelType: text("label_type").notNull().$type<LabelType>(),
  projectCategory: text("project_category").notNull().$type<ProjectCategory>().default("general"),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  workContext: text("work_context").notNull().$type<WorkContext>().default("internal"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("label_projects_org_id_idx").on(table.orgId),
]);

export const annotationTaskStatuses = ["pending", "in_progress", "review", "completed"] as const;
export type AnnotationTaskStatus = typeof annotationTaskStatuses[number];

export const relevanceStatuses = ["relevant", "not_relevant"] as const;
export type RelevanceStatus = typeof relevanceStatuses[number];

export const newsFirmTypes = [
  "gp_pe", "gp_vc", "lp", "fund", "portfolio_company", 
  "service_provider", "bank_trustee", "regulator", "startup", "corporate"
] as const;
export type NewsFirmType = typeof newsFirmTypes[number];

export const newsEventTypes = [
  "fundraise", "investment", "exit", "mna", "leadership_change",
  "regulatory_update", "product_launch", "partnership", "financial_results", "litigation"
] as const;
export type NewsEventType = typeof newsEventTypes[number];

export const newsAssetClasses = [
  "private_equity", "venture_capital", "private_debt", "infrastructure",
  "real_assets", "hedge_funds", "public_markets", "esg"
] as const;
export type NewsAssetClass = typeof newsAssetClasses[number];

export const newsActionTypes = [
  "add_new_profile", "update_existing_profile", "no_new_information"
] as const;
export type NewsActionType = typeof newsActionTypes[number];

export interface TaggedEntity {
  entity_id: string;
  entity_name: string;
  entity_type: string;
}

export interface NewsItemMetadata {
  headline?: string;
  source_name?: string;
  publish_date?: string;
  url?: string;
  raw_text?: string;
  cleaned_text?: string;
  news_id?: string;  // FK to news table for entity linking
  relevance_status?: RelevanceStatus;
  relevance_notes?: string;
  firm_type?: NewsFirmType[];
  event_type?: NewsEventType[];
  asset_class?: NewsAssetClass[];
  action_type?: NewsActionType[];
  tagged_entities?: TaggedEntity[];
  created_entities?: TaggedEntity[];
}

export const annotationTasks = pgTable("annotation_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => labelProjects.id).notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: text("status").notNull().$type<AnnotationTaskStatus>().default("pending"),
  metadata: jsonb("metadata").$type<{ headline?: string; source_name?: string; publish_date?: string }>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("annotation_tasks_project_id_idx").on(table.projectId),
  index("annotation_tasks_assigned_to_idx").on(table.assignedTo),
]);

export type LabelProject = typeof labelProjects.$inferSelect;
export type InsertLabelProject = typeof labelProjects.$inferInsert;
export type AnnotationTask = typeof annotationTasks.$inferSelect;
export type InsertAnnotationTask = typeof annotationTasks.$inferInsert;

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

export const entitiesGp = pgTable("entities_gp", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  gpName: text("gp_name").notNull(),
  gpLegalName: text("gp_legal_name"),
  firmType: text("firm_type"),
  headquartersCountry: text("headquarters_country"),
  headquartersCity: text("headquarters_city"),
  totalAum: text("total_aum"),
  aumCurrency: text("aum_currency"),
  website: text("website"),
  primaryAssetClasses: text("primary_asset_classes"),
  status: text("status").default("active"),
  // Contact information
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  // Source tracking
  sourcesUsed: text("sources_used").array().default([]),
  sourceUrls: text("source_urls").array().default([]),
  lastUpdatedBy: varchar("last_updated_by"),
  lastUpdatedOn: timestamp("last_updated_on").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_gp_org_id_idx").on(table.orgId),
]);

export const entitiesLp = pgTable("entities_lp", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  lpName: text("lp_name").notNull(),
  lpLegalName: text("lp_legal_name"),
  firmType: text("firm_type"),
  headquartersCountry: text("headquarters_country"),
  headquartersCity: text("headquarters_city"),
  totalAum: text("total_aum"),
  aumCurrency: text("aum_currency"),
  website: text("website"),
  investorType: text("investor_type"),
  status: text("status").default("active"),
  // Contact information
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  // Source tracking
  sourcesUsed: text("sources_used").array().default([]),
  sourceUrls: text("source_urls").array().default([]),
  lastUpdatedBy: varchar("last_updated_by"),
  lastUpdatedOn: timestamp("last_updated_on").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_lp_org_id_idx").on(table.orgId),
]);

export const entitiesFund = pgTable("entities_fund", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  fundName: text("fund_name").notNull(),
  gpId: varchar("gp_id").references(() => entitiesGp.id),
  fundType: text("fund_type"),
  vintageYear: integer("vintage_year"),
  fundSize: text("fund_size"),
  fundCurrency: text("fund_currency"),
  targetSize: text("target_size"),
  fundStatus: text("fund_status"),
  primarySector: text("primary_sector"),
  geographicFocus: text("geographic_focus"),
  // Source tracking
  sourcesUsed: text("sources_used").array().default([]),
  sourceUrls: text("source_urls").array().default([]),
  lastUpdatedBy: varchar("last_updated_by"),
  lastUpdatedOn: timestamp("last_updated_on").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_fund_org_id_idx").on(table.orgId),
]);

export const entitiesPortfolioCompany = pgTable("entities_portfolio_company", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  companyName: text("company_name").notNull(),
  companyType: text("company_type"),
  headquartersCountry: text("headquarters_country"),
  headquartersCity: text("headquarters_city"),
  primaryIndustry: text("primary_industry"),
  businessModel: text("business_model"),
  website: text("website"),
  businessDescription: text("business_description"),
  foundedYear: integer("founded_year"),
  employeeCount: integer("employee_count"),
  status: text("status").default("active"),
  // Financial snapshot (bands only)
  revenueBand: text("revenue_band"),
  valuationBand: text("valuation_band"),
  // Lifecycle & ownership
  currentOwnerType: text("current_owner_type"),
  exitType: text("exit_type"),
  exitYear: integer("exit_year"),
  // Intelligence metadata
  confidenceScore: integer("confidence_score"),
  dataSource: text("data_source"),
  // Source tracking
  sourcesUsed: text("sources_used").array().default([]),
  sourceUrls: text("source_urls").array().default([]),
  lastUpdatedBy: varchar("last_updated_by"),
  lastUpdatedOn: timestamp("last_updated_on").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_portfolio_company_org_id_idx").on(table.orgId),
]);

export const entitiesServiceProvider = pgTable("entities_service_provider", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  providerName: text("provider_name").notNull(),
  providerType: text("provider_type"),
  headquartersCountry: text("headquarters_country"),
  headquartersCity: text("headquarters_city"),
  website: text("website"),
  servicesOffered: text("services_offered"),
  sectorExpertise: text("sector_expertise"),
  geographicCoverage: text("geographic_coverage"),
  foundedYear: integer("founded_year"),
  status: text("status").default("active"),
  // Contact information
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  // Source tracking
  sourcesUsed: text("sources_used").array().default([]),
  sourceUrls: text("source_urls").array().default([]),
  lastUpdatedBy: varchar("last_updated_by"),
  lastUpdatedOn: timestamp("last_updated_on").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_service_provider_org_id_idx").on(table.orgId),
]);

export const entitiesContact = pgTable("entities_contact", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  companyName: text("company_name"),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  linkedinUrl: text("linkedin_url"),
  notes: text("notes"),
  status: text("status").default("active"),
  // Professional context
  roleCategory: text("role_category"),
  seniorityLevel: text("seniority_level"),
  // Coverage intelligence
  assetClassFocus: text("asset_class_focus"),
  sectorFocus: text("sector_focus"),
  geographyFocus: text("geography_focus"),
  // Verification & trust
  verificationStatus: text("verification_status"),
  verificationSource: text("verification_source"),
  lastVerifiedAt: timestamp("last_verified_at"),
  // Relationship intelligence
  associatedFundIds: text("associated_fund_ids"),
  boardRoles: text("board_roles"),
  // Internal scoring
  confidenceScore: integer("confidence_score"),
  importanceScore: integer("importance_score"),
  // Source tracking
  sourcesUsed: text("sources_used").array().default([]),
  sourceUrls: text("source_urls").array().default([]),
  lastUpdatedBy: varchar("last_updated_by"),
  lastUpdatedOn: timestamp("last_updated_on").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_contact_org_id_idx").on(table.orgId),
]);

export const entitiesDeal = pgTable("entities_deal", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  dealName: text("deal_name").notNull(),
  dealType: text("deal_type"),
  dealStatus: text("deal_status"),
  dealAmount: text("deal_amount"),
  dealCurrency: text("deal_currency"),
  dealDate: text("deal_date"),
  targetCompany: text("target_company"),
  acquirerCompany: text("acquirer_company"),
  investorIds: text("investor_ids"),
  sector: text("sector"),
  notes: text("notes"),
  // Classification
  dealRound: text("deal_round"),
  assetClass: text("asset_class"),
  // Structured relationships
  targetCompanyId: varchar("target_company_id"),
  acquirerCompanyId: varchar("acquirer_company_id"),
  // Investment context
  leadInvestor: boolean("lead_investor"),
  ownershipPercentage: numeric("ownership_percentage"),
  // Trust & quality
  verificationStatus: text("verification_status"),
  confidenceScore: integer("confidence_score"),
  // Source tracking
  sourcesUsed: text("sources_used").array().default([]),
  sourceUrls: text("source_urls").array().default([]),
  lastUpdatedBy: varchar("last_updated_by"),
  lastUpdatedOn: timestamp("last_updated_on").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_deal_org_id_idx").on(table.orgId),
]);

export const urlTypes = [
  "fundamentals",
  "about_us",
  "service",
  "product",
  "financial_report",
  "address",
  "people",
  "portfolio",
  "press_release"
] as const;
export type UrlType = typeof urlTypes[number];

export const urlStatuses = ["active", "inactive"] as const;
export type UrlStatus = typeof urlStatuses[number];

export const entityUrls = pgTable("entity_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  urlType: text("url_type").$type<UrlType>().notNull(),
  urlLink: text("url_link").notNull(),
  addedDate: timestamp("added_date").defaultNow(),
  status: text("status").$type<UrlStatus>().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entity_urls_org_id_idx").on(table.orgId),
  index("entity_urls_entity_idx").on(table.entityType, table.entityId),
]);

export const insertEntityUrlSchema = createInsertSchema(entityUrls).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEntityUrl = z.infer<typeof insertEntityUrlSchema>;
export type EntityUrl = typeof entityUrls.$inferSelect;

// News table for article content
export const news = pgTable("news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  headline: text("headline"),
  sourceName: text("source_name"),
  publishDate: text("publish_date"),
  url: text("url"),
  rawText: text("raw_text"),
  cleanedText: text("cleaned_text"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("news_org_id_idx").on(table.orgId),
]);

export const insertNewsSchema = createInsertSchema(news).omit({ id: true, createdAt: true });
export type InsertNews = z.infer<typeof insertNewsSchema>;
export type News = typeof news.$inferSelect;

// Entity linking types for news
export const newsEntityTypes = ["firm", "fund", "person", "deal", "company"] as const;
export type NewsEntityType = typeof newsEntityTypes[number];

// Entity linking table for news
export const newsEntityLinks = pgTable("news_entity_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  newsId: varchar("news_id").references(() => news.id).notNull(),
  entityType: text("entity_type").notNull().$type<NewsEntityType>(),
  entityId: varchar("entity_id").notNull(),
  orgId: varchar("org_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("news_entity_links_news_id_idx").on(table.newsId),
  index("news_entity_links_entity_idx").on(table.entityType, table.entityId),
  index("news_entity_links_org_id_idx").on(table.orgId),
]);

export const insertNewsEntityLinkSchema = createInsertSchema(newsEntityLinks).omit({ id: true, createdAt: true });
export type InsertNewsEntityLink = z.infer<typeof insertNewsEntityLinkSchema>;
export type NewsEntityLink = typeof newsEntityLinks.$inferSelect;

// Text annotation storage for news
export const textAnnotations = pgTable("text_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  newsId: varchar("news_id").references(() => news.id).notNull(),
  entityType: text("entity_type").notNull(),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  textSpan: text("text_span").notNull(),
  confidence: integer("confidence"),
  orgId: varchar("org_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("text_annotations_news_id_idx").on(table.newsId),
  index("text_annotations_org_id_idx").on(table.orgId),
]);

export const insertTextAnnotationSchema = createInsertSchema(textAnnotations).omit({ id: true, createdAt: true });
export type InsertTextAnnotation = z.infer<typeof insertTextAnnotationSchema>;
export type TextAnnotation = typeof textAnnotations.$inferSelect;

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

export const insertEntityGpSchema = createInsertSchema(entitiesGp).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntityLpSchema = createInsertSchema(entitiesLp).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntityFundSchema = createInsertSchema(entitiesFund).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntityPortfolioCompanySchema = createInsertSchema(entitiesPortfolioCompany).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntityServiceProviderSchema = createInsertSchema(entitiesServiceProvider).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntityContactSchema = createInsertSchema(entitiesContact).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntityDealSchema = createInsertSchema(entitiesDeal).omit({ id: true, createdAt: true, updatedAt: true });

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

export type InsertEntityGp = z.infer<typeof insertEntityGpSchema>;
export type EntityGp = typeof entitiesGp.$inferSelect;
export type InsertEntityLp = z.infer<typeof insertEntityLpSchema>;
export type EntityLp = typeof entitiesLp.$inferSelect;
export type InsertEntityFund = z.infer<typeof insertEntityFundSchema>;
export type EntityFund = typeof entitiesFund.$inferSelect;
export type InsertEntityPortfolioCompany = z.infer<typeof insertEntityPortfolioCompanySchema>;
export type EntityPortfolioCompany = typeof entitiesPortfolioCompany.$inferSelect;
export type InsertEntityServiceProvider = z.infer<typeof insertEntityServiceProviderSchema>;
export type EntityServiceProvider = typeof entitiesServiceProvider.$inferSelect;
export type InsertEntityContact = z.infer<typeof insertEntityContactSchema>;
export type EntityContact = typeof entitiesContact.$inferSelect;
export type InsertEntityDeal = z.infer<typeof insertEntityDealSchema>;
export type EntityDeal = typeof entitiesDeal.$inferSelect;

export const moduleAccessByRole: Record<UserRole, string[]> = {
  super_admin: ["dashboard", "nest_annotate", "data_nest", "extraction_engine", "contact_intelligence", "admin_panel", "org_management", "user_management", "location_data"],
  admin: ["dashboard", "nest_annotate", "data_nest", "extraction_engine", "contact_intelligence", "admin_panel", "user_management", "location_data"],
  manager: ["dashboard", "nest_annotate", "data_nest", "extraction_engine", "contact_intelligence", "user_management", "location_data"],
  researcher: ["dashboard", "nest_annotate", "data_nest"],
  annotator: ["dashboard", "nest_annotate"],
  qa: ["dashboard", "nest_annotate", "data_nest"],
  guest: ["guest_preview"],
};

export const roleHierarchy: Record<UserRole, number> = {
  super_admin: 100,
  admin: 80,
  manager: 60,
  researcher: 40,
  annotator: 30,
  qa: 30,
  guest: 10,
};

export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return roleHierarchy[actorRole] > roleHierarchy[targetRole];
}

export function canManageUsers(role: UserRole): boolean {
  return ["super_admin", "admin", "manager"].includes(role);
}

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

// Entity edit locks for concurrent editing prevention
export const entityTypes = ["gp", "lp", "fund", "service_provider", "portfolio_company", "deal", "contact"] as const;
export type EntityType = typeof entityTypes[number];

export const entityEditLocks = pgTable("entity_edit_locks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull().$type<EntityType>(),
  entityId: varchar("entity_id").notNull(),
  lockedBy: varchar("locked_by").notNull(),
  lockedByName: text("locked_by_name"),
  lockedAt: timestamp("locked_at").defaultNow(),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
}, (table) => [
  index("entity_edit_locks_entity_idx").on(table.entityType, table.entityId),
  index("entity_edit_locks_org_idx").on(table.orgId),
]);

export const insertEntityEditLockSchema = createInsertSchema(entityEditLocks).omit({ id: true, lockedAt: true });
export type InsertEntityEditLock = z.infer<typeof insertEntityEditLockSchema>;
export type EntityEditLock = typeof entityEditLocks.$inferSelect;

// DataNest Project Tables
export const dataProjectStatuses = ["active", "paused", "completed", "archived"] as const;
export type DataProjectStatus = typeof dataProjectStatuses[number];

export const dataProjectTypes = ["research", "data_enrichment", "verification", "outreach", "custom"] as const;
export type DataProjectType = typeof dataProjectTypes[number];

export const projectTaskStatuses = ["pending", "in_progress", "completed", "blocked"] as const;
export type ProjectTaskStatus = typeof projectTaskStatuses[number];

export const entitiesProject = pgTable("entities_project", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  projectType: text("project_type").$type<DataProjectType>().default("research"),
  description: text("description"),
  status: text("status").$type<DataProjectStatus>().default("active"),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_project_org_id_idx").on(table.orgId),
]);

export const entitiesProjectItems = pgTable("entities_project_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => entitiesProject.id).notNull(),
  entityType: text("entity_type").$type<EntityType>().notNull(),
  entityId: varchar("entity_id").notNull(),
  entityNameSnapshot: text("entity_name_snapshot"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  taskStatus: text("task_status").$type<ProjectTaskStatus>().default("pending"),
  notes: text("notes"),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("entities_project_items_project_id_idx").on(table.projectId),
  index("entities_project_items_assigned_to_idx").on(table.assignedTo),
  index("entities_project_items_org_id_idx").on(table.orgId),
]);

export const entitiesProjectMembers = pgTable("entities_project_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => entitiesProject.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: text("role").default("member"),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("entities_project_members_project_id_idx").on(table.projectId),
  index("entities_project_members_user_id_idx").on(table.userId),
]);

export const insertEntitiesProjectSchema = createInsertSchema(entitiesProject).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntitiesProjectItemSchema = createInsertSchema(entitiesProjectItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEntitiesProjectMemberSchema = createInsertSchema(entitiesProjectMembers).omit({ id: true, createdAt: true });

export type InsertEntitiesProject = z.infer<typeof insertEntitiesProjectSchema>;
export type EntitiesProject = typeof entitiesProject.$inferSelect;
export type InsertEntitiesProjectItem = z.infer<typeof insertEntitiesProjectItemSchema>;
export type EntitiesProjectItem = typeof entitiesProjectItems.$inferSelect;
export type InsertEntitiesProjectMember = z.infer<typeof insertEntitiesProjectMemberSchema>;
export type EntitiesProjectMember = typeof entitiesProjectMembers.$inferSelect;

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
