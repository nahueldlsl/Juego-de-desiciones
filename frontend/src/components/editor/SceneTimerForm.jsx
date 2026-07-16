import React from 'react';

const SceneTimerForm = ({ 
  timerDuration, 
  defaultNextSceneTempId, 
  scenes, 
  currentSceneTempId, 
  onUpdateField 
}) => {
  return (
    <div className="editor-card">
      <h4>Restricción de Tiempo (Temporizador)</h4>
      
      <div className="form-group">
        <label htmlFor="timer-duration-input">Duración (segundos)</label>
        <input 
          id="timer-duration-input"
          type="number" 
          min="1"
          placeholder="Dejar vacío para tiempo ilimitado"
          value={timerDuration}
          onChange={(e) => onUpdateField('timer_duration', e.target.value)}
        />
        <span className="field-hint">Segundos máximos para decidir.</span>
      </div>

      {timerDuration && (
        <div className="form-group animate-fade-in">
          <label htmlFor="fallback-scene-select">Escena de Contingencia (Timeout Fallback)</label>
          <select 
            id="fallback-scene-select"
            value={defaultNextSceneTempId}
            onChange={(e) => onUpdateField('default_next_scene_temp_id', e.target.value)}
          >
            <option value="">-- Elige una escena destino --</option>
            {scenes
              .filter(s => s.temp_id !== currentSceneTempId)
              .map(s => (
                <option key={s.temp_id} value={s.temp_id}>
                  {s.title}
                </option>
              ))}
          </select>
          <span className="field-hint">Adónde irá el juego si se acaba el tiempo.</span>
        </div>
      )}
    </div>
  );
};

export default SceneTimerForm;
