"use client";

import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import { uploadImage as uploadToStorage } from "@/lib/storageHelpers";
import {
    collection,
    doc,
    query,
    orderBy,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    type DocumentSnapshot,
} from "firebase/firestore";

export interface PageSection {
    id: string;
    type: "text" | "image" | "gallery" | "cta";
    content: string;
    imageUrl?: string;
    imageUrls?: string[];
    buttonText?: string;
    buttonLink?: string;
    order: number;
}

export interface WebsitePage {
    id: string;
    slug: string;
    title: string;
    isPublished: boolean;
    order: number;
    sections: PageSection[];
    createdAt?: any;
    updatedAt?: any;
}

function mapDocToPage(snap: DocumentSnapshot): WebsitePage {
    const d = snap.data() ?? {};
    return {
        id: snap.id,
        slug: d.slug ?? "",
        title: d.title ?? "",
        isPublished: d.isPublished ?? false,
        order: d.sortOrder ?? 0,
        sections: d.sections ?? [],
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
    };
}

export function useWebsitePages(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-pages", tenantId] as const;
    const [saving, setSaving] = useState(false);
    const db = getDb();

    const collectionRef = useMemo(
        () =>
            query(
                collection(db, `tenants/${tenantId}/customPages`),
                orderBy("sortOrder", "asc")
            ),
        [db, tenantId]
    );

    const { data: pages = [], isLoading: loading } = useFirestoreQuery<WebsitePage>({
        queryKey: qk,
        collectionRef,
        mapDoc: mapDocToPage,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    // Create a new page
    const createPage = async (title: string, slug: string): Promise<string | null> => {
        if (!tenantId) return null;

        setSaving(true);
        try {
            const docRef = await addDoc(
                collection(db, `tenants/${tenantId}/customPages`),
                {
                    tenantId,
                    title,
                    slug: slug.toLowerCase().replace(/\s+/g, "-"),
                    isPublished: false,
                    sortOrder: pages.length,
                    sections: [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }
            );

            invalidate();
            return docRef.id;
        } catch (error) {
            console.error("Error creating page:", error);
            return null;
        } finally {
            setSaving(false);
        }
    };

    // Update a page
    const updatePage = async (pageId: string, updates: Partial<WebsitePage>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const dbUpdates: Record<string, any> = {};
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
            if (updates.isPublished !== undefined) dbUpdates.isPublished = updates.isPublished;
            if (updates.order !== undefined) dbUpdates.sortOrder = updates.order;
            if (updates.sections !== undefined) dbUpdates.sections = updates.sections;
            dbUpdates.updatedAt = serverTimestamp();

            await updateDoc(
                doc(db, `tenants/${tenantId}/customPages`, pageId),
                dbUpdates
            );

            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Delete a page
    const deletePage = async (pageId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await deleteDoc(doc(db, `tenants/${tenantId}/customPages`, pageId));

            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Toggle page publish status
    const togglePublish = async (pageId: string, isPublished: boolean): Promise<boolean> => {
        return updatePage(pageId, { isPublished });
    };

    // Add section to page
    const addSection = async (
        pageId: string,
        type: PageSection["type"],
        content: string = ""
    ): Promise<boolean> => {
        const page = pages.find((p) => p.id === pageId);
        if (!page) return false;

        const newSection: PageSection = {
            id: `section_${Date.now()}`,
            type,
            content,
            order: page.sections.length,
        };

        return updatePage(pageId, {
            sections: [...page.sections, newSection],
        });
    };

    // Update section
    const updateSection = async (
        pageId: string,
        sectionId: string,
        updates: Partial<PageSection>
    ): Promise<boolean> => {
        const page = pages.find((p) => p.id === pageId);
        if (!page) return false;

        const updatedSections = page.sections.map((s) =>
            s.id === sectionId ? { ...s, ...updates } : s
        );

        return updatePage(pageId, { sections: updatedSections });
    };

    // Delete section
    const deleteSection = async (pageId: string, sectionId: string): Promise<boolean> => {
        const page = pages.find((p) => p.id === pageId);
        if (!page) return false;

        const updatedSections = page.sections.filter((s) => s.id !== sectionId);
        return updatePage(pageId, { sections: updatedSections });
    };

    // Reorder pages
    const reorderPages = async (reorderedPages: WebsitePage[]): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await Promise.all(
                reorderedPages.map((page, index) =>
                    updateDoc(
                        doc(db, `tenants/${tenantId}/customPages`, page.id),
                        { sortOrder: index }
                    )
                )
            );
            invalidate();
            return true;
        } catch (error) {
            console.error("Error reordering pages:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Upload image for section (uses Firebase Storage)
    const uploadSectionImage = async (file: File, pageId: string): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            return await uploadToStorage(file, tenantId, "pages");
        } catch (error) {
            console.error("Error uploading section image:", error);
            return null;
        }
    };

    // Get published pages only (for public website)
    const publishedPages = useMemo(() => pages.filter((p) => p.isPublished), [pages]);

    return {
        pages,
        publishedPages,
        loading,
        saving,
        createPage,
        updatePage,
        deletePage,
        togglePublish,
        addSection,
        updateSection,
        deleteSection,
        reorderPages,
        uploadSectionImage,
    };
}
