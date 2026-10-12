'use client';

import { useEffect, useRef } from 'react';
import './StarField.css';

const StarField = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let stars = [];

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    // Initialize stars
    const initStars = () => {
      stars = [];
      const starCount = Math.floor((canvas.width * canvas.height) / 6000); // Increased density

      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2 + 0.5, // Larger size range
          opacity: Math.random() * 0.6 + 0.4, // Higher opacity
          twinkleSpeed: Math.random() * 0.03 + 0.01, // Faster twinkle
          twinklePhase: Math.random() * Math.PI * 2
        });
      }
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach(star => {
        // Gentle twinkle effect for light theme
        star.twinklePhase += star.twinkleSpeed;
        const twinkleValue = Math.sin(star.twinklePhase);
        const currentOpacity = star.opacity * (0.2 + twinkleValue * 0.3); // Subtle 0.2-0.5 range

        // Draw star with multiple colors for variety
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);

        // Light theme: blue/green/cyan tinted stars
        const colorChance = star.radius / 2.5;
        if (colorChance > 0.8 && twinkleValue > 0.3) {
          // Blue/green/cyan color palette for light theme
          const colors = [
            `rgba(14, 165, 233, ${currentOpacity * 0.4})`,   // Sky blue
            `rgba(16, 163, 127, ${currentOpacity * 0.4})`,   // Teal green
            `rgba(37, 99, 235, ${currentOpacity * 0.4})`     // Royal blue
          ];
          const colorIndex = Math.floor(star.x * 3 / canvas.width);
          ctx.fillStyle = colors[colorIndex];
        } else {
          ctx.fillStyle = `rgba(14, 165, 233, ${currentOpacity * 0.3})`;
        }
        ctx.fill();

        // Subtle glow for brighter stars (light theme)
        if (star.radius > 1.2) {
          const gradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.radius * 3
          );
          gradient.addColorStop(0, `rgba(14, 165, 233, ${currentOpacity * 0.15})`);
          gradient.addColorStop(0.5, `rgba(16, 163, 127, ${currentOpacity * 0.08})`);
          gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
          ctx.fillStyle = gradient;
          ctx.fill();
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
  }, []);

  return <canvas ref={canvasRef} className="star-field-canvas" />;
};

export default StarField;
