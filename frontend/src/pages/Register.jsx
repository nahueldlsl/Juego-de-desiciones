import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al registrar el usuario.');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      {/* Background decorations */}
      <div className="blur-circle circle-1"></div>
      <div className="blur-circle circle-2"></div>

      <div className="register-card">
        <div className="register-header">
          <h1>REGISTRO DE USUARIO</h1>
          <p>Crea tu cuenta para forjar tus propias historias y publicarlas</p>
        </div>

        {success ? (
          <div className="success-box" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#34d399' }}>🎉 ¡Registro Exitoso!</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#a0aec0' }}>Redirigiéndote al inicio de sesión...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="register-form">
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
              <label htmlFor="email">Correo Electrónico (Opcional)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej: usuario@correo.com"
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

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn-register" disabled={loading}>
              {loading ? 'Registrando...' : 'Crear Cuenta ➔'}
            </button>
          </form>
        )}
        
        <div className="register-footer">
          <p>¿Ya tienes una cuenta? <span onClick={() => navigate('/login')} className="link-login">Inicia Sesión</span></p>
          <button onClick={() => navigate('/')} className="btn-secondary">
            Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
