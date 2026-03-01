"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  query,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import type { Project, ActivityLogEntry } from "@/lib/services/projectService";
import { logActivity } from "@/lib/services/projectService";
import type { Phase, Task, TaskAttachment, TaskComment } from "@/lib/services/taskTemplates";
import { uploadImage } from "@/lib/storageHelpers";

export type { Project };

// ---------------------------------------------------------------------------
// Firebase/Firestore migration:
//   projects → tenants/{tenantId}/projects
//   phases   → tenants/{tenantId}/projects/{pid}/phases
//   tasks    → tenants/{tenantId}/projects/{pid}/tasks (with phaseId field)
//   task_attachments → tenants/{tenantId}/projects/{pid}/tasks/{tid}/attachments
//   task_comments    → tenants/{tenantId}/projects/{pid}/tasks/{tid}/comments
//   activity_logs    → tenants/{tenantId}/projects/{pid}/activityLog
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mapping helpers (Firestore docs are camelCase)
// ---------------------------------------------------------------------------

function mapTaskDoc(
  id: string,
  data: any,
  attachments: TaskAttachment[],
  comments: TaskComment[]
): Task {
  return {
    id,
    name: data.name ?? "",
    status: data.status ?? "pending",
    progress: data.progress ?? 0,
    assignedTo: data.assigneeId ?? data.assignedTo,
    dueDate: data.dueDate || undefined,
    completedAt: data.completedAt || undefined,
    notes: data.notes,
    attachments,
    comments,
  };
}

function mapPhaseDoc(id: string, data: any, tasks: Task[]): Phase {
  return {
    id,
    name: data.name ?? "",
    order: data.sortOrder ?? 0,
    status: data.status ?? "pending",
    tasks,
    startDate: data.startDate || undefined,
    endDate: data.endDate || undefined,
  };
}

function mapProjectDoc(
  id: string,
  data: any,
  phases: Phase[],
  timeline: Project["timeline"]
): Project {
  return {
    id,
    tenantId: data.tenantId ?? "",
    leadId: data.leadId ?? "",
    estimateId: data.estimateId,
    clientName: data.clientName ?? "",
    clientEmail: data.clientEmail ?? "",
    clientPhone: data.clientPhone ?? "",
    clientCity: data.clientCity,
    totalAmount: data.contractValue ?? 0,
    status: data.status ?? "planning",
    projectName: data.name ?? "",
    assignedDesigner: data.designerId,
    assignedSupervisor: data.supervisorId,
    assignedTo: data.managerId,
    phases,
    startDate: data.startDate,
    expectedEndDate: data.targetEndDate,
    completedDate: data.actualEndDate,
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt,
    timeline,
    projectProgress: data.progress,
  };
}

// ---------------------------------------------------------------------------
// Enrichment: progress, overdue, health (computed from tasks)
// ---------------------------------------------------------------------------

function enrichProjects(rawProjects: Project[]): Project[] {
  const now = new Date();

  return rawProjects.map((project) => {
    let totalOverdue = 0;

    const enrichedPhases = project.phases.map((phase) => {
      const total = phase.tasks?.length || 0;
      let phaseOverdueCount = 0;

      const enrichedTasks =
        phase.tasks?.map((task) => {
          const isOverdue =
            task.status !== "completed" &&
            task.dueDate &&
            new Date(task.dueDate) < now;
          if (isOverdue) {
            phaseOverdueCount++;
            totalOverdue++;
          }
          return { ...task, isOverdue: !!isOverdue };
        }) || [];

      const progressPercentage =
        total > 0
          ? Math.round(
              enrichedTasks.reduce(
                (sum, t) =>
                  sum + (t.progress ?? (t.status === "completed" ? 100 : 0)),
                0
              ) / total
            )
          : 0;

      const isDelayed = total > 0 && phaseOverdueCount / total > 0.3;

      return { ...phase, tasks: enrichedTasks, progressPercentage, isDelayed };
    });

    const projectProgress =
      enrichedPhases.length > 0
        ? Math.round(
            enrichedPhases.reduce(
              (sum, p) => sum + (p.progressPercentage || 0),
              0
            ) / enrichedPhases.length
          )
        : 0;

    const anyPhaseDelayed = enrichedPhases.some((p) => p.isDelayed);
    const healthStatus: "on_track" | "at_risk" | "delayed" = anyPhaseDelayed
      ? "delayed"
      : totalOverdue > 0
        ? "at_risk"
        : "on_track";

    return { ...project, phases: enrichedPhases, projectProgress, healthStatus };
  });
}

