import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StoryMetaForm from '../components/editor/StoryMetaForm';
import SceneNodeList from '../components/editor/SceneNodeList';
import SceneGeneralForm from '../components/editor/SceneGeneralForm';
import SceneMediaForm from '../components/editor/SceneMediaForm';
import SceneTimerForm from '../components/editor/SceneTimerForm';
import SceneChoicesForm from '../components/editor/SceneChoicesForm';
import useAuthStore from '../store/useAuthStore';
import './Editor.css';

const Editor = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  // Story state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startSceneTempId, setStartSceneTempId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  
  // List of scenes in the graph
  const [scenes, setScenes] = useState([]);
  
  // Currently active scene index in the editing panel
  const [activeSceneIndex, setActiveSceneIndex] = useState(null);

  // Status/Error states
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  // Selected local media files to upload keyed by scene temp_id
  const [mediaFiles, setMediaFiles] = useState({});

  // Dynamic Story Resources List State
  const [storyResources, setStoryResources] = useState([]);

  // Read storyId from query params
  const queryParams = new URLSearchParams(window.location.search);
  const storyId = queryParams.get('storyId');

  // Load existing story if editing
  useEffect(() => {
    if (storyId) {
      const fetchStory = async () => {
        try {
          const token = useAuthStore.getState().token;
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const response = await fetch(`http://127.0.0.1:8000/api/stories/${storyId}/`, { headers });
          if (!response.ok) {
            throw new Error('No se pudo cargar la historia para editar.');
          }
          const storyData = await response.json();
          setTitle(storyData.title);
          setDescription(storyData.description);
          setIsPublic(storyData.is_public || false);
          
          // Load story resources
          const loadedResources = (storyData.story_resources || []).map(res => ({
            id: res.id,
            temp_id: res.id,
            name: res.name,
            initial_value: res.initial_value,
            trigger_limit: res.trigger_limit,
            trigger_condition: res.trigger_condition,
            game_over_scene_temp_id: res.game_over_scene_id || ''
          }));
          setStoryResources(loadedResources);

          const loadedScenes = storyData.scenes.map(scene => ({
            id: scene.id,
            temp_id: scene.id, // Database UUID acts as temp_id in editor
            title: scene.title,
            description: scene.description,
            media_type: scene.media_type,
            media_url: scene.media_url,
            decision_trigger_time: scene.decision_trigger_time !== null ? scene.decision_trigger_time.toString() : '',
            pause_on_decision: scene.pause_on_decision,
            timer_duration: scene.timer_duration !== null ? scene.timer_duration.toString() : '',
            default_next_scene_temp_id: scene.default_next_scene_id || '',
            choices: scene.choices.map(choice => ({
              text: choice.text,
              next_scene_temp_id: choice.next_scene_id,
              resource_impacts: (choice.resource_impacts || []).map(imp => ({
                resource_temp_id: imp.resource_id,
                resource_id: imp.resource_id,
                impact_value: imp.impact_value
              }))
            }))
          }));
          
          setScenes(loadedScenes);
          setStartSceneTempId(storyData.start_scene_id || '');
          setActiveSceneIndex(0);
        } catch (err) {
          setSaveError(err.message);
        }
      };
      fetchStory();
    }
  }, [storyId]);

  // Auto-initialize with one starting scene (only if NOT loading an existing story)
  useEffect(() => {
    if (!storyId && scenes.length === 0) {
      const initialScene = createNewSceneObject("Escena Inicial");
      setScenes([initialScene]);
      setActiveSceneIndex(0);
      setStartSceneTempId(initialScene.temp_id);
    }
  }, [scenes, storyId]);

  const generateTempId = () => {
    return 'scene_' + Math.random().toString(36).substr(2, 9);
  };

  const createNewSceneObject = (customTitle = '') => {
    return {
      temp_id: generateTempId(),
      title: customTitle || `Escena ${scenes.length + 1}`,
      description: '',
      media_type: 'IMAGE',
      media_url: '',
      decision_trigger_time: '',
      pause_on_decision: true,
      timer_duration: '',
      default_next_scene_temp_id: '',
      choices: []
    };
  };

  // Add a new node to the graph
  const handleAddScene = () => {
    const newScene = createNewSceneObject();
    setScenes([...scenes, newScene]);
    setActiveSceneIndex(scenes.length);
  };

  // Delete a node from the graph
  const handleDeleteScene = (indexToDelete, e) => {
    e.stopPropagation();
    if (scenes.length <= 1) {
      alert("La historia debe tener al menos una escena.");
      return;
    }

    const sceneToDelete = scenes[indexToDelete];
    const newScenes = scenes.filter((_, idx) => idx !== indexToDelete);
    
    // Clean up references to the deleted scene
    const cleanedScenes = newScenes.map(scene => {
      let cleanFallback = scene.default_next_scene_temp_id;
      if (cleanFallback === sceneToDelete.temp_id) {
        cleanFallback = '';
      }
      
      const cleanChoices = scene.choices.filter(choice => choice.next_scene_temp_id !== sceneToDelete.temp_id);
      
      return {
        ...scene,
        default_next_scene_temp_id: cleanFallback,
        choices: cleanChoices
      };
    });

    setScenes(cleanedScenes);

    // Clean up local media files
    const updatedMediaFiles = { ...mediaFiles };
    delete updatedMediaFiles[sceneToDelete.temp_id];
    setMediaFiles(updatedMediaFiles);

    // Update active scene index
    if (activeSceneIndex === indexToDelete) {
      setActiveSceneIndex(0);
    } else if (activeSceneIndex > indexToDelete) {
      setActiveSceneIndex(activeSceneIndex - 1);
    }

    // Update start scene if it was the deleted one
    if (startSceneTempId === sceneToDelete.temp_id) {
      setStartSceneTempId(cleanedScenes[0].temp_id);
    }
  };

  // Update properties of the active scene
  const handleUpdateActiveScene = (field, value) => {
    if (activeSceneIndex === null) return;
    const updatedScenes = [...scenes];
    updatedScenes[activeSceneIndex] = {
      ...updatedScenes[activeSceneIndex],
      [field]: value
    };
    setScenes(updatedScenes);
  };

  // Attach local file to scene state
  const handleFileSelect = (tempId, file) => {
    setMediaFiles(prev => ({
      ...prev,
      [tempId]: file
    }));
  };

  // Callback to insert AI suggested choices
  const handleSuggestChoices = (suggestedChoices) => {
    if (activeSceneIndex === null) return;
    const updatedScenes = [...scenes];
    const activeScene = updatedScenes[activeSceneIndex];
    
    const newChoices = suggestedChoices.map(item => ({
      text: item.text,
      next_scene_temp_id: '', // Leave empty to connect manually in the editor
      resource_impacts: []
    }));

    activeScene.choices = [...activeScene.choices, ...newChoices];
    setScenes(updatedScenes);
  };

  // Callback to set the AI generated image URL on the scene
  const handleAIImageGenerated = async (imageUrl) => {
    if (activeSceneIndex === null) return;
    
    const activeScene = scenes[activeSceneIndex];
    // If the scene is already saved in the database, we can PATCH it immediately to download the image.
    // Otherwise, we can save the media_url in the scene's state so it gets patched when saving, or patch it.
    // Let's call the PATCH endpoint directly if the scene has a real ID!
    if (activeScene.id && !activeScene.id.startsWith('temp_')) {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/scenes/${activeScene.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ media_url: imageUrl })
        });
        if (!response.ok) throw new Error('Error al guardar la imagen en el servidor');
        const data = await response.json();
        const updatedScenes = [...scenes];
        updatedScenes[activeSceneIndex] = {
          ...updatedScenes[activeSceneIndex],
          media_url: data.media_url
        };
        setScenes(updatedScenes);
        // Clear local file selection to force displaying the new media_url preview
        setMediaFiles(prev => {
          const updated = { ...prev };
          delete updated[activeScene.temp_id];
          return updated;
        });
        alert('¡Ilustración conceptual de IA descargada y asociada con éxito!');
      } catch (err) {
        alert(err.message);
      }
    } else {
      // If it is a new scene, we save it as a temporary property which we can handle or alert
      alert('Guarda el grafo primero para que la escena tenga un ID asignado, y luego podrás ilustrarla con la IA.');
    }
  };

  // Add a decision choice path
  const handleAddChoice = () => {
    if (activeSceneIndex === null) return;
    const updatedScenes = [...scenes];
    const activeScene = updatedScenes[activeSceneIndex];
    
    const newChoice = {
      text: 'Hacer algo...',
      next_scene_temp_id: scenes[0]?.temp_id || ''
    };

    activeScene.choices = [...activeScene.choices, newChoice];
    setScenes(updatedScenes);
  };

  // Update choice text or target
  const handleUpdateChoice = (choiceIndex, field, value) => {
    if (activeSceneIndex === null) return;
    const updatedScenes = [...scenes];
    const choices = [...updatedScenes[activeSceneIndex].choices];
    choices[choiceIndex] = {
      ...choices[choiceIndex],
      [field]: value
    };
    updatedScenes[activeSceneIndex].choices = choices;
    setScenes(updatedScenes);
  };

  // Remove choice
  const handleRemoveChoice = (choiceIndex) => {
    if (activeSceneIndex === null) return;
    const updatedScenes = [...scenes];
    updatedScenes[activeSceneIndex].choices = updatedScenes[activeSceneIndex].choices.filter((_, idx) => idx !== choiceIndex);
    setScenes(updatedScenes);
  };

  // Dynamic Resource Handlers
  const handleAddResource = () => {
    const newRes = {
      temp_id: `res_temp_${Date.now()}`,
      name: `Recurso ${storyResources.length + 1}`,
      initial_value: 100,
      trigger_limit: 0,
      trigger_condition: 'LTE',
      game_over_scene_temp_id: ''
    };
    setStoryResources(prev => [...prev, newRes]);
  };

  const handleUpdateResource = (index, field, value) => {
    setStoryResources(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const handleRemoveResource = (index) => {
    setStoryResources(prev => {
      const resourceToRemove = prev[index];
      const updated = prev.filter((_, idx) => idx !== index);

      // Clean up Choice impacts in all scenes
      setScenes(currentScenes => 
        currentScenes.map(scene => ({
          ...scene,
          choices: scene.choices.map(choice => ({
            ...choice,
            resource_impacts: (choice.resource_impacts || []).filter(
              imp => imp.resource_temp_id !== resourceToRemove.temp_id && imp.resource_id !== resourceToRemove.temp_id
            )
          }))
        }))
      );

      return updated;
    });
  };

  // Submit graph to API
  const handleSaveStory = async () => {
    if (!title.trim()) {
      alert("Por favor, ingresa el título de la historia.");
      return;
    }
    
    setSaving(true);
    setSaveError(null);

    const formattedScenes = scenes.map(scene => {
      const trigger = parseFloat(scene.decision_trigger_time);
      const timer = parseInt(scene.timer_duration, 10);
      
      return {
        ...scene,
        decision_trigger_time: isNaN(trigger) ? null : trigger,
        timer_duration: isNaN(timer) ? null : timer,
        default_next_scene_temp_id: scene.default_next_scene_temp_id || null
      };
    });

    const payload = {
      story_id: storyId || null,
      title,
      description,
      is_public: isPublic,
      start_scene_temp_id: startSceneTempId,
      scenes: formattedScenes,
      story_resources: storyResources
    };

    try {
      const token = useAuthStore.getState().token;
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://127.0.0.1:8000/api/stories/save-graph/', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al guardar la historia.');
      }

      const responseData = await response.json();
      const idMap = responseData.id_map;

      // Upload local media files for each scene via PATCH requests
      for (const [tempId, file] of Object.entries(mediaFiles)) {
        const realId = idMap[tempId];
        if (!realId) continue;

        const formData = new FormData();
        formData.append('media_file', file);

        const patchHeaders = {};
        if (token) {
          patchHeaders['Authorization'] = `Bearer ${token}`;
        }

        const uploadResponse = await fetch(`http://127.0.0.1:8000/api/scenes/${realId}/`, {
          method: 'PATCH',
          headers: patchHeaders,
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.error(`Error al subir el archivo multimedia para el nodo: ${realId}`);
        }
      }

      alert("¡Historia guardada con éxito en el grafo!");
      navigate('/');
    } catch (err) {
      setSaveError(err.message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const activeScene = activeSceneIndex !== null ? scenes[activeSceneIndex] : null;

  return (
    <div className="editor-page-container">
      {/* Top action bar */}
      <header className="editor-header">
        <button className="btn btn-back" onClick={() => navigate('/')}>
          ← Volver al Inicio
        </button>
        <div className="header-title-container">
          <h2>Forjador de Historias</h2>
          <span className="subtitle-badge">Editor de Grafos Narrativos</span>
        </div>
        <button 
          onClick={handleSaveStory} 
          disabled={saving} 
          className="btn btn-save"
        >
          {saving ? 'Guardando...' : 'Guardar Historia 💾'}
        </button>
      </header>

      {saveError && (
        <div className="save-error-banner">
          ⚠️ Error al guardar: {saveError}
        </div>
      )}

      {/* Main editor split view */}
      <div className="editor-layout">
        
        {/* Story Metadata & Scene Node List (Left Column) */}
        <aside className="editor-sidebar">
          <StoryMetaForm 
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            startSceneTempId={startSceneTempId}
            setStartSceneTempId={setStartSceneTempId}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
            scenes={scenes}
            storyResources={storyResources}
            onAddResource={handleAddResource}
            onUpdateResource={handleUpdateResource}
            onRemoveResource={handleRemoveResource}
          />

          <SceneNodeList 
            scenes={scenes}
            activeSceneIndex={activeSceneIndex}
            setActiveSceneIndex={setActiveSceneIndex}
            startSceneTempId={startSceneTempId}
            handleAddScene={handleAddScene}
            handleDeleteScene={handleDeleteScene}
          />
        </aside>

        {/* Current Active Scene Settings panel (Center Column) */}
        <main className="editor-main-panel">
          {activeScene ? (
            <div className="scene-details-editor">
              <div className="panel-title-container">
                <span className="panel-badge">Editar Escena</span>
                <h2>{activeScene.title || 'Escena sin título'}</h2>
              </div>

              <div className="editor-grid">
                <SceneGeneralForm 
                  title={activeScene.title}
                  description={activeScene.description}
                  onUpdateField={handleUpdateActiveScene}
                  storyContext={{ title, description }}
                  token={token}
                />

                <SceneMediaForm 
                  mediaType={activeScene.media_type}
                  decisionTriggerTime={activeScene.decision_trigger_time}
                  pauseOnDecision={activeScene.pause_on_decision}
                  selectedFileName={mediaFiles[activeScene.temp_id]?.name || ''}
                  onUpdateField={handleUpdateActiveScene}
                  onFileSelect={(file) => handleFileSelect(activeScene.temp_id, file)}
                  currentSceneTitle={activeScene.title}
                  currentSceneDesc={activeScene.description}
                  currentSceneTempId={activeScene.temp_id}
                  storyContext={{ title, description }}
                  scenes={scenes}
                  token={token}
                  onAIImageGenerated={handleAIImageGenerated}
                  mediaUrl={activeScene.media_url}
                  localFile={mediaFiles[activeScene.temp_id]}
                />

                <SceneTimerForm 
                  timerDuration={activeScene.timer_duration}
                  defaultNextSceneTempId={activeScene.default_next_scene_temp_id}
                  scenes={scenes}
                  currentSceneTempId={activeScene.temp_id}
                  onUpdateField={handleUpdateActiveScene}
                />

                <SceneChoicesForm 
                  choices={activeScene.choices}
                  scenes={scenes}
                  handleAddChoice={handleAddChoice}
                  handleUpdateChoice={handleUpdateChoice}
                  handleRemoveChoice={handleRemoveChoice}
                  storyResources={storyResources}
                  currentSceneTitle={activeScene.title}
                  currentSceneDesc={activeScene.description}
                  token={token}
                  onSuggestChoices={handleSuggestChoices}
                />
              </div>
            </div>
          ) : (
            <div className="no-active-scene-panel">
              <p>Selecciona una escena del listado izquierdo o añade una nueva para comenzar a editar.</p>
            </div>
          )}
        </main>

      </div>
    </div>
  );
};

export default Editor;
