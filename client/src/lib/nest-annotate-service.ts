import { supabase } from "../../lib/supabase";
import type { 
  LabelType, WorkContext, AnnotationTaskStatus, UserRole,
  NewsItemMetadata, RelevanceStatus, NewsFirmType, NewsEventType, 
  NewsAssetClass, NewsActionType, TaggedEntity
} from "@shared/schema";

export interface NewsItem {
  id: string;
  projectId: string;
  projectName: string;
  headline: string;
  sourceName: string | null;
  publishDate: string | null;
  status: AnnotationTaskStatus;
  assignedTo: string | null;
  assignedToName: string | null;
}

export interface LabelProjectWithStats {
  id: string;
  name: string;
  labelType: LabelType;
  projectCategory: string;
  orgId: string;
  workContext: WorkContext;
  createdAt: string;
  totalItems: number;
  completedItems: number;
  projectStatus: "not_started" | "in_progress" | "completed";
}

export interface LabelTypeSummary {
  labelType: LabelType;
  openCount: number;
}

interface SupabaseProject {
  id: string;
  name: string;
  label_type: string;
  project_category: string;
  org_id: string;
  work_context: string;
  created_at: string;
}

interface SupabaseTask {
  id: string;
  project_id: string;
  assigned_to: string | null;
  status: string;
  created_at: string;
  metadata: { headline?: string; source_name?: string; publish_date?: string } | null;
}

export async function fetchProjectsWithStats(
  orgId: string,
  userId: string,
  userRole: UserRole
): Promise<LabelProjectWithStats[]> {
  if (userRole === "annotator") {
    const { data: assignedTasks, error: tasksError } = await supabase
      .from("annotation_tasks")
      .select("project_id, status")
      .eq("assigned_to", userId);

    if (tasksError) {
      console.error("Error fetching assigned tasks:", tasksError);
      throw new Error("Failed to fetch tasks");
    }

    if (!assignedTasks || assignedTasks.length === 0) {
      return [];
    }

    const assignedProjectIds = Array.from(new Set(assignedTasks.map((t: { project_id: string }) => t.project_id)));
    
    const { data: projects, error: projectsError } = await supabase
      .from("label_projects")
      .select("*")
      .eq("org_id", orgId)
      .in("id", assignedProjectIds);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw new Error("Failed to fetch projects");
    }

    if (!projects || projects.length === 0) {
      return [];
    }

    const tasksByProject = new Map<string, { status: string }[]>();
    assignedTasks.forEach((task: { project_id: string; status: string }) => {
      const existing = tasksByProject.get(task.project_id) || [];
      existing.push(task);
      tasksByProject.set(task.project_id, existing);
    });

    return projects.map((project: SupabaseProject) => {
      const projectTasks = tasksByProject.get(project.id) || [];
      const totalItems = projectTasks.length;
      const completedItems = projectTasks.filter((t) => t.status === "completed").length;
      
      let projectStatus: "not_started" | "in_progress" | "completed";
      if (totalItems === 0 || completedItems === 0) {
        projectStatus = "not_started";
      } else if (completedItems === totalItems) {
        projectStatus = "completed";
      } else {
        projectStatus = "in_progress";
      }

      return {
        id: project.id,
        name: project.name,
        labelType: project.label_type as LabelType,
        projectCategory: project.project_category || "general",
        orgId: project.org_id,
        workContext: project.work_context as WorkContext,
        createdAt: project.created_at,
        totalItems,
        completedItems,
        projectStatus,
      };
    });
  }

  const { data: projects, error: projectsError } = await supabase
    .from("label_projects")
    .select("*")
    .eq("org_id", orgId);

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    throw new Error("Failed to fetch projects");
  }

  if (!projects || projects.length === 0) {
    return [];
  }

  const projectIds = projects.map((p: SupabaseProject) => p.id);
  const { data: tasks, error: tasksError } = await supabase
    .from("annotation_tasks")
    .select("*")
    .in("project_id", projectIds);

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    throw new Error("Failed to fetch tasks");
  }

  const tasksByProject = new Map<string, SupabaseTask[]>();
  (tasks || []).forEach((task: SupabaseTask) => {
    const existing = tasksByProject.get(task.project_id) || [];
    existing.push(task);
    tasksByProject.set(task.project_id, existing);
  });

  return projects.map((project: SupabaseProject) => {
    const projectTasks = tasksByProject.get(project.id) || [];
    const totalItems = projectTasks.length;
    const completedItems = projectTasks.filter((t: SupabaseTask) => t.status === "completed").length;
    
    let projectStatus: "not_started" | "in_progress" | "completed";
    if (totalItems === 0 || completedItems === 0) {
      projectStatus = "not_started";
    } else if (completedItems === totalItems) {
      projectStatus = "completed";
    } else {
      projectStatus = "in_progress";
    }

    return {
      id: project.id,
      name: project.name,
      labelType: project.label_type as LabelType,
      projectCategory: project.project_category || "general",
      orgId: project.org_id,
      workContext: project.work_context as WorkContext,
      createdAt: project.created_at,
      totalItems,
      completedItems,
      projectStatus,
    };
  });
}

