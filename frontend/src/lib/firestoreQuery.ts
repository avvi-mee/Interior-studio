"use client";

import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  type Query,
  type DocumentReference,
  type QuerySnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { getQueryClient } from "./queryClient";

/**
 * React Query wrapper with Firestore realtime listener.
 * `onSnapshot` pushes data into the React Query cache automatically.
 *
 * Usage:
 *   useFirestoreQuery({
 *     queryKey: ["leads", tenantId],
 *     collectionRef: query(collection(db, `tenants/${tid}/leads`), orderBy("createdAt", "desc")),
 *     mapDoc: (doc) => ({ id: doc.id, ...doc.data() }),
 *     enabled: !!tenantId,
 *   })
 */
export function useFirestoreQuery<T>({
  queryKey,
  collectionRef,
  mapDoc,
  enabled = true,
  staleTime,
}: {
  queryKey: readonly unknown[];
  collectionRef: Query;
  mapDoc: (snap: DocumentSnapshot) => T;
  enabled?: boolean;
  staleTime?: number;
}) {
  const queryClient = useQueryClient();

  // Set up realtime listener
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = onSnapshot(
      collectionRef,
      (snapshot: QuerySnapshot) => {
        const data = snapshot.docs.map((d) => mapDoc(d));
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error("Firestore listener error:", error);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...queryKey]);

  return useQuery<T[]>({
    queryKey,
    queryFn: async () => {
      const snapshot = await getDocs(collectionRef);
      return snapshot.docs.map((d) => mapDoc(d));
    },
    enabled,
    staleTime: staleTime ?? Infinity, // Data comes from listener
  });
}

/**
 * React Query wrapper for a single Firestore document with realtime listener.
 *
 * Usage:
 *   useFirestoreDoc({
 *     queryKey: ["pricing", tenantId],
 *     docRef: doc(db, `tenants/${tid}/pricing/config`),
 *     mapDoc: (snap) => snap.data(),
 *     enabled: !!tenantId,
 *   })
 */
export function useFirestoreDoc<T>({
  queryKey,
  docRef,
  mapDoc,
  enabled = true,
  staleTime,
}: {
  queryKey: readonly unknown[];
  docRef: DocumentReference;
  mapDoc: (snap: DocumentSnapshot) => T | null;
  enabled?: boolean;
  staleTime?: number;
}) {
  const queryClient = useQueryClient();

  // Set up realtime listener
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot) => {
        const data = mapDoc(snapshot);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error("Firestore doc listener error:", error);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...queryKey]);

  return useQuery<T | null>({
    queryKey,
    queryFn: async () => {
      const snapshot = await getDoc(docRef);
      return mapDoc(snapshot);
    },
    enabled,
    staleTime: staleTime ?? Infinity,
  });
}

/**
 * Create a mutation that auto-invalidates related queries on success.
 */
export function useFirestoreMutation<TArgs, TResult = void>({
  mutationFn,
  invalidateKeys,
}: {
  mutationFn: (args: TArgs) => Promise<TResult>;
  invalidateKeys: readonly unknown[][];
}) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TArgs>({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
