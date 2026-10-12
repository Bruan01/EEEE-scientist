"use client";

import { useEffect, useRef } from "react";

export function MacOSGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const draw = () => {
      time += 0.002; // Very slow animation

      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      );

      // macOS Sonoma style soft gradient
      const shift = Math.sin(time) * 0.1;
      gradient.addColorStop(0, `hsl(${250 + shift * 20}, 70%, 60%)`); // Purple
      gradient.addColorStop(0.3, `hsl(${280 + shift * 15}, 60%, 55%)`); // Pink-Purple
      gradient.addColorStop(0.5, `hsl(${220 + shift * 10}, 70%, 55%)`); // Blue
      gradient.addColorStop(0.7, `hsl(${190 + shift * 15}, 70%, 50%)`); // Cyan-Blue
      gradient.addColorStop(1, `hsl(${170 + shift * 20}, 60%, 45%)`); // Cyan

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ filter: "blur(80px) saturate(1.2)" }}
    />
  );
}
