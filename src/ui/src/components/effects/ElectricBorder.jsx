'use client';

import { useEffect, useRef } from 'react';
import './ElectricBorder.css';

/**
 * ElectricBorder - Animated electric border effect
 * Creates flowing electric arcs along the border
 */
const ElectricBorder = ({
  children,
  borderWidth = 2,
  colors = ['#a855f7', '#ec4899', '#0ea5e9'],
  speed = 3,
  arcCount = 8,
  glowIntensity = 0.8,
  borderRadius = '28px',
  className = ''
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let arcs = [];

    // Set canvas size to match container
    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      // Ensure valid dimensions to prevent Canvas errors
      if (!rect.width || !rect.height || rect.width < 1 || rect.height < 1) {
        canvas.width = 0;
        canvas.height = 0;
        return false;
      }
      canvas.width = rect.width;
      canvas.height = rect.height;
      initArcs();
      return true;
    };

    // Initialize electric arcs
    const initArcs = () => {
      arcs = [];
      const perimeter = (canvas.width + canvas.height) * 2;

      for (let i = 0; i < arcCount; i++) {
        arcs.push({
          position: (perimeter / arcCount) * i,
          speed: speed * (0.5 + Math.random() * 0.5),
          length: 50 + Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0.3 + Math.random() * 0.5,
          width: 1 + Math.random() * 2
        });
      }
    };

    // Get position along border
    const getPositionOnBorder = (distance) => {
      const w = canvas.width;
      const h = canvas.height;
      const perimeter = (w + h) * 2;
      const normalizedDist = distance % perimeter;

      if (normalizedDist < w) {
        // Top edge
        return { x: normalizedDist, y: 0 };
      } else if (normalizedDist < w + h) {
        // Right edge
        return { x: w, y: normalizedDist - w };
      } else if (normalizedDist < w * 2 + h) {
        // Bottom edge
        return { x: w - (normalizedDist - w - h), y: h };
      } else {
        // Left edge
        return { x: 0, y: h - (normalizedDist - w * 2 - h) };
      }
    };

    // Animation loop
    const animate = () => {
      // Safety check: ensure canvas has valid dimensions
      if (!canvas.width || !canvas.height || canvas.width < 1 || canvas.height < 1) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      arcs.forEach(arc => {
        // Update position
        arc.position += arc.speed;
        const perimeter = (canvas.width + canvas.height) * 2;
        if (arc.position > perimeter) {
          arc.position = 0;
        }

        // Draw arc trail
        const segmentCount = 15;
        for (let i = 0; i < segmentCount; i++) {
          const t = i / segmentCount;
          const opacity = arc.opacity * (1 - t) * glowIntensity;
          const pos = getPositionOnBorder(arc.position - t * arc.length);

          // Safety check: ensure position values are finite
          if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(arc.width)) {
            continue;
          }

          // Main arc line (sharper for light theme)
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, arc.width * (1 - t * 0.3), 0, Math.PI * 2);
          ctx.fillStyle = `${arc.color}${Math.floor(opacity * 0.8 * 255).toString(16).padStart(2, '0')}`;
          ctx.fill();

          // Subtle glow effect (reduced for light theme)
          const radiusOuter = arc.width * 2.5;
          if (isFinite(radiusOuter) && radiusOuter > 0) {
            const gradient = ctx.createRadialGradient(
              pos.x, pos.y, 0,
              pos.x, pos.y, radiusOuter
            );
            gradient.addColorStop(0, `${arc.color}${Math.floor(opacity * 0.3 * 255).toString(16).padStart(2, '0')}`);
            gradient.addColorStop(1, `${arc.color}00`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radiusOuter, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    animate();

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [borderWidth, colors, speed, arcCount, glowIntensity]);

  return (
    <div
      ref={containerRef}
      className={`electric-border-container ${className}`}
      style={{ borderRadius }}
    >
      <canvas
        ref={canvasRef}
        className="electric-border-canvas"
        style={{ borderRadius }}
      />
      <div className="electric-border-content" style={{ borderRadius }}>
        {children}
      </div>
    </div>
  );
};

export default ElectricBorder;
