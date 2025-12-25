import { supabase } from "../../lib/supabase";
import type { LabelType, WorkContext, AnnotationTaskStatus, UserRole } from "@shared/schema";

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
