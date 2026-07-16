import React from 'react';

const SceneNodeList = ({ 
  scenes, 
  activeSceneIndex, 
  setActiveSceneIndex, 
  startSceneTempId, 
  handleAddScene, 
  handleDeleteScene 
}) => {
  return (
    <div className="sidebar-section scenes-list-box">
      <div className="section-header">
        <h3>Nodos de Escenas ({scenes.length})</h3>
        <button 
          onClick={handleAddScene} 
          className="btn-add-circle" 
          title="Añadir Escena"
        >
          +
        </button>
      </div>
      
      <div className="nodes-list">
        {scenes.map((scene, idx) => (
          <div 
            key={scene.temp_id}
            className={`node-item ${activeSceneIndex === idx ? 'active' : ''} ${startSceneTempId === scene.temp_id ? 'start-node' : ''}`}
            onClick={() => setActiveSceneIndex(idx)}
          >
            <div className="node-info">
              <span className="node-title">{scene.title}</span>
              <span className="node-subtitle">
                {scene.choices.length} {scene.choices.length === 1 ? 'decisión' : 'decisiones'}
              </span>
            </div>
            <button 
              className="btn-delete-node" 
              onClick={(e) => handleDeleteScene(idx, e)}
              title="Eliminar escena"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SceneNodeList;
