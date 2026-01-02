import React from 'react';

interface Module {
  id: number;
  url: string;
  name: string;
  modname: string;
  description?: string;
}

interface Section2Props {
  id?: number;
  name: string;
  summary: string;
  modules: Module[];
}

const Section2 = ({ name, summary, modules }: Section2Props) => {
  return (
    <div className="p-4 bg-white/5 rounded-lg border border-white/10 mt-4">
      <h3 className="text-lg font-semibold mb-2 text-white">{name}</h3>
      <p className="text-sm text-gray-300 mb-4">{summary}</p>
      <div className="space-y-2">
        {modules.map(mod => (
          <div key={mod.id} className="p-3 bg-white/5 rounded border border-white/10">
            <h4 className="text-sm font-medium text-white">{mod.name}</h4>
            {mod.description && <p className="text-xs text-gray-400 mt-1">{mod.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Section2;
