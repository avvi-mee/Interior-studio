"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getDb } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { Loader2, CheckCircle } from "lucide-react";

interface TalkToSalesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TalkToSalesModal({ open, onOpenChange }: TalkToSalesModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [form, setForm] = useState({
        name: "",
        company: "",
        email: "",
        phone: "",
        message: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email) return;

        setLoading(true);
        try {
            const db = getDb();
            await addDoc(collection(db, "enterprise_requests"), {
                name: form.name,
                company: form.company,
                email: form.email,
                phone: form.phone,
                message: form.message,
                created_at: new Date().toISOString(),
            });

            setSuccess(true);
            toast({ title: "Request sent!", description: "We'll be in touch shortly." });
            setTimeout(() => {
                onOpenChange(false);
                setSuccess(false);
                setForm({ name: "", company: "", email: "", phone: "", message: "" });
            }, 2000);
        } catch (error) {
            console.error("Error submitting:", error);
            toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <div className="p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Talk to Sales</DialogTitle>
                        <DialogDescription>
                            Tell us about your studio and we'll reach out within 24 hours.
                        </DialogDescription>
                    </DialogHeader>

                    {success ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-400" />
                            </div>
                            <p className="text-lg font-semibold text-foreground">Request Sent!</p>
                            <p className="text-sm text-muted-foreground text-center">
                                Our team will get back to you within 24 hours.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name *</Label>
                                    <Input
                                        required
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Company</Label>
                                    <Input
                                        value={form.company}
                                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                                        placeholder="Studio Name"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email *</Label>
                                <Input
                                    required
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="john@studio.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Message</Label>
                                <Textarea
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    placeholder="Tell us about your requirements..."
                                    rows={3}
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={loading}
                                variant="gradient"
                                className="w-full h-11"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Request"
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
