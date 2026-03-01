"use client";

import React, { useRef, useCallback, useState } from "react";
import { motion } from "framer-motion";
import { cn, } from "@/lib/utils";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface MotionButtonProps extends ButtonProps {
  ripple?: boolean;
  pressScale?: number;
}

export const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, variant, size, ripple = false, pressScale = 0.95, children, ...props }, ref) => {
    const reducedMotion = useReducedMotion();
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (ripple && !reducedMotion && btnRef.current) {
          const rect = btnRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const id = Date.now();
          setRipples((prev) => [...prev, { x, y, id }]);
          setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
        }
        props.onClick?.(e);
      },
      [ripple, reducedMotion, props.onClick]
    );

    const setRef = useCallback(
      (node: HTMLButtonElement | null) => {
        btnRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      },
      [ref]
    );

    return (
      <motion.button
        ref={setRef}
        className={cn(buttonVariants({ variant, size, className }), "relative overflow-hidden")}
        whileTap={reducedMotion ? undefined : { scale: pressScale }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        onClick={handleClick}
        {...(props as any)}
      >
        {children}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute rounded-full bg-white/20 pointer-events-none"
            style={{
              left: r.x,
              top: r.y,
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
              animation: "ripple 0.6s ease-out forwards",
            }}
          />
        ))}
      </motion.button>
    );
  }
);

MotionButton.displayName = "MotionButton";
