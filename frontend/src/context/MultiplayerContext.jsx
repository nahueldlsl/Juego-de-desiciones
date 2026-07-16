import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import useGameSocket from '../hooks/useGameSocket';
import useAuthStore from '../store/useAuthStore';

const MultiplayerContext = createContext(null);

export const MultiplayerProvider = ({ children }) => {
  // Initialize states from sessionStorage to survive page refreshes and isolate browser tabs
  const [roomPin, setRoomPin] = useState(() => {
    return sessionStorage.getItem('adventure_mp_room_pin') || null;
  });
  const [nickname, setNickname] = useState(() => {
    return sessionStorage.getItem('adventure_mp_nickname') || '';
  });
  const [avatar, setAvatar] = useState(() => {
    return sessionStorage.getItem('adventure_mp_avatar') || '👤';
  });
  const [role, setRole] = useState(() => {
    return sessionStorage.getItem('adventure_mp_role') || null;
  });
  const [sessionKey, setSessionKey] = useState(() => {
    return sessionStorage.getItem('adventure_mp_session_key') || '';
  });
  const [hostKey, setHostKey] = useState(() => {
    return sessionStorage.getItem('adventure_mp_host_key') || '';
  });
  
  // Real-time synchronization states (loaded dynamically from WebSocket)
  const [roomState, setRoomState] = useState(null);
  const [votesChart, setVotesChart] = useState(null);
  const [connected, setConnected] = useState(false);
  const [joinError, setJoinError] = useState(null);

  // Initialize or restore player reconnection session key (Idempotent per tab)
  useEffect(() => {
    let key = sessionStorage.getItem('adventure_mp_session_key');
    if (!key) {
      key = `session_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      sessionStorage.setItem('adventure_mp_session_key', key);
    }
    setSessionKey(key);
  }, []);

  // Define message receiver callbacks
  const handleMessage = useCallback((payload) => {
    const { type, state, message, votes_chart } = payload;
    console.log('Received WebSocket frame:', payload);

    switch (type) {
      case 'error':
        setJoinError(message);
        break;
      case 'join_success':
        setJoinError(null);
        break;
      case 'room_state_update':
        setRoomState(state);
        break;
      case 'game_started':
        setRoomState(state);
        break;
      case 'scene_changed':
        setRoomState(state);
        setVotesChart(votes_chart);
        break;
      case 'game_over':
        setVotesChart(votes_chart);
        setRoomState(prev => prev ? { ...prev, status: 'FINISHED' } : { status: 'FINISHED' });
        break;
      default:
        break;
    }
  }, []);

  const handleOpen = useCallback(() => {
    setConnected(true);
  }, []);

  const handleClose = useCallback(() => {
    setConnected(false);
  }, []);

  // Hook up useGameSocket
  const { send } = useGameSocket(roomPin, {
    onMessage: handleMessage,
    onOpen: handleOpen,
    onClose: handleClose,
  }, hostKey);

  // Automatically trigger join_room when socket connects as Guest
  useEffect(() => {
    if (connected && role === 'guest' && nickname && sessionKey) {
      console.log(`Sending join_room as Guest: nickname="${nickname}" avatar="${avatar}"`);
      send({
        type: 'join_room',
        nickname,
        session_key: sessionKey,
        avatar
      });
    }
  }, [connected, role, nickname, sessionKey, avatar, send]);

  // --- API / Control Operations ---

  // Host Action: Create a new room lobby for a story
  const createRoom = useCallback(async (storyId, mode = 'CONJUNTO') => {
    setJoinError(null);
    try {
      const token = useAuthStore.getState().token;
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://127.0.0.1:8000/api/rooms/create/', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ story_id: storyId, mode }),
      });

      if (!response.ok) {
        throw new Error('Failed to create game room.');
      }

      const data = await response.json();
      
      // Update states
      setRole('host');
      setRoomPin(data.pin_code);
      setHostKey(data.host_key || '');

      // Persist in tab session storage to survive reloads
      sessionStorage.setItem('adventure_mp_role', 'host');
      sessionStorage.setItem('adventure_mp_room_pin', data.pin_code);
      sessionStorage.setItem('adventure_mp_host_key', data.host_key || '');

      return data.pin_code;
    } catch (err) {
      setJoinError(err.message);
      throw err;
    }
  }, []);

  // Guest Action: Enter a room lobby using PIN code
  const joinRoom = useCallback((pin, name, selectedAvatar = '👤') => {
    setJoinError(null);
    
    // Update states
    setRole('guest');
    setNickname(name);
    setAvatar(selectedAvatar);
    setRoomPin(pin);

    // Persist in tab session storage to survive reloads
    sessionStorage.setItem('adventure_mp_role', 'guest');
    sessionStorage.setItem('adventure_mp_nickname', name);
    sessionStorage.setItem('adventure_mp_avatar', selectedAvatar);
    sessionStorage.setItem('adventure_mp_room_pin', pin);
  }, []);

  // Host Action: Start the game (from lobby to scene 1)
  const startGame = useCallback(() => {
    if (role !== 'host') {
      console.warn('startGame failed: role is not Host', role);
      return;
    }
    send({ type: 'start_game' });
  }, [role, send]);

  // Guest Action: Submit choice vote (Modo Conjunto)
  const submitVote = useCallback((choiceId, reactionTimeMs = 0) => {
    if (role !== 'guest') return;
    send({
      type: 'submit_vote',
      session_key: sessionKey,
      choice_id: choiceId,
      reaction_time_ms: reactionTimeMs
    });
  }, [role, sessionKey, send]);

  // Guest Action: Self-pace transition to next node (Modo Separado)
  const submitTransition = useCallback((nextSceneId) => {
    if (role !== 'guest') return;
    send({
      type: 'node_transition',
      session_key: sessionKey,
      next_scene_id: nextSceneId
    });
  }, [role, sessionKey, send]);

  // Host Action: Advance síncrono scene, democratic or forced
  const nextScene = useCallback((forcedChoiceId = null, currentSceneId = null) => {
    if (role !== 'host') return;
    send({
      type: 'next_scene',
      forced_choice_id: forcedChoiceId,
      current_scene_id: currentSceneId
    });
    setVotesChart(null); // Clear previous results
  }, [role, send]);

  // Exit lobby / disconnect
  const leaveRoom = useCallback(() => {
    setRoomPin(null);
    setNickname('');
    setAvatar('👤');
    setRole(null);
    setRoomState(null);
    setVotesChart(null);
    setConnected(false);
    setJoinError(null);
    setHostKey('');

    // Wipe tab storage
    sessionStorage.removeItem('adventure_mp_role');
    sessionStorage.removeItem('adventure_mp_nickname');
    sessionStorage.removeItem('adventure_mp_avatar');
    sessionStorage.removeItem('adventure_mp_room_pin');
    sessionStorage.removeItem('adventure_mp_host_key');
  }, []);

  const value = {
    roomPin,
    nickname,
    role,
    avatar,
    sessionKey,
    hostKey,
    roomState,
    votesChart,
    connected,
    joinError,
    createRoom,
    joinRoom,
    startGame,
    submitVote,
    submitTransition,
    nextScene,
    leaveRoom
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
};

export const useMultiplayer = () => {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  }
  return context;
};
