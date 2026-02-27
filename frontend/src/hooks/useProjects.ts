"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import type { Project, ActivityLogEntry } from "@/lib/services/projectService";
import { logActivity } from "@/lib/services/projectService";
import type { Phase, Task } from "@/lib/services/taskTemplates";

export type { Project };

export function useProjects(tenantId: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    planning: 0,
    inProgress: 0,
    onHold: 0,
    completed: 0,
    totalValue: 0,
    atRisk: 0,
    delayed: 0,
    totalOverdueTasks: 0,
  });

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const projectsRef = collection(db, `tenants/${tenantId}/projects`);
    const q = query(projectsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Project[];

        // Enrich projects with progress, overdue, and health data
        const now = new Date();
        const enriched = data.map((project) => {
          let overdueCount = 0;
          const enrichedPhases = project.phases.map((phase) => {
            const total = phase.tasks?.length || 0;
            const completed = phase.tasks?.filter((t) => t.status === "completed").length || 0;
            const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

            let isDelayed = false;
            const enrichedTasks = phase.tasks?.map((task) => {
              const isOverdue =
                task.status !== "completed" &&
                task.dueDate &&
                (task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate)) < now;
              if (isOverdue) {
                overdueCount++;
                isDelayed = true;
              }
              return { ...task, isOverdue: !!isOverdue };
            }) || [];

            return { ...phase, tasks: enrichedTasks, progressPercentage, isDelayed };
          });

          const projectProgress =
            enrichedPhases.length > 0
              ? Math.round(
                  enrichedPhases.reduce((sum, p) => sum + (p.progressPercentage || 0), 0) /
                    enrichedPhases.length
                )
              : 0;

          const healthStatus: "on_track" | "at_risk" | "delayed" =
            overdueCount > 10 ? "delayed" : overdueCount > 5 ? "at_risk" : "on_track";

          return { ...project, phases: enrichedPhases, projectProgress, healthStatus };
        });

        setProjects(enriched);

        setStats({
          planning: enriched.filter((p) => p.status === "planning").length,
          inProgress: enriched.filter((p) => p.status === "in_progress").length,
          onHold: enriched.filter((p) => p.status === "on_hold").length,
          completed: enriched.filter((p) => p.status === "completed").length,
          totalValue: enriched.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
          atRisk: enriched.filter((p) => p.healthStatus === "at_risk").length,
          delayed: enriched.filter((p) => p.healthStatus === "delayed").length,
          totalOverdueTasks: enriched.reduce(
            (sum, p) =>
              sum +
              p.phases.reduce(
                (s, ph) => s + (ph.tasks?.filter((t) => t.isOverdue).length || 0),
                0
              ),
            0
          ),
        });

        setLoading(false);
      },
      (error) => {
        console.error("Error fetching projects:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  const updateProject = useCallback(
    async (projectId: string, updates: Partial<Project>) => {
      if (!tenantId) return false;
      try {
        const ref = doc(db, `tenants/${tenantId}/projects`, projectId);
        await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });

        // Log activity (fire-and-forget)
        logActivity(tenantId, projectId, {
          action: "Project status changed",
          entityType: "project",
          entityId: projectId,
        }).catch(() => {});

        return true;
      } catch (error) {
        console.error("Error updating project:", error);
        return false;
      }
    },
    [tenantId]
  );

  const updatePhase = useCallback(
    async (projectId: string, phaseId: string, newStatus: Phase["status"]) => {
      if (!tenantId) return false;
      try {
        const project = projects.find((p) => p.id === projectId);
        if (!project) return false;

        const updatedPhases = project.phases.map((phase) =>
          phase.id === phaseId ? { ...phase, status: newStatus } : phase
        );

        const ref = doc(db, `tenants/${tenantId}/projects`, projectId);
        await updateDoc(ref, {
          phases: updatedPhases,
          updatedAt: serverTimestamp(),
          timeline: arrayUnion({
            action: `Phase "${project.phases.find((p) => p.id === phaseId)?.name}" marked as ${newStatus}`,
            timestamp: Timestamp.now(),
          }),
        });

        // Log activity (fire-and-forget)
        logActivity(tenantId, projectId, {
          action: `Phase "${project.phases.find((p) => p.id === phaseId)?.name}" marked as ${newStatus}`,
          entityType: "phase",
          entityId: phaseId,
        }).catch(() => {});

        return true;
      } catch (error) {
        console.error("Error updating phase:", error);
        return false;
      }
    },
    [tenantId, projects]
  );

  const updateTask = useCallback(
    async (projectId: string, phaseId: string, taskId: string, updates: Partial<Task>) => {
      if (!tenantId) return false;
      try {
        const project = projects.find((p) => p.id === projectId);
        if (!project) return false;

        const updatedPhases = project.phases.map((phase) => {
          if (phase.id !== phaseId) return phase;
          const updatedTasks = phase.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...updates,
                  ...(updates.status === "completed" ? { completedAt: Timestamp.now() } : {}),
                }
              : task
          );
          // Auto-update phase status based on tasks
          const allCompleted = updatedTasks.every((t) => t.status === "completed");
          const anyInProgress = updatedTasks.some(
            (t) => t.status === "in_progress" || t.status === "completed"
          );
          const phaseStatus = allCompleted ? "completed" : anyInProgress ? "in_progress" : "pending";
          return { ...phase, tasks: updatedTasks, status: phaseStatus };
        });

        // Compute progress per phase
        const phasesWithProgress = updatedPhases.map((phase) => {
          const total = phase.tasks?.length || 0;
          const completed = phase.tasks.filter((t) => t.status === "completed").length;
          return {
            ...phase,
            progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          };
        });

        const projectProgress =
          phasesWithProgress.length > 0
            ? Math.round(
                phasesWithProgress.reduce((s, p) => s + (p.progressPercentage || 0), 0) /
                  phasesWithProgress.length
              )
            : 0;

        // Count overdue tasks
        const now = new Date();
        let overdueCount = 0;
        phasesWithProgress.forEach((ph) =>
          ph.tasks?.forEach((t) => {
            if (t.status !== "completed" && t.dueDate) {
              const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
              if (due < now) overdueCount++;
            }
          })
        );
        const healthStatus: "on_track" | "at_risk" | "delayed" =
          overdueCount > 10 ? "delayed" : overdueCount > 5 ? "at_risk" : "on_track";

        const ref = doc(db, `tenants/${tenantId}/projects`, projectId);
        await updateDoc(ref, {
          phases: phasesWithProgress,
          projectProgress,
          healthStatus,
          updatedAt: serverTimestamp(),
        });

        // Log activity (fire-and-forget)
        logActivity(tenantId, projectId, {
          action: `Task "${updates.status === "completed" ? "completed" : "updated"}"`,
          entityType: "task",
          entityId: taskId,
        }).catch(() => {});

        return true;
      } catch (error) {
        console.error("Error updating task:", error);
        return false;
      }
    },
    [tenantId, projects]
  );

  const fetchActivityLog = useCallback(
    async (projectId: string): Promise<ActivityLogEntry[]> => {
      if (!tenantId) return [];
      const q = query(
        collection(db, `tenants/${tenantId}/projects/${projectId}/activityLog`),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLogEntry));
    },
    [tenantId]
  );

  return { projects, stats, loading, updateProject, updatePhase, updateTask, fetchActivityLog };
}
