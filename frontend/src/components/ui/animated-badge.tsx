"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface AnimatedBadgeProps {
  children: React.ReactNode;
  variant?: "shimmer" | "pulse" | "static";
  className?: string;
}

export function AnimatedBadge({
  children,
  variant = "shimmer",
  className,
}: AnimatedBadgeProps) {
  const reducedMotion = useReducedMotion();
  const effectiveVariant = reducedMotion ? "static" : variant;

  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm relative overflow-hidden",
        className
      )}
      animate={
        effectiveVariant === "pulse"
          ? { scale: [1, 1.02, 1] }
          : undefined
      }
      transition={
        effectiveVariant === "pulse"
          ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      {effectiveVariant === "shimmer" && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
            animation: "shimmer-slide 3s ease-in-out infinite",
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2.5">
        {children}
      </span>
    </motion.span>
  );
}
