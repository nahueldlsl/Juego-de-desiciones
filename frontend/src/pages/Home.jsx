import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useMultiplayer } from '../context/MultiplayerContext';
import useAuthStore from '../store/useAuthStore';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { loadStory } = useGame();
  const { leaveRoom } = useMultiplayer();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { role, user } = useAuthStore();

  const canModifyStory = (story) => {
    if (role === 'SUPERADMIN') return true;
    const userId = user?.user_id || user?.id;
    if (role === 'ADMIN' && userId && story.author_id === userId) return true;
    return false;
  };

  // Clear previous game room state when accessing the main landing screen
  useEffect(() => {
    leaveRoom();
  }, [leaveRoom]);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const token = useAuthStore.getState().token;
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch('http://127.0.0.1:8000/api/stories/', { headers });
        if (response.status === 401) {
          useAuthStore.getState().logout();
          const retryResponse = await fetch('http://127.0.0.1:8000/api/stories/');
          if (!retryResponse.ok) {
            throw new Error('No se pudieron cargar las historias.');
          }
          const data = await retryResponse.json();
          setStories(data);
          return;
        }
        if (!response.ok) {
          throw new Error('No se pudieron cargar las historias.');
        }
        const data = await response.json();
        setStories(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, []);

  const handleDeleteStory = async (storyId, e) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta historia? Se borrarán todos sus nodos y opciones asociadas.")) {
      return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/stories/${storyId}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Error al intentar eliminar la historia.');
      }
      setStories(prev => prev.filter(story => story.id !== storyId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePlayStory = async (storyId) => {
    await loadStory(storyId);
    navigate(`/play/${storyId}`);
  };

  const handleCreateStoryClick = () => {
    if (role === 'GUEST') {
      navigate('/login?message=create');
    } else {
      navigate('/create');
    }
  };

  return (
    <div className="home-container">
      {/* Decorative Blur Background circles */}
      <div className="blur-circle circle-1"></div>
      <div className="blur-circle circle-2"></div>

      {/* User Auth widget */}
      <div className="auth-widget" style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '12px', alignItems: 'center', zIndex: 10 }}>
        {role !== 'GUEST' ? (
          <>
            <span style={{ fontSize: '0.9rem', color: '#a0aec0' }}>
              Conectado como <strong>{user?.username || 'Usuario'}</strong> ({role === 'SUPERADMIN' ? 'Super Admin' : 'Profesor'})
            </span>
            {role === 'SUPERADMIN' && (
              <button onClick={() => navigate('/superadmin/users')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.2)', borderColor: '#8b5cf6', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}>
                ⚙️ Admin
              </button>
            )}
            <button onClick={() => { useAuthStore.getState().logout(); window.location.reload(); }} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '6px', cursor: 'pointer' }}>
              Cerrar Sesión
            </button>
          </>
        ) : (
          <button onClick={() => navigate('/login')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Iniciar Sesión 🎓
          </button>
        )}
      </div>

      <header className="home-header">
        <h1 className="hero-title">ECOS DEL DESTINO</h1>
        <p className="hero-subtitle">Plataforma de Aventuras Interactivas Ramificadas</p>
      </header>

      <main className="home-main">
        {/* Navigation Action Paths */}
        <section className="actions-section">
          <div className="action-card primary" onClick={handleCreateStoryClick}>
            <div className="card-badge">FORJADOR</div>
            <h2>Crear Historia</h2>
            <p>Dibuja grafos narrativos complejos, sube multimedia y edita decisiones con temporizadores dinámicos.</p>
            <span className="card-link">Acceder al Editor ➔</span>
          </div>

          <div className="action-card secondary" onClick={() => navigate('/dashboard')}>
            <div className="card-badge">HOST MULTIPLAYER</div>
            <h2>Crear Sala Grupo</h2>
            <p>Proyecta partidas multijugador síncronas/asíncronas en tiempo real estilo "Kahoot".</p>
            <span className="card-link">Crear Lobby ➔</span>
          </div>

          <div className="action-card tertiary" onClick={() => navigate('/join')} style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)', border: '1px solid rgba(139, 92, 246, 0.15)', cursor: 'pointer', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
            <div>
              <div className="card-badge" style={{ background: '#8b5cf6', display: 'inline-block', fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', color: '#fff', marginBottom: '16px' }}>JUGADOR MULTI</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '0 0 10px 0', color: '#fff' }}>Unirse a una Sala</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#a0aec0', lineHeight: '1.5' }}>Introduce el PIN del Host para participar en decisiones democráticas desde tu móvil.</p>
            </div>
            <span className="card-link" style={{ color: '#c084fc', marginTop: '16px', display: 'inline-block', fontWeight: '700', fontSize: '0.85rem' }}>Unirse con PIN ➔</span>
          </div>
        </section>

        {/* Stories Listing Section */}
        <section className="stories-section">
          <h3>Historias Disponibles</h3>
          
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Conectando con el servidor de historias...</p>
            </div>
          ) : error ? (
            <div className="error-message">
              <p>⚠️ No se pudo establecer conexión con la API de Django en `http://127.0.0.1:8000`. Asegúrate de que el backend esté corriendo.</p>
              <p className="error-details">Detalles: {error}</p>
            </div>
          ) : stories.length === 0 ? (
            <div className="empty-stories">
              <p>No hay historias guardadas en la base de datos local.</p>
              <button onClick={handleCreateStoryClick} className="btn btn-primary">
                Crear la primera Historia
              </button>
            </div>
          ) : (
            <div className="stories-grid">
              {stories.map((story) => (
                <div key={story.id} className="story-card">
                  <div className="story-card-body">
                    <h4>{story.title}</h4>
                    <p>{story.description || 'Sin descripción disponible.'}</p>
                  </div>
                  <div className="story-card-footer">
                    <button 
                      onClick={() => handlePlayStory(story.id)} 
                      className="btn btn-play"
                      disabled={!story.start_scene_id}
                    >
                      {story.start_scene_id ? 'Jugar Aventura ➔' : 'Sin Inicio ⚠️'}
                    </button>
                    {canModifyStory(story) && (
                      <div className="card-admin-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button 
                          onClick={() => navigate(`/create?storyId=${story.id}`)}
                          className="btn btn-edit-story"
                          style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                        >
                          Editar ✏️
                        </button>
                        <button 
                          onClick={(e) => handleDeleteStory(story.id, e)}
                          className="btn btn-delete-story"
                          style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                        >
                          Borrar 🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Home;