// ---------------------------------------------------------------------------
// Helper: fetch subcollections for a project
// ---------------------------------------------------------------------------

async function fetchProjectSubcollections(
  tenantId: string,
  projectId: string
): Promise<{
  phases: Phase[];
  timeline: Project["timeline"];
}> {
  const db = getDb();
  const basePath = `tenants/${tenantId}/projects/${projectId}`;

  // Fetch phases, tasks, and activity logs in parallel
  const [phasesSnap, tasksSnap, activitySnap] = await Promise.all([
    getDocs(query(collection(db, `${basePath}/phases`), orderBy("sortOrder", "asc"))),
    getDocs(query(collection(db, `${basePath}/tasks`), orderBy("sortOrder", "asc"))),
    getDocs(query(collection(db, `${basePath}/activityLog`), orderBy("createdAt", "desc"))),
  ]);

  // Build tasks with attachments/comments (fetched per task)
  const taskIds = tasksSnap.docs.map((d) => d.id);
  const attachmentsByTask = new Map<string, TaskAttachment[]>();
  const commentsByTask = new Map<string, TaskComment[]>();

  // Fetch attachments and comments for all tasks in parallel
  if (taskIds.length > 0) {
    const fetchPromises: Promise<void>[] = [];

    for (const taskDoc of tasksSnap.docs) {
      const taskId = taskDoc.id;
      const taskPath = `${basePath}/tasks/${taskId}`;

      fetchPromises.push(
        getDocs(collection(db, `${taskPath}/attachments`)).then((snap) => {
          const atts: TaskAttachment[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              name: data.name ?? "",
              url: data.url ?? "",
              uploadedAt: data.createdAt ?? "",
              uploadedBy: data.uploadedBy ?? "",
            };
          });
          if (atts.length > 0) attachmentsByTask.set(taskId, atts);
        })
      );

      fetchPromises.push(
        getDocs(query(collection(db, `${taskPath}/comments`), orderBy("createdAt", "asc"))).then((snap) => {
          const comments: TaskComment[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              text: data.text ?? "",
              authorId: data.authorId ?? "",
              authorName: "",
              createdAt: data.createdAt ?? "",
              isInternal: data.isInternal ?? false,
            };
          });
          if (comments.length > 0) commentsByTask.set(taskId, comments);
        })
      );
    }

    await Promise.all(fetchPromises);
  }

  // Index tasks by phaseId
  const tasksByPhase = new Map<string, Task[]>();
  for (const taskDoc of tasksSnap.docs) {
    const data = taskDoc.data();
    const phaseId = data.phaseId;
    const list = tasksByPhase.get(phaseId) || [];
    list.push(
      mapTaskDoc(
        taskDoc.id,
        data,
        attachmentsByTask.get(taskDoc.id) || [],
        commentsByTask.get(taskDoc.id) || []
      )
    );
    tasksByPhase.set(phaseId, list);
  }

  // Build phases
  const phases = phasesSnap.docs.map((phaseDoc) => {
    const data = phaseDoc.data();
    return mapPhaseDoc(phaseDoc.id, data, tasksByPhase.get(phaseDoc.id) || []);
  });

  // Build timeline
  const timeline: Project["timeline"] = activitySnap.docs.map((alDoc) => {
    const data = alDoc.data();
    return {
      id: alDoc.id,
      action: data.summary || data.action || "",
      timestamp: data.createdAt ?? "",
      updatedBy: data.actorId,
      note: data.summary,
    };
  });

  return { phases, timeline };
}

// ---------------------------------------------------------------------------
// Status notification helper (fire-and-forget)
// ---------------------------------------------------------------------------

