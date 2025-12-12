import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  speed: number;
  oscillationOffset: number;
  oscillationSpeed: number;
}

const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
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
      initParticles();
    };

    const initParticles = () => {
      const particleCount = Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 8000);
      particlesRef.current = [];

      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * canvas.offsetWidth;
        const y = Math.random() * canvas.offsetHeight;
        particlesRef.current.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
          size: Math.random() * 2.5 + 1,
          opacity: Math.random() * 0.3 + 0.1,
          speed: Math.random() * 0.3 + 0.1,
          oscillationOffset: Math.random() * Math.PI * 2,
          oscillationSpeed: Math.random() * 0.02 + 0.01,
        });
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      const mouse = mouseRef.current;
      const interactionRadius = 120;
      const repulsionStrength = 50;

      particlesRef.current.forEach((particle) => {
        // Vertical floating motion
        particle.y -= particle.speed;

        // Horizontal oscillation for organic feel
        particle.oscillationOffset += particle.oscillationSpeed;
        const oscillation = Math.sin(particle.oscillationOffset) * 0.5;
        particle.x += oscillation;

        // Mouse interaction - repulsion
        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < interactionRadius && distance > 0) {
          const force = (interactionRadius - distance) / interactionRadius;
          const angle = Math.atan2(dy, dx);
          particle.vx += Math.cos(angle) * force * repulsionStrength * 0.1;
          particle.vy += Math.sin(angle) * force * repulsionStrength * 0.1;
        }

        // Apply velocity with friction
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.92;
        particle.vy *= 0.92;

        // Wrap around when particle goes off screen
        if (particle.y < -10) {
          particle.y = canvas.offsetHeight + 10;
          particle.x = Math.random() * canvas.offsetWidth;
        }
        if (particle.x < -10) particle.x = canvas.offsetWidth + 10;
        if (particle.x > canvas.offsetWidth + 10) particle.x = -10;

        // Draw particle with glow effect
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(0, 0%, 100%, ${particle.opacity})`;
        ctx.fill();

        // Subtle glow for larger particles
        if (particle.size > 2) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(0, 0%, 100%, ${particle.opacity * 0.2})`;
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
      style={{ opacity: 0.6 }}
    />
  );
};

export default ParticleBackground;
