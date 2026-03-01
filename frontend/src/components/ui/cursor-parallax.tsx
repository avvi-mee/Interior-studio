"use client";

import { motion, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMousePosition } from "@/hooks/useMousePosition";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ParallaxLayer {
  children: React.ReactNode;
  speed: number;
}

interface CursorParallaxProps {
  layers: ParallaxLayer[];
  className?: string;
}

function ParallaxLayerComponent({
  children,
  speed,
  mouseX,
  mouseY,
  disabled,
}: ParallaxLayer & {
  mouseX: ReturnType<typeof useMousePosition>["x"];
  mouseY: ReturnType<typeof useMousePosition>["y"];
  disabled: boolean;
}) {
  const x = useTransform(mouseX, (v) => (disabled ? 0 : (v - (typeof window !== "undefined" ? window.innerWidth / 2 : 0)) * speed));
  const y = useTransform(mouseY, (v) => (disabled ? 0 : (v - (typeof window !== "undefined" ? window.innerHeight / 2 : 0)) * speed));

  return (
    <motion.div style={disabled ? undefined : { x, y }} className="absolute inset-0">
      {children}
    </motion.div>
  );
}

export function CursorParallax({ layers, className }: CursorParallaxProps) {
  const { x: mouseX, y: mouseY } = useMousePosition();
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const disabled = reducedMotion || isMobile;

  return (
    <div className={cn("relative", className)}>
      {layers.map((layer, i) => (
        <ParallaxLayerComponent
          key={i}
          speed={layer.speed}
          mouseX={mouseX}
          mouseY={mouseY}
          disabled={disabled}
        >
          {layer.children}
        </ParallaxLayerComponent>
      ))}
    </div>
  );
}
