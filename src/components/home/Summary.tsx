import React from 'react';

const Summary = ({ summary }: { summary?: string }) => {
  return (
    <div className="p-4 bg-white/5 rounded-lg border border-white/10 mt-4">
      <h3 className="text-lg font-semibold mb-2 text-white">Summary</h3>
      <p className="text-sm text-gray-300">{summary || "No summary available."}</p>
    </div>
  );
};

export default Summary;
