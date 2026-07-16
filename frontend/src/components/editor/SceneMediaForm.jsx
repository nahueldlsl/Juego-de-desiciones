import React, { useState, useEffect } from 'react';

const SceneMediaForm = ({ 
  mediaType, 
  decisionTriggerTime, 
  pauseOnDecision, 
  selectedFileName,
  onUpdateField,
  onFileSelect,
  currentSceneTitle,
  currentSceneDesc,
  currentSceneTempId,
  storyContext,
  scenes,
  token,
  onAIImageGenerated,
  mediaUrl,
  localFile
}) => {
  const [generating, setGenerating] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');

  useEffect(() => {
    if (!localFile) {
      setLocalPreviewUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(localFile);
    setLocalPreviewUrl(objectUrl);
    
    return () => URL.revokeObjectURL(objectUrl);
  }, [localFile]);

  const previewSrc = localPreviewUrl || mediaUrl;

  const handleGenerateImage = async () => {
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
          type: 'image',
          story_context: storyContext,
          current_scene_context: { title: currentSceneTitle, description: currentSceneDesc },
          scenes: scenes,
          current_temp_id: currentSceneTempId
        })
      });
      if (!response.ok) throw new Error('Error al generar la ilustración');
      const data = await response.json();
      if (data.image_url) {
        onAIImageGenerated(data.image_url);
      }
    } catch (err) {
      console.error(err);
      alert('Error en generación de imagen.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="editor-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0 }}>Configuración Multimedia</h4>
        {mediaType === 'IMAGE' && (
          <button 
            type="button"
            onClick={handleGenerateImage}
            disabled={generating}
            className="btn"
            style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
          >
            {generating ? '✨ Dibujando...' : '✨ Ilustrar con IA'}
          </button>
        )}
      </div>
      
      <div className="form-group">
        <label>Tipo de Media</label>
        <div className="radio-group">
          <label className="radio-label">
            <input 
              type="radio" 
              name="media_type_radio" 
              value="IMAGE"
              checked={mediaType === 'IMAGE'}
              onChange={() => onUpdateField('media_type', 'IMAGE')}
            />
            Imagen
          </label>
          <label className="radio-label">
            <input 
              type="radio" 
              name="media_type_radio" 
              value="VIDEO"
              checked={mediaType === 'VIDEO'}
              onChange={() => onUpdateField('media_type', 'VIDEO')}
            />
            Video
          </label>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label htmlFor="media-file-input">Adjuntar Archivo Local ({mediaType === 'IMAGE' ? 'Imagen' : 'Video'})</label>
        <input 
          id="media-file-input"
          type="file" 
          accept={mediaType === 'IMAGE' ? 'image/*' : 'video/*'}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) onFileSelect(file);
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            cursor: 'pointer',
            padding: '8px'
          }}
        />
        {selectedFileName && (
          <span className="field-hint" style={{ color: '#c084fc', display: 'block', marginTop: '6px' }}>
            Seleccionado: 📂 {selectedFileName}
          </span>
        )}
      </div>

      {previewSrc && (
        <div className="media-preview-container" style={{ marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '8px', textAlign: 'left', fontWeight: 'bold' }}>
            Previsualización Activa:
          </span>
          {mediaType === 'IMAGE' ? (
            <img 
              src={previewSrc} 
              alt="Previsualización de la escena" 
              style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '6px', display: 'block', margin: '0 auto' }} 
            />
          ) : (
            <video 
              src={previewSrc} 
              controls 
              style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '6px', display: 'block', margin: '0 auto' }} 
            />
          )}
        </div>
      )}

      {mediaType === 'VIDEO' && (
        <div className="nested-settings-grid animate-fade-in" style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label htmlFor="trigger-time-input">Tiempo del Disparador (segundos)</label>
            <input 
              id="trigger-time-input"
              type="number" 
              step="0.1" 
              min="0"
              placeholder="Ej. 12.5"
              value={decisionTriggerTime}
              onChange={(e) => onUpdateField('decision_trigger_time', e.target.value)}
            />
            <span className="field-hint">Momento del video en que aparecen las decisiones.</span>
          </div>
          
          <div className="form-group-checkbox">
            <label className="checkbox-label">
              <input 
                type="checkbox"
                checked={pauseOnDecision}
                onChange={(e) => onUpdateField('pause_on_decision', e.target.checked)}
              />
              Pausar video al mostrar decisiones
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneMediaForm;
