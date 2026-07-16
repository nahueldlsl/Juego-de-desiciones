import React from 'react';
import './ResourceHUD.css';

const ResourceHUD = ({ storyResources, resources }) => {
  if (!storyResources || storyResources.length === 0) return null;

  return (
    <div className="resource-hud-overlay">
      {storyResources.map((res, index) => {
        const val = resources[res.id] !== undefined ? resources[res.id] : res.initial_value;
        const {
          name,
          initial_value,
          trigger_limit,
          trigger_condition
        } = res;

        // Calculate progress percentage
        // In GTE (Toxicity/Threat) style: 0 is empty, trigger_limit is full
        // In LTE (Energy/Money) style: initial_value is full, trigger_limit is empty
        let pct = 100;
        if (trigger_condition === 'LTE') {
          const range = initial_value - trigger_limit;
          pct = range > 0 ? ((val - trigger_limit) / range) * 100 : 100;
        } else {
          const range = trigger_limit - initial_value;
          pct = range > 0 ? ((val - initial_value) / range) * 100 : 0;
          // In GTE, we want the bar to fill up as it gets closer to GTE limit, so:
          // pct is the danger percent (which fills the bar). That is very intuitive!
        }
        
        pct = Math.max(0, Math.min(100, pct));

        // Determine if value is critical (within 25% of the limit trigger value)
        let isLow = false;
        if (trigger_condition === 'LTE') {
          isLow = val <= trigger_limit + (initial_value - trigger_limit) * 0.25;
        } else {
          isLow = val >= trigger_limit - (trigger_limit - initial_value) * 0.25;
        }

        // Color theme list to differentiate multiple resources dynamically
        const fillClasses = [
          'resource-1-fill',
          'resource-2-fill',
          'resource-3-fill',
          'resource-4-fill'
        ];
        const fillClass = fillClasses[index % fillClasses.length];

        return (
          <div key={res.id || index} className={`resource-card ${isLow ? 'alert-critical' : ''}`}>
            <div className="resource-meta">
              <span className="resource-label">{name}</span>
              <span className="resource-value">
                {val} <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>/ {trigger_condition === 'LTE' ? `min:${trigger_limit}` : `max:${trigger_limit}`}</span>
              </span>
            </div>
            <div className="progress-track">
              <div 
                className={`progress-fill ${fillClass}`} 
                style={{ width: `${pct}%` }}
              ></div>
            </div>
            {isLow && <span className="warning-text animate-pulse">CRÍTICO ⚠️</span>}
          </div>
        );
      })}
    </div>
  );
};

export default ResourceHUD;
