from django.db.models import Q
from django.contrib.auth.models import User, Group
from rest_framework import viewsets, status, serializers, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import Story, Scene, Choice, Room
from .serializers import (
    StoryListSerializer, 
    StoryDetailSerializer, 
    SceneSerializer, 
    ChoiceSerializer,
    MyTokenObtainPairSerializer
)
from .services import StoryGraphPersister, GameEngineService
from .permissions import IsSuperAdminOrAuthorOrReadOnly

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


# 1. Serializador exclusivo para gestión de usuarios
class UserManagementSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_staff', 'is_active', 'date_joined', 'role']
        extra_kwargs = {
            'password': {'write_only': True, 'required': False}
        }

    def get_role(self, obj):
        if obj.is_superuser:
            return 'SUPERADMIN'
        return 'USER'

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            is_staff=False,
            is_superuser=False
        )
        if validated_data.get('password'):
            user.set_password(validated_data['password'])
            user.save()
        return user

# 2. ViewSet exclusivo de administración (Solo SuperAdmins)
class UserManagementViewSet(viewsets.ModelViewSet):
    serializer_class = UserManagementSerializer
    permission_classes = [permissions.IsAdminUser] # Django standard (requiere is_staff o is_superuser)

    def get_queryset(self):
        # Excluir al propio usuario logueado para evitar que se modifique o elimine a sí mismo
        return User.objects.exclude(id=self.request.user.id).order_by('-date_joined')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance == request.user:
            return Response({'error': 'No puedes eliminar tu propia cuenta.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """Suspende o reactiva una cuenta."""
        user = self.get_object()
        if user == request.user:
            return Response({'error': 'No puedes suspender tu propia cuenta.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = not user.is_active
        user.save()
        status_str = "activado" if user.is_active else "suspendido"
        return Response({'message': f'Usuario {user.username} {status_str} exitosamente.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle-role')
    def toggle_role(self, request, pk=None):
        """Promueve a Admin (Superusuario) o degrada a Usuario común."""
        user = self.get_object()
        if user == request.user:
            return Response({'error': 'No puedes cambiar tu propio rol.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if user.is_superuser:
            user.is_superuser = False
            user.is_staff = False
            role = 'USER'
        else:
            user.is_superuser = True
            user.is_staff = True
            role = 'SUPERADMIN'
            
        user.save()
        return Response({'message': f'Usuario {user.username} actualizado al rol {role}.'}, status=status.HTTP_200_OK)



class StoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows stories to be viewed, created, or edited.
    Delegates complex graph persistence logic to domain service StoryGraphPersister (SRP & Low Coupling).
    """
    permission_classes = [IsSuperAdminOrAuthorOrReadOnly]

    def get_queryset(self):
        from django.db.models import Count
        user = self.request.user
        
        # Queryset base con anotaciones para evitar N+1
        queryset = Story.objects.annotate(resources_count=Count('story_resources')).order_by('-created_at')
        
        if user and user.is_authenticated:
            if user.is_superuser:
                # Super Admin ve todo
                return queryset
            else:
                # Profesor ve lo propio O las historias públicas
                return queryset.filter(Q(author=user) | Q(is_public=True))
        else:
            # Guests solo acceden a las públicas
            return queryset.filter(is_public=True)

    def perform_create(self, serializer):
        # Asocia automáticamente la historia al usuario autenticado
        serializer.save(author=self.request.user)

    def get_serializer_class(self):
        if self.action == 'retrieve' or self.action == 'save_graph':
            return StoryDetailSerializer
        return StoryListSerializer

    @action(detail=False, methods=['post'], url_path='save-graph')
    def save_graph(self, request):
        """
        Receives narrative graph data and invokes StoryGraphPersister to build entities.
        Acts as a GRASP Controller.
        """
        data = request.data
        title = data.get('title')
        description = data.get('description', '')
        scenes_data = data.get('scenes', [])
        start_scene_temp_id = data.get('start_scene_temp_id')
        story_id = data.get('story_id')
        story_resources = data.get('story_resources', [])
        is_public = data.get('is_public', False)

        try:
            if story_id:
                # Verificar autorización sobre el objeto a editar
                try:
                    story_obj = Story.objects.get(id=story_id)
                    self.check_object_permissions(request, story_obj)
                except Story.DoesNotExist:
                    return Response({'error': 'Story not found.'}, status=status.HTTP_404_NOT_FOUND)
                
                # Delegate graph update to the domain service
                story, temp_id_map = StoryGraphPersister.update_graph(
                    story_id=story_id,
                    title=title,
                    description=description,
                    start_scene_temp_id=start_scene_temp_id,
                    scenes_data=scenes_data,
                    story_resources_data=story_resources
                )
                story.is_public = is_public
                story.save()
            else:
                # Delegate graph creation to the domain service
                story, temp_id_map = StoryGraphPersister.persist(
                    title=title,
                    description=description,
                    start_scene_temp_id=start_scene_temp_id,
                    scenes_data=scenes_data,
                    story_resources_data=story_resources
                )
                story.is_public = is_public
                # Asignar autor a la nueva historia
                if request.user and request.user.is_authenticated:
                    story.author = request.user
                story.save()
            
            serializer = StoryDetailSerializer(story, context={'request': request})
            id_map = {temp_id: str(scene.id) for temp_id, scene in temp_id_map.items()}
            return Response({
                'story': serializer.data,
                'id_map': id_map
            }, status=status.HTTP_201_CREATED)

        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': 'An unexpected error occurred: ' + str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SceneViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows scenes to be viewed, created, or edited.
    """
    queryset = Scene.objects.all()
    serializer_class = SceneSerializer
    permission_classes = [IsSuperAdminOrAuthorOrReadOnly]

    def perform_update(self, serializer):
        media_url = self.request.data.get('media_url')
        if media_url:
            import requests
            import uuid
            from django.core.files.base import ContentFile
            try:
                response = requests.get(media_url, timeout=15)
                if response.status_code == 200:
                    # Generate a clean, short filename to prevent max_length errors
                    filename = f"ai_{uuid.uuid4().hex[:10]}.jpg"
                    serializer.validated_data['media_file'] = ContentFile(response.content, name=filename)
            except Exception as e:
                pass
        serializer.save()


class ChoiceViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows choices to be viewed, created, or edited.
    """
    queryset = Choice.objects.all()
    serializer_class = ChoiceSerializer


class RoomViewSet(viewsets.ViewSet):
    """
    ViewSet for handling multiplayer Rooms.
    """
    def list(self, request):
        """
        Returns a list of all rooms depending on user role.
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response({'error': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        if user.is_superuser:
            rooms = Room.objects.select_related('story').all()
        else:
            # Only list rooms hosted by the current user or where the current user is the author of the story
            rooms = Room.objects.select_related('story').filter(Q(host=user) | Q(story__author=user))
            
        data = [{
            'room_id': str(room.id),
            'pin_code': room.pin_code,
            'mode': room.mode,
            'status': room.status,
            'story_title': room.story.title
        } for room in rooms]
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='create')
    def create_room(self, request):
        story_id = request.data.get('story_id')
        mode = request.data.get('mode', 'CONJUNTO') # 'CONJUNTO' or 'SEPARADO'
        
        if not story_id:
            return Response({'error': 'story_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            story = Story.objects.get(id=story_id)
        except Story.DoesNotExist:
            return Response({'error': 'Story not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Si el usuario no está autenticado (Guest/Anónimo)
        if not request.user or not request.user.is_authenticated:
            if not story.is_public:
                return Response({'error': 'No puedes instanciar una sala efímera usando una historia privada.'}, status=status.HTTP_403_FORBIDDEN)
            host_user = None
        else:
            # Si el usuario está autenticado, verificar que pueda usar esta historia (es suya o es pública o es superuser)
            if not request.user.is_superuser and story.author != request.user and not story.is_public:
                return Response({'error': 'No tienes permisos para alojar una sala con esta historia privada.'}, status=status.HTTP_403_FORBIDDEN)
            host_user = request.user

        room, error = GameEngineService.create_room_lobby(story_id, mode, host_user=host_user)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({
            'room_id': str(room.id),
            'pin_code': room.pin_code,
            'host_key': str(room.host_key) if room.host_key else None,
            'mode': room.mode,
            'status': room.status,
            'story_title': room.story.title
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='analytics')
    def get_analytics(self, request, pk=None):
        """
        Serves aggregated post-game telemetry/analytics for the room session.
        """
        if not pk:
            return Response({'error': 'Room ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        analytics_data = GameEngineService.get_room_analytics(pk)
        if not analytics_data:
            return Response({'error': 'Room not found or no analytics available.'}, status=status.HTTP_404_NOT_FOUND)
            
        return Response(analytics_data, status=status.HTTP_200_OK)


from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')

        if not username or not password:
            return Response(
                {"error": "El nombre de usuario y la contraseña son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "El nombre de usuario ya está en uso."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email
        )
        return Response(
            {"message": "Usuario registrado exitosamente.", "userId": user.id},
            status=status.HTTP_201_CREATED
        )

