from django.db import transaction
from django.db.models import Count
from .models import Story, Scene, Choice, StoryResource, ChoiceResourceImpact, Room, Participant, Vote, VoteRecord

class StoryGraphPersister:
    """
    Service class responsible for validating, resolving, and persisting 
    a directed graph of stories, scenes, and choices in a database.
    
    Adheres to the Single Responsibility Principle (SRP) and the GRASP Creator pattern.
    """
    
    @staticmethod
    @transaction.atomic
    def persist(title: str, description: str, start_scene_temp_id: str, scenes_data: list, story_resources_data: list = None) -> tuple:
        """
        Creates and connects Story, Scene, Choice, and StoryResource models atomically.
        Handles temp ID translation to avoid cyclical reference failures in DB creation.
        """
        if not title:
            raise ValueError("Story title is required.")

        # 1. Instantiate the Story container (GRASP: Creator)
        story = Story.objects.create(title=title, description=description)

        # 2. Phase 1: Create all Scene nodes without relational links
        temp_id_map = {}
        for scene_data in scenes_data:
            temp_id = scene_data.get('temp_id') or scene_data.get('id')
            if not temp_id:
                raise ValueError("Every scene node must have a unique identifier.")

            scene = Scene.objects.create(
                story=story,
                title=scene_data.get('title', 'Untitled Scene'),
                description=scene_data.get('description', ''),
                media_type=scene_data.get('media_type', 'IMAGE'),
                decision_trigger_time=scene_data.get('decision_trigger_time'),
                pause_on_decision=scene_data.get('pause_on_decision', True),
                timer_duration=scene_data.get('timer_duration'),
            )
            temp_id_map[str(temp_id)] = scene

        # 3. Phase 2: Link the Entry Point (start_scene)
        if start_scene_temp_id:
            start_scene = temp_id_map.get(str(start_scene_temp_id))
            if not start_scene:
                raise ValueError(f"Starting scene '{start_scene_temp_id}' not found in the graph.")
            story.start_scene = start_scene
            story.save()

        # 4. Phase 3: Create StoryResources
        resource_id_map = {}
        for r_data in (story_resources_data or []):
            r_temp_id = r_data.get('temp_id') or r_data.get('id')
            if not r_temp_id:
                raise ValueError("Every resource parameter must have an identifier.")

            game_over_scene = None
            go_scene_temp = r_data.get('game_over_scene_temp_id') or r_data.get('game_over_scene_id')
            if go_scene_temp:
                game_over_scene = temp_id_map.get(str(go_scene_temp))

            resource = StoryResource.objects.create(
                story=story,
                name=r_data.get('name', 'Resource'),
                initial_value=int(r_data.get('initial_value', 100)),
                trigger_limit=int(r_data.get('trigger_limit', 0)),
                trigger_condition=r_data.get('trigger_condition', 'LTE'),
                game_over_scene=game_over_scene
            )
            resource_id_map[str(r_temp_id)] = resource

        # 5. Phase 4: Set fallback default scenes and create choice edges
        for scene_data in scenes_data:
            temp_id = scene_data.get('temp_id') or scene_data.get('id')
            current_scene = temp_id_map.get(str(temp_id))
            if not current_scene:
                continue

            # Set timer timeout fallback target
            default_next_temp_id = scene_data.get('default_next_scene_temp_id') or scene_data.get('default_next_scene_id')
            if default_next_temp_id:
                fallback_scene = temp_id_map.get(str(default_next_temp_id))
                if not fallback_scene:
                    raise ValueError(f"Default next scene '{default_next_temp_id}' not found for scene '{current_scene.title}'.")
                current_scene.default_next_scene = fallback_scene
                current_scene.save()

            # Create choice directed edges
            choices_data = scene_data.get('choices', [])
            for choice_data in choices_data:
                text = choice_data.get('text')
                next_temp_id = choice_data.get('next_scene_temp_id') or choice_data.get('next_scene_id')
                
                if not text or not next_temp_id:
                    raise ValueError("All choices must have label text and a target scene destination.")

                target_scene = temp_id_map.get(str(next_temp_id))
                if not target_scene:
                    raise ValueError(f"Choice destination target '{next_temp_id}' not found in the graph.")

                choice = Choice.objects.create(
                    source_scene=current_scene,
                    text=text,
                    next_scene=target_scene
                )

                # Create choice resource impacts
                impacts_data = choice_data.get('resource_impacts', [])
                for impact_data in impacts_data:
                    res_temp_id = impact_data.get('resource_temp_id') or impact_data.get('resource_id')
                    if res_temp_id:
                        resource = resource_id_map.get(str(res_temp_id))
                        if resource:
                            ChoiceResourceImpact.objects.create(
                                choice=choice,
                                resource=resource,
                                impact_value=int(impact_data.get('impact_value', 0))
                            )

        return story, temp_id_map

    @staticmethod
    @transaction.atomic
    def update_graph(story_id: str, title: str, description: str, start_scene_temp_id: str, scenes_data: list, story_resources_data: list = None) -> tuple:
        """
        Updates an existing story and synchronizes its scenes, resources, and choices.
        Performs creations, updates, and deletes of scene nodes based on incoming data.
        """
        try:
            story = Story.objects.get(pk=story_id)
        except Story.DoesNotExist:
            raise ValueError(f"Story with ID {story_id} does not exist.")

        story.title = title
        story.description = description
        story.save()

        # Get existing scenes to identify deletions
        existing_scenes = {str(scene.id): scene for scene in story.scenes.all()}
        incoming_scene_ids = set()
        temp_id_map = {}

        # 1. Create or update scenes
        for scene_data in scenes_data:
            scene_id = scene_data.get('id') or scene_data.get('temp_id')
            
            if scene_id and str(scene_id) in existing_scenes:
                scene_instance = existing_scenes[str(scene_id)]
                incoming_scene_ids.add(str(scene_id))
                
                # Update details
                scene_instance.title = scene_data.get('title', 'Untitled Scene')
                scene_instance.description = scene_data.get('description', '')
                scene_instance.media_type = scene_data.get('media_type', 'IMAGE')
                scene_instance.decision_trigger_time = scene_data.get('decision_trigger_time')
                scene_instance.pause_on_decision = scene_data.get('pause_on_decision', True)
                scene_instance.timer_duration = scene_data.get('timer_duration')
                scene_instance.save()
            else:
                # Create a new Scene node
                scene_instance = Scene.objects.create(
                    story=story,
                    title=scene_data.get('title', 'Untitled Scene'),
                    description=scene_data.get('description', ''),
                    media_type=scene_data.get('media_type', 'IMAGE'),
                    decision_trigger_time=scene_data.get('decision_trigger_time'),
                    pause_on_decision=scene_data.get('pause_on_decision', True),
                    timer_duration=scene_data.get('timer_duration'),
                )
            
            temp_id_map[str(scene_id)] = scene_instance

        # 2. Delete database scenes that were removed from the frontend graph editor
        for sid, scene in existing_scenes.items():
            if sid not in incoming_scene_ids:
                scene.delete()

        # 3. Link story entry point
        if start_scene_temp_id:
            start_scene = temp_id_map.get(str(start_scene_temp_id))
            if start_scene:
                story.start_scene = start_scene
                story.save()

        # 4. Synchronize StoryResources
        existing_resources = {str(r.id): r for r in story.story_resources.all()}
        incoming_resource_ids = set()
        resource_id_map = {}

        for r_data in (story_resources_data or []):
            r_id = r_data.get('id') or r_data.get('temp_id')
            
            go_scene_temp = r_data.get('game_over_scene_temp_id') or r_data.get('game_over_scene_id')
            game_over_scene = None
            if go_scene_temp:
                game_over_scene = temp_id_map.get(str(go_scene_temp))

            if r_id and str(r_id) in existing_resources:
                resource_instance = existing_resources[str(r_id)]
                incoming_resource_ids.add(str(r_id))
                
                resource_instance.name = r_data.get('name', 'Resource')
                resource_instance.initial_value = int(r_data.get('initial_value', 100))
                resource_instance.trigger_limit = int(r_data.get('trigger_limit', 0))
                resource_instance.trigger_condition = r_data.get('trigger_condition', 'LTE')
                resource_instance.game_over_scene = game_over_scene
                resource_instance.save()
            else:
                resource_instance = StoryResource.objects.create(
                    story=story,
                    name=r_data.get('name', 'Resource'),
                    initial_value=int(r_data.get('initial_value', 100)),
                    trigger_limit=int(r_data.get('trigger_limit', 0)),
                    trigger_condition=r_data.get('trigger_condition', 'LTE'),
                    game_over_scene=game_over_scene
                )
            resource_id_map[str(r_id)] = resource_instance

        # Delete database resources that were removed in the graph editor
        for rid, resource in existing_resources.items():
            if rid not in incoming_resource_ids:
                resource.delete()

        # 5. Re-link default fallback targets and recreate choice edges
        for scene_data in scenes_data:
            scene_id = scene_data.get('id') or scene_data.get('temp_id')
            current_scene = temp_id_map.get(str(scene_id))
            if not current_scene:
                continue

            # Clear choices for this scene since we recreate them
            current_scene.choices.all().delete()

            # Set timer timeout fallback target
            default_next_temp_id = scene_data.get('default_next_scene_temp_id') or scene_data.get('default_next_scene_id')
            if default_next_temp_id:
                fallback_scene = temp_id_map.get(str(default_next_temp_id))
                if fallback_scene:
                    current_scene.default_next_scene = fallback_scene
                    current_scene.save()
                else:
                    current_scene.default_next_scene = None
                    current_scene.save()
            else:
                current_scene.default_next_scene = None
                current_scene.save()

            # Recreate Choice edges
            choices_data = scene_data.get('choices', [])
            for choice_data in choices_data:
                text = choice_data.get('text')
                next_temp_id = choice_data.get('next_scene_temp_id') or choice_data.get('next_scene_id')
                
                if not text or not next_temp_id:
                    continue

                target_scene = temp_id_map.get(str(next_temp_id))
                if target_scene:
                    choice = Choice.objects.create(
                        source_scene=current_scene,
                        text=text,
                        next_scene=target_scene
                    )

                    # Create choice resource impacts
                    impacts_data = choice_data.get('resource_impacts', [])
                    for impact_data in impacts_data:
                        res_temp_id = impact_data.get('resource_temp_id') or impact_data.get('resource_id')
                        if res_temp_id:
                            resource = resource_id_map.get(str(res_temp_id))
                            if resource:
                                ChoiceResourceImpact.objects.create(
                                    choice=choice,
                                    resource=resource,
                                    impact_value=int(impact_data.get('impact_value', 0))
                                )

        return story, temp_id_map


