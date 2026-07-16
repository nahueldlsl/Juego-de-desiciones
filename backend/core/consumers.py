import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.db.models import Count
from .services import GameEngineService
from .models import Room, Participant, Vote, Scene, Choice

class GameRoomConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket Consumer responsible for routing real-time room events (Kahoot-style).
    Deliberately separates network routing (Consumers) from transactional business logic (GameEngineService).
    """

    async def connect(self):
        self.room_pin = self.scope['url_route']['kwargs']['room_pin']
        self.room_group_name = f"room_{self.room_pin}"
        self.is_host = False

        # Extract host_key from query string to authorize Host role
        from urllib.parse import parse_qs
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        host_key = query_params.get('host_key', [None])[0]

        # Validate that the room exists and check if client is the host
        room_exists, is_host = await self.db_validate_room_and_host(self.room_pin, host_key)
        if not room_exists:
            await self.accept()
            await self.close(code=4004) # Close with custom room-not-found code
            return

        self.is_host = is_host

        # Join room group channel
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group channel
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive_json(self, content):
        event_type = content.get('type')
        if not event_type:
            await self.send_json({'type': 'error', 'message': 'Missing event type.'})
            return

        if event_type == 'join_room':
            nickname = content.get('nickname')
            session_key = content.get('session_key')
            avatar = content.get('avatar', '👤')
            
            participant, is_new_join, error = await self.db_join_room(nickname, session_key, avatar)
            if error:
                await self.send_json({'type': 'error', 'message': error})
                return

            # Notify the sender that join was successful
            await self.send_json({
                'type': 'join_success',
                'participant': {
                    'id': str(participant.id),
                    'nickname': participant.nickname,
                    'current_scene_id': str(participant.current_scene_id) if participant.current_scene_id else None
                }
            })

            # Broadcast updated room state to lobby group
            room_state = await self.db_get_room_state()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'room_state_update',
                    'state': room_state
                }
            )

        elif event_type == 'submit_vote':
            session_key = content.get('session_key')
            choice_id = content.get('choice_id')
            reaction_time_ms = content.get('reaction_time_ms', 0)

            vote, error = await self.db_submit_vote(session_key, choice_id, reaction_time_ms)
            if error:
                await self.send_json({'type': 'error', 'message': error})
                return

            await self.send_json({'type': 'vote_registered', 'choice_id': choice_id})

            # Broadcast updated room state (voter counts) to group so host updates live bar charts
            room_state = await self.db_get_room_state()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'room_state_update',
                    'state': room_state
                }
            )

        elif event_type == 'node_transition':
            session_key = content.get('session_key')
            next_scene_id = content.get('next_scene_id')

            participant, error = await self.db_record_transition(session_key, next_scene_id)
            if error:
                await self.send_json({'type': 'error', 'message': error})
                return

            await self.send_json({
                'type': 'transition_registered', 
                'current_scene_id': next_scene_id
            })

            # Broadcast state (Host dashboard tracks who is where)
            room_state = await self.db_get_room_state()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'room_state_update',
                    'state': room_state
                }
            )

        elif event_type == 'start_game':
            if not self.is_host:
                await self.send_json({'type': 'error', 'message': 'No autorizado: solo el Host puede iniciar la partida.'})
                return
            room, success = await self.db_start_game()
            if success:
                room_state = await self.db_get_room_state()
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_started',
                        'current_scene_id': str(room.current_scene_id),
                        'state': room_state
                    }
                )

        elif event_type == 'next_scene':
            if not self.is_host:
                await self.send_json({'type': 'error', 'message': 'No autorizado: solo el Host puede avanzar la escena.'})
                return
            forced_choice_id = content.get('forced_choice_id')
            client_scene_id = content.get('current_scene_id')
            print(f"[WS next_scene] resolving round. forced_choice_id: {forced_choice_id}, client_scene_id: {client_scene_id}")
            next_scene, votes_chart, error = await self.db_resolve_voting_round(forced_choice_id, client_scene_id)
            print(f"[WS next_scene] resolution result: next_scene={next_scene.title if next_scene else None}, error={error}")
            
            if error == 'END_OF_STORY':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_over',
                        'votes_chart': votes_chart
                    }
                )
            elif error:
                await self.send_json({'type': 'error', 'message': error})
            else:
                room_state = await self.db_get_room_state()
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'scene_changed',
                        'current_scene_id': str(next_scene.id),
                        'votes_chart': votes_chart,
                        'state': room_state
                    }
                )

    # Group message handlers (translate incoming group broadcasts into WebSocket frames)
    async def room_state_update(self, event):
        await self.send_json({
            'type': 'room_state_update',
            'state': event['state']
        })

    async def game_started(self, event):
        await self.send_json({
            'type': 'game_started',
            'current_scene_id': event['current_scene_id'],
            'state': event['state']
        })

    async def scene_changed(self, event):
        await self.send_json({
            'type': 'scene_changed',
            'current_scene_id': event['current_scene_id'],
            'votes_chart': event['votes_chart'],
            'state': event['state']
        })

    async def game_over(self, event):
        await self.send_json({
            'type': 'game_over',
            'votes_chart': event['votes_chart']
        })

    # Database sync wrappers pointing to transactional Domain Services
    @database_sync_to_async
    def db_validate_room_and_host(self, pin, host_key):
        try:
            room = Room.objects.get(pin_code=pin)
            is_host = False
            if host_key and str(room.host_key) == str(host_key):
                is_host = True
            return True, is_host
        except Room.DoesNotExist:
            return False, False

    @database_sync_to_async
    def db_join_room(self, nickname, session_key, avatar):
        return GameEngineService.join_room(self.room_pin, nickname, session_key, avatar)

    @database_sync_to_async
    def db_start_game(self):
        return GameEngineService.start_game(self.room_pin)

    @database_sync_to_async
    def db_submit_vote(self, session_key, choice_id, reaction_time_ms=0):
        return GameEngineService.submit_vote(self.room_pin, session_key, choice_id, reaction_time_ms)

    @database_sync_to_async
    def db_record_transition(self, session_key, next_scene_id):
        return GameEngineService.record_transition(self.room_pin, session_key, next_scene_id)

    @database_sync_to_async
    def db_resolve_voting_round(self, forced_choice_id, client_scene_id=None):
        return GameEngineService.resolve_voting_round(self.room_pin, forced_choice_id, client_scene_id)

    @database_sync_to_async
    def db_get_room_state(self):
        """
        Gathers a comprehensive snapshot of the active room state.
        Contains participants list, current scene details, and choice vote counters.
        """
        try:
            room = Room.objects.select_related('story', 'current_scene').get(pin_code=self.room_pin)
        except Room.DoesNotExist:
            return {}

        participants_list = []
        for p in room.participants.select_related('current_scene').all():
            participants_list.append({
                'nickname': p.nickname,
                'avatar': p.avatar,
                'current_scene_id': str(p.current_scene_id) if p.current_scene_id else None,
                'current_scene_title': p.current_scene.title if p.current_scene else 'Lobby'
            })

        # Calculate votes details for host projection charts
        votes_count_map = {}
        total_votes = 0
        if room.current_scene:
            votes = Vote.objects.filter(room=room, scene=room.current_scene)
            total_votes = votes.count()
            counts = votes.values('choice_id').annotate(count=Count('id'))
            votes_count_map = {str(item['choice_id']): item['count'] for item in counts}

        choices_list = []
        if room.current_scene:
            for ch in room.current_scene.choices.all():
                votes_val = votes_count_map.get(str(ch.id), 0)
                choices_list.append({
                    'choice_id': str(ch.id),
                    'choice_text': ch.text,
                    'votes_count': votes_val,
                    'votes_percentage': (votes_val / total_votes * 100) if total_votes > 0 else 0
                })

        return {
            'pin_code': room.pin_code,
            'story_id': str(room.story_id),
            'story_title': room.story.title,
            'mode': room.mode,
            'status': room.status,
            'current_scene_id': str(room.current_scene_id) if room.current_scene_id else None,
            'current_scene_title': room.current_scene.title if room.current_scene else None,
            'participants': participants_list,
            'choices_votes': choices_list,
            'total_votes': total_votes
        }