export async function fetchLabelTypeSummary(
  orgId: string,
  userId: string,
  userRole: UserRole
): Promise<LabelTypeSummary[]> {
  const { data: projects, error: projectsError } = await supabase
    .from("label_projects")
    .select("id, label_type")
    .eq("org_id", orgId);

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    throw new Error("Failed to fetch projects");
  }

  if (!projects || projects.length === 0) {
    return [
      { labelType: "text", openCount: 0 },
      { labelType: "image", openCount: 0 },
      { labelType: "video", openCount: 0 },
      { labelType: "audio", openCount: 0 },
      { labelType: "transcription", openCount: 0 },
      { labelType: "translation", openCount: 0 },
    ];
  }

  const projectIds = projects.map((p: { id: string }) => p.id);
  
  let tasksQuery = supabase
    .from("annotation_tasks")
    .select("project_id, status, assigned_to")
    .in("project_id", projectIds)
    .neq("status", "completed");

  if (userRole === "annotator") {
    tasksQuery = tasksQuery.eq("assigned_to", userId);
  }

  const { data: tasks, error: tasksError } = await tasksQuery;

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    throw new Error("Failed to fetch tasks");
  }

  const projectLabelTypeMap = new Map<string, string>();
  projects.forEach((p: { id: string; label_type: string }) => {
    projectLabelTypeMap.set(p.id, p.label_type);
  });

  const countsByType: Record<string, number> = {
    text: 0,
    image: 0,
    video: 0,
    audio: 0,
    transcription: 0,
    translation: 0,
  };

  (tasks || []).forEach((task: { project_id: string }) => {
    const labelType = projectLabelTypeMap.get(task.project_id);
    if (labelType && labelType in countsByType) {
      countsByType[labelType]++;
    }
  });

  return Object.entries(countsByType).map(([labelType, openCount]) => ({
    labelType: labelType as LabelType,
    openCount,
  }));
}

export async function fetchNewsIntelligenceCount(
  orgId: string,
  userId: string,
  userRole: UserRole
): Promise<number> {
  const { data: newsProjects, error: projectsError } = await supabase
    .from("label_projects")
    .select("id")
    .eq("org_id", orgId)
    .eq("label_type", "text")
    .eq("project_category", "news");

  if (projectsError) {
    console.error("Error fetching news projects:", projectsError);
    throw new Error("Failed to fetch news projects");
  }

  if (!newsProjects || newsProjects.length === 0) {
    return 0;
  }

  const projectIds = newsProjects.map((p: { id: string }) => p.id);

  let tasksQuery = supabase
    .from("annotation_tasks")
    .select("id", { count: "exact" })
    .in("project_id", projectIds)
    .neq("status", "completed");

  if (userRole === "annotator") {
    tasksQuery = tasksQuery.eq("assigned_to", userId);
  }

  const { count, error: tasksError } = await tasksQuery;

  if (tasksError) {
    console.error("Error fetching news tasks:", tasksError);
    throw new Error("Failed to fetch news tasks");
  }

  return count || 0;
}

export interface ProjectDetails {
  id: string;
  name: string;
  labelType: LabelType;
  projectCategory: string;
  orgId: string;
  workContext: WorkContext;
  createdAt: string;
  totalItems: number;
  completedItems: number;
  pendingItems: number;
}

export interface ProjectItem {
  id: string;
  projectId: string;
  headline: string;
  status: AnnotationTaskStatus;
  assignedTo: string | null;
  assignedToEmail: string | null;
  sourceName: string | null;
  createdAt: string;
}

export interface OrgUser {
  id: string;
  email: string;
  displayName: string;
}