class GameEngineService:
    """
    Core Domain Service responsible for multiplayer session transitions, voting rules,
    lobby participants joining, and idempotency states (Kahoot style).
    
    Adheres to SOLID (Single Responsibility) by keeping DB transaction logic separate from websocket channels communication.
    """

    @staticmethod
    @transaction.atomic
    def create_room_lobby(story_id: str, mode: str = 'CONJUNTO', host_user = None) -> tuple:
        """
        Creates a room lobby, generates a unique PIN code, sets up host user if needed.
        Encapsulates domain logic (SOLID / SRP).
        Returns (room, error_message).
        """
        import random
        import uuid
        from django.contrib.auth.models import User
        
        try:
            story = Story.objects.get(id=story_id)
        except Story.DoesNotExist:
            return None, "Story not found."

        # Generate unique 6-digit numeric PIN code
        pin_code = None
        for _ in range(10):
            code = "".join([str(random.randint(0, 9)) for _ in range(6)])
            if not Room.objects.filter(pin_code=code).exists():
                pin_code = code
                break

        if not pin_code:
            return None, "Failed to generate a unique room PIN. Please retry."

        room = Room.objects.create(
            pin_code=pin_code,
            host=host_user,
            story=story,
            mode=mode,
            status='WAITING',
            host_key=uuid.uuid4()
        )

        return room, None

    @staticmethod
    @transaction.atomic
    def join_room(room_pin: str, nickname: str, session_key: str, avatar: str = "👤") -> tuple:
        """
        Attempts to join a participant to a Room lobby.
        Returns (participant, is_new_join, error_message).
        Idempotent: If session_key matches, recovers current state.
        """
        try:
            room = Room.objects.get(pin_code=room_pin)
        except Room.DoesNotExist:
            return None, False, "La sala no existe o el PIN es inválido."

        if room.status == 'FINISHED':
            return None, False, "La partida ya ha finalizado."

        # Idempotency check: Reconnection by session_key
        existing_by_session = Participant.objects.filter(room=room, session_key=session_key).first()
        if existing_by_session:
            # Reconnected player. Update nickname and avatar if changed
            if existing_by_session.nickname != nickname or existing_by_session.avatar != avatar:
                # Ensure new nickname doesn't conflict
                if Participant.objects.filter(room=room, nickname=nickname).exclude(id=existing_by_session.id).exists():
                    return existing_by_session, False, None # Fallback to original nickname to avoid errors
                existing_by_session.nickname = nickname
                existing_by_session.avatar = avatar
                existing_by_session.save()
            return existing_by_session, False, None

        # Ensure nickname uniqueness within the room
        if Participant.objects.filter(room=room, nickname=nickname).exists():
            return None, False, "El apodo (nickname) ya está en uso en esta sala."

        # Register new participant
        # Initialize player current_scene to story's starting scene
        start_scene = room.story.start_scene
        participant = Participant.objects.create(
            room=room,
            nickname=nickname,
            session_key=session_key,
            avatar=avatar,
            current_scene=start_scene
        )
        return participant, True, None

    @staticmethod
    @transaction.atomic
    def start_game(room_pin: str) -> tuple:
        """
        Transitions Room status to PLAYING and initializes current scene for host-driven mode.
        """
        try:
            room = Room.objects.select_related('story', 'story__start_scene').get(pin_code=room_pin)
        except Room.DoesNotExist:
            raise ValueError("Room not found.")

        if room.status != 'WAITING':
            return room, False

        room.status = 'PLAYING'
        room.current_scene = room.story.start_scene
        room.save()

        # Update all participants' current scene to starting scene as well
        room.participants.all().update(current_scene=room.story.start_scene)
        
        return room, True

    @staticmethod
    @transaction.atomic
    def submit_vote(room_pin: str, session_key: str, choice_id: str, reaction_time_ms: int = 0) -> tuple:
        """
        Submits a participant's vote on the current scene (Síncrono/Modo Conjunto).
        Returns (vote, error_message).
        """
        try:
            room = Room.objects.get(pin_code=room_pin)
        except Room.DoesNotExist:
            return None, "Room not found."

        if room.status != 'PLAYING' or room.mode != 'CONJUNTO':
            return None, "Room is not active or is not in Host-driven mode."

        try:
            participant = Participant.objects.get(room=room, session_key=session_key)
        except Participant.DoesNotExist:
            return None, "Participant not registered in this room."

        try:
            choice = Choice.objects.get(id=choice_id)
        except Choice.DoesNotExist:
            return None, "Choice option not found."

        # Verify choice belongs to the active scene
        if choice.source_scene != room.current_scene:
            return None, "La opción elegida no pertenece a la escena actual."

        # Register vote (idempotent: updates existing vote if participant changes their mind)
        vote, created = Vote.objects.update_or_create(
            participant=participant,
            room=room,
            scene=room.current_scene,
            defaults={'choice': choice, 'reaction_time_ms': reaction_time_ms}
        )

        return vote, None

    @staticmethod
    @transaction.atomic
    def record_transition(room_pin: str, session_key: str, next_scene_id: str) -> tuple:
        """
        Moves participant current scene (Asíncrono/Modo Separado).
        """
        try:
            room = Room.objects.get(pin_code=room_pin)
        except Room.DoesNotExist:
            return None, "Room not found."

        if room.status != 'PLAYING' or room.mode != 'SEPARADO':
            return None, "Room is not active or is not in Self-paced mode."

        try:
            participant = Participant.objects.get(room=room, session_key=session_key)
        except Participant.DoesNotExist:
            return None, "Participant not registered in this room."

        try:
            next_scene = Scene.objects.get(id=next_scene_id, story=room.story)
        except Scene.DoesNotExist:
            return None, "Next scene not found in this story context."

        participant.current_scene = next_scene
        participant.save()

        return participant, None

    @staticmethod
    @transaction.atomic
    def resolve_voting_round(room_pin, forced_choice_id=None, client_scene_id=None):
        """
        Tallies votes and transitions the Room to the winning next scene (Síncrono/Modo Conjunto).
        If forced_choice_id is supplied, it overrides democratic evaluation.
        Returns (new_scene, votes_chart_list, error_message).
        """
        try:
            room = Room.objects.select_for_update().select_related('current_scene').get(pin_code=room_pin)
        except Room.DoesNotExist:
            return None, [], "Room not found."

        if room.status != 'PLAYING' or room.mode != 'CONJUNTO':
            return None, [], "Room not active in síncrono mode."

        # Guard against stale double-transition messages!
        if client_scene_id and str(room.current_scene_id) != str(client_scene_id):
            print(f"[resolve_voting_round] IGNORING stale transition request. room.current_scene_id={room.current_scene_id}, client_scene_id={client_scene_id}")
            current_scene = room.current_scene
            votes = Vote.objects.filter(room=room, scene=current_scene)
            total_votes = votes.count()
            counts = votes.values('choice_id').annotate(count=Count('id'))
            counts_map = {str(item['choice_id']): item['count'] for item in counts}
            votes_chart = []
            for ch in current_scene.choices.all():
                ch_votes = counts_map.get(str(ch.id), 0)
                votes_chart.append({
                    'choice_id': str(ch.id),
                    'choice_text': ch.text,
                    'votes_count': ch_votes,
                    'votes_percentage': (ch_votes / total_votes * 100) if total_votes > 0 else 0
                })
            return current_scene, votes_chart, None

        current_scene = room.current_scene
        if not current_scene:
            return None, [], "Room has no active scene."

        # Compile votes distribution details
        votes = Vote.objects.filter(room=room, scene=current_scene)
        total_votes = votes.count()

        # Count by choice
        choice_counts = votes.values('choice_id').annotate(count=Count('id'))
        # Create counts dictionary
        counts_map = {str(item['choice_id']): item['count'] for item in choice_counts}

        # Prepare final visual chart payload for Host projector
        choices_list = current_scene.choices.all()
        votes_chart = []
        winning_choice = None
        max_votes = 0  # Start at 0 so choices with 0 votes don't "win" — allows default_next_scene fallback

        for ch in choices_list:
            ch_votes = counts_map.get(str(ch.id), 0)
            votes_chart.append({
                'choice_id': str(ch.id),
                'choice_text': ch.text,
                'votes_count': ch_votes,
                'votes_percentage': (ch_votes / total_votes * 100) if total_votes > 0 else 0
            })

            # Check democratic winner
            if ch_votes > max_votes:
                max_votes = ch_votes
                winning_choice = ch
            elif ch_votes == max_votes and max_votes > 0:
                pass

        # Apply override if host selected a forced option
        if forced_choice_id:
            try:
                winning_choice = Choice.objects.get(id=forced_choice_id, source_scene=current_scene)
            except Choice.DoesNotExist:
                return None, [], "Forced choice option is invalid for this scene."

        if not winning_choice:
            # Fallback if no votes at all: transition to default fallback or first available choice
            if current_scene.default_next_scene:
                next_scene = current_scene.default_next_scene
            elif choices_list.exists():
                next_scene = choices_list.first().next_scene
            else:
                # End of story node
                room.status = 'FINISHED'
                room.save()
                return None, votes_chart, "END_OF_STORY"
        else:
            next_scene = winning_choice.next_scene

        # Write permanent VoteRecord telemetry logs for all participants who voted in this round
        for v in votes:
            VoteRecord.objects.create(
                room=room,
                participant=v.participant,
                scene_from=current_scene,
                choice_made=v.choice,
                scene_to=next_scene,
                reaction_time_ms=v.reaction_time_ms
            )

        # Clear transient votes for this round
        votes.delete()

        # Execute transition
        room.current_scene = next_scene
        room.save()
        return next_scene, votes_chart, None

    @staticmethod
    def get_room_analytics(room_id: str) -> dict:
        import math
        from collections import defaultdict
        try:
            room = Room.objects.select_related('story').get(id=room_id)
        except Room.DoesNotExist:
            return None

        # 1. Sankey Flow aggregation
        flow_records = (
            VoteRecord.objects.filter(room=room)
            .values('scene_from_id', 'scene_from__title', 'scene_to_id', 'scene_to__title')
            .annotate(value=Count('id'))
        )
        
        game_over_scene_ids = set(
            room.story.story_resources.filter(game_over_scene__isnull=False)
            .values_list('game_over_scene_id', flat=True)
        )
        
        all_scenes = room.story.scenes.prefetch_related('choices').all()
        for scene in all_scenes:
            if scene.choices.count() == 0:
                title_lower = scene.title.lower()
                desc_lower = scene.description.lower() if scene.description else ""
                if "game over" in title_lower or "fin" in title_lower or "moriste" in title_lower or "perdiste" in title_lower or "incorrecto" in title_lower or "game over" in desc_lower:
                    game_over_scene_ids.add(scene.id)

        sankey_data = []
        for record in flow_records:
            if not record['scene_from_id'] or not record['scene_to_id']:
                continue
            to_id = record['scene_to_id']
            sankey_data.append({
                'source': str(record['scene_from_id']),
                'source_name': record['scene_from__title'],
                'target': str(to_id),
                'target_name': record['scene_to__title'],
                'value': record['value'],
                'is_game_over': to_id in game_over_scene_ids
            })

        # 2. Vote distributions for each scene
        vote_distributions = []
        scene_choices = (
            VoteRecord.objects.filter(room=room)
            .values('scene_from_id', 'scene_from__title', 'choice_made_id', 'choice_made__text')
            .annotate(votes=Count('id'))
        )
        
        dist_map = defaultdict(list)
        scene_totals = defaultdict(int)
        
        for item in scene_choices:
            s_id = str(item['scene_from_id'])
            dist_map[s_id].append({
                'choice_id': str(item['choice_made_id']),
                'choice_text': item['choice_made__text'],
                'votes': item['votes']
            })
            scene_totals[s_id] += item['votes']
            
        for s_id, choices in dist_map.items():
            total = scene_totals[s_id]
            scene_title = next((s.title for s in all_scenes if str(s.id) == s_id), "Escena")
            formatted_choices = []
            for ch in choices:
                formatted_choices.append({
                    'choice_id': ch['choice_id'],
                    'choice_text': ch['choice_text'],
                    'votes': ch['votes'],
                    'percentage': round((ch['votes'] / total * 100), 2) if total > 0 else 0
                })
            vote_distributions.append({
                'scene_id': s_id,
                'scene_title': scene_title,
                'choices': formatted_choices,
                'total_votes': total
            })

        # 3. Reaction times / Decision velocity
        from django.db.models import Avg
        reaction_stats = (
            VoteRecord.objects.filter(room=room)
            .values('scene_from_id', 'scene_from__title')
            .annotate(avg_time=Avg('reaction_time_ms'))
        )
        
        reaction_times = []
        for stat in reaction_stats:
            s_id = stat['scene_from_id']
            if not s_id:
                continue
            
            times = list(
                VoteRecord.objects.filter(room=room, scene_from_id=s_id)
                .values_list('reaction_time_ms', flat=True)
            )
            
            total_votes = len(times)
            avg_time = stat['avg_time'] or 0.0
            
            if total_votes > 1:
                variance = sum((x - avg_time) ** 2 for x in times) / (total_votes - 1)
                std_dev = math.sqrt(variance)
            else:
                std_dev = 0.0
                
            scene_title = next((s.title for s in all_scenes if str(s.id) == str(s_id)), "Escena")
            reaction_times.append({
                'scene_id': str(s_id),
                'scene_title': scene_title,
                'avg_time_ms': round(avg_time, 2),
                'std_dev_ms': round(std_dev, 2),
                'total_votes': total_votes,
                'raw_times': times
            })

        # 4. Raw records list for scatter plot
        raw_records = []
        for vr in VoteRecord.objects.filter(room=room).select_related('participant', 'scene_from', 'choice_made', 'scene_to'):
            raw_records.append({
                'participant_name': vr.participant.nickname,
                'scene_title': vr.scene_from.title,
                'choice_text': vr.choice_made.text,
                'reaction_time_s': round(vr.reaction_time_ms / 1000.0, 2),
                'is_game_over': vr.scene_to_id in game_over_scene_ids if vr.scene_to_id else False
            })

        return {
            'room_id': str(room.id),
            'room_pin': room.pin_code,
            'story_title': room.story.title,
            'sankey_data': sankey_data,
            'vote_distributions': vote_distributions,
            'reaction_times': reaction_times,
            'raw_records': raw_records
        }
