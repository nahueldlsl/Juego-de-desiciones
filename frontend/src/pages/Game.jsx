import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import Player from '../components/Player';
import './Game.css';

const Game = () => {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const { loadStory, currentStory } = useGame();

  useEffect(() => {
    if (storyId && (!currentStory || currentStory.id !== storyId)) {
      loadStory(storyId);
    }
  }, [storyId, currentStory, loadStory]);

  return (
    <div className="game-page-container">
      <div className="game-header-bar">
        <button className="back-home-link" onClick={() => navigate('/')}>
          « Volver al Panel
        </button>
        <span className="current-story-badge">
          Reproduciendo: {currentStory ? currentStory.title : 'Cargando...'}
        </span>
      </div>

      <div className="game-player-wrapper">
        <Player />
      </div>
    </div>
  );
};

export default Game;
