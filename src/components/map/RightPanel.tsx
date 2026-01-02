import React from 'react';
import './RightPanel.css';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFeature?: any;
}

const RightPanel: React.FC<RightPanelProps> = ({ isOpen, onClose, selectedFeature }) => {
  if (!isOpen) return null;

  return (
    <div className="right-panel-overlay">
      <div className="right-panel">
        <div className="panel-header">
          <h3>Building Details</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="panel-content">
          {selectedFeature ? (
            <div className="feature-details">
              <div className="feature-header">
                {selectedFeature.logo && (
                  <img 
                    src={selectedFeature.logo} 
                    alt="Building Logo" 
                    className="feature-logo"
                  />
                )}
                <div className="feature-title">
                  <h4>{selectedFeature.building_name || selectedFeature.name || 'Building'}</h4>
                  {selectedFeature.location && (
                    <p className="feature-location">📍 {selectedFeature.location}</p>
                  )}
                </div>
              </div>

              {selectedFeature.image && (
                <div className="feature-image">
                  <img 
                    src={selectedFeature.image} 
                    alt={selectedFeature.building_name || selectedFeature.name}
                    className="building-image"
                  />
                </div>
              )}

              {selectedFeature.description && (
                <div className="feature-description">
                  <p>{selectedFeature.description}</p>
                </div>
              )}

              <div className="feature-info">
                {Object.entries(selectedFeature)
                  .filter(([key]) => !['style', 'logo', 'image', 'description', 'name', 'building_name'].includes(key))
                  .map(([key, value]) => {
                    if (typeof value === 'object') return null;
                    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return (
                      <div key={key} className="info-item">
                        <span className="info-label">{formattedKey}:</span>
                        <span className="info-value">{String(value)}</span>
                      </div>
                    );
                  })}
              </div>

              {selectedFeature.facilities && Array.isArray(selectedFeature.facilities) && (
                <div className="facilities-section">
                  <h5>Facilities</h5>
                  <ul className="facilities-list">
                    {selectedFeature.facilities.map((facility: string, index: number) => (
                      <li key={index}>{facility}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="contact-info">
                {selectedFeature.contact && (
                  <div className="contact-item">
                    <span className="contact-icon">📞</span>
                    <span>{selectedFeature.contact}</span>
                  </div>
                )}
                {selectedFeature.hours && (
                  <div className="contact-item">
                    <span className="contact-icon">🕒</span>
                    <span>{selectedFeature.hours}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>Click on a building to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightPanel;

