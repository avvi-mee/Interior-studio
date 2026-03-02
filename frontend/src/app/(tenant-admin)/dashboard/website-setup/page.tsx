"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { Loader2, ExternalLink, Copy, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getTenantUrl } from "@/lib/tenantUrl";

// Import tab components
import BrandTab from "@/components/dashboard/website-builder/BrandTab";
import ThemeTab from "@/components/dashboard/website-builder/ThemeTab";
import PagesTab from "@/components/dashboard/website-builder/PagesTab";
import MediaTab from "@/components/dashboard/website-builder/MediaTab";
import PricingTab from "@/components/dashboard/website-builder/PricingTab";
import PreviewPanel from "@/components/dashboard/website-builder/PreviewPanel";

export default function WebsiteSetupPage() {
    const { tenant } = useTenantAuth();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    // Always use tenant ID as the URL identifier (no slug)
    const urlIdentifier = tenant?.id || "";
    const publicUrl = urlIdentifier ? getTenantUrl(urlIdentifier) : "";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        toast({ title: "Copied!", description: "Public URL copied to clipboard." });
        setTimeout(() => setCopied(false), 2000);
    };

    if (!tenant) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Website Builder</h2>
                <p className="text-muted-foreground">
                    Build and customize your interior designer website
                </p>
            </div>

            {/* Public URL Card */}
            <Card className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] text-white border-none shadow-xl">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <ExternalLink className="h-4 w-4 text-yellow-400" />
                                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                                    Your Website URL
                                </span>
                            </div>
                            <a
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lg font-mono text-blue-300 hover:text-blue-100 underline underline-offset-4 transition-colors"
                            >
                                {publicUrl}
                            </a>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={copyToClipboard}
                                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                            >
                                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                                {copied ? "Copied" : "Copy"}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setPreviewOpen(true)}
                                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => window.open(publicUrl, "_blank")}
                                className="bg-white text-black hover:bg-gray-100"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open Website
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Tabs */}
            <Tabs defaultValue="brand" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5 h-12 bg-gray-100 rounded-xl p-1">
                    <TabsTrigger value="brand" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Brand</TabsTrigger>
                    <TabsTrigger value="pages" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Pages</TabsTrigger>
                    <TabsTrigger value="theme" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Theme</TabsTrigger>
                    <TabsTrigger value="media" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Media</TabsTrigger>
                    <TabsTrigger value="pricing" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Pricing</TabsTrigger>
                </TabsList>

                <TabsContent value="brand" className="space-y-6"><BrandTab tenantId={tenant.id} /></TabsContent>
                <TabsContent value="pages" className="space-y-6"><PagesTab tenantId={tenant.id} /></TabsContent>
                <TabsContent value="theme" className="space-y-6"><ThemeTab tenantId={tenant.id} /></TabsContent>
                <TabsContent value="media" className="space-y-6"><MediaTab tenantId={tenant.id} /></TabsContent>
                <TabsContent value="pricing" className="space-y-6"><PricingTab tenantId={tenant.id} /></TabsContent>
            </Tabs>

            {/* Preview Panel */}
            <PreviewPanel storeId={urlIdentifier} open={previewOpen} onClose={() => setPreviewOpen(false)} />
        </div>
    );
}
