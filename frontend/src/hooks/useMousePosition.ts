"use client";

import { useEffect } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";

interface MousePosition {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

export function useMousePosition(): MousePosition {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [x, y]);

  return { x, y };
}
