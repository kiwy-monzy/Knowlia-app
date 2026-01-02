import React from 'react';
import { MeshGradient } from "@paper-design/shaders-react";

interface SimpleCardProps {
  children: React.ReactNode;
  className?: string;
}

const SimpleCard: React.FC<SimpleCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <MeshGradient
          speed={0.5}
          colors={["#FFFFFF", "#F8FAFC", "#F1F5F9", "#E2E8F0"]}
          distortion={0.4}
          swirl={0.05}
          grainMixer={0}
          grainOverlay={0}
          className="inset-0 sticky top-0"
          style={{ height: "100%", width: "100%" }}
        />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

// Card components for compatibility
const Card = {
  Root: SimpleCard,
  Header: ({ children, className = '' }: any) => (
    <div className={`p-6 pb-4 ${className}`}>{children}</div>
  ),
  Content: ({ children, className = '' }: any) => (
    <div className={`p-6 pt-0 ${className}`}>{children}</div>
  ),
  Title: ({ children, className = '' }: any) => (
    <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h3>
  ),
  Description: ({ children, className = '' }: any) => (
    <p className={`text-sm text-gray-600 mt-1 ${className}`}>{children}</p>
  ),
};

export { Card };
export default SimpleCard;
