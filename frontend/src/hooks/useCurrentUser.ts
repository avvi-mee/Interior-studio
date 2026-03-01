"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFirebaseAuth, getDb } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { can as canCheck, PermissionAction } from "@/lib/permissions";

export type UserType = "owner" | "employee" | "superadmin" | null;

export interface CurrentUser {
  userType: UserType;
  tenantId: string | null;
  roles: string[];
  employeeId: string | null;
  firebaseUser: User | null;
  loading: boolean;
  can: (action: PermissionAction) => boolean;
}

interface ResolvedUser {
  userType: UserType;
  tenantId: string | null;
  roles: string[];
  employeeId: string | null;
}

async function resolveUserFromDb(user: User): Promise<ResolvedUser> {
  const db = getDb();

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const userData = userDoc.exists() ? userDoc.data() : null;

  if (userData?.role === "superadmin") {
    return { userType: "superadmin", tenantId: null, roles: ["owner"], employeeId: null };
  }

  if (userData?.role === "admin") {
    const tid = userData.tenantId || userData.tenant_id || null;
    return { userType: "owner", tenantId: tid, roles: ["owner"], employeeId: null };
  }

  // Check employees — search all tenants for this user as employee
  // First check if user doc has tenantId
  const tid = userData?.tenantId || userData?.tenant_id;
  if (tid) {
    const empDoc = await getDoc(doc(db, "tenants", tid, "employees", user.uid));
    if (empDoc.exists()) {
      const empData = empDoc.data();
      if (empData.isActive !== false) {
        const empRoles =
          empData.roles && empData.roles.length > 0
            ? empData.roles
            : [empData.role || "designer"];
        return {
          userType: "employee",
          tenantId: tid,
          roles: Array.isArray(empRoles) ? empRoles : [empRoles],
          employeeId: empDoc.id,
        };
      }
    }
  }

  return { userType: null, tenantId: userData?.tenantId || userData?.tenant_id || null, roles: [], employeeId: null };
}

export function useCurrentUser(): CurrentUser {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u ?? null);
      if (!u && typeof window !== "undefined") {
        sessionStorage.removeItem("employeeSession");
      }
    });
    return () => unsubscribe();
  }, []);

  const { data: resolved, isLoading } = useQuery<ResolvedUser>({
    queryKey: ["current-user", firebaseUser?.uid],
    queryFn: () => resolveUserFromDb(firebaseUser!),
    enabled: !!firebaseUser?.uid,
  });

  const userType = resolved?.userType ?? null;
  const roles = resolved?.roles ?? [];
  const tenantId = resolved?.tenantId ?? null;
  const employeeId = resolved?.employeeId ?? null;

  const can = useCallback(
    (action: PermissionAction) => {
      if (userType === "superadmin") return true;
      return canCheck(roles, action);
    },
    [roles, userType]
  );

  return {
    userType,
    tenantId,
    roles,
    employeeId,
    firebaseUser,
    loading: firebaseUser === undefined ? true : isLoading,
    can,
  };
}
