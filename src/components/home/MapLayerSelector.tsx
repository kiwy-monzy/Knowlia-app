import React, { useState } from 'react';

interface MapLayerSelectorProps {
  onLayerChange?: (layer: string) => void;
  className?: string;
}

const MapLayerSelector: React.FC<MapLayerSelectorProps> = ({ onLayerChange, className = "" }) => {
  const [selectedLayer, setSelectedLayer] = useState('Google Street');
  
  const layers = [
    { 
      id: 'google-street', 
      name: 'Google Street', 
      image: 'https://tiles.stadiamaps.com/tiles/stamen_terrain_lines/14/8192/8192.png',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0NCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yIDJIMTJWMTJIMloiIGZpbGw9IiM2YjcyODAiLz4KPHBhdGggZD0iTTE0IDJIMjJWMTJIMTRaIiBmaWxsPSIjOWNhM2FmIi8+CjxwYXRoIGQ9Ik0yNiAySDQyVjEySDI2WiIgZmlsbD0iIzY2NzQ4MCIvPgo8cGF0aCBkPSJNMiAxNEgxMlYyMkgyWiIgZmlsbD0iIzM0ZDc4MSIvPgo8cGF0aCBkPSJNMTQgMTRIMjJWMjJIMTRaIiBmaWxsPSIjZjU5ZTBiIi8+CjxwYXRoIGQ9Ik0yNiAxNEg0MlYyMkgyNloiIGZpbGw9IiNlZjQ0NDQiLz4KPC9zdmc+'
    },
    { 
      id: 'google-satellite', 
      name: 'Google Satellite', 
      image: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/8192/8192',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0NCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMTY0ZTNiIi8+CjxwYXRoIGQ9Ik0yIDJIMTJWMTJIMloiIGZpbGw9IiMxNjVzMzciLz4KPHBhdGggZD0iTTE0IDJIMjJWMTJIMTRaIiBmaWxsPSIjMTU4MDNkIi8+CjxwYXRoIGQ9Ik0yNiAySDQyVjEySDI2WiIgZmlsbD0iIzE2NGUzYiIvPgo8cGF0aCBkPSJNMiAxNEgxMlYyMkgyWiIgZmlsbD0iIzE2NGUzYiIvPgo8cGF0aCBkPSJNMTQgMTRIMjJWMjJIMTRaIiBmaWxsPSIjMTU4MDNkIi8+CjxwYXRoIGQ9Ik0yNiAxNEg0MlYyMkgyNloiIGZpbGw9IiMxNjRlM2IiLz4KPC9zdmc+'
    },
    { 
      id: 'jigaw-street', 
      name: 'Jigaw Street', 
      image: 'https://tiles.stadiamaps.com/tiles/stamen_terrain_lines/14/8192/8192.png',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0NCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yIDJIMTJWMTJIMloiIGZpbGw9IiM2YjcyODAiLz4KPHBhdGggZD0iTTE0IDJIMjJWMTJIMTRaIiBmaWxsPSIjOWNhM2FmIi8+CjxwYXRoIGQ9Ik0yNiAySDQyVjEySDI2WiIgZmlsbD0iIzY2NzQ4MCIvPgo8cGF0aCBkPSJNMiAxNEgxMlYyMkgyWiIgZmlsbD0iIzM0ZDc4MSIvPgo8cGF0aCBkPSJNMTQgMTRIMjJWMjJIMTRaIiBmaWxsPSIjZjU5ZTBiIi8+CjxwYXRoIGQ9Ik0yNiAxNEg0MlYyMkgyNloiIGZpbGw9IiNlZjQ0NDQiLz4KPC9zdmc+'
    },
    { 
      id: 'jigaw-satellite', 
      name: 'Jigaw Satellite', 
      image: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/14/8192/8192',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0NCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMTY0ZTNiIi8+CjxwYXRoIGQ9Ik0yIDJIMTJWMTJIMloiIGZpbGw9IiMxNjVzMzciLz4KPHBhdGggZD0iTTE0IDJIMjJWMTJIMTRaIiBmaWxsPSIjMTU4MDNkIi8+CjxwYXRoIGQ9Ik0yNiAySDQyVjEySDI2WiIgZmlsbD0iIzE2NGUzYiIvPgo8cGF0aCBkPSJNMiAxNEgxMlYyMkgyWiIgZmlsbD0iIzE2NGUzYiIvPgo8cGF0aCBkPSJNMTQgMTRIMjJWMjJIMTRaIiBmaWxsPSIjMTU4MDNkIi8+CjxwYXRoIGQ9Ik0yNiAxNEg0MlYyMkgyNloiIGZpbGw9IiMxNjRlM2IiLz4KPC9zdmc+'
    },
    { 
      id: 'openstreetmap', 
      name: 'OpenStreetMap', 
      image: 'https://tile.openstreetmap.org/14/8192/8192.png',
      thumbnail: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA0NCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yIDJIMTJWMTJIMloiIGZpbGw9IiM2YjcyODAiLz4KPHBhdGggZD0iTTE0IDJIMjJWMTJIMTRaIiBmaWxsPSIjOWNhM2FmIi8+CjxwYXRoIGQ9Ik0yNiAySDQyVjEySDI2WiIgZmlsbD0iIzY2NzQ4MCIvPgo8cGF0aCBkPSJNMiAxNEgxMlYyMkgyWiIgZmlsbD0iIzM0ZDc4MSIvPgo8cGF0aCBkPSJNMTQgMTRIMjJWMjJIMTRaIiBmaWxsPSIjZjU5ZTBiIi8+CjxwYXRoIGQ9Ik0yNiAxNEg0MlYyMkgyNloiIGZpbGw9IiNlZjQ0NDQiLz4KPC9zdmc+'
    }
  ];

  const handleLayerSelect = (layer: string) => {
    setSelectedLayer(layer);
    onLayerChange?.(layer);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main SVG Component */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        xmlnsXlink="http://www.w3.org/1999/xlink" 
        width="400" 
        height="120" 
        viewBox="0 0 400 120"
        className="w-full h-auto"
      >
        <defs>
          <filter id="Rectangle_4" x="0" y="0" width="400" height="120" filterUnits="userSpaceOnUse">
            <feOffset dy="3" in="SourceAlpha"/>
            <feGaussianBlur stdDeviation="6" result="blur"/>
            <feFlood floodOpacity="0.161"/>
            <feComposite operator="in" in2="blur"/>
            <feComposite in="SourceGraphic"/>
          </filter>
        </defs>
        
        {/* Main preview area */}
        <g 
          id="Group_38" 
          data-name="Group 38" 
          transform="translate(10 10)"
          className="cursor-pointer hover:scale-105 transition-transform"
          onClick={() => handleLayerSelect(selectedLayer)}
          style={{ cursor: 'pointer' }}
        >
          <g transform="matrix(1, 0, 0, 1, 0, 0)" filter="url(#Rectangle_4)">
            <rect 
              width="120" 
              height="100" 
              rx="12" 
              transform="translate(0 0)" 
              fill="#fff"
              stroke="#e5e7eb"
              strokeWidth="1"
              className="transition-all duration-200 hover:fill-gray-50 hover:stroke-gray-300"
            />
          </g>
          
          {/* Title text */}
          <text 
            transform="translate(10 20)" 
            fill="#1a1a1a" 
            fontSize="11" 
            fontFamily="Arial-BoldMT, Arial" 
            fontWeight="700"
            className="select-none pointer-events-none"
          >
            <tspan x="0" y="0">{selectedLayer}</tspan>
          </text>
          
          {/* Thumbnail area */}
          <rect 
            width="100" 
            height="60" 
            rx="8" 
            transform="translate(10 30)"
            fill="#1a1a1a"
            stroke="#374151"
            strokeWidth="0.5"
            className="transition-all duration-200 hover:fill-gray-800"
          />
          
          {/* Click indicator */}
          <text 
            transform="translate(10 95)" 
            fill="#666" 
            fontSize="6" 
            fontFamily="Arial" 
            className="select-none pointer-events-none"
          >
            <tspan x="0" y="0">Click to select</tspan>
          </text>
        </g>

        {/* Layer buttons - each as a separate Group_38 */}
        {layers.map((layer, index) => (
          <g 
            key={layer.id}
            id={`Group_38_${index}`} 
            data-name={`Group 38 ${index}`} 
            transform={`translate(${140 + index * 50}, 10)`}
            className="cursor-pointer hover:scale-105 transition-transform"
            onClick={() => handleLayerSelect(layer.name)}
            style={{ cursor: 'pointer' }}
          >
            {/* Button shadow/filter */}
            <g transform="matrix(1, 0, 0, 1, 0, 0)" filter="url(#Rectangle_4)">
              <rect 
                width="45" 
                height="100" 
                rx="8" 
                transform="translate(0 0)" 
                fill={selectedLayer === layer.name ? "#3b82f6" : "#fff"}
                stroke={selectedLayer === layer.name ? "#1e40af" : "#e5e7eb"}
                strokeWidth="1"
                className="transition-all duration-200 hover:fill-gray-50 hover:stroke-gray-300"
              />
            </g>
            
            {/* Button text - first part */}
            <text 
              transform="translate(5 18)" 
              fill={selectedLayer === layer.name ? "#fff" : "#1a1a1a"} 
              fontSize="7" 
              fontFamily="Arial-BoldMT, Arial" 
              fontWeight="700"
              className="select-none pointer-events-none"
            >
              <tspan x="0" y="0">{layer.name.split(' ')[0]}</tspan>
            </text>
            
            {/* Mini thumbnail */}
            <rect 
              width="35" 
              height="25" 
              rx="4" 
              transform="translate(5 28)"
              fill={selectedLayer === layer.name ? "#1e40af" : "#1a1a1a"}
              stroke={selectedLayer === layer.name ? "#3b82f6" : "#374151"}
              strokeWidth="0.5"
              className="transition-all duration-200"
            />
            
            {/* Layer type indicator */}
            <text 
              transform="translate(5 65)" 
              fill={selectedLayer === layer.name ? "#fff" : "#666"} 
              fontSize="6" 
              fontFamily="Arial" 
              className="select-none pointer-events-none"
            >
              <tspan x="0" y="0">{layer.name.split(' ')[1] || ''}</tspan>
            </text>
            
            {/* Selection indicator dot */}
            {selectedLayer === layer.name && (
              <circle 
                cx="22.5" 
                cy="85" 
                r="3" 
                fill="#fff"
                className="pointer-events-none"
              />
            )}
          </g>
        ))}
      </svg>

      {/* Image Display Area - Inside the main preview area */}
      <div className="absolute top-16 left-6 w-24 h-14 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
        {selectedLayer && (
          <img 
            src={layers.find(l => l.name === selectedLayer)?.thumbnail || layers[0].thumbnail} 
            alt={selectedLayer}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to a default thumbnail if the specified thumbnail fails to load
              e.currentTarget.src = layers[0].thumbnail;
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MapLayerSelector;
