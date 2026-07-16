import React, { useState } from 'react';

const SceneChoicesForm = ({ 
  choices, 
  scenes, 
  handleAddChoice, 
  handleUpdateChoice, 
  handleRemoveChoice,
  storyResources,
  currentSceneTitle,
  currentSceneDesc,
  token,
  onSuggestChoices
}) => {
  const [generating, setGenerating] = useState(false);

  const handleSuggestChoices = async () => {
    if (!currentSceneDesc) {
      alert('Escribe una descripción en la escena primero para que la IA tenga contexto.');
      return;
    }
    setGenerating(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://127.0.0.1:8000/api/ai/generate/', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          type: 'choices',
          current_scene_context: { title: currentSceneTitle, description: currentSceneDesc }
        })
      });
      if (!response.ok) throw new Error('Error al sugerir opciones');
      const data = await response.json();
      if (Array.isArray(data)) {
        onSuggestChoices(data);
      }
    } catch (err) {
      console.error(err);
      alert('Error al obtener sugerencias de decisiones.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="editor-card col-span-2">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0 }}>Decisiones / Opciones del Jugador ({choices.length})</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button"
            onClick={handleSuggestChoices}
            disabled={generating}
            className="btn"
            style={{ padding: '8px 12px', fontSize: '0.8rem', background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.2)', color: '#c084fc', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {generating ? '✨ Pensando...' : '✨ Sugerir Opciones con IA'}
          </button>
          <button 
            onClick={handleAddChoice} 
            className="btn btn-add-choice"
          >
            + Añadir Opción
          </button>
        </div>
      </div>

      {choices.length === 0 ? (
        <p className="no-choices-text">
          Esta escena no tiene opciones. Será tratada como un nodo final (Fin de la aventura).
        </p>
      ) : (
        <div className="choices-editor-list">
          {choices.map((choice, choiceIdx) => (
            <div key={choiceIdx} className="choice-editor-row-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '8px' }}>
              
              <div className="choice-editor-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="form-group flex-2" style={{ minWidth: '200px', margin: 0 }}>
                  <label htmlFor={`choice-text-${choiceIdx}`}>Texto del Botón</label>
                  <input 
                    id={`choice-text-${choiceIdx}`}
                    type="text" 
                    value={choice.text}
                    onChange={(e) => handleUpdateChoice(choiceIdx, 'text', e.target.value)}
                  />
                </div>
                
                <div className="form-group flex-2" style={{ minWidth: '200px', margin: 0 }}>
                  <label htmlFor={`choice-target-${choiceIdx}`}>Escena Destino (next_scene)</label>
                  <select 
                    id={`choice-target-${choiceIdx}`}
                    value={choice.next_scene_temp_id}
                    onChange={(e) => handleUpdateChoice(choiceIdx, 'next_scene_temp_id', e.target.value)}
                  >
                    <option value="">-- Conectar con... --</option>
                    {scenes.map(s => (
                      <option key={s.temp_id} value={s.temp_id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  className="btn btn-remove-choice"
                  onClick={() => handleRemoveChoice(choiceIdx)}
                  title="Eliminar esta opción"
                  style={{ alignSelf: 'flex-end', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                >
                  Eliminar
                </button>
              </div>

              {/* Dynamic resource impacts inputs */}
              {storyResources && storyResources.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', marginTop: '6px', background: 'rgba(255, 255, 255, 0.01)', padding: '10px', borderRadius: '6px', border: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#9ca3af', width: '100%', marginBottom: '2px' }}>
                    Impacto en Recursos del Jugador al elegir esta opción:
                  </span>
                  {storyResources.map(res => {
                    const impacts = choice.resource_impacts || [];
                    const currentImpact = impacts.find(imp => imp.resource_temp_id === res.temp_id || imp.resource_id === res.temp_id);
                    const impactValue = currentImpact ? currentImpact.impact_value : 0;

                    const handleLocalImpactChange = (e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      let newImpacts = [...impacts];
                      const idx = newImpacts.findIndex(imp => imp.resource_temp_id === res.temp_id || imp.resource_id === res.temp_id);
                      if (idx >= 0) {
                        newImpacts[idx] = { ...newImpacts[idx], impact_value: val };
                      } else {
                        newImpacts.push({
                          resource_temp_id: res.temp_id,
                          resource_id: res.temp_id,
                          impact_value: val
                        });
                      }
                      handleUpdateChoice(choiceIdx, 'resource_impacts', newImpacts);
                    };

                    return (
                      <div key={res.temp_id || res.id} className="form-group" style={{ minWidth: '90px', flex: 1, margin: 0 }}>
                        <label style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'none', marginBottom: '2px' }}>{res.name} (+/-)</label>
                        <input 
                          type="number" 
                          value={impactValue}
                          onChange={handleLocalImpactChange}
                          style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SceneChoicesForm;
