import React from 'react';

const StoryMetaForm = ({ 
  title, 
  setTitle, 
  description, 
  setDescription, 
  startSceneTempId, 
  setStartSceneTempId, 
  isPublic,
  setIsPublic,
  scenes,
  storyResources,
  onAddResource,
  onUpdateResource,
  onRemoveResource
}) => {
  return (
    <div className="sidebar-section story-meta-box">
      <h3>Metadatos de la Historia</h3>
      
      <div className="form-group">
        <label htmlFor="story-title">Título General</label>
        <input 
          id="story-title"
          type="text" 
          placeholder="Ej. El Enigma Ancestral" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="story-desc">Descripción Corta</label>
        <textarea 
          id="story-desc"
          placeholder="Sinopsis atractiva para los jugadores..." 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <input 
          id="story-public"
          type="checkbox" 
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          style={{ width: 'auto', cursor: 'pointer' }}
        />
        <label htmlFor="story-public" style={{ margin: 0, cursor: 'pointer', display: 'inline' }}>
          Historia Pública (Visible para todos)
        </label>
      </div>
      
      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label htmlFor="story-start">Punto de Entrada (Inicio)</label>
        <select 
          id="story-start"
          value={startSceneTempId}
          onChange={(e) => setStartSceneTempId(e.target.value)}
        >
          {scenes.map(s => (
            <option key={s.temp_id} value={s.temp_id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      {/* --- Dynamic Resource System Section (Open/Scalable) --- */}
      <div className="resource-config-section" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9ca3af' }}>
            Recursos de la Historia ({storyResources.length})
          </h4>
          <button 
            type="button"
            onClick={onAddResource}
            className="btn btn-hud"
            style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Añadir
          </button>
        </div>

        {storyResources.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic', margin: '8px 0 0 0' }}>
            No hay recursos configurados. Esta historia no utilizará el sistema de recursos.
          </p>
        ) : (
          <div className="resources-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {storyResources.map((res, index) => (
              <div 
                key={res.temp_id || res.id} 
                className="resource-card-editor animate-fade-in" 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  position: 'relative'
                }}
              >
                {/* Delete resource button */}
                <button
                  type="button"
                  onClick={() => onRemoveResource(index)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    padding: '0 4px'
                  }}
                  title="Eliminar Recurso"
                >
                  ×
                </button>

                <div className="form-group" style={{ marginBottom: '8px', paddingRight: '20px' }}>
                  <label style={{ fontSize: '0.75rem' }}>Nombre del Recurso</label>
                  <input 
                    type="text" 
                    value={res.name}
                    placeholder="Ej. Energía, Salud"
                    onChange={(e) => onUpdateResource(index, 'name', e.target.value)}
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem' }}>Val. Inicial</label>
                    <input 
                      type="number" 
                      value={res.initial_value}
                      onChange={(e) => onUpdateResource(index, 'initial_value', parseInt(e.target.value, 10) || 0)}
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.75rem' }}>Límite</label>
                    <input 
                      type="number" 
                      value={res.trigger_limit}
                      onChange={(e) => onUpdateResource(index, 'trigger_limit', parseInt(e.target.value, 10) || 0)}
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem' }}>Regla de Límite</label>
                  <select 
                    value={res.trigger_condition}
                    onChange={(e) => onUpdateResource(index, 'trigger_condition', e.target.value)}
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                  >
                    <option value="LTE">Menor o igual que (&lt;=)</option>
                    <option value="GTE">Mayor o igual que (&gt;=)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>Escena Game Over</label>
                  <select 
                    value={res.game_over_scene_temp_id}
                    onChange={(e) => onUpdateResource(index, 'game_over_scene_temp_id', e.target.value)}
                    style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                  >
                    <option value="">-- Sin redirección (Continuar) --</option>
                    {scenes.map(s => (
                      <option key={s.temp_id} value={s.temp_id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryMetaForm;
