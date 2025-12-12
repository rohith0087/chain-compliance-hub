import { useEffect, useRef } from 'react';

// Tunable configuration
const CONFIG = {
  columnSpacing: 50,        // Pixels between columns
  dotsPerColumn: 5,         // Staggered dots per column
  speed: 0.25,              // Pixels per frame (slow)
  speedVariation: 0.08,     // Slight variation per dot
  dotSize: 1.5,             // Consistent size
  baseOpacity: 0.25,        // Low opacity
  interactionRadius: 70,    // Small, precise
  maxDisplacement: 12,      // Max horizontal shift on hover
  fadeZone: 80,             // Fade in/out zone at edges
  easingFactor: 0.92,       // How fast dots return to center
};

interface Dot {
  columnX: number;
  y: number;
  speed: number;
  baseOpacity: number;
  offsetX: number;
}

const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initDots();
    };

    const initDots = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const columnCount = Math.floor(width / CONFIG.columnSpacing);
      
      dotsRef.current = [];

      for (let col = 0; col < columnCount; col++) {
        const columnX = (col + 0.5) * CONFIG.columnSpacing;
        
        for (let i = 0; i < CONFIG.dotsPerColumn; i++) {
          // Stagger dots vertically within each column
          const staggerOffset = (height / CONFIG.dotsPerColumn) * i;
          const randomOffset = Math.random() * (height / CONFIG.dotsPerColumn);
          
          dotsRef.current.push({
            columnX,
            y: staggerOffset + randomOffset,
            speed: CONFIG.speed + (Math.random() - 0.5) * CONFIG.speedVariation * 2,
            baseOpacity: CONFIG.baseOpacity + (Math.random() - 0.5) * 0.1,
            offsetX: 0,
          });
        }
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      ctx.clearRect(0, 0, width, height);

      const mouse = mouseRef.current;

      dotsRef.current.forEach((dot) => {
        // Strictly vertical motion - downward only
        dot.y += dot.speed;

        // Reset to top when exiting bottom
        if (dot.y > height + CONFIG.fadeZone) {
          dot.y = -CONFIG.fadeZone;
        }

        // Cursor interaction - horizontal displacement only
        const dx = (dot.columnX + dot.offsetX) - mouse.x;
        const dy = dot.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < CONFIG.interactionRadius && distance > 0) {
          const force = 1 - (distance / CONFIG.interactionRadius);
          const direction = dx > 0 ? 1 : -1;
          const targetOffset = direction * force * CONFIG.maxDisplacement;
          dot.offsetX += (targetOffset - dot.offsetX) * 0.15;
        } else {
          // Ease back to column center
          dot.offsetX *= CONFIG.easingFactor;
        }

        // Calculate edge fading
        const topFade = Math.min(1, Math.max(0, (dot.y + CONFIG.fadeZone) / CONFIG.fadeZone));
        const bottomFade = Math.min(1, Math.max(0, (height + CONFIG.fadeZone - dot.y) / CONFIG.fadeZone));
        const edgeFade = Math.min(topFade, bottomFade);

        // Final opacity with edge fading
        const opacity = dot.baseOpacity * edgeFade;

        if (opacity > 0.01) {
          const renderX = dot.columnX + dot.offsetX;
          
          ctx.beginPath();
          ctx.arc(renderX, dot.y, CONFIG.dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fill();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    resizeCanvas();
    animate();

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ opacity: 0.7 }}
    />
  );
};

export default ParticleBackground;
