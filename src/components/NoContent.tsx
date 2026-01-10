"use client";
import React from 'react';
import { FileX } from 'lucide-react';

interface NoContentProps {
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

const NoContent: React.FC<NoContentProps> = ({ children, title = "NO CONTENT", className = '' }) => (
  <div className={`h-full flex items-center justify-center p-4 bg-transparent ${className}`}>
    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
      {/* Icon Container */}
      <div className="relative mb-8">
        {/* Background Circle */}
        <div className="absolute inset-0 bg-gray-300 rounded-full w-32 h-32 mx-auto opacity-20" />
        {/* Main Icon */}
        <div className="relative z-10 w-32 h-32 mx-auto bg-transparent rounded-full flex items-center justify-center">
          <FileX className="w-12 h-12 text-gray-400" />
        </div>
        {/* Floating Elements */}
        <div className="absolute top-4 right-4 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
          <div className="w-3 h-3 text-gray-400" />
        </div>
        <div className="absolute bottom-4 left-4 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
          <div className="w-3 h-3 text-gray-400" />
        </div>
      </div>
      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-300 mb-3 tracking-wide">
        {title}
      </h2>
      {/* Description */}
      <div className="text-gray-200 text-base mb-6 leading-relaxed">
        {children || (
          <>
            {""}
          </>
        )}
      </div>
      {/* Static Dots */}
      <div className="flex justify-center space-x-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="w-2 h-2 bg-gray-400 rounded-full"
          />
        ))}
      </div>
    </div>
  </div>
);

export default NoContent;