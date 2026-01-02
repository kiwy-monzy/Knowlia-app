import React, { useState, useRef, useEffect } from 'react';
import { RotateCw, RotateCcw, Maximize2, Minimize2, Move, ZoomIn, ZoomOut } from 'lucide-react';

interface MapCanvasProps {
  children: React.ReactNode;
  className?: string;
}

const MapCanvas: React.FC<MapCanvasProps> = ({ children, className = '' }) => {
  const [rotation, setRotation] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleRotateLeft = () => {
    setRotation(prev => (prev - 45 + 360) % 360);
  };

  const handleRotateRight = () => {
    setRotation(prev => (prev + 45) % 360);
  };

  const handleTiltUp = () => {
    setTilt(prev => Math.max(prev - 15, -60));
  };

  const handleTiltDown = () => {
    setTilt(prev => Math.min(prev + 15, 60));
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleReset = () => {
    setRotation(0);
    setTilt(0);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{
        perspective: '2000px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      }}
    >
      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 1300,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.1) inset',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minWidth: '200px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Move size={18} color="#60a5fa" />
          <h3 style={{ 
            margin: 0, 
            fontSize: '14px', 
            fontWeight: '600',
            color: 'white'
          }}>
            Canvas Controls
          </h3>
        </div>

        {/* Rotation Controls */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '11px',
            color: '#94a3b8',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            ROTATION ({rotation}°)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRotateLeft}
              style={{
                flex: 1,
                background: 'rgba(96, 165, 250, 0.2)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: '8px',
                padding: '8px',
                color: '#60a5fa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              <RotateCcw size={14} />
              Left
            </button>
            <button
              onClick={handleRotateRight}
              style={{
                flex: 1,
                background: 'rgba(96, 165, 250, 0.2)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: '8px',
                padding: '8px',
                color: '#60a5fa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              <RotateCw size={14} />
              Right
            </button>
          </div>
        </div>

        {/* Tilt Controls */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '11px',
            color: '#94a3b8',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            TILT ({tilt}°)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleTiltUp}
              style={{
                flex: 1,
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                padding: '8px',
                color: '#a78bfa',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              ↑ Up
            </button>
            <button
              onClick={handleTiltDown}
              style={{
                flex: 1,
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                padding: '8px',
                color: '#a78bfa',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              ↓ Down
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            fontSize: '11px',
            color: '#94a3b8',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            SCALE ({(scale * 100).toFixed(0)}%)
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleZoomOut}
              style={{
                flex: 1,
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                padding: '8px',
                color: '#22c55e',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              <ZoomOut size={14} />
              Out
            </button>
            <button
              onClick={handleZoomIn}
              style={{
                flex: 1,
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                padding: '8px',
                color: '#22c55e',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              <ZoomIn size={14} />
              In
            </button>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          style={{
            width: '100%',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          🔄 Reset View
        </button>
      </div>

      {/* Canvas Container */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          transformStyle: 'preserve-3d',
          transform: `
            translate(${position.x}px, ${position.y}px)
            rotateX(${tilt}deg)
            rotateZ(${rotation}deg)
            scale(${scale})
          `,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {children}
      </div>

      {/* Info Display */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        zIndex: 1300,
        background: 'rgba(15, 23, 42, 0.9)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '11px',
        color: '#94a3b8',
        fontWeight: '600'
      }}>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: '#60a5fa' }}>💡 Tip:</span> Drag to pan, use controls to rotate and tilt
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '10px' }}>
          <span>Rotation: {rotation}°</span>
          <span>Tilt: {tilt}°</span>
          <span>Scale: {(scale * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

export default MapCanvas;
