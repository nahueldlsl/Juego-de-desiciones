from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Story, Scene, Choice, StoryResource, ChoiceResourceImpact

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_superuser'] = user.is_superuser
        token['groups'] = list(user.groups.values_list('name', flat=True))
        return token


class ChoiceResourceImpactSerializer(serializers.ModelSerializer):
    resource_id = serializers.PrimaryKeyRelatedField(
        source='resource',
        read_only=True
    )

    class Meta:
        model = ChoiceResourceImpact
        fields = ['id', 'resource_id', 'impact_value']


class ChoiceSerializer(serializers.ModelSerializer):
    next_scene_id = serializers.PrimaryKeyRelatedField(
        source='next_scene', 
        read_only=True
    )
    resource_impacts = ChoiceResourceImpactSerializer(many=True, read_only=True)

    class Meta:
        model = Choice
        fields = ['id', 'text', 'next_scene_id', 'resource_impacts']


class SceneSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    default_next_scene_id = serializers.PrimaryKeyRelatedField(
        source='default_next_scene', 
        read_only=True
    )
    media_url = serializers.SerializerMethodField()

    class Meta:
        model = Scene
        fields = [
            'id', 
            'title', 
            'description', 
            'media_url', 
            'media_type', 
            'media_file',
            'decision_trigger_time', 
            'pause_on_decision', 
            'timer_duration', 
            'default_next_scene_id', 
            'choices'
        ]
        extra_kwargs = {
            'media_file': {'write_only': True, 'required': False}
        }

    def get_media_url(self, obj):
        if obj.media_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.media_file.url)
            return obj.media_file.url
        return None


class StoryResourceSerializer(serializers.ModelSerializer):
    game_over_scene_id = serializers.PrimaryKeyRelatedField(
        source='game_over_scene',
        read_only=True
    )

    class Meta:
        model = StoryResource
        fields = [
            'id',
            'name',
            'initial_value',
            'trigger_limit',
            'trigger_condition',
            'game_over_scene_id'
        ]


class StoryDetailSerializer(serializers.ModelSerializer):
    scenes = SceneSerializer(many=True, read_only=True)
    start_scene_id = serializers.PrimaryKeyRelatedField(
        source='start_scene', 
        read_only=True
    )
    story_resources = StoryResourceSerializer(many=True, read_only=True)
    author_id = serializers.PrimaryKeyRelatedField(source='author', read_only=True)
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = Story
        fields = ['id', 'title', 'description', 'start_scene_id', 'scenes', 'story_resources', 'created_at', 'updated_at', 'author_id', 'author_username', 'is_public']


class StoryListSerializer(serializers.ModelSerializer):
    start_scene_id = serializers.PrimaryKeyRelatedField(
        source='start_scene', 
        read_only=True
    )
    use_resource_system = serializers.SerializerMethodField()
    author_id = serializers.PrimaryKeyRelatedField(source='author', read_only=True)
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = Story
        fields = ['id', 'title', 'description', 'start_scene_id', 'use_resource_system', 'created_at', 'author_id', 'author_username', 'is_public']

    def get_use_resource_system(self, obj):
        # Read from annotated field to prevent N+1 DB query
        resources_count = getattr(obj, 'resources_count', None)
        if resources_count is not None:
            return resources_count > 0
        return obj.story_resources.exists()
