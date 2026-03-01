"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getFirebaseAuth, getDb } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { ensureTenantSlug } from "@/lib/firestoreHelpers";

// ---------- Types ----------

export interface Tenant {
  id: string;
  ownerId?: string;
  name: string;
  email: string;
  phone?: string;
  slug: string;
  status: "pending" | "active" | "inactive" | "rejected";
  createdAt: string;
  approvedAt?: string;
  subscription: "free" | "basic" | "pro" | "enterprise";
  settings?: Record<string, any>;
}

export interface Customer {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  city?: string;
  createdAt: any;
  lastLogin: any;
}

export type AuthRole = "superadmin" | "admin" | "customer" | "anonymous";

interface AuthState {
  user: User | null;
  role: AuthRole;
  tenant: Tenant | null;
  customer: Customer | null;
  loading: boolean;
  error: string;
}

// ---------- Tenant cache (module-level singleton) ----------

const tenantCache: Record<string, { data: Tenant; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

function getCachedTenant(email: string): Tenant | null {
  const entry = tenantCache[email];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCachedTenant(email: string, data: Tenant) {
  tenantCache[email] = { data, ts: Date.now() };
}

function clearCachedTenant(email: string) {
  delete tenantCache[email];
}

// ---------- DB helpers ----------

function docToTenant(id: string, data: any): Tenant {
  return {
    id,
    ownerId: data.ownerId || data.owner_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    slug: data.slug,
    status: data.status,
    createdAt: data.createdAt || data.created_at || "",
    approvedAt: data.approvedAt || data.approved_at,
    subscription: data.subscription || "free",
    settings: data.settings,
  };
}

function docToCustomer(uid: string, data: any): Customer {
  return {
    uid,
    email: data.email,
    displayName: data.displayName || data.display_name || "",
    photoURL: data.photoURL || data.photo_url,
    phoneNumber: data.phoneNumber || data.phone_number,
    city: data.city,
    createdAt: data.createdAt || data.created_at,
    lastLogin: data.lastLogin || data.last_login,
  };
}

// ---------- Unified hook ----------

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: "anonymous",
    tenant: null,
    customer: null,
    loading: true,
    error: "",
  });
  const resolvingRef = useRef(false);

  // Resolve user role + data from a Firebase User
  const resolveUser = useCallback(async (authUser: User) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    const db = getDb();

    try {
      // Step 1: Check users doc for role
      const userDoc = await getDoc(doc(db, "users", authUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const dbRole = userData?.role as string | undefined;

      // --- Superadmin ---
      if (dbRole === "superadmin") {
        setState({
          user: authUser,
          role: "superadmin",
          tenant: null,
          customer: null,
          loading: false,
          error: "",
        });
        return;
      }

      // --- Admin / Tenant owner ---
      if (dbRole === "admin" || !dbRole) {
        const email = authUser.email || "";
        const cached = getCachedTenant(email);

        if (cached) {
          setState({
            user: authUser,
            role: "admin",
            tenant: cached,
            customer: null,
            loading: false,
            error: "",
          });
          return;
        }

        // Look up tenant by email first (owner flow)
        const tenantByEmailSnap = await getDocs(
          query(collection(db, "tenants"), where("email", "==", email), limit(1))
        );

        if (!tenantByEmailSnap.empty) {
          const tDoc = tenantByEmailSnap.docs[0];
          const tenant = docToTenant(tDoc.id, tDoc.data());
          setCachedTenant(email, tenant);
          setState({
            user: authUser,
            role: "admin",
            tenant,
            customer: null,
            loading: false,
            error: "",
          });
          // Backfill slug if missing (fire-and-forget, don't block auth)
          if (!tenant.slug) {
            ensureTenantSlug(tenant.id, tenant.name).then((slug) => {
              tenant.slug = slug;
              setCachedTenant(email, { ...tenant, slug });
              setState((prev) => prev.tenant?.id === tenant.id
                ? { ...prev, tenant: { ...prev.tenant!, slug } }
                : prev
              );
            }).catch((err) => console.warn("Slug backfill failed:", err));
          }
          return;
        }

        // Fallback: look up tenant by tenant_id from users doc
        if (userData?.tenantId || userData?.tenant_id) {
          const tid = userData.tenantId || userData.tenant_id;
          const tenantDoc = await getDoc(doc(db, "tenants", tid));
          if (tenantDoc.exists()) {
            const tenant = docToTenant(tenantDoc.id, tenantDoc.data());
            setCachedTenant(email, tenant);
            setState({
              user: authUser,
              role: "admin",
              tenant,
              customer: null,
              loading: false,
              error: "",
            });
            // Backfill slug if missing (fire-and-forget)
            if (!tenant.slug) {
              ensureTenantSlug(tenant.id, tenant.name).then((slug) => {
                tenant.slug = slug;
                setCachedTenant(email, { ...tenant, slug });
                setState((prev) => prev.tenant?.id === tenant.id
                  ? { ...prev, tenant: { ...prev.tenant!, slug } }
                  : prev
                );
              }).catch((err) => console.warn("Slug backfill failed:", err));
            }
            return;
          }
        }
      }

      // --- Customer ---
      if (dbRole === "customer" || !dbRole) {
        const customerDoc = await getDoc(doc(db, "customers", authUser.uid));

        if (customerDoc.exists()) {
          setState({
            user: authUser,
            role: "customer",
            tenant: null,
            customer: docToCustomer(authUser.uid, customerDoc.data()),
            loading: false,
            error: "",
          });
          return;
        }
      }

      // Authenticated but no matching profile
      setState({
        user: authUser,
        role: "anonymous",
        tenant: null,
        customer: null,
        loading: false,
        error: "",
      });
    } catch (err) {
      console.error("Error resolving auth:", err);
      setState((prev) => ({ ...prev, loading: false }));
    } finally {
      resolvingRef.current = false;
    }
  }, []);

  // Single auth listener
  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        resolveUser(user);
      } else {
        setState({
          user: null,
          role: "anonymous",
          tenant: null,
          customer: null,
          loading: false,
          error: "",
        });
      }
    });

    return () => unsubscribe();
  }, [resolveUser]);

  // ---------- Actions ----------

  /** Login for tenant admins / owners */
  const loginTenant = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, error: "", loading: true }));
    const auth = getFirebaseAuth();
    const db = getDb();

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Resolve tenant
      let tenantData: Tenant | null = null;
      let tenantRole: "owner" | "admin" = "owner";

      // Try owner flow
      const tenantByEmailSnap = await getDocs(
        query(collection(db, "tenants"), where("email", "==", email), limit(1))
      );

      if (!tenantByEmailSnap.empty) {
        const tDoc = tenantByEmailSnap.docs[0];
        tenantData = docToTenant(tDoc.id, tDoc.data());
      } else {
        // Try admin flow via users doc
        const userDoc = await getDoc(doc(db, "users", uid));
        const userData = userDoc.exists() ? userDoc.data() : null;
        const tid = userData?.tenantId || userData?.tenant_id;

        if (tid && userData?.role === "admin") {
          const tenantDoc = await getDoc(doc(db, "tenants", tid));
          if (tenantDoc.exists()) {
            tenantData = docToTenant(tenantDoc.id, tenantDoc.data());
            tenantRole = "admin";
          }
        }
      }

      if (!tenantData) {
        setState((prev) => ({
          ...prev,
          error: "No designer account found with this email",
          loading: false,
        }));
        await firebaseSignOut(auth);
        return false;
      }

      if (tenantData.status !== "active") {
        const messages: Record<string, string> = {
          pending: "Your account is pending approval from the super admin",
          rejected: "Your account has been rejected",
          inactive: "Your account has been deactivated",
        };
        setState((prev) => ({
          ...prev,
          error: messages[tenantData!.status] || "Your account is not active",
          loading: false,
        }));
        await firebaseSignOut(auth);
        return false;
      }

      setCachedTenant(email, tenantData);

      // Sync users doc
      await setDoc(
        doc(db, "users", uid),
        {
          email,
          role: "admin",
          tenantRole,
          tenantId: tenantData.id,
          lastLogin: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => console.error("Failed to sync admin user:", err));

      setState({
        user: cred.user,
        role: "admin",
        tenant: tenantData,
        customer: null,
        loading: false,
        error: "",
      });

      // Backfill slug if missing (fire-and-forget)
      if (!tenantData.slug) {
        ensureTenantSlug(tenantData.id, tenantData.name).then((slug) => {
          setCachedTenant(email, { ...tenantData!, slug });
          setState((prev) => prev.tenant?.id === tenantData!.id
            ? { ...prev, tenant: { ...prev.tenant!, slug } }
            : prev
          );
        }).catch((err) => console.warn("Slug backfill failed:", err));
      }

      return true;
    } catch (err: any) {
      console.error("Login error:", err);
      setState((prev) => ({ ...prev, error: "Invalid email or password", loading: false }));
      return false;
    }
  }, []);

  /** Login for superadmin */
  const loginAdmin = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, error: "", loading: true }));
    const auth = getFirebaseAuth();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state change listener will handle role resolution
      return true;
    } catch (err: any) {
      console.error("Login failed:", err);
      setState((prev) => ({ ...prev, error: "Invalid email or password", loading: false }));
      return false;
    }
  }, []);

  /** Login for customers (email/password) */
  const loginCustomer = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const db = getDb();
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Update last_login (best effort)
    await Promise.allSettled([
      setDoc(doc(db, "customers", cred.user.uid), { lastLogin: serverTimestamp() }, { merge: true }),
      setDoc(doc(db, "users", cred.user.uid), { lastLogin: serverTimestamp() }, { merge: true }),
    ]);

    return { user: cred.user, session: null };
  }, []);

  /** Sign up customer */
  const signupCustomer = useCallback(
    async (email: string, password: string, displayName: string, mobile: string, tenantId: string) => {
      const auth = getFirebaseAuth();
      const db = getDb();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      await setDoc(doc(db, "users", uid), {
        email,
        name: displayName,
        phone: mobile,
        role: "customer",
        tenantId,
        lastLogin: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, "customers", uid), {
        email,
        displayName,
        phoneNumber: mobile,
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        customer: { uid, email, displayName, phoneNumber: mobile, createdAt: now, lastLogin: now },
        role: "customer",
      }));

      return { user: cred.user, session: null };
    },
    []
  );

  /** Google OAuth login for customers */
  const loginWithGoogle = useCallback(async (_tenantId?: string) => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return { user: result.user, url: null };
  }, []);

  /** Password reset */
  const resetPassword = useCallback(async (email: string) => {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
  }, []);

  /** Unified logout */
  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (state.user?.email) {
      clearCachedTenant(state.user.email);
    }
    await firebaseSignOut(auth);
    setState({
      user: null,
      role: "anonymous",
      tenant: null,
      customer: null,
      loading: false,
      error: "",
    });
  }, [state.user?.email]);

  return {
    // State
    user: state.user,
    role: state.role,
    tenant: state.tenant,
    customer: state.customer,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user && state.role !== "anonymous",

    // Actions
    loginTenant,
    loginAdmin,
    loginCustomer,
    signupCustomer,
    loginWithGoogle,
    resetPassword,
    logout,
  };
}
