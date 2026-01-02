"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { FileX, Inbox, Search } from 'lucide-react';

interface NoContentProps {
  children?: React.ReactNode;
  title?: string;
  className?: string;
}

const NoContent: React.FC<NoContentProps> = ({ children, title = "NO CONTENT", className = '' }) => (
  <div className={`h-full flex items-center justify-center p-4 bg-transparent ${className}`}>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center max-w-md mx-auto"
    >
      {/* Animated Icon Container */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200, damping: 15 }}
        className="relative mb-8"
      >
        {/* Background Circle */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="absolute inset-0 bg-gray-300 rounded-full w-32 h-32 mx-auto opacity-20"
        />
        {/* Main Icon */}
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="relative z-10 w-32 h-32 mx-auto bg-transparent rounded-full flex items-center justify-center"
        >
          <FileX className="w-12 h-12 text-gray-400" />
        </motion.div>
        {/* Floating Elements */}
        <motion.div
          animate={{ x: [0, 10, 0], y: [0, -5, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', delay: 0.5 }}
          className="absolute top-4 right-4 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center"
        >
          <Search className="w-3 h-3 text-gray-400" />
        </motion.div>
        <motion.div
          animate={{ x: [0, -8, 0], y: [0, 8, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-4 left-4 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center"
        >
          <Inbox className="w-3 h-3 text-gray-400" />
        </motion.div>
      </motion.div>
      {/* Animated Text */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-2xl font-bold text-gray-300 mb-3 tracking-wide"
        >
         {title}
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-gray-200 text-base mb-6 leading-relaxed"
        >
          {children || (
            <>
              {""}
            </>
          )}
        </motion.div>
        {/* Animated Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="flex justify-center space-x-2"
        >
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: index * 0.2, ease: 'easeInOut' }}
              className="w-2 h-2 bg-gray-400 rounded-full"
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  </div>
);

export default NoContent; 