"use client";

import { useRef, useCallback } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsMobile } from "@/hooks/useIsMobile";

interface TiltCardProps extends Omit<HTMLMotionProps<"div">, "style"> {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glowColor?: string;
  disabled?: boolean;
}

export function TiltCard({
  children,
  className,
  maxTilt = 8,
  glowColor = "indigo",
  disabled = false,
  ...props
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const { style } = useTiltEffect(ref, { maxTilt });

  const shouldTilt = !disabled && !reducedMotion && !isMobile;

  const glowMap: Record<string, string> = {
    indigo: "rgba(99, 102, 241, 0.15)",
    violet: "rgba(124, 58, 237, 0.15)",
    cyan: "rgba(6, 182, 212, 0.15)",
    gold: "rgba(201, 168, 76, 0.15)",
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!shouldTilt || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      ref.current.style.setProperty("--glow-x", `${x}%`);
      ref.current.style.setProperty("--glow-y", `${y}%`);
    },
    [shouldTilt]
  );

  return (
    <div className="perspective-1000">
      <motion.div
        ref={ref}
        className={cn(
          "glass-card p-6 preserve-3d glow-trail relative overflow-hidden",
          !shouldTilt && "transition-all duration-300 hover:-translate-y-1",
          className
        )}
        style={shouldTilt ? style : undefined}
        whileHover={shouldTilt ? undefined : { y: -4 }}
        onPointerMove={handlePointerMove}
        {...props}
      >
        {children}
      </motion.div>
    </div>
  );
}
