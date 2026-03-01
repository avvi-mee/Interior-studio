"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Phone, Mail, User, MessageSquare } from "lucide-react";
import { getDb } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

interface ConsultationFormProps {
    tenantId: string;
    storeId?: string; // deprecated, unused in v2
    customer?: any;
    onSuccess?: () => void;
}

export default function ConsultationForm({ tenantId, customer, onSuccess }: ConsultationFormProps) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [requirement, setRequirement] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Pre-fill form if logged in
    useEffect(() => {
        if (customer) {
            setName(customer.displayName || "");
            setPhone(customer.phoneNumber || "");
            setEmail(customer.email || "");
        }
    }, [customer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!tenantId) {
            alert("Unable to submit. Please try again.");
            return;
        }

        setIsSubmitting(true);

        try {
            const db = getDb();
            await addDoc(collection(db, `tenants/${tenantId}/consultations`), {
                tenant_id: tenantId,
                name: name,
                phone: phone,
                email: email,
                source: "website",
                requirement: requirement,
                status: "new",
                customer_uid: customer?.uid || null,
                created_at: new Date().toISOString(),
            });

            setIsSuccess(true);
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error submitting consultation:", error);
            alert("Failed to submit request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="text-center py-12 space-y-6">
                <div className="flex justify-center">
                    <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center ring-8 ring-green-50/50">
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900">Successfully Submitted!</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                        Thank you for your interest. We'll be in touch shortly to discuss your project.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold text-gray-700">Full Name</Label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            id="name"
                            placeholder="Rahul Sharma"
                            className="pl-12 h-12 rounded-xl border-gray-100 bg-gray-50 focus:bg-white transition-all ring-offset-transparent focus-visible:ring-gray-200"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">Mobile Number</Label>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                id="phone"
                                placeholder="+91 98XXX XXXXX"
                                className="pl-12 h-12 rounded-xl border-gray-100 bg-gray-50 focus:bg-white transition-all ring-offset-transparent focus-visible:ring-gray-200"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address</Label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="rahul@example.com"
                                className="pl-12 h-12 rounded-xl border-gray-100 bg-gray-50 focus:bg-white transition-all ring-offset-transparent focus-visible:ring-gray-200"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="requirement" className="text-sm font-semibold text-gray-700">Message / Notes</Label>
                    <div className="relative">
                        <MessageSquare className="absolute left-4 top-4 h-4 w-4 text-gray-400" />
                        <Textarea
                            id="requirement"
                            placeholder="Tell us about your project requirements..."
                            className="pl-12 min-h-[120px] rounded-xl border-gray-100 bg-gray-50 focus:bg-white transition-all resize-none ring-offset-transparent focus-visible:ring-gray-200"
                            value={requirement}
                            onChange={(e) => setRequirement(e.target.value)}
                            required
                        />
                    </div>
                </div>
            </div>

            <Button
                type="submit"
                className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-white transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg flex items-center justify-center"
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Submitting...
                    </>
                ) : (
                    "Send Request"
                )}
            </Button>
        </form>
    );
}