export async function fetchProjectById(
  projectId: string,
  orgId: string
): Promise<ProjectDetails | null> {
  const { data: project, error: projectError } = await supabase
    .from("label_projects")
    .select("*")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .single();

  if (projectError) {
    if (projectError.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching project:", projectError);
    throw new Error("Failed to fetch project");
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("annotation_tasks")
    .select("id, status")
    .eq("project_id", projectId);

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    throw new Error("Failed to fetch tasks");
  }

  const totalItems = tasks?.length || 0;
  const completedItems = tasks?.filter((t: { status: string }) => t.status === "completed").length || 0;
  const pendingItems = tasks?.filter((t: { status: string }) => t.status === "pending").length || 0;

  return {
    id: project.id,
    name: project.name,
    labelType: project.label_type as LabelType,
    projectCategory: project.project_category || "general",
    orgId: project.org_id,
    workContext: project.work_context as WorkContext,
    createdAt: project.created_at,
    totalItems,
    completedItems,
    pendingItems,
  };
}

export async function fetchProjectItems(
  projectId: string,
  orgId: string,
  userId: string,
  userRole: UserRole
): Promise<ProjectItem[]> {
  const { data: project, error: projectError } = await supabase
    .from("label_projects")
    .select("id")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .single();

  if (projectError) {
    console.error("Error verifying project:", projectError);
    throw new Error("Project not found");
  }

  let tasksQuery = supabase
    .from("annotation_tasks")
    .select("id, project_id, assigned_to, status, created_at, metadata")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (userRole === "annotator") {
    tasksQuery = tasksQuery.eq("assigned_to", userId);
  }

  const { data: tasks, error: tasksError } = await tasksQuery;

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError);
    throw new Error("Failed to fetch tasks");
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  const assignedUserIds = Array.from(
    new Set(
      tasks
        .map((t: SupabaseTask) => t.assigned_to)
        .filter((id): id is string => id !== null)
    )
  );

  let userEmailMap = new Map<string, string>();
  if (assignedUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, email")
      .in("id", assignedUserIds);

    if (users) {
      users.forEach((u: { id: string; email: string }) => {
        userEmailMap.set(u.id, u.email);
      });
    }
  }

  return tasks.map((task: SupabaseTask) => {
    const metadata = task.metadata || {};
    return {
      id: task.id,
      projectId: task.project_id,
      headline: metadata.headline || `Task ${task.id.slice(0, 8)}`,
      status: task.status as AnnotationTaskStatus,
      assignedTo: task.assigned_to,
      assignedToEmail: task.assigned_to ? userEmailMap.get(task.assigned_to) || null : null,
      sourceName: metadata.source_name || null,
      createdAt: task.created_at,
    };
  });
}

export async function fetchOrgUsers(orgId: string): Promise<OrgUser[]> {
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, display_name")
    .eq("org_id", orgId);

  if (error) {
    console.error("Error fetching org users:", error);
    throw new Error("Failed to fetch users");
  }

  return (users || []).map((u: { id: string; email: string; display_name: string }) => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name,
  }));
}

export async function bulkAssignItems(
  itemIds: string[],
  assignToUserId: string
): Promise<void> {
  const { error } = await supabase
    .from("annotation_tasks")
    .update({ assigned_to: assignToUserId })
    .in("id", itemIds);

  if (error) {
    console.error("Error bulk assigning items:", error);
    throw new Error("Failed to assign items");
  }
}

