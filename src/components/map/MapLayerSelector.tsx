import React, { useState } from 'react';
import { mapLayers } from '@/data/mockData';
import { Layers, Building2, Eye, EyeOff } from 'lucide-react';

interface MapLayerSelectorProps {
  onLayerChange?: (layer: string) => void;
  onGeoJSONLayerToggle?: (layerName: string, visible: boolean) => void;
  className?: string;
}

interface BuildingLayer {
  name: string;
  color: string;
  zIndex: number;
  visible: boolean;
  height: number; // Visual height for stacking representation
}

const MapLayerSelector: React.FC<MapLayerSelectorProps> = ({ 
  onLayerChange, 
  onGeoJSONLayerToggle,
  className = "" 
}) => {
  const [showBuildingLayers, setShowBuildingLayers] = useState(true);
  const [rotation, setRotation] = useState(0);
  
  // Convert mapLayers to building layers with z-index
  const buildingLayers: BuildingLayer[] = mapLayers.map((layer, index) => ({
    name: layer.name,
    color: layer.style.fillColor,
    zIndex: index + 1,
    visible: layer.visible,
    height: (index + 1) * 8 // Each layer adds 8px height
  })).reverse(); // Reverse to show top layers first

  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(
    Object.fromEntries(buildingLayers.map(l => [l.name, l.visible]))
  );

  const toggleLayerVisibility = (layerName: string) => {
    const newVisibility = !layerVisibility[layerName];
    setLayerVisibility(prev => ({
      ...prev,
      [layerName]: newVisibility
    }));
    onGeoJSONLayerToggle?.(layerName, newVisibility);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 45) % 360);
  };

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        color: 'white',
        borderRadius: 16,
        padding: '20px',
        fontSize: 14,
        fontWeight: '500',
        zIndex: 1200,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.1) inset',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        minWidth: '320px',
        maxWidth: '400px'
      }} 
      className={className}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={20} color="#60a5fa" />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            Building Layers
          </h3>
        </div>
        <button
          onClick={() => setShowBuildingLayers(!showBuildingLayers)}
          style={{
            background: 'rgba(96, 165, 250, 0.2)',
            border: '1px solid rgba(96, 165, 250, 0.3)',
            borderRadius: '8px',
            padding: '6px 12px',
            color: '#60a5fa',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          {showBuildingLayers ? 'Hide' : 'Show'}
        </button>
      </div>

      {showBuildingLayers && (
        <>
          {/* 3D Building Visualization */}
          <div style={{
            marginBottom: '20px',
            padding: '20px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
                LAYER STACK PREVIEW
              </span>
              <button
                onClick={handleRotate}
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: '#a78bfa',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
              >
                🔄 Rotate
              </button>
            </div>
            
            {/* 3D Isometric Stack */}
            <div style={{
              perspective: '1000px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              height: '180px',
              position: 'relative',
              transform: `rotateY(${rotation}deg)`,
              transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
              {buildingLayers.map((layer, index) => {
                const isVisible = layerVisibility[layer.name];
                const stackHeight = buildingLayers
                  .slice(index)
                  .filter(l => layerVisibility[l.name])
                  .reduce((sum, l) => sum + l.height, 0);
                
                return isVisible ? (
                  <div
                    key={layer.name}
                    style={{
                      position: 'absolute',
                      bottom: `${stackHeight - layer.height}px`,
                      width: '140px',
                      height: `${layer.height}px`,
                      background: `linear-gradient(135deg, ${layer.color} 0%, ${layer.color}dd 100%)`,
                      border: `2px solid ${layer.color}`,
                      borderRadius: '4px',
                      boxShadow: `
                        0 4px 12px rgba(0, 0, 0, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2),
                        0 0 20px ${layer.color}40
                      `,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: 'white',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                      transform: 'rotateX(5deg)',
                      transformStyle: 'preserve-3d',
                      transition: 'all 0.3s ease',
                      zIndex: layer.zIndex,
                      opacity: 0.95
                    }}
                  >
                    <span style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {layer.name}
                    </span>
                    
                    {/* Z-Index Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: '800',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                    }}>
                      {layer.zIndex}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>

          {/* Layer Controls */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#94a3b8',
              fontWeight: '600',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Layers size={14} />
              LAYER CONTROLS
            </div>
            
            {buildingLayers.map((layer) => (
              <div
                key={layer.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: layerVisibility[layer.name] 
                    ? 'rgba(96, 165, 250, 0.1)' 
                    : 'rgba(71, 85, 105, 0.1)',
                  border: `1px solid ${layerVisibility[layer.name] 
                    ? 'rgba(96, 165, 250, 0.3)' 
                    : 'rgba(71, 85, 105, 0.2)'}`,
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onClick={() => toggleLayerVisibility(layer.name)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Color Indicator */}
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: `linear-gradient(135deg, ${layer.color} 0%, ${layer.color}cc 100%)`,
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: `0 2px 8px ${layer.color}40`
                  }} />
                  
                  {/* Layer Info */}
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: layerVisibility[layer.name] ? '#f1f5f9' : '#94a3b8'
                    }}>
                      {layer.name}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#64748b',
                      marginTop: '2px'
                    }}>
                      z-index: {layer.zIndex}
                    </div>
                  </div>
                </div>

                {/* Toggle Button */}
                <button
                  style={{
                    background: layerVisibility[layer.name]
                      ? 'rgba(34, 197, 94, 0.2)'
                      : 'rgba(239, 68, 68, 0.2)',
                    border: `1px solid ${layerVisibility[layer.name]
                      ? 'rgba(34, 197, 94, 0.3)'
                      : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: layerVisibility[layer.name] ? '#22c55e' : '#ef4444',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisibility(layer.name);
                  }}
                >
                  {layerVisibility[layer.name] ? (
                    <>
                      <Eye size={12} />
                      ON
                    </>
                  ) : (
                    <>
                      <EyeOff size={12} />
                      OFF
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Info Footer */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            fontSize: '11px',
            color: '#93c5fd',
            lineHeight: '1.5'
          }}>
            <strong>💡 Tip:</strong> Layers stack on top of each other with z-index. 
            Higher numbers appear on top. Toggle layers to see the building structure.
          </div>
        </>
      )}
    </div>
  );
};

export default MapLayerSelector;
