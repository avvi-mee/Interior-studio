"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { useHomePage, DEFAULT_SECTION_LAYOUT } from "@/hooks/useWebsiteBuilder";
import { useToast } from "@/hooks/use-toast";
import type { HomeSectionConfig } from "@/types/website";

interface HomeSectionManagerProps {
    tenantId: string;
}

export default function HomeSectionManager({ tenantId }: HomeSectionManagerProps) {
    const { getSectionLayout, saveSectionLayout, saving } = useHomePage(tenantId);
    const { toast } = useToast();

    const layout = getSectionLayout();

    const handleToggle = async (sectionId: string, enabled: boolean) => {
        const updated = layout.map((s) =>
            s.id === sectionId ? { ...s, enabled } : s
        );
        const success = await saveSectionLayout(updated);
        if (success) {
            toast({ title: "Updated", description: `Section ${enabled ? "enabled" : "disabled"}.` });
        }
    };

    const handleMoveUp = async (index: number) => {
        if (index <= 0) return;
        const updated = [...layout];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        await saveSectionLayout(updated);
    };

    const handleMoveDown = async (index: number) => {
        if (index >= layout.length - 1) return;
        const updated = [...layout];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        await saveSectionLayout(updated);
    };

    const handleReset = async () => {
        const success = await saveSectionLayout(DEFAULT_SECTION_LAYOUT);
        if (success) {
            toast({ title: "Reset", description: "Section layout reset to defaults." });
        }
    };

    return (
        <Card className="rounded-xl shadow-sm border-gray-200">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">Homepage Sections</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                            Toggle sections on/off and reorder them
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={saving}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset to Default
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-1">
                    {layout.map((section, index) => (
                        <div
                            key={section.id}
                            className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col gap-0.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0 hover:bg-gray-200"
                                        onClick={() => handleMoveUp(index)}
                                        disabled={index === 0 || saving}
                                    >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 p-0 hover:bg-gray-200"
                                        onClick={() => handleMoveDown(index)}
                                        disabled={index === layout.length - 1 || saving}
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                <span className="font-medium text-sm">
                                    {section.label}
                                </span>
                            </div>
                            <Switch
                                checked={section.enabled}
                                onCheckedChange={(checked) => handleToggle(section.id, checked)}
                                disabled={section.id === "hero" || saving}
                            />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