export async function assignItemsEvenly(
  itemIds: string[],
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0 || itemIds.length === 0) {
    return;
  }

  const updates = itemIds.map((itemId, index) => ({
    id: itemId,
    assignToUserId: userIds[index % userIds.length],
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from("annotation_tasks")
      .update({ assigned_to: update.assignToUserId })
      .eq("id", update.id);

    if (error) {
      console.error("Error assigning item:", error);
      throw new Error("Failed to assign items evenly");
    }
  }
}

export interface NewsItemDetail {
  id: string;
  projectId: string;
  projectName: string;
  headline: string;
  sourceName: string | null;
  publishDate: string | null;
  url: string | null;
  status: AnnotationTaskStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  metadata: NewsItemMetadata;
}

export async function fetchNewsItemById(
  taskId: string,
  orgId: string
): Promise<NewsItemDetail | null> {
  const { data: task, error: taskError } = await supabase
    .from("annotation_tasks")
    .select("id, project_id, assigned_to, status, metadata")
    .eq("id", taskId)
    .single();

  if (taskError) {
    if (taskError.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching task:", taskError);
    throw new Error("Failed to fetch task");
  }

  const { data: project, error: projectError } = await supabase
    .from("label_projects")
    .select("id, name, org_id, project_category")
    .eq("id", task.project_id)
    .eq("org_id", orgId)
    .single();

  if (projectError) {
    console.error("Error fetching project:", projectError);
    throw new Error("Project not found or access denied");
  }

  if (project.project_category !== "news") {
    throw new Error("This task is not a news item");
  }

  let assignedToName: string | null = null;
  if (task.assigned_to) {
    const { data: user } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", task.assigned_to)
      .single();
    assignedToName = user?.display_name || null;
  }

  const metadata = (task.metadata || {}) as NewsItemMetadata;

  return {
    id: task.id,
    projectId: task.project_id,
    projectName: project.name,
    headline: metadata.headline || `Task ${task.id.slice(0, 8)}`,
    sourceName: metadata.source_name || null,
    publishDate: metadata.publish_date || null,
    url: metadata.url || null,
    status: task.status as AnnotationTaskStatus,
    assignedTo: task.assigned_to,
    assignedToName,
    metadata,
  };
}

export async function updateNewsItemTags(
  taskId: string,
  tags: Partial<NewsItemMetadata>
): Promise<void> {
  const { data: existingTask, error: fetchError } = await supabase
    .from("annotation_tasks")
    .select("metadata")
    .eq("id", taskId)
    .single();

  if (fetchError) {
    console.error("Error fetching task:", fetchError);
    throw new Error("Failed to fetch task");
  }

  const existingMetadata = (existingTask.metadata || {}) as NewsItemMetadata;
  const updatedMetadata: NewsItemMetadata = {
    ...existingMetadata,
    ...tags,
  };

  const { error: updateError } = await supabase
    .from("annotation_tasks")
    .update({ metadata: updatedMetadata })
    .eq("id", taskId);

  if (updateError) {
    console.error("Error updating tags:", updateError);
    throw new Error("Failed to update tags");
  }
}

export async function updateNewsItemStatus(
  taskId: string,
  status: AnnotationTaskStatus
): Promise<void> {
  const { error } = await supabase
    .from("annotation_tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) {
    console.error("Error updating status:", error);
    throw new Error("Failed to update status");
  }
}

export interface EntitySearchResult {
  id: string;
  name: string;
  type: string;
}

export interface AnnotationTaskDetail {
  id: string;
  projectId: string;
  projectName: string;
  assignedTo: string | null;
  status: AnnotationTaskStatus;
  metadata: Record<string, unknown>;
}

export async function fetchAnnotationTaskById(
  taskId: string,
  orgId: string
): Promise<AnnotationTaskDetail | null> {
  const { data: task, error: taskError } = await supabase
    .from("annotation_tasks")
    .select("id, project_id, assigned_to, status, metadata")
    .eq("id", taskId)
    .single();

  if (taskError) {
    if (taskError.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching task:", taskError);
    throw new Error("Failed to fetch task");
  }

  const { data: project, error: projectError } = await supabase
    .from("label_projects")
    .select("id, name, org_id")
    .eq("id", task.project_id)
    .eq("org_id", orgId)
    .single();

  if (projectError) {
    console.error("Error fetching project:", projectError);
    throw new Error("Project not found or access denied");
  }

  return {
    id: task.id,
    projectId: project.id,
    projectName: project.name,
    assignedTo: task.assigned_to,
    status: task.status as AnnotationTaskStatus,
    metadata: (task.metadata || {}) as Record<string, unknown>,
  };
}

export async function searchEntities(
  orgId: string,
  searchTerm: string
): Promise<EntitySearchResult[]> {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const searchPattern = `%${searchTerm}%`;

  // Run all searches in parallel for better performance (includes service providers)
  const [gpsResult, lpsResult, fundsResult, companiesResult, contactsResult, serviceProvidersResult] = await Promise.all([
    supabase.from("entities_gp").select("id, gp_name, firm_type").eq("org_id", orgId).ilike("gp_name", searchPattern).limit(5),
    supabase.from("entities_lp").select("id, lp_name, firm_type").eq("org_id", orgId).ilike("lp_name", searchPattern).limit(5),
    supabase.from("entities_fund").select("id, fund_name, fund_type").eq("org_id", orgId).ilike("fund_name", searchPattern).limit(5),
    supabase.from("entities_portfolio_company").select("id, company_name, company_type").eq("org_id", orgId).ilike("company_name", searchPattern).limit(5),
    supabase.from("entities_contact").select("id, first_name, last_name, company_name").eq("org_id", orgId).or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`).limit(5),
    supabase.from("entities_service_provider").select("id, provider_name, provider_type").eq("org_id", orgId).ilike("provider_name", searchPattern).limit(5),
  ]);

  const results: EntitySearchResult[] = [];

  // Process GP results - always return normalized "gp" type
  if (gpsResult.data) {
    gpsResult.data.forEach((gp: { id: string; gp_name: string; firm_type: string | null }) => {
      results.push({ id: gp.id, name: gp.gp_name, type: "gp" });
    });
  }

  // Process LP results - always return normalized "lp" type
  if (lpsResult.data) {
    lpsResult.data.forEach((lp: { id: string; lp_name: string; firm_type: string | null }) => {
      results.push({ id: lp.id, name: lp.lp_name, type: "lp" });
    });
  }

  // Process Fund results - always return normalized "fund" type
  if (fundsResult.data) {
    fundsResult.data.forEach((f: { id: string; fund_name: string; fund_type: string | null }) => {
      results.push({ id: f.id, name: f.fund_name, type: "fund" });
    });
  }

  // Process Portfolio Company results - always return normalized "portfolio_company" type
  if (companiesResult.data) {
    companiesResult.data.forEach((c: { id: string; company_name: string; company_type: string | null }) => {
      results.push({ id: c.id, name: c.company_name, type: "portfolio_company" });
    });
  }

  // Process Contact results - always return normalized "contact" type with company name
  if (contactsResult.data) {
    contactsResult.data.forEach((c: { id: string; first_name: string | null; last_name: string | null; company_name?: string | null }) => {
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
      const displayName = c.company_name ? `${fullName || "Unknown"} (${c.company_name})` : (fullName || "Unknown");
      results.push({ id: c.id, name: displayName, type: "contact" });
    });
  }

  // Process Service Provider results - always return normalized "service_provider" type
  if (serviceProvidersResult.data) {
    serviceProvidersResult.data.forEach((sp: { id: string; provider_name: string; provider_type: string | null }) => {
      results.push({ id: sp.id, name: sp.provider_name, type: "service_provider" });
    });
  }

  return results;
}

export async function fetchNewsItems(
  orgId: string,
  userId: string,
  userRole: UserRole
): Promise<NewsItem[]> {
  const { data: newsProjects, error: projectsError } = await supabase
    .from("label_projects")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("label_type", "text")
    .eq("project_category", "news");

  if (projectsError) {
    console.error("Error fetching news projects:", projectsError);
    throw new Error("Failed to fetch news projects");
  }

  if (!newsProjects || newsProjects.length === 0) {
    return [];
  }

  const projectIds = newsProjects.map((p: { id: string }) => p.id);
  const projectNameMap = new Map<string, string>();
  newsProjects.forEach((p: { id: string; name: string }) => {
    projectNameMap.set(p.id, p.name);
  });

  let tasksQuery = supabase
    .from("annotation_tasks")
    .select("id, project_id, assigned_to, status, created_at, metadata")
    .in("project_id", projectIds)
    .neq("status", "completed")
    .order("created_at", { ascending: false });

  if (userRole === "annotator") {
    tasksQuery = tasksQuery.eq("assigned_to", userId);
  }

  const { data: tasks, error: tasksError } = await tasksQuery;

  if (tasksError) {
    console.error("Error fetching news tasks:", tasksError);
    throw new Error("Failed to fetch news tasks");
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  const assignedUserIds = Array.from(
    new Set(
      tasks
        .map((t: SupabaseTask) => t.assigned_to)
        .filter((id): id is string => id !== null)
    )
  );

  let userNameMap = new Map<string, string>();
  if (assignedUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, display_name")
      .in("id", assignedUserIds);

    if (users) {
      users.forEach((u: { id: string; display_name: string }) => {
        userNameMap.set(u.id, u.display_name);
      });
    }
  }

  return tasks.map((task: SupabaseTask) => {
    const projectName = projectNameMap.get(task.project_id) || "Unknown Project";
    const metadata = task.metadata || {};

    return {
      id: task.id,
      projectId: task.project_id,
      projectName,
      headline: metadata.headline || projectName,
      sourceName: metadata.source_name || null,
      publishDate: metadata.publish_date || null,
      status: task.status as AnnotationTaskStatus,
      assignedTo: task.assigned_to,
      assignedToName: task.assigned_to ? userNameMap.get(task.assigned_to) || null : null,
    };
  });
}

// ========================================
// News Table Service Functions
// ========================================

export interface NewsRecord {
  id: string;
  orgId: string;
  headline: string | null;
  sourceName: string | null;
  publishDate: string | null;
  url: string | null;
  rawText: string | null;
  cleanedText: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

export interface NewsEntityLinkRecord {
  id: string;
  newsId: string;
  entityType: string;
  entityId: string;
  createdBy: string | null;
  createdAt: string | null;
}

// Ensure a news record exists for entity linking
// Creates one from task metadata if it doesn't exist
export async function ensureNewsRecord(
  taskId: string,
  orgId: string,
  createdBy: string
): Promise<string> {
  // Fetch task with org access verified via joined project table
  // This prevents any cross-tenant metadata exposure
  const { data: taskWithProject, error: taskError } = await supabase
    .from("annotation_tasks")
    .select("id, metadata, project_id, label_projects!inner(id, org_id)")
    .eq("id", taskId)
    .eq("label_projects.org_id", orgId)
    .single();

  if (taskError || !taskWithProject) {
    console.error("Error fetching task:", taskError);
    throw new Error("Access denied: task not found or does not belong to your organization");
  }

  // Extract project from the joined result (cast to unknown first to satisfy TypeScript)
  const project = taskWithProject.label_projects as unknown as { id: string; org_id: string };

  const metadata = (taskWithProject.metadata || {}) as NewsItemMetadata;
  
  // If news_id exists, verify the record exists and return it
  if (metadata.news_id) {
    const { data: existingNews } = await supabase
      .from("news")
      .select("id")
      .eq("id", metadata.news_id)
      .eq("org_id", orgId)
      .single();
    
    if (existingNews) {
      return metadata.news_id;
    }
  }

  // Create a new news record from task metadata
  const { data: newNews, error: insertError } = await supabase
    .from("news")
    .insert({
      org_id: orgId,
      headline: metadata.headline || null,
      source_name: metadata.source_name || null,
      publish_date: metadata.publish_date || null,
      url: metadata.url || null,
      raw_text: metadata.raw_text || null,
      cleaned_text: metadata.cleaned_text || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Error creating news record:", insertError);
    throw new Error("Failed to create news record");
  }

  // Update task metadata with the new news_id (scoped by verified project_id)
  const updatedMetadata = { ...metadata, news_id: newNews.id };
  const { error: updateError } = await supabase
    .from("annotation_tasks")
    .update({ metadata: updatedMetadata })
    .eq("id", taskId)
    .eq("project_id", project.id);

  if (updateError) {
    console.error("Error updating task metadata:", updateError);
    throw new Error("Failed to update task with news reference");
  }

  return newNews.id;
}

export async function fetchNewsById(
  newsId: string,
  orgId: string
): Promise<NewsRecord | null> {
  const { data: news, error } = await supabase
    .from("news")
    .select("*")
    .eq("id", newsId)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching news:", error);
    throw new Error("Failed to fetch news");
  }

  return {
    id: news.id,
    orgId: news.org_id,
    headline: news.headline,
    sourceName: news.source_name,
    publishDate: news.publish_date,
    url: news.url,
    rawText: news.raw_text,
    cleanedText: news.cleaned_text,
    createdAt: news.created_at,
    createdBy: news.created_by,
  };
}

export async function fetchNewsEntityLinks(
  newsId: string
): Promise<NewsEntityLinkRecord[]> {
  const { data: links, error } = await supabase
    .from("news_entity_links")
    .select("*")
    .eq("news_id", newsId);

  if (error) {
    console.error("Error fetching entity links:", error);
    throw new Error("Failed to fetch entity links");
  }

  return (links || []).map((link: {
    id: string;
    news_id: string;
    entity_type: string;
    entity_id: string;
    created_by: string | null;
    created_at: string | null;
  }) => ({
    id: link.id,
    newsId: link.news_id,
    entityType: link.entity_type,
    entityId: link.entity_id,
    createdBy: link.created_by,
    createdAt: link.created_at,
  }));
}

export async function addNewsEntityLink(
  newsId: string,
  entityType: string,
  entityId: string,
  createdBy: string,
  orgId: string
): Promise<NewsEntityLinkRecord> {
  // First verify the entity belongs to the same org (security check)
  const entityCheck = await fetchEntityDetails(orgId, entityType, entityId);
  if (!entityCheck) {
    throw new Error("Entity not found or access denied");
  }

  const { data, error } = await supabase
    .from("news_entity_links")
    .insert({
      news_id: newsId,
      entity_type: entityType,
      entity_id: entityId,
      created_by: createdBy,
      org_id: orgId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding entity link:", error);
    throw new Error("Failed to add entity link");
  }

  return {
    id: data.id,
    newsId: data.news_id,
    entityType: data.entity_type,
    entityId: data.entity_id,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function removeNewsEntityLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("news_entity_links")
    .delete()
    .eq("id", linkId);

  if (error) {
    console.error("Error removing entity link:", error);
    throw new Error("Failed to remove entity link");
  }
}

// Fetch entity details for displaying linked entities
export async function fetchEntityDetails(
  orgId: string,
  entityType: string,
  entityId: string
): Promise<{ id: string; name: string; type: string } | null> {
  try {
    // Handle GP entity types (gp or any GP firm_type like PE, VC, etc.)
    if (entityType === "gp" || entityType === "PE" || entityType === "VC" || entityType === "Hedge Fund" || entityType === "Private Debt") {
      const { data, error } = await supabase
        .from("entities_gp")
        .select("id, gp_name, firm_type")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (error || !data) return null;
      return { id: data.id, name: data.gp_name || "Unknown", type: "gp" };
    }

    // Handle LP entity types
    if (entityType === "lp" || entityType === "Pension Fund" || entityType === "Endowment" || entityType === "Family Office" || entityType === "Sovereign Wealth Fund" || entityType === "Fund of Funds" || entityType === "Insurance Company" || entityType === "Foundation") {
      const { data, error } = await supabase
        .from("entities_lp")
        .select("id, lp_name, firm_type")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (error || !data) return null;
      return { id: data.id, name: data.lp_name || "Unknown", type: "lp" };
    }

    // Handle Fund entity types
    if (entityType === "fund" || entityType === "Buyout" || entityType === "Growth Equity" || entityType === "Venture Capital" || entityType === "Real Estate" || entityType === "Infrastructure" || entityType === "Credit" || entityType === "Secondaries") {
      const { data, error } = await supabase
        .from("entities_fund")
        .select("id, fund_name, fund_type")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (error || !data) return null;
      return { id: data.id, name: data.fund_name || "Unknown", type: "fund" };
    }

    // Handle Company/Portfolio Company entity types
    if (entityType === "company" || entityType === "portfolio_company" || entityType === "Private" || entityType === "Public" || entityType === "Subsidiary") {
      const { data, error } = await supabase
        .from("entities_portfolio_company")
        .select("id, company_name, company_type")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (error || !data) return null;
      return { id: data.id, name: data.company_name || "Unknown", type: "portfolio_company" };
    }

    // Handle Service Provider entity types
    if (entityType === "service_provider" || entityType === "Advisory" || entityType === "Legal" || entityType === "Placement Agent") {
      const { data, error } = await supabase
        .from("entities_service_provider")
        .select("id, provider_name, provider_type")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (error || !data) return null;
      return { id: data.id, name: data.provider_name || "Unknown", type: "service_provider" };
    }

    // Handle Person/Contact entity types
    if (entityType === "person" || entityType === "contact") {
      const { data, error } = await supabase
        .from("entities_contact")
        .select("id, first_name, last_name, company_name")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (error || !data) return null;
      const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
      const displayName = data.company_name ? `${fullName || "Unknown"} (${data.company_name})` : (fullName || "Unknown");
      return { id: data.id, name: displayName, type: "contact" };
    }

    // Legacy support: Handle old firm/fund entity types from legacy tables
    if (entityType === "firm") {
      const { data, error } = await supabase
        .from("firms")
        .select("id, name")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (!error && data) return { id: data.id, name: data.name || "Unknown", type: entityType };
    }

    if (entityType === "fund" && !entityType.includes("Buyout") && !entityType.includes("Growth")) {
      // Try legacy funds table first for backward compatibility
      const { data, error } = await supabase
        .from("funds")
        .select("id, name")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();
      if (!error && data) return { id: data.id, name: data.name || "Unknown", type: entityType };
    }

    // Fallback: Try to find in any entity table using parallel queries
    const [gpResult, lpResult, fundResult, companyResult, contactResult, serviceProviderResult] = await Promise.all([
      supabase.from("entities_gp").select("id, gp_name, firm_type").eq("id", entityId).eq("org_id", orgId).single(),
      supabase.from("entities_lp").select("id, lp_name, firm_type").eq("id", entityId).eq("org_id", orgId).single(),
      supabase.from("entities_fund").select("id, fund_name, fund_type").eq("id", entityId).eq("org_id", orgId).single(),
      supabase.from("entities_portfolio_company").select("id, company_name, company_type").eq("id", entityId).eq("org_id", orgId).single(),
      supabase.from("entities_contact").select("id, first_name, last_name, company_name").eq("id", entityId).eq("org_id", orgId).single(),
      supabase.from("entities_service_provider").select("id, provider_name, provider_type").eq("id", entityId).eq("org_id", orgId).single(),
    ]);

    if (gpResult.data) return { id: gpResult.data.id, name: gpResult.data.gp_name || "Unknown", type: "gp" };
    if (lpResult.data) return { id: lpResult.data.id, name: lpResult.data.lp_name || "Unknown", type: "lp" };
    if (fundResult.data) return { id: fundResult.data.id, name: fundResult.data.fund_name || "Unknown", type: "fund" };
    if (companyResult.data) return { id: companyResult.data.id, name: companyResult.data.company_name || "Unknown", type: "portfolio_company" };
    if (contactResult.data) {
      const fullName = `${contactResult.data.first_name || ""} ${contactResult.data.last_name || ""}`.trim();
      const displayName = contactResult.data.company_name ? `${fullName || "Unknown"} (${contactResult.data.company_name})` : (fullName || "Unknown");
      return { id: contactResult.data.id, name: displayName, type: "contact" };
    }
    if (serviceProviderResult.data) return { id: serviceProviderResult.data.id, name: serviceProviderResult.data.provider_name || "Unknown", type: "service_provider" };

    return null;
  } catch {
    return null;
  }
}

// Create a new entity in the appropriate DataNest table
export async function createEntity(
  orgId: string,
  entityType: string,
  entityName: string,
  createdBy: string
): Promise<{ id: string; name: string; type: string }> {
  let tableName: string;
  let insertData: Record<string, unknown>;

  switch (entityType) {
    case "gp":
      tableName = "entities_gp";
      insertData = {
        org_id: orgId,
        gp_name: entityName,
        firm_type: "PE",
        created_by: createdBy,
      };
      break;
    case "lp":
      tableName = "entities_lp";
      insertData = {
        org_id: orgId,
        lp_name: entityName,
        firm_type: "Pension Fund",
        created_by: createdBy,
      };
      break;
    case "service_provider":
      tableName = "entities_service_provider";
      insertData = {
        org_id: orgId,
        provider_name: entityName,
        provider_type: "Advisory",
        created_by: createdBy,
      };
      break;
    case "fund":
      tableName = "entities_fund";
      insertData = {
        org_id: orgId,
        fund_name: entityName,
        fund_type: "Buyout",
        created_by: createdBy,
      };
      break;
    case "contact":
      tableName = "entities_contact";
      const nameParts = entityName.split(" ");
      const firstName = nameParts[0] || entityName;
      const lastName = nameParts.slice(1).join(" ") || "";
      insertData = {
        org_id: orgId,
        first_name: firstName,
        last_name: lastName,
        created_by: createdBy,
      };
      break;
    case "portfolio_company":
    case "company":
      tableName = "entities_portfolio_company";
      insertData = {
        org_id: orgId,
        company_name: entityName,
        company_type: "Private",
        created_by: createdBy,
      };
      break;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const { data, error } = await supabase
    .from(tableName)
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("Error creating entity:", error);
    throw new Error(`Failed to create ${entityType} entity`);
  }

  // Return normalized entity info
  const name = data.gp_name || data.lp_name || data.fund_name || data.company_name || 
    data.provider_name || `${data.first_name || ""} ${data.last_name || ""}`.trim() || entityName;
  
  return { id: data.id, name, type: entityType };
}

// ========================================
// Text Annotations Service Functions
// ========================================

export interface TextAnnotationRecord {
  id: string;
  newsId: string;
  entityType: string;
  startOffset: number;
  endOffset: number;
  textSpan: string;
  confidence: number | null;
  createdBy: string | null;
  createdAt: string | null;
}

export async function fetchTextAnnotations(
  newsId: string
): Promise<TextAnnotationRecord[]> {
  const { data: annotations, error } = await supabase
    .from("text_annotations")
    .select("*")
    .eq("news_id", newsId);

  if (error) {
    console.error("Error fetching text annotations:", error);
    throw new Error("Failed to fetch text annotations");
  }

  return (annotations || []).map((annotation: {
    id: string;
    news_id: string;
    entity_type: string;
    start_offset: number;
    end_offset: number;
    text_span: string;
    confidence: number | null;
    created_by: string | null;
    created_at: string | null;
  }) => ({
    id: annotation.id,
    newsId: annotation.news_id,
    entityType: annotation.entity_type,
    startOffset: annotation.start_offset,
    endOffset: annotation.end_offset,
    textSpan: annotation.text_span,
    confidence: annotation.confidence,
    createdBy: annotation.created_by,
    createdAt: annotation.created_at,
  }));
}

export async function addTextAnnotation(
  newsId: string,
  entityType: string,
  startOffset: number,
  endOffset: number,
  textSpan: string,
  createdBy: string,
  orgId: string,
  confidence?: number
): Promise<TextAnnotationRecord> {
  const { data, error } = await supabase
    .from("text_annotations")
    .insert({
      news_id: newsId,
      entity_type: entityType,
      start_offset: startOffset,
      end_offset: endOffset,
      text_span: textSpan,
      confidence: confidence || null,
      created_by: createdBy,
      org_id: orgId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding text annotation:", error);
    throw new Error("Failed to add text annotation");
  }

  return {
    id: data.id,
    newsId: data.news_id,
    entityType: data.entity_type,
    startOffset: data.start_offset,
    endOffset: data.end_offset,
    textSpan: data.text_span,
    confidence: data.confidence,
    createdBy: data.created_by,
    createdAt: data.created_at,
  };
}

export async function removeTextAnnotation(annotationId: string): Promise<void> {
  const { error } = await supabase
    .from("text_annotations")
    .delete()
    .eq("id", annotationId);

  if (error) {
    console.error("Error removing text annotation:", error);
    throw new Error("Failed to remove text annotation");
  }
}
