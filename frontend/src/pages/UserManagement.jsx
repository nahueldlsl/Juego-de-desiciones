import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import './UserManagement.css';

const UserManagement = () => {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/users/?_t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Error al listar los usuarios del sistema.');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username) return;
    setSubmitting(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/users/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      if (!response.ok) {
        throw new Error('Error al crear la cuenta de usuario.');
      }

      setUsername('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/users/${userId}/toggle-status/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Error al cambiar el estado del usuario.');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleRole = async (userId) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/users/${userId}/toggle-role/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Error al modificar el rol del usuario.');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar permanentemente esta cuenta de usuario?')) {
      return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/users/${userId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Error al eliminar el usuario.');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="usermgmt-container">
      <div className="usermgmt-header">
        <button onClick={() => navigate('/')} className="btn-back">
          ← Volver al Home
        </button>
        <h1>Panel de Super Admin</h1>
        <p>Administración y asignación de roles a las cuentas del sistema.</p>
      </div>

      <div className="usermgmt-grid">
        {/* Left Side: Create User Form */}
        <div className="usermgmt-card form-card">
          <h2>Registrar Nuevo Usuario/Admin</h2>
          <form onSubmit={handleCreateUser}>
            <div className="form-group">
              <label htmlFor="username">Nombre de Usuario</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej: nuevo_usuario"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email (Opcional)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej: usuario@correo.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña Temporal</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear Cuenta ➔'}
            </button>
          </form>
        </div>

        {/* Right Side: Users List */}
        <div className="usermgmt-card list-card">
          <h2>Usuarios Registrados</h2>
          {loading ? (
            <div className="loader">Cargando usuarios...</div>
          ) : error ? (
            <div className="error-alert">⚠️ Error: {error}</div>
          ) : users.length === 0 ? (
            <p className="empty-message">No hay usuarios registrados en el sistema todavía.</p>
          ) : (
            <div className="table-responsive">
              <table className="usermgmt-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol Activo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={!u.is_active ? 'row-suspended' : ''}>
                      <td>
                        <strong>{u.username}</strong>
                      </td>
                      <td>{u.email || '-'}</td>
                      <td>
                        <span className={`badge badge-role ${u.role}`}>
                          {u.role === 'ADMIN' || u.role === 'SUPERADMIN' ? 'Admin 🎓' : 'Usuario 👤'}
                        </span>
                      </td>

                      <td>
                        <span className={`badge badge-status ${u.is_active ? 'active' : 'suspended'}`}>
                          {u.is_active ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => handleToggleRole(u.id)}
                            className="btn-action btn-role"
                            title="Cambiar rol"
                          >
                            🔄 Rol
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(u.id)}
                            className="btn-action btn-status"
                            title={u.is_active ? "Suspender" : "Activar"}
                          >
                            ⚠️ Status
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="btn-action btn-delete"
                            title="Eliminar permanentemente"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
