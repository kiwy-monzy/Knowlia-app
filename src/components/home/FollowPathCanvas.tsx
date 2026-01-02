import React, { useEffect, useRef } from "react";

const POINTS = 25;
const LENGTH = 35;
const STROKE_WIDTH = 20;
const COLOR = "#E4141B";
const COLOR_DOWN = "#e08285";

const FollowPathCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const isDownRef = useRef(false);
  const animationFrameId = useRef<number | null>(null);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  // Set up initial points
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth * dpr;
    const height = canvas.offsetHeight * dpr;
    canvas.width = width;
    canvas.height = height;

    // Start points horizontally, spaced by LENGTH
    const startX = width / 10;
    const startY = height / 2;
    pointsRef.current = Array.from({ length: POINTS }, (_, i) => ({ x: startX + i * LENGTH, y: startY }));

    let running = true;

    function draw() {
      if (!running || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = isDownRef.current ? COLOR_DOWN : COLOR;
      ctx.lineWidth = STROKE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      // Move to first point, then line through all
      const pts = pointsRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      animationFrameId.current = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      running = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  // Handle mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    function getPos(e: MouseEvent): { x: number; y: number } {
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      };
    }
    function onMouseMove(e: MouseEvent) {
      const mouse = getPos(e);
      lastMouseRef.current = mouse;
      // First point moves to mouse
      pointsRef.current[0] = mouse;
      // Each follows the previous one, spaced by LENGTH
      for (let i = 0; i < POINTS - 1; i++) {
        const pt = pointsRef.current[i];
        const next = pointsRef.current[i + 1];
        let dx = pt.x - next.x;
        let dy = pt.y - next.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const targetDist = LENGTH;
        if (dist > 0) {
          const scale = targetDist / dist;
          // move next point closer to pt but keep exact distance
          next.x = pt.x - dx * scale;
          next.y = pt.y - dy * scale;
        }
      }
    }
    function onMouseDown(e: MouseEvent) {
      isDownRef.current = true;
    }
    function onMouseUp(e: MouseEvent) {
      isDownRef.current = false;
    }
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Responsiveness: reinitialize points if resized
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      const startX = canvas.width / 10;
      const startY = canvas.height / 2;
      pointsRef.current = Array.from({ length: POINTS }, (_, i) => ({ x: startX + i * LENGTH, y: startY }));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div style={{ width: "100%", height: 200, position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", borderRadius: 12, background: "#fcfcfc", boxShadow: "0 2px 16px #0001" }}
      />
    </div>
  );
};

export default FollowPathCanvas;
