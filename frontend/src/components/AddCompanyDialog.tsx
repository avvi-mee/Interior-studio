"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getFirebaseAuth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { addDesigner, generateSlug } from "@/lib/firestoreHelpers";
import { validateTenantSlug } from "@/lib/reservedSlugs";

interface AddCompanyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddCompanyDialog({ open, onOpenChange }: AddCompanyDialogProps) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "", // Added
        phone: "",
        businessName: "",
        slug: "",
        plan: "free" as "free" | "basic" | "pro" | "enterprise",
        status: "active" as "active" | "pending", // Added
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [slugError, setSlugError] = useState("");

    const handleBusinessNameChange = (businessName: string) => {
        const newSlug = generateSlug(businessName);
        setFormData({
            ...formData,
            businessName,
            slug: newSlug,
        });
        if (newSlug) {
            const validation = validateTenantSlug(newSlug);
            setSlugError(validation.valid ? "" : validation.reason || "");
        } else {
            setSlugError("");
        }
    };

    const handleSlugChange = (slug: string) => {
        setFormData({ ...formData, slug });
        if (slug) {
            const validation = validateTenantSlug(slug);
            setSlugError(validation.valid ? "" : validation.reason || "");
        } else {
            setSlugError("");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            // Validation
            if (!formData.name || !formData.email || !formData.businessName || !formData.slug) {
                setError("Please fill in all required fields");
                setLoading(false);
                return;
            }

            // Validate slug
            const slugValidation = validateTenantSlug(formData.slug);
            if (!slugValidation.valid) {
                setError(slugValidation.reason || "Invalid slug");
                setLoading(false);
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                setError("Please enter a valid email address");
                setLoading(false);
                return;
            }

            let uid = "";

            // Create Auth User via Firebase Auth if password provided
            if (formData.password) {
                if (formData.password.length < 6) {
                    setError("Password must be at least 6 characters");
                    setLoading(false);
                    return;
                }

                try {
                    const auth = getFirebaseAuth();
                    const userCredential = await createUserWithEmailAndPassword(
                        auth,
                        formData.email,
                        formData.password
                    );
                    uid = userCredential.user.uid;
                } catch (authErr: any) {
                    if (authErr.code === "auth/email-already-in-use") {
                        setError("This email is already registered. You can still add the company record.");
                        // Continue because maybe they just want to link the tenant record
                    } else {
                        throw authErr;
                    }
                }
            }

            await addDesigner({
                name: formData.businessName,
                email: formData.email,
                phone: formData.phone,
                slug: formData.slug,
                plan: formData.plan,
                uid: uid,
                status: formData.status
            });

            // Reset form
            setFormData({
                name: "",
                email: "",
                password: "",
                phone: "",
                businessName: "",
                slug: "",
                plan: "free",
                status: "active",
            });

            onOpenChange(false);
        } catch (err: any) {
            console.error("Error adding company:", err);
            setError(err.message || "Failed to add company. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Company</DialogTitle>
                    <DialogDescription>
                        Register a new company and create their admin login account.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Admin Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="John Doe"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Admin Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@company.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Login Password (Optional)</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Create a password for the designer"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                If provided, a login account will be created automatically.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="businessName">Company Name *</Label>
                            <Input
                                id="businessName"
                                placeholder="ABC Interiors Pvt Ltd"
                                value={formData.businessName}
                                onChange={(e) => handleBusinessNameChange(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="slug">URL Slug *</Label>
                                <Input
                                    id="slug"
                                    placeholder="abc-interiors"
                                    value={formData.slug}
                                    onChange={(e) => handleSlugChange(e.target.value)}
                                    required
                                    className={slugError ? "border-destructive" : ""}
                                />
                                {slugError && (
                                    <p className="text-[10px] text-destructive">{slugError}</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+91 98765 43210"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="plan">Plan</Label>
                                <select
                                    id="plan"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.plan}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            plan: e.target.value as any,
                                        })
                                    }
                                >
                                    <option value="free">Free</option>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="status">Initial Status</Label>
                                <select
                                    id="status"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.status}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            status: e.target.value as any,
                                        })
                                    }
                                >
                                    <option value="active">Active (Instant Access)</option>
                                    <option value="pending">Pending Approval</option>
                                </select>
                            </div>
                        </div>

                        {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                            {loading ? "Processing..." : "Create & Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
