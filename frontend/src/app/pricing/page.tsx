"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PricingCard } from "@/components/landing/PricingCard";
import { TalkToSalesModal } from "@/components/landing/TalkToSalesModal";
import { MotionSection } from "@/components/ui/motion-section";
import { staggerContainer, fadeInUp } from "@/lib/animations";
import { Check, Minus } from "lucide-react";

const TIERS = [
    {
        name: "Starter",
        price: "$29",
        description: "For solo designers getting started.",
        features: [
            "1 branded storefront",
            "Smart estimate calculator",
            "Up to 50 estimates/month",
            "Basic CRM & pipeline",
            "Email support",
        ],
        highlighted: false,
        cta: "Talk to Sales",
    },
    {
        name: "Growth",
        price: "$79",
        description: "For growing studios with a team.",
        features: [
            "Everything in Starter",
            "Unlimited estimates",
            "Team management (up to 10)",
            "Project & task management",
            "Finance tracking & invoicing",
            "Analytics dashboard",
            "Priority support",
        ],
        highlighted: true,
        cta: "Talk to Sales",
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "For large firms and franchises.",
        features: [
            "Everything in Growth",
            "Unlimited team members",
            "Multi-location support",
            "Custom integrations",
            "Dedicated account manager",
            "SLA & uptime guarantees",
            "White-label option",
        ],
        highlighted: false,
        cta: "Talk to Sales",
    },
];

const COMPARISON = [
    { feature: "Branded Storefront", starter: true, growth: true, enterprise: true },
    { feature: "Smart Estimates", starter: true, growth: true, enterprise: true },
    { feature: "CRM & Pipeline", starter: true, growth: true, enterprise: true },
    { feature: "Estimates/month", starter: "50", growth: "Unlimited", enterprise: "Unlimited" },
    { feature: "Team Members", starter: "1", growth: "10", enterprise: "Unlimited" },
    { feature: "Project Management", starter: false, growth: true, enterprise: true },
    { feature: "Finance & Invoicing", starter: false, growth: true, enterprise: true },
    { feature: "Analytics", starter: false, growth: true, enterprise: true },
    { feature: "Custom Integrations", starter: false, growth: false, enterprise: true },
    { feature: "Dedicated Support", starter: false, growth: false, enterprise: true },
    { feature: "White-label", starter: false, growth: false, enterprise: true },
];

export default function PricingPage() {
    const [salesOpen, setSalesOpen] = useState(false);

    useEffect(() => {
        document.body.classList.add('theme-marketing');
        return () => document.body.classList.remove('theme-marketing');
    }, []);

    return (
        <div className="min-h-screen bg-base theme-marketing">
            <LandingNav />

            <main className="pt-32 pb-20">
                {/* Header */}
                <div className="container mx-auto px-6 max-w-6xl">
                    <MotionSection direction="up" className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-4">
                            Simple, Transparent Pricing
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                            Start free, scale as you grow. No hidden fees, cancel anytime.
                        </p>
                    </MotionSection>

                    {/* Pricing Cards */}
                    <motion.div
                        className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-24"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                    >
                        {TIERS.map((tier) => (
                            <PricingCard
                                key={tier.name}
                                name={tier.name}
                                price={tier.price}
                                period={tier.period !== undefined ? tier.period : "/mo"}
                                description={tier.description}
                                features={tier.features}
                                highlighted={tier.highlighted}
                                ctaLabel={tier.cta}
                                onCtaClick={() => setSalesOpen(true)}
                            />
                        ))}
                    </motion.div>

                    {/* Feature Comparison Table */}
                    <MotionSection direction="up">
                        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
                            Feature Comparison
                        </h2>
                        <div className="border border-white/[0.06] rounded-xl overflow-hidden max-w-4xl mx-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                        <th className="text-left p-4 text-muted-foreground font-medium">Feature</th>
                                        <th className="p-4 text-center text-muted-foreground font-medium">Starter</th>
                                        <th className="p-4 text-center text-brand-indigo font-semibold">Growth</th>
                                        <th className="p-4 text-center text-muted-foreground font-medium">Enterprise</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMPARISON.map((row, i) => (
                                        <motion.tr
                                            key={row.feature}
                                            className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                                            initial={{ opacity: 0, y: 10 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ duration: 0.3, delay: i * 0.03 }}
                                        >
                                            <td className="p-4 text-foreground">{row.feature}</td>
                                            {[row.starter, row.growth, row.enterprise].map((val, j) => (
                                                <td key={j} className="p-4 text-center">
                                                    {val === true ? (
                                                        <Check className="h-4 w-4 text-brand-indigo mx-auto" />
                                                    ) : val === false ? (
                                                        <Minus className="h-4 w-4 text-white/10 mx-auto" />
                                                    ) : (
                                                        <span className="text-muted-foreground">{val}</span>
                                                    )}
                                                </td>
                                            ))}
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </MotionSection>
                </div>
            </main>

            <LandingFooter />
            <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
        </div>
    );
}
