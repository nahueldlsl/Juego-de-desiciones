import React, { useState } from 'react';

const SceneGeneralForm = ({ 
  title, 
  description, 
  onUpdateField,
  storyContext,
  token
}) => {
  const [generating, setGenerating] = useState(false);

  const handleGenerateAI = async () => {
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
          type: 'scene_content',
          story_context: storyContext
        })
      });
      if (!response.ok) throw new Error('Error en generación de IA');
      const data = await response.json();
      if (data.title) onUpdateField('title', data.title);
      if (data.description) onUpdateField('description', data.description);
    } catch (err) {
      console.error(err);
      alert('No se pudo autocompletar la escena con IA.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="editor-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0 }}>Información General</h4>
        <button 
          type="button" 
          onClick={handleGenerateAI}
          disabled={generating}
          className="btn"
          style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', gap: '4px', alignItems: 'center' }}
        >
          {generating ? '✨ Escribiendo...' : '✨ Autocompletar con IA'}
        </button>
      </div>
      
      <div className="form-group">
        <label htmlFor="scene-title-input">Título de la Escena</label>
        <input 
          id="scene-title-input"
          type="text" 
          value={title}
          onChange={(e) => onUpdateField('title', e.target.value)}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="scene-desc-input">Contenido Narrativo / Descripción</label>
        <textarea 
          id="scene-desc-input"
          rows={5}
          placeholder="Escribe la historia que el jugador leerá en esta escena..."
          value={description}
          onChange={(e) => onUpdateField('description', e.target.value)}
        />
      </div>
    </div>
  );
};

export default SceneGeneralForm;
