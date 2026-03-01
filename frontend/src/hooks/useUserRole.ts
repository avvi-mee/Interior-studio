"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFirebaseAuth, getDb } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export interface UserRoleData {
  uid: string;
  email: string;
  role: "admin" | "customer" | "superadmin";
  tenantId: string;
  name?: string;
  phone?: string;
}

export function useUserRole() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
    });
    return () => unsubscribe();
  }, []);

  const { data: roleData = null, isLoading } = useQuery<UserRoleData | null>({
    queryKey: ["user-role", user?.uid],
    queryFn: async () => {
      const db = getDb();
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      if (!userDoc.exists()) return null;
      const data = userDoc.data();
      return {
        uid: userDoc.id,
        email: data.email,
        role: data.role,
        tenantId: data.tenantId || data.tenant_id,
        name: data.name,
        phone: data.phone,
      };
    },
    enabled: !!user?.uid,
  });

  return { user, roleData, loading: !user ? true : isLoading };
}
