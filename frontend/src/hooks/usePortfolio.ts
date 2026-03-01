"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { collection, doc, addDoc, updateDoc, deleteDoc, query, serverTimestamp } from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

export interface Project {
  id: string;
  title: string;
  description: string;
  images: string[];
  completionDate: string;
  location: string;
  category: string;
  status: "active" | "hidden";
  tenantId: string;
  createdAt?: any;
}

function mapDoc(snap: any): Project {
  const data = snap.data();
  return {
    id: snap.id,
    title: data.title ?? "",
    description: data.description ?? "",
    images: data.images ?? (data.imageUrl ? [data.imageUrl] : []),
    completionDate: data.completionDate ?? "",
    location: data.location ?? "",
    category: data.category ?? "",
    status: data.status ?? "active",
    tenantId: data.tenantId ?? "",
    createdAt: data.createdAt,
  };
}

export function usePortfolio(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["portfolio", tenantId] as const;
  const db = getDb();

  const { data: projects = [], isLoading: loading } = useFirestoreQuery<Project>({
    queryKey: qk,
    collectionRef: query(collection(db, `tenants/${tenantId}/portfolio`)),
    mapDoc,
    enabled: !!tenantId,
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: qk }), [queryClient, qk]);

  const updateProjectStatus = useCallback(async (projectId: string, status: "active" | "hidden") => {
    await updateDoc(doc(db, `tenants/${tenantId}/portfolio`, projectId), { status });
    invalidate();
  }, [db, tenantId, invalidate]);

  const addProject = useCallback(async (projectData: Omit<Project, "id" | "tenantId" | "createdAt" | "status">) => {
    if (!tenantId) throw new Error("No tenant ID");
    const ref = await addDoc(collection(db, `tenants/${tenantId}/portfolio`), {
      title: projectData.title,
      description: projectData.description,
      images: projectData.images,
      imageUrl: projectData.images?.[0] ?? null,
      completionDate: projectData.completionDate,
      location: projectData.location,
      category: projectData.category,
      status: "active",
      createdAt: serverTimestamp(),
    });
    invalidate();
    return ref.id;
  }, [tenantId, db, invalidate]);

  const deleteProject = useCallback(async (projectId: string) => {
    await deleteDoc(doc(db, `tenants/${tenantId}/portfolio`, projectId));
    invalidate();
  }, [db, tenantId, invalidate]);

  return { projects, loading, updateProjectStatus, addProject, deleteProject };
}
