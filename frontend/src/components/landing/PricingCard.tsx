"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Button } from "@/components/ui/button";
import { TiltCard } from "@/components/ui/tilt-card";
import { cn } from "@/lib/utils";
import { staggerItem } from "@/lib/animations";

interface PricingCardProps {
    name: string;
    price: string;
    period?: string;
    description: string;
    features: string[];
    highlighted?: boolean;
    ctaLabel: string;
    onCtaClick: () => void;
}

export function PricingCard({
    name,
    price,
    period = "/mo",
    description,
    features,
    highlighted = false,
    ctaLabel,
    onCtaClick,
}: PricingCardProps) {
    const content = (
        <>
            {highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-brand-indigo to-brand-violet text-white text-[10px] font-bold uppercase tracking-wider z-10">
                    Most Popular
                </div>
            )}

            <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground mb-1">{name}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            <div className="mb-6">
                <span className="text-4xl font-black text-foreground">{price}</span>
                {period && <span className="text-sm text-muted-foreground ml-1">{period}</span>}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
                {features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-brand-indigo shrink-0 mt-0.5" />
                        {f}
                    </li>
                ))}
            </ul>

            {highlighted ? (
                <MagneticButton
                    onClick={onCtaClick}
                    variant="gradient"
                    className="w-full h-11"
                >
                    {ctaLabel}
                </MagneticButton>
            ) : (
                <Button
                    onClick={onCtaClick}
                    variant="outline"
                    className="w-full h-11"
                >
                    {ctaLabel}
                </Button>
            )}
        </>
    );

    if (highlighted) {
        return (
            <motion.div variants={staggerItem}>
                <TiltCard
                    className={cn(
                        "relative flex flex-col h-full",
                        "border-brand-indigo/30 bg-brand-indigo/[0.04] shadow-lg shadow-brand-indigo/5"
                    )}
                    glowColor="indigo"
                >
                    {content}
                </TiltCard>
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={staggerItem}
            className="relative rounded-xl p-6 border border-white/[0.06] bg-white/[0.02] flex flex-col h-full"
        >
            {content}
        </motion.div>
    );
}
