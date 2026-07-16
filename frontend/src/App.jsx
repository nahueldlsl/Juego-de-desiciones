import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { MultiplayerProvider } from './context/MultiplayerContext';
import Home from './pages/Home';
import Game from './pages/Game';
import Editor from './pages/Editor';
import Dashboard from './pages/Dashboard';
import HostView from './pages/HostView';
import JoinRoom from './pages/JoinRoom';
import GuestPlayer from './pages/GuestPlayer';
import TeacherDashboard from './pages/TeacherDashboard';
import UserManagement from './pages/UserManagement';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <MultiplayerProvider>
      <GameProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/play/:storyId" element={<Game />} />
            
            {/* Protected Editor and Dashboard */}
            <Route path="/create" element={
              <ProtectedRoute allowedRoles={['SUPERADMIN', 'USER']}>
                <Editor />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['SUPERADMIN', 'USER', 'GUEST']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* Super Admin User Management Panel */}
            <Route path="/superadmin/users" element={
              <ProtectedRoute allowedRoles={['SUPERADMIN']}>
                <UserManagement />
              </ProtectedRoute>
            } />

            <Route path="/host/:roomPin" element={<HostView />} />
            <Route path="/host/:roomPin/analytics" element={<TeacherDashboard />} />
            <Route path="/join" element={<JoinRoom />} />
            <Route path="/play/lobby/:roomPin" element={<GuestPlayer />} />
          </Routes>
        </Router>
      </GameProvider>
    </MultiplayerProvider>
  );
}

export default App;

