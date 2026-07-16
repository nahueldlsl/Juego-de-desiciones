import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || '/';

  const queryParams = new URLSearchParams(location.search);
  const showInviteMessage = queryParams.get('message') === 'create';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error('Credenciales incorrectas o usuario inactivo.');
      }

      const data = await response.json();
      login(data.access);
      
      // Redirect to target path or home
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background decorations */}
      <div className="blur-circle circle-1"></div>
      <div className="blur-circle circle-2"></div>

      <div className="login-card">
        <div className="login-header">
          <h1>ECOS DEL DESTINO</h1>
          <p>Identificación para Creadores de Contenido y Administradores</p>
        </div>

        {showInviteMessage && (
          <div className="invite-box" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#c084fc' }}>🎓 ¡Crea tu Aventura!</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#a0aec0', lineHeight: '1.4' }}>
              Para forjar y publicar narrativas interactivas personalizadas, debes iniciar sesión con una cuenta registrada. Si aún no tienes una, ¡regístrate gratis!
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-alert">⚠️ {error}</div>}

          <div className="form-group">
            <label htmlFor="username">Nombre de Usuario</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej: mi_usuario"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Validando...' : 'Iniciar Sesión ➔'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>¿No tienes una cuenta? <span onClick={() => navigate('/register')} style={{ color: '#8b5cf6', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Regístrate aquí</span></p>
          <button onClick={() => navigate('/')} className="btn-secondary">
            Volver al Inicio
          </button>
        </div>

      </div>
    </div>
  );
};

export default Login;
