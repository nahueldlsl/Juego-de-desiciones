import React, { createContext, useContext, useState, useCallback } from 'react';
import useAuthStore from '../store/useAuthStore';

const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  const [currentStory, setCurrentStory] = useState(null);
  const [currentScene, setCurrentScene] = useState(null);
  const [history, setHistory] = useState([]); // Array of scene IDs
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dynamic Resource System States
  const [storyResources, setStoryResources] = useState([]); // Array of StoryResource configs
  const [resources, setResources] = useState({}); // Key-value map: { [resource_id]: current_value }
  const [historyResources, setHistoryResources] = useState([]); // Array of historical resource value maps corresponding to history

  // Load a story and set the initial scene
  const loadStory = useCallback(async (storyId, apiBaseUrl = 'http://127.0.0.1:8000/api') => {
    setLoading(true);
    setError(null);
    try {
      const token = useAuthStore.getState().token;
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${apiBaseUrl}/stories/${storyId}/`, { headers });
      if (!response.ok) {
        throw new Error('Failed to fetch story structure from API.');
      }
      const storyData = await response.json();
      setCurrentStory(storyData);
      
      // Load dynamic resources list
      const resList = storyData.story_resources || [];
      setStoryResources(resList);
      
      if (resList.length > 0) {
        const initialResValues = {};
        resList.forEach(r => {
          initialResValues[r.id] = r.initial_value;
        });
        setResources(initialResValues);
        setHistoryResources([]);
      } else {
        setResources({});
        setHistoryResources([]);
      }
      
      // Find starting scene
      const startSceneId = storyData.start_scene_id;
      const startScene = storyData.scenes.find(s => s.id === startSceneId);
      
      if (startScene) {
        setCurrentScene(startScene);
        setHistory([]);
      } else {
        throw new Error('Starting scene not found in story metadata.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Transition to a specific scene ID within the loaded story (direct jumps, fallbacks, etc.)
  const transitionToScene = useCallback((sceneId) => {
    if (!currentStory) return;
    
    const nextScene = currentStory.scenes.find(s => s.id === sceneId);
    if (nextScene) {
      if (currentScene) {
        setHistory(prev => [...prev, currentScene.id]);
        
        // If resource system is active, mirror resource values in history
        if (storyResources.length > 0) {
          setHistoryResources(prev => [...prev, { ...resources }]);
        }
      }
      setCurrentScene(nextScene);
    } else {
      console.error(`Scene with ID ${sceneId} not found in current story.`);
    }
  }, [currentStory, currentScene, storyResources, resources]);

  // Apply choice selection containing potential resource impacts
  const applyChoice = useCallback((choice) => {
    if (!currentStory || !currentScene) return;

    if (storyResources.length > 0) {
      // Copy current resource values map
      const nextResources = { ...resources };

      // Apply impacts from this choice
      const impacts = choice.resource_impacts || [];
      impacts.forEach(impact => {
        const resId = impact.resource_id;
        if (nextResources[resId] !== undefined) {
          nextResources[resId] += impact.impact_value;
        }
      });

      // Record state history for rollback support
      setHistory(prev => [...prev, currentScene.id]);
      setHistoryResources(prev => [...prev, { ...resources }]);

      // Check trigger limits for Game Over conditions
      for (const resConfig of storyResources) {
        const val = nextResources[resConfig.id];
        const limit = resConfig.trigger_limit;
        const condition = resConfig.trigger_condition; // 'LTE' or 'GTE'

        let breached = false;
        if (condition === 'LTE' && val <= limit) {
          breached = true;
        } else if (condition === 'GTE' && val >= limit) {
          breached = true;
        }

        if (breached && resConfig.game_over_scene_id) {
          // Force to Game Over scene immediately!
          nextResources[resConfig.id] = limit; // cap at limit symbolically
          setResources(nextResources);
          
          const gameOverScene = currentStory.scenes.find(s => s.id === resConfig.game_over_scene_id);
          if (gameOverScene) {
            setCurrentScene(gameOverScene);
            return;
          }
        }
      }

      // Safe update & navigation if no game over was triggered
      setResources(nextResources);
      const nextScene = currentStory.scenes.find(s => s.id === choice.next_scene_id);
      if (nextScene) {
        setCurrentScene(nextScene);
      }
    } else {
      // Standard path traversal without resource system
      transitionToScene(choice.next_scene_id);
    }
  }, [currentStory, currentScene, storyResources, resources, transitionToScene]);

  // Rollback to the previous scene
  const goBack = useCallback(() => {
    if (history.length === 0 || !currentStory) return;
    
    const prevHistory = [...history];
    const previousSceneId = prevHistory.pop();
    const previousScene = currentStory.scenes.find(s => s.id === previousSceneId);
    
    if (previousScene) {
      setHistory(prevHistory);
      setCurrentScene(previousScene);

      // Rollback resource states
      if (storyResources.length > 0 && historyResources.length > 0) {
        const prevResHistory = [...historyResources];
        const prevRes = prevResHistory.pop();
        if (prevRes) {
          setResources(prevRes);
          setHistoryResources(prevResHistory);
        }
      }
    }
  }, [history, historyResources, currentStory, storyResources]);

  // Reset the game session
  const restartStory = useCallback(() => {
    if (!currentStory) return;
    const startScene = currentStory.scenes.find(s => s.id === currentStory.start_scene_id);
    if (startScene) {
      setCurrentScene(startScene);
      setHistory([]);
      
      // Reset resource values to configuration initials
      if (storyResources.length > 0) {
        const initialResValues = {};
        storyResources.forEach(r => {
          initialResValues[r.id] = r.initial_value;
        });
        setResources(initialResValues);
        setHistoryResources([]);
      }
    }
  }, [currentStory, storyResources]);

  const value = {
    currentStory,
    currentScene,
    history,
    isPlaying,
    setIsPlaying,
    loading,
    error,
    storyResources,
    resources,
    loadStory,
    transitionToScene,
    applyChoice,
    goBack,
    restartStory
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
