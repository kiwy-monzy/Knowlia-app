"use client"

import { Calendar, Download, Activity } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"

interface TSLADataPoint {
  date: string;
  connections: number;
  tsli: number;
}

interface TSLAGraphProps {
  data: TSLADataPoint[];
}

export default function TSLAGraph({ data }: TSLAGraphProps) {
  // Debug: Log data to console
  console.log('TSLAGraph received data:', data);
  
  // Ensure we have data before rendering
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6 bg-[#0D0D0D] rounded-2xl">
        <div className="text-center text-gray-400">
          <Activity className="w-8 h-8 mx-auto mb-2" />
          <p>No TSLA data available</p>
        </div>
      </div>
    );
  }
  
  // Calculate summary statistics from real data
  const avgTSLA = data.length > 0 
    ? data.reduce((sum, d) => sum + d.tsli, 0) / data.length 
    : 98.2;
  
  const avgConnections = data.length > 0 
    ? Math.round(data.reduce((sum, d) => sum + d.connections, 0) / data.length)
    : 51;
    
  const peakConnections = data.length > 0 
    ? Math.max(...data.map(d => d.connections))
    : 78;
    
  const peakDate = data.length > 0 
    ? data.find(d => d.connections === peakConnections)?.date || 'Jan 28'
    : 'Jan 28';
  return (
    <div className="flex flex-col gap-6 p-6 bg-[#0D0D0D] rounded-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-2 lg:gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-medium text-white">TSLA Performance</h2>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1A1A1A] rounded-full border border-[#333]">
            <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-white">TSLA</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-2 lg:gap-4">
          <div className="flex items-center bg-[#1A1A1A] rounded-lg p-1">
            {['1D', '1M', '3M', '6M', '1Y'].map((period) => (
              <button
                key={period}
                className={`px-3 md:px-2 lg:px-3 py-1 text-sm md:text-xs lg:text-sm rounded-md transition-colors ${
                  period === '6M' 
                    ? 'bg-[#2A2A2A] text-white shadow-sm' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-white bg-[#1A1A1A] rounded-lg transition-colors">
              <Calendar className="h-5 w-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white bg-[#1A1A1A] rounded-lg transition-colors">
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorTSLA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorConnections" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} />
            <XAxis 
              dataKey="date" 
              hide 
            />
            <YAxis 
              yAxisId="tsli"
              domain={[95, 100]} 
              orientation="left" 
              tick={{ fill: '#666' }} 
              axisLine={false}
              tickLine={false}
              ticks={[95, 96, 97, 98, 99, 100]}
            />
            <YAxis 
              yAxisId="connections"
              domain={[30, 80]} 
              orientation="right" 
              tick={{ fill: '#666' }} 
              axisLine={false}
              tickLine={false}
              ticks={[30, 40, 50, 60, 70, 80]}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#1A1A1A] border border-[#333] p-3 rounded-lg shadow-xl">
                      <div className="space-y-2">
                        <p className="text-white font-medium">
                          <span className="text-blue-400">Connections:</span> {payload[0]?.payload?.connections || 'N/A'}
                        </p>
                        <p className="text-white font-medium">
                          <span className="text-green-400">TSLA:</span> {payload.find(p => p.dataKey === 'tsli')?.value?.toFixed(1)}%
                        </p>
                        <p className="text-gray-400 text-sm">
                          {payload[0]?.payload?.date}
                        </p>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            
            <Area 
              yAxisId="tsli"
              type="monotone" 
              dataKey="tsli" 
              stroke="#22c55e" 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#colorTSLA)" 
            />
            <Area 
              yAxisId="connections"
              type="monotone" 
              dataKey="connections" 
              stroke="#3b82f6" 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#colorConnections)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-[#1A1A1A] rounded-lg p-4 border border-[#333]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-sm font-medium text-gray-400">Avg TSLA</span>
          </div>
          <p className="text-2xl font-bold text-white">98.2%</p>
          <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
        </div>
        
        <div className="bg-[#1A1A1A] rounded-lg p-4 border border-[#333]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-sm font-medium text-gray-400">Avg Connections</span>
          </div>
          <p className="text-2xl font-bold text-white">51</p>
          <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
        </div>
        
        <div className="bg-[#1A1A1A] rounded-lg p-4 border border-[#333]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
            <span className="text-sm font-medium text-gray-400">Peak Connections</span>
          </div>
          <p className="text-2xl font-bold text-white">78</p>
          <p className="text-xs text-gray-500 mt-1">Jan 28</p>
        </div>
      </div>
    </div>
  )
}
