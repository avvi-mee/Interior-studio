"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Monitor, Tablet, Smartphone, RefreshCw, Globe } from "lucide-react";
import { getTenantUrl } from "@/lib/tenantUrl";

interface PreviewPanelProps {
    storeId: string;
    open: boolean;
    onClose: () => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<DeviceMode, string> = {
    mobile: "375px",
    tablet: "768px",
    desktop: "100%",
};

export default function PreviewPanel({ storeId, open, onClose }: PreviewPanelProps) {
    const [device, setDevice] = useState<DeviceMode>("desktop");
    const [refreshKey, setRefreshKey] = useState(0);

    if (!open) return null;

    const previewUrl = `/${storeId}`;

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
                className="flex-1 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="w-full max-w-[55%] md:max-w-[55%] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-semibold text-sm shrink-0">Preview</h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-gray-100 rounded-full px-3 py-1 truncate">
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="truncate font-mono">{getTenantUrl(storeId)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant={device === "mobile" ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDevice("mobile")}
                            title="Mobile (375px)"
                        >
                            <Smartphone className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={device === "tablet" ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDevice("tablet")}
                            title="Tablet (768px)"
                        >
                            <Tablet className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={device === "desktop" ? "default" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDevice("desktop")}
                            title="Desktop (100%)"
                        >
                            <Monitor className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-5 bg-gray-300 mx-1" />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setRefreshKey((k) => k + 1)}
                            title="Refresh"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={onClose}
                            title="Close preview"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Iframe Container */}
                <div className="flex-1 overflow-hidden bg-gray-100 flex items-start justify-center p-4">
                    <iframe
                        key={refreshKey}
                        src={previewUrl}
                        className="bg-white shadow-lg rounded-lg border"
                        style={{
                            width: deviceWidths[device],
                            height: "100%",
                            maxWidth: "100%",
                        }}
                        title="Website Preview"
                    />
                </div>
            </div>
        </div>
    );
}
