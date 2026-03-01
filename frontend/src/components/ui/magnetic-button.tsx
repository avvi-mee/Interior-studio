"use client";

import { useRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMagneticEffect } from "@/hooks/useMagneticEffect";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Button, type ButtonProps, buttonVariants } from "@/components/ui/button";

interface MagneticButtonProps extends ButtonProps {
  magneticStrength?: number;
  magneticRadius?: number;
}

export function MagneticButton({
  children,
  className,
  magneticStrength = 0.3,
  magneticRadius = 150,
  variant,
  size,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const { x, y } = useMagneticEffect(ref, {
    strength: magneticStrength,
    radius: magneticRadius,
  });

  const shouldAnimate = !reducedMotion && !isMobile;

  if (!shouldAnimate) {
    return (
      <Button className={className} variant={variant} size={size} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <motion.div ref={ref} style={{ x, y }} className="inline-block">
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        {...(props as any)}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}
