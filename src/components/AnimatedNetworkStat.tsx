import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

interface AnimatedNetworkStatProps {
  rtt: number | null;
  name: string;
}

export const AnimatedNetworkStat: React.FC<AnimatedNetworkStatProps> = ({ rtt, name }) => {
  const [prevRtt, setPrevRtt] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (rtt !== null && prevRtt !== null && rtt !== prevRtt) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
    setPrevRtt(rtt);
  }, [rtt, prevRtt]);

  const getAnimationClass = () => {
    if (!isAnimating || !rtt || !prevRtt) return '';
    
    const change = rtt - prevRtt;
    if (Math.abs(change) < 5) return '';
    
    if (change > 0) {
      return 'animate-pulse bg-red-800';
    } else {
      return 'animate-pulse bg-green-800';
    }
  };

  const getLatencyColor = () => {
    if (!rtt) return 'text-gray-400';
    if (rtt < 50) return 'text-emerald-400';
    if (rtt < 100) return 'text-emerald-300';
    if (rtt < 150) return 'text-amber-300';
    if (rtt < 200) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md sidebar-3d-icon border border-black/50 transition-all duration-300 ${
        rtt && rtt < 200 ? 'bg-emerald-900' : 'bg-red-900'
      } ${getAnimationClass()} text-white`}
      title={`${name} - ${rtt ? `${rtt}ms` : 'Measuring...'}`}
    >
      <Activity className={`w-3 h-3 ${isAnimating ? 'animate-spin' : ''}`} />
      <span className="truncate max-w-[80px] font-medium">
        {name}
      </span>
      {rtt && (
        <span className={getLatencyColor()}>
          {rtt}ms
        </span>
      )}
    </div>
  );
};
