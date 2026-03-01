"use client";

import { type RefObject, useEffect, useCallback } from "react";
import {
  useMotionValue,
  useSpring,
  type MotionStyle,
  type MotionValue,
} from "framer-motion";

interface TiltEffectOptions {
  maxTilt?: number;
  perspective?: number;
}

interface TiltEffectReturn {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  style: MotionStyle;
}

export function useTiltEffect(
  ref: RefObject<HTMLElement | null>,
  { maxTilt = 8, perspective = 1000 }: TiltEffectOptions = {}
): TiltEffectReturn {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const rotateX = useSpring(rawX, { stiffness: 150, damping: 20 });
  const rotateY = useSpring(rawY, { stiffness: 150, damping: 20 });

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      rawY.set(dx * maxTilt);
      rawX.set(-dy * maxTilt);
    },
    [ref, maxTilt, rawX, rawY]
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

  const style: MotionStyle = {
    rotateX,
    rotateY,
    perspective,
    transformStyle: "preserve-3d" as const,
  };

  return { rotateX, rotateY, style };
}
