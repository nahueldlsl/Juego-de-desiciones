from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import StoryViewSet, SceneViewSet, ChoiceViewSet, RoomViewSet, UserManagementViewSet, MyTokenObtainPairView, RegisterView
from .views_ai import AIGeneratorView

router = DefaultRouter()
router.register(r'stories', StoryViewSet, basename='story')
router.register(r'scenes', SceneViewSet, basename='scene')
router.register(r'choices', ChoiceViewSet, basename='choice')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'users', UserManagementViewSet, basename='user')

urlpatterns = [
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    path('ai/generate/', AIGeneratorView.as_view(), name='ai_generate'),
    path('', include(router.urls)),
]