function sendStatusNotification(payload: {
  tenantId: string;
  projectId: string;
  clientEmail: string;
  clientName: string;
  projectName: string;
  statusType: "project" | "phase";
  entityName: string;
  newStatus: string;
}) {
  fetch("/api/status-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("Status notification failed:", err));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjects(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["projects", tenantId] as const;
  const db = getDb();

  const projectsQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/projects`),
      orderBy("createdAt", "desc"),
      firestoreLimit(50)
    );
  }, [db, tenantId]);

  const { data: projects = [], isLoading: loading } = useFirestoreQuery<Project>({
    queryKey: qk,
    collectionRef: projectsQuery!,
    mapDoc: (snap) => {
      const data = snap.data() || {};
      // Initial mapping without subcollections; enrichment happens via useEffect
      return mapProjectDoc(snap.id, data, [], []);
    },
    enabled: !!tenantId && !!projectsQuery,
  });

  // Enrich projects with subcollection data (phases, tasks, activity logs)
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const projectIdsKey = projectIds.join(",");
  const enrichingRef = useRef<string>("");

  useEffect(() => {
    if (!tenantId || projects.length === 0) return;
    // Avoid re-enriching the same set
    if (enrichingRef.current === projectIdsKey) return;
    enrichingRef.current = projectIdsKey;

    let cancelled = false;

    (async () => {
      try {
        const enriched = await Promise.all(
          projects.map(async (project) => {
            // Skip if already has phases (already enriched from cache)
            if (project.phases.length > 0) return project;
            const { phases, timeline } = await fetchProjectSubcollections(
              tenantId,
              project.id
            );
            return { ...project, phases, timeline };
          })
        );
        if (!cancelled) {
          const finalProjects = enrichProjects(enriched);
          queryClient.setQueryData(qk, finalProjects);
        }
      } catch (err) {
        console.error("Error enriching projects:", err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, projectIdsKey]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  // Stats derived via useMemo
  const stats = useMemo(() => {
    return {
      planning: projects.filter((p) => p.status === "planning").length,
      inProgress: projects.filter((p) => p.status === "in_progress").length,
      onHold: projects.filter((p) => p.status === "on_hold").length,
      completed: projects.filter((p) => p.status === "completed").length,
      totalValue: projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
      atRisk: projects.filter((p) => p.healthStatus === "at_risk").length,
      delayed: projects.filter((p) => p.healthStatus === "delayed").length,
      totalOverdueTasks: projects.reduce(
        (sum, p) =>
          sum +
          p.phases.reduce(
            (s, ph) =>
              s + (ph.tasks?.filter((t) => (t as any).isOverdue).length || 0),
            0
          ),
        0
      ),
    };
  }, [projects]);

  // -----------------------------------------------------------------------
  // updateProject
  // -----------------------------------------------------------------------
  const updateProject = useCallback(
    async (projectId: string, updates: Partial<Project>) => {
      if (!tenantId) return false;
      try {
        const db = getDb();
        const dbUpdates: Record<string, any> = {
          updatedAt: serverTimestamp(),
        };
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.projectName !== undefined) dbUpdates.name = updates.projectName;
        if (updates.startDate !== undefined) dbUpdates.startDate = updates.startDate;
        if (updates.expectedEndDate !== undefined) dbUpdates.targetEndDate = updates.expectedEndDate;
        if (updates.completedDate !== undefined) dbUpdates.actualEndDate = updates.completedDate;
        if (updates.clientName !== undefined) dbUpdates.clientName = updates.clientName;
        if (updates.clientEmail !== undefined) dbUpdates.clientEmail = updates.clientEmail;
        if (updates.clientPhone !== undefined) dbUpdates.clientPhone = updates.clientPhone;
        if (updates.clientCity !== undefined) dbUpdates.clientCity = updates.clientCity;
        if (updates.projectProgress !== undefined) dbUpdates.progress = updates.projectProgress;

        await updateDoc(doc(db, `tenants/${tenantId}/projects`, projectId), dbUpdates);

        logActivity(tenantId, projectId, {
          action: "Project updated",
          entityType: "project",
          entityId: projectId,
        }).catch(() => {});

        // Send email notification on status change
        if (updates.status !== undefined) {
          const project = projects.find((p) => p.id === projectId);
          if (project?.clientEmail) {
            sendStatusNotification({
              tenantId,
              projectId,
              clientEmail: project.clientEmail,
              clientName: project.clientName || "",
              projectName: project.projectName || "",
              statusType: "project",
              entityName: project.projectName || "",
              newStatus: updates.status,
            });
          }
        }

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating project:", error);
        return false;
      }
    },
    [tenantId, projects, invalidate]
  );

  // -----------------------------------------------------------------------
  // updatePhase
  // -----------------------------------------------------------------------
  const updatePhase = useCallback(
    async (projectId: string, phaseId: string, newStatus: Phase["status"]) => {
      if (!tenantId) return false;
      try {
        const db = getDb();

        await updateDoc(
          doc(db, `tenants/${tenantId}/projects/${projectId}/phases`, phaseId),
          { status: newStatus }
        );

        const project = projects.find((p) => p.id === projectId);
        const phaseName =
          project?.phases.find((p) => p.id === phaseId)?.name || "Unknown";

        logActivity(tenantId, projectId, {
          action: `Phase "${phaseName}" marked as ${newStatus}`,
          entityType: "phase",
          entityId: phaseId,
        }).catch(() => {});

        // Send email notification on phase status change
        if (project?.clientEmail) {
          sendStatusNotification({
            tenantId,
            projectId,
            clientEmail: project.clientEmail,
            clientName: project.clientName || "",
            projectName: project.projectName || "",
            statusType: "phase",
            entityName: phaseName,
            newStatus,
          });
        }

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating phase:", error);
        return false;
      }
    },
    [tenantId, projects, invalidate]
  );

  // -----------------------------------------------------------------------
  // updateTask (+ auto-sync progress/status, phase status)
  // -----------------------------------------------------------------------
  const updateTask = useCallback(
    async (
      projectId: string,
      phaseId: string,
      taskId: string,
      updates: Partial<Task>
    ) => {
      if (!tenantId) return false;
      try {
        const db = getDb();
        const basePath = `tenants/${tenantId}/projects/${projectId}`;

        const dbUpdates: Record<string, any> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.assignedTo !== undefined) dbUpdates.assigneeId = updates.assignedTo;
        if (updates.dueDate !== undefined) dbUpdates.dueDate = updates.dueDate;

        // Progress-status auto-sync
        if (updates.progress !== undefined) {
          dbUpdates.progress = updates.progress;
          if (updates.progress === 100) {
            dbUpdates.status = "completed";
            dbUpdates.completedAt = serverTimestamp();
          } else if (updates.progress > 0) {
            dbUpdates.status = "in_progress";
            dbUpdates.completedAt = null;
          } else {
            dbUpdates.status = "pending";
            dbUpdates.completedAt = null;
          }
        } else if (updates.status !== undefined) {
          dbUpdates.status = updates.status;
          if (updates.status === "completed") {
            dbUpdates.progress = 100;
            dbUpdates.completedAt = serverTimestamp();
          }
        }

        await updateDoc(doc(db, `${basePath}/tasks`, taskId), dbUpdates);

        // Recalculate phase status from all tasks in this phase
        const phaseTasksSnap = await getDocs(
          query(collection(db, `${basePath}/tasks`))
        );

        const phaseTasks = phaseTasksSnap.docs
          .filter((d) => d.data().phaseId === phaseId)
          .map((d) => d.data());

        if (phaseTasks.length > 0) {
          const allCompleted = phaseTasks.every(
            (t: any) => t.status === "completed"
          );
          const anyInProgress = phaseTasks.some(
            (t: any) =>
              t.status === "in_progress" || t.status === "completed"
          );
          const phaseStatus = allCompleted
            ? "completed"
            : anyInProgress
              ? "in_progress"
              : "pending";

          await updateDoc(
            doc(db, `${basePath}/phases`, phaseId),
            { status: phaseStatus }
          );
        }

        logActivity(tenantId, projectId, {
          action:
            updates.progress !== undefined
              ? `Task progress updated to ${updates.progress}%`
              : `Task "${updates.status === "completed" ? "completed" : "updated"}"`,
          entityType: "task",
          entityId: taskId,
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating task:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // addTaskAttachment
  // -----------------------------------------------------------------------
  const addTaskAttachment = useCallback(
    async (
      projectId: string,
      phaseId: string,
      taskId: string,
      file: File,
      uploadedBy: string
    ) => {
      if (!tenantId) return false;
      try {
        const db = getDb();

        const url = await uploadImage(file, tenantId, "projects");

        await addDoc(
          collection(db, `tenants/${tenantId}/projects/${projectId}/tasks/${taskId}/attachments`),
          {
            name: file.name,
            url,
            uploadedBy,
            createdAt: serverTimestamp(),
          }
        );

        logActivity(tenantId, projectId, {
          action: `File "${file.name}" uploaded to task`,
          entityType: "attachment",
          entityId: taskId,
          performedBy: uploadedBy,
          metadata: { fileName: file.name, url },
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error adding attachment:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // addTaskComment
  // -----------------------------------------------------------------------
  const addTaskComment = useCallback(
    async (
      projectId: string,
      phaseId: string,
      taskId: string,
      text: string,
      authorId: string,
      authorName: string,
      isInternal: boolean
    ) => {
      if (!tenantId) return false;
      try {
        const db = getDb();

        await addDoc(
          collection(db, `tenants/${tenantId}/projects/${projectId}/tasks/${taskId}/comments`),
          {
            text,
            authorId,
            isInternal,
            createdAt: serverTimestamp(),
          }
        );

        logActivity(tenantId, projectId, {
          action: `Comment added to task${isInternal ? " (internal)" : ""}`,
          entityType: "comment",
          entityId: taskId,
          performedBy: authorId,
          performedByName: authorName,
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error adding comment:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // assignRole
  // -----------------------------------------------------------------------
  const assignRole = useCallback(
    async (
      projectId: string,
      role: "designer" | "supervisor" | "manager",
      tenantUserId: string,
      memberName: string,
      memberEmail?: string
    ) => {
      if (!tenantId) return false;
      try {
        const db = getDb();

        const fieldMap: Record<string, string> = {
          designer: "designerId",
          supervisor: "supervisorId",
          manager: "managerId",
        };

        const field = fieldMap[role];

        await updateDoc(doc(db, `tenants/${tenantId}/projects`, projectId), {
          [field]: tenantUserId,
          updatedAt: serverTimestamp(),
        });

        // Activity log
        await addDoc(collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`), {
          entityType: "project",
          entityId: projectId,
          action: "assigned",
          summary: `${role.charAt(0).toUpperCase() + role.slice(1)} assigned: ${memberName}`,
          createdAt: serverTimestamp(),
        });

        logActivity(tenantId, projectId, {
          action: `${role.charAt(0).toUpperCase() + role.slice(1)} assigned: ${memberName}`,
          entityType: "project",
          entityId: projectId,
          metadata: { role, tenantUserId, memberName },
        }).catch(() => {});

        // Fire-and-forget: notify the assigned employee
        if (memberEmail) {
          const project = projects.find((p) => p.id === projectId);
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "project_assigned",
              memberEmail,
              memberName,
              role,
              projectName: project?.projectName || "",
              tenantBusinessName: null,
            }),
          }).catch((err) => console.error("Project assignment notification failed:", err));
        }

        invalidate();
        return true;
      } catch (error) {
        console.error("Error assigning role:", error);
        return false;
      }
    },
    [tenantId, projects, invalidate]
  );

  // -----------------------------------------------------------------------
  // fetchActivityLog
  // -----------------------------------------------------------------------
  const fetchActivityLog = useCallback(
    async (projectId: string): Promise<ActivityLogEntry[]> => {
      if (!tenantId) return [];
      const db = getDb();

      try {
        const snap = await getDocs(
          query(
            collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`),
            orderBy("createdAt", "desc"),
            firestoreLimit(50)
          )
        );

        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            action: data.summary || data.action || "",
            entityType: data.entityType ?? "",
            entityId: data.entityId ?? "",
            performedBy: data.actorId,
            metadata: data.metadata,
            timestamp: data.createdAt ?? "",
          };
        });
      } catch (error) {
        console.error("Error fetching activity log:", error);
        return [];
      }
    },
    [tenantId]
  );

  return {
    projects,
    stats,
    loading,
    updateProject,
    updatePhase,
    updateTask,
    fetchActivityLog,
    addTaskAttachment,
    addTaskComment,
    assignRole,
  };
}
