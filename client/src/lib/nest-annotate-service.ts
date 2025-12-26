import { supabase } from "../../lib/supabase";
import type { LabelType, WorkContext, AnnotationTaskStatus, UserRole } from "@shared/schema";

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
