from rest_framework import permissions

class IsSuperAdminOrAuthorOrReadOnly(permissions.BasePermission):
    """
    Control de acceso granular:
    - Lectura (SAFE_METHODS):
        - Permitido para todos (incluido Guests) si el recurso (Story/sub-recursos) es público.
        - Si es privado, requiere autenticación y ser el autor o SuperAdmin.
    - Creación (POST):
        - Permitido solo para SuperAdmin o usuarios pertenecientes al grupo "Profesores".
    - Escritura (PUT/PATCH/DELETE):
        - Solo permitido para Super Admin (is_superuser == True) o el autor original del recurso.
        - Bloqueado para Guests y otros profesores.
    """

    def has_permission(self, request, view):
        # 1. Lectura: permitida para evaluar a nivel de objeto
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # 2. Creación: requiere estar autenticado
        if not request.user or not request.user.is_authenticated:
            return False
            
        # 3. Solo SuperAdmins o miembros del grupo "Profesores" pueden crear (POST)
        if request.method == 'POST':
            return request.user.is_superuser or request.user.groups.filter(name='Profesores').exists()
            
        return True

    def _get_story_from_obj(self, obj):
        # Resuelve el objeto Story según la entidad recibida
        from .models import Story, Scene, Choice
        if isinstance(obj, Story):
            return obj
        elif hasattr(obj, 'story'):
            return obj.story
        elif hasattr(obj, 'source_scene') and hasattr(obj.source_scene, 'story'):
            return obj.source_scene.story
        return None

    def has_object_permission(self, request, view, obj):
        story = self._get_story_from_obj(obj)
        if not story:
            return False
        
        # 1. Acceso de Lectura
        if request.method in permissions.SAFE_METHODS:
            if story.is_public:
                return True
            # Si es privada, solo autor o superadmin
            if not request.user or not request.user.is_authenticated:
                return False
            return request.user.is_superuser or story.author == request.user

        # 2. Acceso de Escritura (Modificaciones estructurales)
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Super Admin puede modificar todo; el autor original puede modificar su propia historia
        return request.user.is_superuser or story.author == request.user
