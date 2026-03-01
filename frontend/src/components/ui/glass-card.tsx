"use client";

import { useRef, useCallback } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsMobile } from "@/hooks/useIsMobile";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  glow?: "indigo" | "cyan" | "none";
  hover?: boolean;
  tilt?: boolean;
  hoverGlow?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({
  glow = "none",
  hover = true,
  tilt = false,
  hoverGlow = false,
  children,
  className,
  ...props
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const { style: tiltStyle } = useTiltEffect(ref, { maxTilt: 6 });

  const shouldTilt = tilt && !reducedMotion && !isMobile;

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!hoverGlow || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      ref.current.style.setProperty("--glow-x", `${x}%`);
      ref.current.style.setProperty("--glow-y", `${y}%`);
    },
    [hoverGlow]
  );

  const card = (
    <motion.div
      ref={ref}
      className={cn(
        "glass-card p-6",
        glow === "indigo" && "glow-indigo",
        glow === "cyan" && "glow-cyan",
        hover && !shouldTilt && "transition-all duration-300 hover:border-white/10 hover:-translate-y-1",
        hoverGlow && "glow-trail",
        className
      )}
      style={shouldTilt ? tiltStyle : undefined}
      onPointerMove={handlePointerMove}
      {...props}
    >
      {children}
    </motion.div>
  );

  if (shouldTilt) {
    return <div className="perspective-1000">{card}</div>;
  }

  return card;
}
