"use client";

import { type RefObject, useEffect, useCallback } from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";

interface MagneticEffectOptions {
  strength?: number;
  radius?: number;
}

interface MagneticEffectReturn {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

export function useMagneticEffect(
  ref: RefObject<HTMLElement | null>,
  { strength = 0.3, radius = 150 }: MagneticEffectOptions = {}
): MagneticEffectReturn {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 200, damping: 25 });
  const y = useSpring(rawY, { stiffness: 200, damping: 25 });

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        rawX.set(dx * strength);
        rawY.set(dy * strength);
      } else {
        rawX.set(0);
        rawY.set(0);
      }
    },
    [ref, strength, radius, rawX, rawY]
  );

  const handlePointerLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [ref, handlePointerMove, handlePointerLeave]);

  return { x, y };
}
