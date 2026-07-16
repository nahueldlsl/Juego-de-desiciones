import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiplayer } from '../context/MultiplayerContext';
import { useGame } from '../context/GameContext';
import Player from '../components/Player';
import './GuestPlayer.css';

const GuestPlayer = () => {
  const { roomPin } = useParams();
  const navigate = useNavigate();
  
  const { 
    roomState, 
    submitVote, 
    submitTransition, 
    connected, 
    leaveRoom,
    avatar
  } = useMultiplayer();

  const { loadStory, currentScene } = useGame();

  const [sceneDetails, setSceneDetails] = useState(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [loadingScene, setLoadingScene] = useState(false);
  const [guestTimerRemaining, setGuestTimerRemaining] = useState(null);
  const [sceneLoadTime, setSceneLoadTime] = useState(null);
  const [sceneError, setSceneError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Sync separated mode story loading
  useEffect(() => {
    if (roomState?.status === 'PLAYING' && roomState.mode === 'SEPARADO') {
      loadStory(roomState.story_id);
    }
  }, [roomState?.status, roomState?.mode, roomState?.story_id, loadStory]);

  // Sync transition messages in separated mode
  useEffect(() => {
    if (roomState?.status === 'PLAYING' && roomState.mode === 'SEPARADO' && currentScene) {
      submitTransition(currentScene.id);
    }
  }, [currentScene, roomState?.status, roomState?.mode, submitTransition]);

  // Fetch choices and details on síncrono mode scene changes
  useEffect(() => {
    if (roomState?.current_scene_id && roomState.mode === 'CONJUNTO') {
      // Clear old state immediately to prevent race conditions or stale rendering
      setSceneDetails(null);
      setGuestTimerRemaining(null);
      setSceneError(null);

      const fetchScene = async () => {
        setLoadingScene(true);
        try {
          const res = await fetch(`http://127.0.0.1:8000/api/scenes/${roomState.current_scene_id}/`);
          if (res.ok) {
            const data = await res.json();
            setSceneDetails(data);
            setSelectedChoiceId(null); // Reset vote state on new scene!
            setSceneLoadTime(Date.now());
          } else {
            throw new Error('Error al obtener los detalles de la escena del servidor.');
          }
        } catch (err) {
          console.error(err);
          setSceneError(err.message || 'Error de comunicación con el servidor.');
        } finally {
          setLoadingScene(false);
        }
      };
      fetchScene();
    }
  }, [roomState?.current_scene_id, roomState?.mode, retryCount]);

  // Guest countdown timer management (Modo Conjunto síncrono)
  useEffect(() => {
    let timerId = null;
    if (sceneDetails?.timer_duration && roomState?.status === 'PLAYING' && !selectedChoiceId) {
      setGuestTimerRemaining(sceneDetails.timer_duration);
      timerId = setInterval(() => {
        setGuestTimerRemaining((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(timerId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setGuestTimerRemaining(null);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [sceneDetails, roomState?.status, selectedChoiceId]);

  if (!roomState) {
    return (
      <div className="guest-loading-screen">
        <div className="spinner"></div>
        <p>Conectando al lobby de la sala {roomPin}...</p>
        {!connected && <span className="error-text">Esperando conexión de sockets...</span>}
      </div>
    );
  }

  const { status, mode, nickname } = roomState;

  // Retrieve customized avatar emoji for this participant
  const myParticipant = roomState?.participants?.find(p => p.nickname === nickname);

  const handleVoteClick = (choiceId) => {
    if (guestTimerRemaining === 0) return; // Prevent voting on time out
    setSelectedChoiceId(choiceId);
    const reactionTime = sceneLoadTime ? (Date.now() - sceneLoadTime) : 0;
    submitVote(choiceId, reactionTime);
  };

  return (
    <div className="guest-player-container">
      {/* Player header */}
      <header className="guest-header">
        <span className="player-badge">
          <span className="badge-avatar">{avatar}</span> {nickname}
        </span>
        <span className="room-pin-badge">SALA PIN: {roomPin}</span>
      </header>

      {/* 1. LOBBY WAITING SCREEN */}
      {status === 'WAITING' && (
        <div className="guest-lobby-screen animate-pop-in">
          <div className="lobby-icon">{avatar || '🛋️'}</div>
          <h2>¡Te has unido con éxito!</h2>
          <p>Apodo registrado: <strong>{nickname}</strong></p>
          <div className="loading-bar-marquee"></div>
          <p className="footer-status">Esperando a que el Host inicie la partida...</p>
        </div>
      )}

      {/* 2. PLAYING SCREEN */}
      {status === 'PLAYING' && (
        <div className="guest-gameplay-screen">
          {mode === 'CONJUNTO' ? (
            /* Modo Conjunto Keypad */
            <div className="keypad-layout">
              {loadingScene ? (
                <div className="spinner-container">
                  <div className="spinner"></div>
                  <p>Obteniendo opciones de la escena...</p>
                </div>
              ) : sceneError ? (
                /* Network Error screen */
                <div className="voted-waiting-screen animate-pop-in timeout-state">
                  <div className="timeout-icon">⚠️</div>
                  <h2>Error de Conexión</h2>
                  <p>{sceneError}</p>
                  <button 
                    onClick={() => setRetryCount(prev => prev + 1)} 
                    className="btn btn-hud"
                    style={{ marginTop: '20px', background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Reintentar Conexión ↻
                  </button>
                </div>
              ) : guestTimerRemaining === 0 ? (
                /* Time out screen */
                <div className="voted-waiting-screen animate-pop-in timeout-state">
                  <div className="timeout-icon">⏰</div>
                  <h2>¡Tiempo Agotado!</h2>
                  <p>No has enviado tu voto a tiempo para esta escena.</p>
                  <p className="hint-text">Presta atención a la proyección principal para ver la resolución democrática del grupo.</p>
                </div>
              ) : selectedChoiceId ? (
                /* Already voted screen */
                <div className="voted-waiting-screen animate-pop-in">
                  <div className="success-icon">✓</div>
                  <h2>¡Voto Enviado!</h2>
                  <p>Has elegido: <strong>{sceneDetails?.choices.find(c => c.id === selectedChoiceId)?.text}</strong></p>
                  <p className="hint-text">Observa la proyección principal de la sala para ver las estadísticas grupales y los resultados.</p>
                  <div className="pulse-loader"></div>
                </div>
              ) : (
                /* Choice buttons keypad */
                <div className="voting-keypad animate-pop-in">
                  <h2>Toma tu decisión:</h2>
                  <p className="narrative-hint">La mayoría democrática definirá el camino de la historia.</p>
                  
                  {guestTimerRemaining !== null && (
                    <div className="guest-timer-banner">
                      ⏱️ Tiempo restante: <strong>{guestTimerRemaining}s</strong>
                    </div>
                  )}

                  <div className="keypad-buttons-grid">
                    {sceneDetails?.choices && sceneDetails.choices.length > 0 ? (
                      sceneDetails.choices.map((choice, index) => (
                        <button
                          key={choice.id}
                          onClick={() => handleVoteClick(choice.id)}
                          className={`btn-keypad-choice choice-color-${index % 4}`}
                        >
                          <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                          <span className="choice-text">{choice.text}</span>
                        </button>
                      ))
                    ) : (
                      <div className="no-choices-pad">
                        <h3>Nivel final alcanzado</h3>
                        <p>No hay decisiones pendientes. Observa la pantalla principal para el desenlace.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Modo Separado: Renders normal player, but syncs scene in the background */
            <div className="guest-self-paced-wrapper">
              <Player />
            </div>
          )}
        </div>
      )}

      {/* 3. FINISHED GAME OVER SCREEN */}
      {status === 'FINISHED' && (
        <div className="guest-finished-screen animate-pop-in">
          <div className="end-icon">🏁</div>
          <h2>¡Fin del Juego!</h2>
          <p>Has completado la historia. Mira los resultados finales acumulados en la proyección.</p>
          <button onClick={() => navigate('/')} className="btn-return-home">
            Salir al Panel de Inicio
          </button>
        </div>
      )}

    </div>
  );
};

export default GuestPlayer;
