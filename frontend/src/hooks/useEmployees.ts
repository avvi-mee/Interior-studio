"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  serverTimestamp,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

export interface Employee {
  id: string;
  name: string;
  email: string;
  password?: string;
  area: string;
  phone: string;
  totalWork: number;
  currentWork: string;
  upcomingWork?: string;
  role: "owner" | "sales" | "designer" | "project_manager" | "site_supervisor";
  assignedLeads?: string[];
  assignedProjects?: string[];
  isActive: boolean;
  tenantId: string;
  createdAt?: any;
}

export function useEmployees(tenantId: string | null) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "tenants", tenantId, "employees"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const empList = snapshot.docs.map((d) => ({
          id: d.id,
          role: "designer",
          isActive: true,
          ...d.data(),
        })) as Employee[];
        setEmployees(empList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching employees:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  const addEmployee = useCallback(
    async (data: Omit<Employee, "id" | "tenantId" | "createdAt">) => {
      if (!tenantId) return null;
      try {
        const ref = await addDoc(collection(db, "tenants", tenantId, "employees"), {
          ...data,
          tenantId,
          createdAt: serverTimestamp(),
        });
        return ref.id;
      } catch (error) {
        console.error("Error adding employee:", error);
        return null;
      }
    },
    [tenantId]
  );

  const updateEmployee = useCallback(
    async (employeeId: string, updates: Partial<Employee>) => {
      if (!tenantId) return false;
      try {
        const ref = doc(db, "tenants", tenantId, "employees", employeeId);
        await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
        return true;
      } catch (error) {
        console.error("Error updating employee:", error);
        return false;
      }
    },
    [tenantId]
  );

  const deleteEmployee = useCallback(
    async (employeeId: string) => {
      if (!tenantId) return false;
      try {
        await deleteDoc(doc(db, "tenants", tenantId, "employees", employeeId));
        return true;
      } catch (error) {
        console.error("Error deleting employee:", error);
        return false;
      }
    },
    [tenantId]
  );

  const getEmployeesByRole = useCallback(
    (role: Employee["role"]) => employees.filter((e) => e.role === role && e.isActive),
    [employees]
  );

  return { employees, loading, addEmployee, updateEmployee, deleteEmployee, getEmployeesByRole };
}
