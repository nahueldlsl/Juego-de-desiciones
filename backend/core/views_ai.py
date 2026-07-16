from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .ai_service import AIService

class AIGeneratorView(APIView):
    permission_classes = [permissions.IsAuthenticated] # Solo creadores logueados pueden gastar tokens

    def post(self, request):
        action_type = request.data.get('type') # 'scene_content', 'choices', 'image'
        story_context = request.data.get('story_context', {})
        current_scene_context = request.data.get('current_scene_context', {})
        scenes = request.data.get('scenes', [])
        current_temp_id = request.data.get('current_temp_id')

        if not action_type:
            return Response({'error': 'Parameter type is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if action_type in ['scene_content', 'choices']:
            result = AIService.generate_text_helper(action_type, story_context, current_scene_context)
            return Response(result, status=status.HTTP_200_OK)
            
        elif action_type == 'image':
            scene_title = current_scene_context.get('title', '')
            scene_desc = current_scene_context.get('description', '')
            result = AIService.generate_image_helper(
                scene_title,
                scene_desc,
                story_context=story_context,
                scenes=scenes,
                current_temp_id=current_temp_id
            )
            return Response(result, status=status.HTTP_200_OK)

        return Response({'error': f'Invalid type: {action_type}'}, status=status.HTTP_400_BAD_REQUEST)
