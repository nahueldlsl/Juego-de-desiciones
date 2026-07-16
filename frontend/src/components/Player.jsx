import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import ResourceHUD from './ResourceHUD';
import './Player.css';

const Player = () => {
  const {
    currentScene,
    history,
    transitionToScene,
    goBack,
    restartStory,
    loading,
    error,
    storyResources,
    resources,
    applyChoice
  } = useGame();

  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  
  // Local state
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [choicesVisible, setChoicesVisible] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderedScene, setRenderedScene] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset local states whenever currentScene changes
  useEffect(() => {
    setVideoCurrentTime(0);
    setChoicesVisible(false);
    setTimerRemaining(null);
    setVideoDuration(0);

    // If it's an image or video with no trigger time, show choices immediately
    if (currentScene) {
      const isImage = currentScene.media_type === 'IMAGE';
      const noTrigger = currentScene.decision_trigger_time === null || currentScene.decision_trigger_time === undefined;
      
      if (isImage || noTrigger) {
        setChoicesVisible(true);
      }
    }
  }, [currentScene]);

  // Video timeupdate handler
  const handleTimeUpdate = (e) => {
    const video = e.target;
    const currentTime = video.currentTime;
    setVideoCurrentTime(currentTime);

    if (currentScene && currentScene.media_type === 'VIDEO') {
      const triggerTime = currentScene.decision_trigger_time || 0;
      
      // If we reach or pass the trigger time, display choices
      if (currentTime >= triggerTime && !choicesVisible) {
        setChoicesVisible(true);
        
        // Pause the video if configured
        if (currentScene.pause_on_decision && videoRef.current) {
          videoRef.current.pause();
        }
      }
    }
  };

  // Set video duration when loaded
  const handleLoadedMetadata = (e) => {
    setVideoDuration(e.target.duration);
  };

  // Timer countdown hook
  useEffect(() => {
    let timerId = null;

    if (choicesVisible && currentScene && currentScene.timer_duration) {
      // Initialize timer if not already set
      if (timerRemaining === null) {
        setTimerRemaining(currentScene.timer_duration);
      }

      timerId = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            handleTimerExpiration();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [choicesVisible, currentScene, timerRemaining]);

  // Synchronize fullscreen state from document changes (e.g. Escape key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cinematic transition effect between scenes (Fade Out -> Swap -> Fade In)
  useEffect(() => {
    if (!currentScene) return;

    if (!renderedScene) {
      setRenderedScene(currentScene);
      return;
    }

    // Only transition if the scene ID actually changed!
    if (renderedScene.id === currentScene.id) {
      setRenderedScene(currentScene); // Just update reference if needed
      return;
    }

    setIsTransitioning(true);

    const swapTimeout = setTimeout(() => {
      setRenderedScene(currentScene);
      
      // Fallback: If no media is specified, fade back in instantly
      if (!currentScene.media_url) {
        setIsTransitioning(false);
      }
    }, 250); // Peak of the black fade

    return () => clearTimeout(swapTimeout);
  }, [currentScene]);

  const handleMediaLoad = () => {
    setIsTransitioning(false);
    if (activeScene?.media_type === 'VIDEO' && videoRef.current) {
      videoRef.current.play().catch((err) => console.log('Autoplay deferred:', err));
    }
  };

  const activeScene = renderedScene || currentScene;

  // Request/Exit HTML5 Fullscreen on container
  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Handle timer expiration
  const handleTimerExpiration = () => {
    if (currentScene && currentScene.default_next_scene_id) {
      transitionToScene(currentScene.default_next_scene_id);
    } else {
      console.warn("Timer expired but no fallback default_next_scene_id was set.");
    }
  };

  // Select a choice with resource impacts
  const handleChoiceSelect = (choice) => {
    applyChoice(choice);
  };

  if (loading) {
    return (
      <div className="player-message-container">
        <div className="spinner"></div>
        <p>Loading your interactive adventure...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="player-message-container error">
        <div className="error-icon">⚠️</div>
        <p>Error: {error}</p>
        <button onClick={restartStory} className="btn btn-retry">Retry</button>
      </div>
    );
  }

  if (!currentScene) {
    return (
      <div className="player-message-container">
        <p>No story or scene loaded. Please select a story to begin.</p>
      </div>
    );
  }

  const {
    title,
    description,
    media_url,
    media_type,
    timer_duration,
    choices
  } = activeScene || currentScene;

  // Calculate timer progress bar percentage
  const timerPercentage = timer_duration && timerRemaining !== null
    ? (timerRemaining / timer_duration) * 100
    : 0;

  return (
    <div 
      ref={playerContainerRef} 
      className={`adventure-player-container ${isFullscreen ? 'fullscreen-mode' : ''}`}
    >
      {/* HUD Controller Bar */}
      <div className="hud-header">
        <button 
          onClick={goBack} 
          disabled={history.length === 0} 
          className="btn btn-hud"
          title="Go back to the previous scene"
        >
          ← Regresar
        </button>
        <span className="story-title">{title}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={restartStory} className="btn btn-hud">
            Reiniciar ↻
          </button>
          <button 
            onClick={toggleFullscreen} 
            className="btn btn-hud btn-fullscreen"
            title="Alternar Pantalla Completa"
          >
            {isFullscreen ? 'Normal 🖥️' : 'Pantalla Completa ⛶'}
          </button>
        </div>
      </div>

      {/* Floating Resource system indicator HUD (Rendered Conditionally) */}
      <ResourceHUD storyResources={storyResources} resources={resources} />

      {/* Main Screen/Viewport */}
      <div className="media-viewport">
        {/* Cinematic transition black screen */}
        <div className={`cinematic-transition-overlay ${isTransitioning ? 'active' : ''}`}></div>

        {media_type === 'VIDEO' && media_url ? (
          <video
            ref={videoRef}
            src={media_url}
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={handleMediaLoad}
            className="viewport-media"
            playsInline
          />
        ) : media_url ? (
          <img 
            src={media_url} 
            alt={title} 
            onLoad={handleMediaLoad}
            className="viewport-media" 
          />
        ) : (
          <div className="viewport-placeholder">
            <div className="artistic-bg"></div>
            <p className="placeholder-text">Sinfonía del Silencio</p>
          </div>
        )}

        {/* Narrative Details Cards (Transparent Backdrop) */}
        <div className={`scene-info-panel ${choicesVisible ? 'choices-active' : ''}`}>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        {/* Choices Overlay */}
        {choicesVisible && (
          <div className="choices-overlay-container">
            {/* Visual Timer Progress Bar */}
            {timer_duration && timerRemaining !== null && (
              <div className="timer-container">
                <div className="timer-label">Elige rápido: {timerRemaining}s</div>
                <div className="timer-bar-outer">
                  <div 
                    className="timer-bar-inner" 
                    style={{ width: `${timerPercentage}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Decisions List */}
            <div className="choices-grid">
              {choices && choices.length > 0 ? (
                choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => handleChoiceSelect(choice)}
                    className="choice-btn"
                  >
                    <span className="choice-btn-text">{choice.text}</span>
                    <span className="choice-btn-arrow">➔</span>
                  </button>
                ))
              ) : (
                <div className="end-story-message">
                  Fin del camino. Gracias por jugar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;
