import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMultiplayer } from '../context/MultiplayerContext';
import './HostView.css';

const HostView = () => {
  const { roomPin } = useParams();
  const navigate = useNavigate();
  const { 
    roomState, 
    startGame, 
    nextScene, 
    votesChart, 
    connected, 
    leaveRoom 
  } = useMultiplayer();

  const [activeSceneDetails, setActiveSceneDetails] = useState(null);
  const [fetchingScene, setFetchingScene] = useState(false);
  const [hostTimerRemaining, setHostTimerRemaining] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Stable refs so handleNextScene never changes reference (avoids useEffect re-firing on scene change)
  const nextSceneRef = React.useRef(nextScene);
  const currentSceneIdRef = React.useRef(null);
  const isTransitioningRef = React.useRef(false);
  const timerFiredRef = React.useRef(false);

  // Keep refs in sync with latest values every render
  nextSceneRef.current = nextScene;
  currentSceneIdRef.current = roomState?.current_scene_id;
  isTransitioningRef.current = isTransitioning;

  // Stable callback — never changes reference, reads from refs
  const handleNextScene = useCallback((forcedChoiceId = null) => {
    if (isTransitioningRef.current) return;
    setIsTransitioning(true);
    nextSceneRef.current?.(forcedChoiceId, currentSceneIdRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync active scene details for projection view (Modo Conjunto)
  useEffect(() => {
    if (roomState?.current_scene_id && roomState.mode === 'CONJUNTO') {
      // Clear old state immediately to prevent race conditions or stale rendering
      setActiveSceneDetails(null);
      setHostTimerRemaining(null);
      setIsTransitioning(false);
      timerFiredRef.current = false; // Reset one-shot guard for this new scene

      const fetchSceneDetails = async () => {
        setFetchingScene(true);
        try {
          const res = await fetch(`http://127.0.0.1:8000/api/scenes/${roomState.current_scene_id}/`);
          if (res.ok) {
            const data = await res.json();
            setActiveSceneDetails(data);
          }
        } catch (err) {
          console.error('Error fetching scene details for host projection:', err);
        } finally {
          setFetchingScene(false);
        }
      };
      fetchSceneDetails();
    } else {
      setActiveSceneDetails(null);
      setHostTimerRemaining(null);
      timerFiredRef.current = false;
    }
  }, [roomState?.current_scene_id, roomState?.mode]);

  // Combined timer countdown + one-shot trigger in a single effect
  // deps: scene identity + status only — handleNextScene is stable, no risk of re-firing
  useEffect(() => {
    if (!activeSceneDetails?.timer_duration || roomState?.status !== 'PLAYING') {
      setHostTimerRemaining(null);
      return;
    }

    // Fresh timer for this scene
    timerFiredRef.current = false;
    setHostTimerRemaining(activeSceneDetails.timer_duration);

    const timerId = setInterval(() => {
      setHostTimerRemaining((prev) => {
        if (prev === null || prev <= 0) return prev;
        const next = prev - 1;
        if (next === 0 && !timerFiredRef.current) {
          timerFiredRef.current = true;
          // Use setTimeout to avoid calling setState inside another setState updater
          setTimeout(() => handleNextScene(), 50);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [activeSceneDetails?.id, activeSceneDetails?.timer_duration, roomState?.status, handleNextScene]);

  if (!roomState) {
    return (
      <div className="host-loading-screen">
        <div className="spinner"></div>
        <p>Estableciendo sala de juego en {roomPin}...</p>
        {!connected && <span className="warning-text">Intentando conectar al servidor de sockets...</span>}
      </div>
    );
  }

  const { status, mode, participants, story_title, choices_votes, total_votes } = roomState;

  return (
    <div className="host-view-container">
      {/* Header bar */}
      <header className="host-header">
        <div className="header-story-info">
          <span className="badge-mode">{mode === 'CONJUNTO' ? 'MODO SÍNCRONO (GRUPO)' : 'MODO ASÍNCRONO (INDIVIDUAL)'}</span>
          <h2>Aventura: {story_title}</h2>
        </div>
        <div className="header-pin-display">
          <span>CÓDIGO DE ACCESO</span>
          <div className="pin-number">{roomPin}</div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn btn-quit">
          Cerrar Sala ✕
        </button>
      </header>

      {/* 1. WAITING LOBBY (Lobby de espera) */}
      {status === 'WAITING' && (
        <div className="lobby-layout">
          <div className="lobby-instructions">
            <h1>Esperando a los jugadores...</h1>
            <p>Instrucciones para unirse:</p>
            <ol>
              <li>Entra a la plataforma desde tu dispositivo.</li>
              <li>Ingresa el código PIN: <strong>{roomPin}</strong>.</li>
              <li>Escribe tu apodo, elige tu avatar emoji y haz clic en unirse.</li>
            </ol>
            
            <button 
              onClick={startGame} 
              className="btn btn-start-game animate-pulse"
              disabled={participants.length === 0}
            >
              ¡Iniciar Aventura! 🎬
            </button>
          </div>

          <div className="lobby-participants-box">
            <h3>Jugadores en la sala ({participants.length})</h3>
            {participants.length === 0 ? (
              <div className="empty-lobby-text">
                <p>Nadie se ha unido todavía. Las tarjetas de apodos aparecerán aquí.</p>
              </div>
            ) : (
              <div className="participants-grid">
                {participants.map((p, idx) => (
                  <div key={idx} className="participant-card animate-pop-in">
                    <span className="player-avatar">{p.avatar || '👤'}</span>
                    <span className="player-name">{p.nickname}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. PLAYING GAME (Modo Conjunto vs Modo Separado) */}
      {status === 'PLAYING' && (
        <div className="playing-layout">
          {mode === 'CONJUNTO' ? (
            /* Modo Conjunto Host view: proyecta el video/imagen + muestra gráficos de votación */
            <div className="conjunto-grid">
              
              <div className="projection-screen">
                {fetchingScene ? (
                  <div className="scene-loader">Cargando recurso multimedia...</div>
                ) : activeSceneDetails ? (
                  <div className="projection-media-wrapper">
                    {/* Active Scene Timer Display */}
                    {activeSceneDetails.timer_duration && hostTimerRemaining !== null && (
                      <div className="host-timer-overlay animate-pulse">
                        ⏱️ Tiempo: {hostTimerRemaining}s
                      </div>
                    )}

                    {activeSceneDetails.media_url ? (
                      activeSceneDetails.media_type === 'VIDEO' ? (
                        <video 
                          src={activeSceneDetails.media_url} 
                          autoPlay 
                          playsInline
                          className="projection-media"
                        />
                      ) : (
                        <img 
                          src={activeSceneDetails.media_url} 
                          alt="Proyección" 
                          className="projection-media"
                        />
                      )
                    ) : (
                      <div className="projection-placeholder">
                        <p>{activeSceneDetails.title}</p>
                      </div>
                    )}
                    <div className="projection-narrative">
                      <h3>{activeSceneDetails.title}</h3>
                      <p>{activeSceneDetails.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="projection-placeholder">
                    <p>Preparando escena...</p>
                  </div>
                )}
              </div>

              {/* Tally and Control Sidebar */}
              <div className="controls-sidebar">
                {/* Only show vote tally when scene has choices (not final node) */}
                {activeSceneDetails && activeSceneDetails.choices?.length > 0 && (
                  <div className="sidebar-stats-card">
                    <h3>Votos Recibidos</h3>
                    <div className="votes-counter">
                      <span className="big-count">{total_votes}</span>
                      <span className="denominator">/ {participants.length}</span>
                    </div>
                  </div>
                )}

                {/* Vote counts / results chart — driven by roomState for live updates */}
                <div className="sidebar-results-card">
                  <h3>Distribución de Decisiones</h3>
                  {!activeSceneDetails ? (
                    <p className="no-votes-yet">Cargando escena...</p>
                  ) : activeSceneDetails.choices?.length === 0 ? (
                    <p className="no-votes-yet">🏁 Escena Final — No hay decisiones pendientes.</p>
                  ) : (
                    <div className="live-bars-list">
                      {choices_votes.map((choice, index) => (
                        <div key={choice.choice_id} className="live-bar-row">
                          <div className="bar-meta">
                            <span className="bar-label">{choice.choice_text}</span>
                            <span className="bar-count">{choice.votes_count} votos ({Math.round(choice.votes_percentage)}%)</span>
                          </div>
                          <div className="bar-track">
                            <div 
                              className={`bar-fill fill-color-${index % 4}`} 
                              style={{ width: `${choice.votes_percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Navigation controllers — driven by activeSceneDetails for accuracy */}
                <div className="sidebar-actions-card">
                  {!activeSceneDetails ? (
                    <p className="no-votes-yet">Cargando controles...</p>
                  ) : activeSceneDetails.choices?.length === 0 ? (
                    /* Final scene: only show Finish button */
                    <button 
                      onClick={() => handleNextScene()} 
                      className="btn btn-advance-demo btn-finish-story"
                      disabled={isTransitioning}
                    >
                      Finalizar Aventura 🏁
                    </button>
                  ) : (
                    /* Normal scene: democratic resolve + forced overrides */
                    <>
                      <button 
                        onClick={() => handleNextScene()} 
                        className="btn btn-advance-demo"
                        disabled={isTransitioning}
                      >
                        Resolver por Mayoría 🗳️
                      </button>

                      <div className="forced-override-section">
                        <span>Forzar Desviación:</span>
                        <div className="forced-buttons-grid">
                          {choices_votes.map((choice) => (
                            <button
                              key={choice.choice_id}
                              onClick={() => handleNextScene(choice.choice_id)}
                              className="btn btn-forced-choice"
                              title="Fuerza la transición inmediata por este camino"
                              disabled={isTransitioning}
                            >
                              {choice.choice_text} ➔
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>

            </div>
          ) : (
            /* Modo Separado Host view: Dashboard de progreso del profesor */
            <div className="separado-dashboard-layout">
              <div className="dashboard-stats-row">
                <div className="stat-card">
                  <h4>Jugadores Activos</h4>
                  <span className="stat-value">{participants.length}</span>
                </div>
                <div className="stat-card">
                  <h4>Lobby PIN</h4>
                  <span className="stat-value">{roomPin}</span>
                </div>
              </div>

              <div className="dashboard-table-card">
                <h3>Seguimiento de Jugadores en Tiempo Real</h3>
                <div className="table-responsive">
                  <table className="participants-table">
                    <thead>
                      <tr>
                        <th>Nickname</th>
                        <th>Estado de Conexión</th>
                        <th>Escena Actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p, idx) => (
                        <tr key={idx}>
                          <td className="col-name">{p.avatar || '👤'} {p.nickname}</td>
                          <td className="col-status">
                            <span className="status-indicator active">En línea</span>
                          </td>
                          <td className="col-scene">
                            <span className="badge-scene">{p.current_scene_title}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. FINISHED (Resultados Finales) */}
      {status === 'FINISHED' && (
        <div className="finished-layout">
          <div className="finished-card animate-pop-in">
            <span className="crown-icon">👑</span>
            <h1>¡Partida Finalizada!</h1>
            <p>La aventura ha concluido. Todos los caminos se han cerrado.</p>
            
            {votesChart && votesChart.length > 0 && (
              <div className="final-chart-box">
                <h3>Votación de la Última Escena:</h3>
                <div className="final-bars-list">
                  {votesChart.map((ch, idx) => (
                    <div key={idx} className="final-bar-row">
                      <span className="final-bar-label">{ch.choice_text}</span>
                      <div className="final-bar-track">
                        <div 
                          className="final-bar-fill" 
                          style={{ width: `${ch.votes_percentage}%` }}
                        ></div>
                      </div>
                      <span className="final-bar-pct">{Math.round(ch.votes_percentage)}% ({ch.votes_count} v)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
              <button 
                onClick={() => navigate(`/host/${roomPin}/analytics`)} 
                className="btn btn-analytics"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s ease' }}
              >
                Ver Analíticas de Supervivencia 📊
              </button>
              <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
                Volver al Panel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HostView;
