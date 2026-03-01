"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

// =============================================================================
// Firebase/Firestore migration:
// Employees stored at tenants/{tenantId}/employees
// Employee doc ID is the user's auth UID
// =============================================================================

export interface TeamMember {
  id: string;           // employee doc id (= auth UID)
  userId: string;       // auth user id
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  area: string;
  roles: string[];      // role names
  isOwner: boolean;
  isActive: boolean;
  joinedAt: string;
  tenantId: string;
}

// Backward-compat alias
export type Employee = TeamMember;

function mapDocToTeamMember(id: string, data: any): TeamMember {
  return {
    id,
    userId: data.userId ?? id,
    fullName: data.fullName ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    avatarUrl: data.avatarUrl,
    area: data.area ?? "",
    roles: data.roles ?? [],
    isOwner: data.isOwner ?? false,
    isActive: data.isActive ?? true,
    joinedAt: data.joinedAt ?? data.createdAt ?? "",
    tenantId: data.tenantId ?? "",
  };
}

export function useTeam(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["team", tenantId] as const;
  const db = getDb();

  const employeesQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/employees`),
      orderBy("joinedAt", "desc"),
      limit(100)
    );
  }, [db, tenantId]);

  const { data: members = [], isLoading: loading } = useFirestoreQuery<TeamMember>({
    queryKey: qk,
    collectionRef: employeesQuery!,
    mapDoc: (snap) => mapDocToTeamMember(snap.id, snap.data() || {}),
    enabled: !!tenantId && !!employeesQuery,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  const addMember = useCallback(
    async (data: {
      email: string;
      fullName: string;
      phone?: string;
      area?: string;
      roles?: string[];
      password?: string;
    }) => {
      if (!tenantId) return null;
      try {
        // Create auth account via API route
        if (data.password) {
          const res = await fetch("/api/employee-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId,
              name: data.fullName,
              email: data.email,
              phone: data.phone,
              area: data.area,
              password: data.password,
              roles: data.roles,
            }),
          });
          const result = await res.json();
          if (res.ok) {
            invalidate();
            return result.tenantUserId ?? result.employeeId;
          }
          console.warn("API member creation fallback:", result.error);
        }

        // Direct insert into employees collection
        // Employee doc ID should be the user's auth UID if known
        const db = getDb();

        const docRef = await addDoc(collection(db, `tenants/${tenantId}/employees`), {
          tenantId,
          userId: null, // Will be linked when user signs up
          fullName: data.fullName,
          email: data.email,
          phone: data.phone || "",
          area: data.area || "",
          roles: data.roles || [],
          isOwner: false,
          isActive: true,
          joinedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        invalidate();
        return docRef.id;
      } catch (error) {
        console.error("Error adding team member:", error);
        return null;
      }
    },
    [tenantId, invalidate]
  );

  const updateMember = useCallback(
    async (employeeId: string, updates: Partial<TeamMember>) => {
      if (!tenantId) return false;
      try {
        const db = getDb();
        const dbUpdates: Record<string, any> = {
          updatedAt: serverTimestamp(),
        };

        if (updates.fullName !== undefined) dbUpdates.fullName = updates.fullName;
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
        if (updates.area !== undefined) dbUpdates.area = updates.area;
        if (updates.avatarUrl !== undefined) dbUpdates.avatarUrl = updates.avatarUrl;
        if (updates.roles !== undefined) dbUpdates.roles = updates.roles;
        if (updates.isActive !== undefined) {
          dbUpdates.isActive = updates.isActive;
          if (!updates.isActive) dbUpdates.deactivatedAt = serverTimestamp();
        }

        await updateDoc(
          doc(db, `tenants/${tenantId}/employees`, employeeId),
          dbUpdates
        );

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating team member:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  const removeMember = useCallback(
    async (employeeId: string) => {
      if (!tenantId) return false;
      try {
        const db = getDb();
        // Soft-deactivate instead of hard delete
        await updateDoc(
          doc(db, `tenants/${tenantId}/employees`, employeeId),
          {
            isActive: false,
            deactivatedAt: serverTimestamp(),
          }
        );
        invalidate();
        return true;
      } catch (error) {
        console.error("Error removing team member:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  const getMembersByRole = useCallback(
    (roleName: string) =>
      members.filter((m) => m.roles.includes(roleName) && m.isActive),
    [members]
  );

  // Backward compat: expose as "employees" too
  return {
    members,
    employees: members,
    loading,
    addMember,
    addEmployee: addMember,
    updateMember,
    updateEmployee: updateMember,
    removeMember,
    deleteEmployee: removeMember,
    getMembersByRole,
    getEmployeesByRole: getMembersByRole,
  };
}

// Backward-compat alias
export const useEmployees = useTeam;
