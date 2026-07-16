import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayer } from '../context/MultiplayerContext';
import './JoinRoom.css';

const PRESET_EMOJIS = ['👤', '🦊', '🐱', '🐼', '🐨', '🐯', '🦁', '🦖', '🚀', '🛸', '🎮', '👾', '🎨', '🍕', '🍩', '🍀', '🧙', '👽', '👻', '🤖'];

const JoinRoom = () => {
  const navigate = useNavigate();
  const { joinRoom, roomState, joinError, connected, leaveRoom } = useMultiplayer();

  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('👤');
  const [customAvatar, setCustomAvatar] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Clear previous game room state when accessing guest join screen
  useEffect(() => {
    leaveRoom();
  }, [leaveRoom]);

  // If the player successfully joins and socket gets state, redirect to guest lobby/player
  useEffect(() => {
    if (roomState && connected) {
      navigate(`/play/lobby/${roomState.pin_code}`);
    }
  }, [roomState, connected, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) return;

    setSubmitting(true);
    const finalAvatar = customAvatar.trim() ? customAvatar.trim() : selectedAvatar;
    joinRoom(pin.trim(), nickname.trim(), finalAvatar);
    setSubmitting(false);
  };

  const handleCustomAvatarChange = (e) => {
    const val = e.target.value;
    // Simple filter to take the first character or emoji
    setCustomAvatar(val);
  };

  return (
    <div className="join-container">
      <div className="join-card animate-pop-in">
        <div className="join-logo">{customAvatar.trim() ? customAvatar.trim() : selectedAvatar}</div>
        <h1>Unirse a Aventura</h1>
        <p>Introduce el PIN de la sala, tu apodo y elige un avatar emoji.</p>

        <form onSubmit={handleSubmit} className="join-form">
          <div className="form-group">
            <input 
              type="text" 
              maxLength="6"
              placeholder="PIN DE SALA"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // Digits only
              required
              className="pin-input"
            />
          </div>

          <div className="form-group">
            <input 
              type="text" 
              maxLength="15"
              placeholder="TU APODO (NICKNAME)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              className="nickname-input"
            />
          </div>

          {/* Emoji Avatar Selector */}
          <div className="avatar-picker-section">
            <label className="picker-label">Elige tu Avatar Emoji</label>
            <div className="avatar-carousel">
              <button
                type="button"
                className="carousel-arrow"
                onClick={() => {
                  const currentIndex = PRESET_EMOJIS.indexOf(selectedAvatar);
                  const prevIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + PRESET_EMOJIS.length) % PRESET_EMOJIS.length;
                  setSelectedAvatar(PRESET_EMOJIS[prevIndex]);
                  setCustomAvatar('');
                }}
              >
                ◀
              </button>
              <div className="avatar-display">
                {customAvatar.trim() ? customAvatar.trim() : selectedAvatar}
              </div>
              <button
                type="button"
                className="carousel-arrow"
                onClick={() => {
                  const currentIndex = PRESET_EMOJIS.indexOf(selectedAvatar);
                  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PRESET_EMOJIS.length;
                  setSelectedAvatar(PRESET_EMOJIS[nextIndex]);
                  setCustomAvatar('');
                }}
              >
                ▶
              </button>
            </div>
            
            <div className="custom-emoji-row">
              <input
                type="text"
                placeholder="O escribe cualquier otro emoji..."
                value={customAvatar}
                onChange={handleCustomAvatarChange}
                maxLength="4"
                className="custom-avatar-input"
              />
            </div>
          </div>

          {joinError && <div className="join-error-banner">⚠️ {joinError}</div>}

          <button 
            type="submit" 
            className="btn btn-join-submit"
            disabled={submitting}
          >
            {submitting ? 'Conectando...' : '¡Entrar a Jugar! ➔'}
          </button>
        </form>

        <button 
          onClick={() => {
            leaveRoom();
            navigate('/');
          }} 
          className="btn btn-join-cancel"
        >
          Volver a Inicio
        </button>
      </div>
    </div>
  );
};

export default JoinRoom;
