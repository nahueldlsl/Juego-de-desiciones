import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

class Story(models.Model):
    """
    Represents an interactive narrative.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, verbose_name="Story Title")
    description = models.TextField(blank=True, verbose_name="Story Description")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    start_scene = models.OneToOneField(
        'Scene',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='starting_story',
        verbose_name="Starting Scene"
    )
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='stories',
        verbose_name="Author/Creator",
        null=True,
        blank=True
    )
    is_public = models.BooleanField(default=False, verbose_name="Is Public Story")

    class Meta:
        verbose_name = "Story"
        verbose_name_plural = "Stories"

    def __str__(self):
        return self.title


class StoryResource(models.Model):
    """
    Represents a dynamic parameter/resource in a Story (e.g. Energy, Toxicity, Money).
    Enables fully customizable, multiple, and adaptable resource metrics.
    """
    CONDITION_CHOICES = [
        ('LTE', 'Menor o igual que (<=)'),
        ('GTE', 'Mayor o igual que (>=)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name='story_resources',
        verbose_name="Story"
    )
    name = models.CharField(max_length=100, verbose_name="Resource Name")
    initial_value = models.IntegerField(default=100, verbose_name="Initial Value")
    
    # Custom triggering constraints (Límite Simbólico)
    trigger_limit = models.IntegerField(default=0, verbose_name="Trigger Threshold Limit")
    trigger_condition = models.CharField(
        max_length=5,
        choices=CONDITION_CHOICES,
        default='LTE',
        verbose_name="Trigger Condition Rule"
    )
    
    # Fallback Game over scene if target threshold breached
    game_over_scene = models.ForeignKey(
        'Scene',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='game_over_for_resources',
        verbose_name="Game Over Fallback Scene"
    )

    class Meta:
        verbose_name = "Story Resource"
        verbose_name_plural = "Story Resources"

    def clean(self):
        super().clean()
        if not self.name.strip():
            raise ValidationError("Resource name cannot be empty.")
            
        # Validate that the trigger limit does not conflict with initial values immediately
        if self.trigger_condition == 'LTE' and self.initial_value <= self.trigger_limit:
            raise ValidationError("Initial value must be greater than the trigger threshold limit under LTE conditions.")
        if self.trigger_condition == 'GTE' and self.initial_value >= self.trigger_limit:
            raise ValidationError("Initial value must be less than the trigger threshold limit under GTE conditions.")

    def __str__(self):
        return f"{self.story.title} - {self.name} (Start: {self.initial_value}, Trigger: {self.trigger_condition} {self.trigger_limit})"


class Scene(models.Model):
    """
    Represents a single node (state) in the interactive story graph.
    """
    MEDIA_TYPE_CHOICES = [
        ('VIDEO', 'Video'),
        ('IMAGE', 'Image'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name='scenes',
        verbose_name="Story"
    )
    title = models.CharField(max_length=255, verbose_name="Scene Title")
    description = models.TextField(blank=True, verbose_name="Scene Description/Content")
    
    # Media configuration
    media_file = models.FileField(
        upload_to='scene_media/',
        null=True,
        blank=True,
        verbose_name="Media File (Video or Image)"
    )
    media_type = models.CharField(
        max_length=10,
        choices=MEDIA_TYPE_CHOICES,
        default='IMAGE',
        verbose_name="Media Type"
    )
    
    # Timing and display configurations
    decision_trigger_time = models.FloatField(
        null=True,
        blank=True,
        help_text="Timestamp in seconds at which choices should appear (Videos only). If null, they appear immediately.",
        verbose_name="Decision Trigger Time"
    )
    pause_on_decision = models.BooleanField(
        default=True,
        help_text="Whether to pause the video when choices are displayed.",
        verbose_name="Pause on Decision"
    )
    
    # Timer configuration for decisions
    timer_duration = models.IntegerField(
        null=True,
        blank=True,
        help_text="Time in seconds that the player has to make a choice. If null, there is no time limit.",
        verbose_name="Timer Duration"
    )
    default_next_scene = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='default_fallback_for',
        help_text="The next scene to transition to if the timer expires without user interaction.",
        verbose_name="Default Fallback Scene"
    )

    class Meta:
        verbose_name = "Scene"
        verbose_name_plural = "Scenes"

    def clean(self):
        super().clean()
        if self.default_next_scene and self.timer_duration is None:
            raise ValidationError({
                'timer_duration': "You must set a timer duration if a default next scene is specified."
            })
            
        if self.media_type != 'VIDEO' and self.decision_trigger_time is not None:
            raise ValidationError({
                'decision_trigger_time': "Decision trigger time can only be configured for Video media."
            })

    def __str__(self):
        return f"{self.story.title} - {self.title}"


class Choice(models.Model):
    """
    Represents a directed edge between two Scene nodes.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_scene = models.ForeignKey(
        Scene,
        on_delete=models.CASCADE,
        related_name='choices',
        verbose_name="Source Scene"
    )
    text = models.CharField(
        max_length=255,
        verbose_name="Choice Button Text"
    )
    next_scene = models.ForeignKey(
        Scene,
        on_delete=models.CASCADE,
        related_name='incoming_choices',
        verbose_name="Target Destination Scene"
    )

    class Meta:
        verbose_name = "Choice"
        verbose_name_plural = "Choices"

    def clean(self):
        super().clean()
        if self.source_scene.story != self.next_scene.story:
            raise ValidationError(
                "A choice cannot point to a scene in a different story."
            )

    def __str__(self):
        return f"From: {self.source_scene.title} -> To: {self.next_scene.title} ({self.text[:20]})"


