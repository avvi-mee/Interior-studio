"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";

export interface City {
  id: string;
  name: string;
  enabled: boolean;
  tier?: "Tier 1" | "Tier 2" | "Tier 3";
  createdAt?: any;
}

function mapDoc(d: any): City {
  const data = d.data ? d.data() : d;
  return {
    id: d.id || data.id,
    name: data.name,
    enabled: data.isEnabled ?? data.enabled ?? true,
    tier: data.tier ?? undefined,
    createdAt: data.createdAt,
  };
}

export function useCities(tenantId: string | null) {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const qk = ["cities", tenantId] as const;
  const db = getDb();

  const { data: cities = [], isLoading: loading } = useFirestoreQuery<City>({
    queryKey: qk,
    collectionRef: query(
      collection(db, `tenants/${tenantId}/cities`),
      orderBy("name", "asc")
    ),
    mapDoc: (snap) => mapDoc(snap),
    enabled: !!tenantId,
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: qk }), [queryClient, qk]);

  const addCity = useCallback(async (name: string): Promise<boolean> => {
    if (!tenantId) return false;
    setSaving(true);
    try {
      await addDoc(collection(db, `tenants/${tenantId}/cities`), {
        name,
        isEnabled: true,
        createdAt: serverTimestamp(),
      });
      invalidate();
      return true;
    } catch (error) {
      console.error("Error adding city:", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, db, invalidate]);

  const updateCity = useCallback(async (id: string, updates: Partial<City>): Promise<boolean> => {
    if (!tenantId) return false;
    setSaving(true);
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.enabled !== undefined) dbUpdates.isEnabled = updates.enabled;
      if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
      await updateDoc(doc(db, `tenants/${tenantId}/cities`, id), dbUpdates);
      invalidate();
      return true;
    } catch (error) {
      console.error("Error updating city:", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, db, invalidate]);

  const deleteCity = useCallback(async (id: string): Promise<boolean> => {
    if (!tenantId) return false;
    setSaving(true);
    try {
      await deleteDoc(doc(db, `tenants/${tenantId}/cities`, id));
      invalidate();
      return true;
    } catch (error) {
      console.error("Error deleting city:", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, db, invalidate]);

  const toggleCity = useCallback(async (id: string, currentStatus: boolean): Promise<boolean> => {
    return updateCity(id, { enabled: !currentStatus });
  }, [updateCity]);

  return { cities, loading, saving, addCity, updateCity, deleteCity, toggleCity };
}
