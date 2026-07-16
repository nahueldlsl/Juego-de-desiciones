import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayer } from '../context/MultiplayerContext';
import useAuthStore from '../store/useAuthStore';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { createRoom, joinError, leaveRoom } = useMultiplayer();
  
  const [stories, setStories] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [mode, setMode] = useState('CONJUNTO');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Clear previous game room state when accessing host dashboard setup
  useEffect(() => {
    leaveRoom();
  }, [leaveRoom]);

  // Fetch available stories
  useEffect(() => {
    const fetchStories = async () => {
      try {
        const token = useAuthStore.getState().token;
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('http://127.0.0.1:8000/api/stories/', { headers });
        if (res.status === 401) {
          useAuthStore.getState().logout();
          const retryRes = await fetch('http://127.0.0.1:8000/api/stories/');
          if (!retryRes.ok) throw new Error('Error fetching stories list.');
          const data = await retryRes.json();
          setStories(data);
          if (data.length > 0) {
            setSelectedStoryId(data[0].id);
          }
          return;
        }
        if (!res.ok) throw new Error('Error fetching stories list.');
        const data = await res.json();
        setStories(data);
        if (data.length > 0) {
          setSelectedStoryId(data[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!selectedStoryId) return;

    setSubmitting(true);
    try {
      const pin = await createRoom(selectedStoryId, mode);
      navigate(`/host/${pin}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <button onClick={() => navigate('/')} className="btn-back">
          ← Volver
        </button>
        <h1>Panel de Host Multijugador</h1>
        <p>Inicia una sala estilo "Kahoot" para proyectar la aventura en grupo.</p>
      </div>

      <div className="dashboard-card">
        {loading ? (
          <div className="loader-container">
            <div className="spinner"></div>
            <p>Cargando aventuras disponibles...</p>
          </div>
        ) : stories.length === 0 ? (
          <div className="no-stories-message">
            <p>⚠️ No hay historias creadas. Primero debes ir al Editor para crear una.</p>
            <button onClick={() => navigate('/create')} className="btn btn-primary">
              Crear Aventura
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateRoom} className="room-creation-form">
            <div className="form-group">
              <label htmlFor="story-select">1. Selecciona la Aventura</label>
              <select
                id="story-select"
                value={selectedStoryId}
                onChange={(e) => setSelectedStoryId(e.target.value)}
              >
                {stories.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title} {story.use_resource_system ? '(Con recursos)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>2. Modo de Juego</label>
              <div className="modes-grid">
                <div 
                  className={`mode-option ${mode === 'CONJUNTO' ? 'active' : ''}`}
                  onClick={() => setMode('CONJUNTO')}
                >
                  <h3>Modo Síncrono 👥</h3>
                  <p>Consenso grupal. El Host proyecta la pantalla y avanza la historia tras el voto democrático de la clase.</p>
                </div>
                <div 
                  className={`mode-option ${mode === 'SEPARADO' ? 'active' : ''}`}
                  onClick={() => setMode('SEPARADO')}
                >
                  <h3>Modo Auto-guiado ⏱️</h3>
                  <p>Ritmo individual. Todos comparten el lobby, pero cada alumno navega a su propio ritmo. El Host vigila el progreso.</p>
                </div>
              </div>
            </div>

            {joinError && <div className="error-alert">⚠️ Error: {joinError}</div>}

            <button 
              type="submit" 
              className="btn btn-create-lobby"
              disabled={submitting}
            >
              {submitting ? 'Creando Sala...' : 'Crear Sala y Obtener PIN →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