class ChoiceResourceImpact(models.Model):
    """
    Represents the numerical change that a specific choice inflicts on a story resource parameter.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    choice = models.ForeignKey(
        Choice,
        on_delete=models.CASCADE,
        related_name='resource_impacts',
        verbose_name="Choice"
    )
    resource = models.ForeignKey(
        StoryResource,
        on_delete=models.CASCADE,
        related_name='impacts',
        verbose_name="Target Resource"
    )
    impact_value = models.IntegerField(default=0, verbose_name="Impact Value (+/-)")

    class Meta:
        verbose_name = "Choice Resource Impact"
        verbose_name_plural = "Choice Resource Impacts"

    def clean(self):
        super().clean()
        # Verify that both the choice and the resource belong to the exact same Story scope
        if self.choice.source_scene.story != self.resource.story:
            raise ValidationError(
                "The associated choice and resource parameter must reside in the exact same Story scope."
            )

    def __str__(self):
        return f"{self.choice.text[:15]} -> {self.resource.name} ({'+' if self.impact_value >= 0 else ''}{self.impact_value})"


class Room(models.Model):
    """
    Represents a game session/lobby created by a Host (Admin) for a specific Story.
    """
    MODE_CHOICES = [
        ('CONJUNTO', 'Host-driven (Síncrono)'),
        ('SEPARADO', 'Self-paced (Asíncrono)'),
    ]
    STATUS_CHOICES = [
        ('WAITING', 'Waiting for players'),
        ('PLAYING', 'Active game'),
        ('FINISHED', 'Finished'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pin_code = models.CharField(max_length=6, unique=True, verbose_name="Room PIN Access Code")
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_rooms', verbose_name="Host Admin", null=True, blank=True)
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='rooms', verbose_name="Story")
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='CONJUNTO', verbose_name="Game Mode")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='WAITING', verbose_name="Session Status")
    
    # Active scene: only used for MODO CONJUNTO (Host-driven sync)
    current_scene = models.ForeignKey(
        Scene, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='active_rooms_here',
        verbose_name="Current Room Scene"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    host_key = models.UUIDField(default=uuid.uuid4, null=True, blank=True, verbose_name="Host Secret Reconnection Key")

    class Meta:
        verbose_name = "Room"
        verbose_name_plural = "Rooms"

    def __str__(self):
        return f"Room {self.pin_code} - Mode: {self.mode} ({self.status})"


class Participant(models.Model):
    """
    Represents a Guest player inside a Room session.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nickname = models.CharField(max_length=50, verbose_name="Player Nickname")
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='participants', verbose_name="Room")
    
    # Current scene: primarily used for MODO SEPARADO (Self-paced async)
    current_scene = models.ForeignKey(
        Scene, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='participants_here',
        verbose_name="Current Participant Scene"
    )
    
    # Session identifier to recover from disconnects/page-refreshes (Idempotency)
    session_key = models.CharField(max_length=255, db_index=True, verbose_name="Reconnect Session Identifier")
    avatar = models.CharField(max_length=10, default="👤", verbose_name="Player Avatar Emoji")
    joined_at = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Participant"
        verbose_name_plural = "Participants"
        unique_together = (
            ('room', 'nickname'),
            ('room', 'session_key')
        )

    def __str__(self):
        return f"{self.nickname} in Room {self.room.pin_code}"


class Vote(models.Model):
    """
    Tracks player choices submitted inside a Room under MODO CONJUNTO (Host-driven sync).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='votes', verbose_name="Participant")
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='votes', verbose_name="Room")
    scene = models.ForeignKey(Scene, on_delete=models.CASCADE, verbose_name="Voted Scene")
    choice = models.ForeignKey(Choice, on_delete=models.CASCADE, verbose_name="Voted Choice Option")
    reaction_time_ms = models.PositiveIntegerField(default=0, verbose_name="Reaction Time (ms)")
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Vote"
        verbose_name_plural = "Votes"
        unique_together = ('participant', 'room', 'scene') # Only one vote allowed per participant per scene!

    def __str__(self):
        return f"{self.participant.nickname} voted {self.choice.text[:15]} on scene {self.scene.title[:15]}"


class VoteRecord(models.Model):
    """
    Permanent telemetry action log for post-game dashboard analysis.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='vote_records', verbose_name="Room")
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='vote_records', verbose_name="Participant")
    scene_from = models.ForeignKey(Scene, on_delete=models.CASCADE, related_name='vote_records_from', verbose_name="Scene From")
    choice_made = models.ForeignKey(Choice, on_delete=models.CASCADE, related_name='vote_records_choice', verbose_name="Choice Made")
    scene_to = models.ForeignKey(Scene, on_delete=models.CASCADE, null=True, blank=True, related_name='vote_records_to', verbose_name="Scene To")
    reaction_time_ms = models.PositiveIntegerField(default=0, verbose_name="Reaction Time (ms)")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Vote Record"
        verbose_name_plural = "Vote Records"

    def __str__(self):
        return f"{self.participant.nickname}: {self.scene_from.title} -> {self.choice_made.text[:15]} -> {self.scene_to.title if self.scene_to else 'None'}"
