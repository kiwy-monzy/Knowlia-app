import React from 'react';

interface UnderConstructionSectionProps {
  title: string;
  subtitle: string;
}

const UnderConstructionSection: React.FC<UnderConstructionSectionProps> = ({ title, subtitle }) => {
  return (
    <div className="p-8 border rounded-lg text-center bg-gray-50">
      <div className="mb-4">
        <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-4">{subtitle}</p>
      <p className="text-sm text-gray-500">This feature is currently under construction.</p>
    </div>
  );
};

export default UnderConstructionSection;
