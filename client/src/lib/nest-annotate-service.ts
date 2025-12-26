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
  const results: EntitySearchResult[] = [];

  if (!searchTerm || searchTerm.length < 2) {
    return results;
  }

  const searchPattern = `%${searchTerm}%`;

  const { data: firms } = await supabase
    .from("firms")
    .select("id, name, firm_type")
    .eq("org_id", orgId)
    .ilike("name", searchPattern)
    .limit(10);

  if (firms) {
    firms.forEach((f: { id: string; name: string; firm_type: string }) => {
      results.push({
        id: f.id,
        name: f.name,
        type: f.firm_type || "firm",
      });
    });
  }

  const { data: funds } = await supabase
    .from("funds")
    .select("id, name")
    .eq("org_id", orgId)
    .ilike("name", searchPattern)
    .limit(10);

  if (funds) {
    funds.forEach((f: { id: string; name: string }) => {
      results.push({
        id: f.id,
        name: f.name,
        type: "fund",
      });
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
    switch (entityType) {
      case "firm": {
        const { data, error } = await supabase
          .from("firms")
          .select("id, name")
          .eq("id", entityId)
          .eq("org_id", orgId)
          .single();
        if (error || !data) return null;
        return { id: data.id, name: data.name || "Unknown", type: entityType };
      }
      case "fund": {
        const { data, error } = await supabase
          .from("funds")
          .select("id, name")
          .eq("id", entityId)
          .eq("org_id", orgId)
          .single();
        if (error || !data) return null;
        return { id: data.id, name: data.name || "Unknown", type: entityType };
      }
      case "person": {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("id", entityId)
          .eq("org_id", orgId)
          .single();
        if (error || !data) return null;
        const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
        return { id: data.id, name: fullName || "Unknown", type: entityType };
      }
      case "company": {
        const { data, error } = await supabase
          .from("entities_portfolio_company")
          .select("id, company_name")
          .eq("id", entityId)
          .eq("org_id", orgId)
          .single();
        if (error || !data) return null;
        return { id: data.id, name: data.company_name || "Unknown", type: entityType };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
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
