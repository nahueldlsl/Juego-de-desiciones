import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

class AIService:
    @staticmethod
    def _get_api_key():
        return os.environ.get("GEMINI_API_KEY") or getattr(settings, 'GEMINI_API_KEY', None)

    @classmethod
    def generate_text_helper(cls, prompt_type, story_context, current_scene_context=""):
        """
        Llama a Gemini 1.5 Flash para generar títulos, descripciones o elecciones.
        """
        api_key = cls._get_api_key()
        
        # 1. Fallback Heurístico Local si no hay API Key o no está instalada la librería
        if not GEMINI_AVAILABLE or not api_key:
            return cls._fallback_heuristic(prompt_type, story_context, current_scene_context)

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Construir prompt según el tipo
            if prompt_type == 'scene_content':
                prompt = (
                    f"Eres un diseñador de videojuegos narrativos. A partir del contexto de la historia:\n"
                    f"Título: {story_context.get('title')}\n"
                    f"Sinopsis: {story_context.get('description')}\n"
                    f"Genera un título corto para una escena nueva y una descripción narrativa misteriosa e inmersiva. "
                    f"Responde ESTRICTAMENTE en formato JSON plano: {{\"title\": \"título sugerido\", \"description\": \"texto narrativo\"}}"
                )
            elif prompt_type == 'choices':
                prompt = (
                    f"Dada la escena actual:\n"
                    f"Título de Escena: {current_scene_context.get('title')}\n"
                    f"Descripción: {current_scene_context.get('description')}\n"
                    f"Sugiere exactamente 3 decisiones/opciones ramificadas coherentes para el jugador. "
                    f"Responde ESTRICTAMENTE en formato JSON plano como una lista: "
                    f"[{{\"text\": \"Texto botón 1\", \"next_scene_title\": \"Título destino 1\"}}, ...]"
                )
            else:
                return {"error": "Tipo de prompt no soportado."}

            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            import json
            return json.loads(response.text)

        except Exception as e:
            logger.error(f"Error calling Gemini: {e}")
            return cls._fallback_heuristic(prompt_type, story_context, current_scene_context)

    @classmethod
    def generate_image_helper(cls, scene_title, scene_desc, story_context=None, scenes=None, current_temp_id=None):
        """
        Genera una ilustración real usando Pollinations AI, optimizando el prompt con Gemini
        a partir del contexto de la historia y las escenas predecesoras para mantener coherencia.
        """
        import urllib.parse
        api_key = cls._get_api_key()
        if story_context is None:
            story_context = {}
        
        # 1. Encontrar escenas predecesoras
        predecessors_info = []
        if scenes and current_temp_id:
            for scene in scenes:
                choices = scene.get('choices', [])
                for choice in choices:
                    target = choice.get('next_scene_temp_id') or choice.get('next_scene_id')
                    if str(target) == str(current_temp_id):
                        predecessors_info.append(
                            f"Escena previa: '{scene.get('title')}' -> '{scene.get('description')}'"
                        )
                        break
        
        predecessor_context = "\n".join(predecessors_info)
        
        # Prompt base por defecto (heurístico)
        default_prompt = f"digital fantasy painting, {scene_title}, {scene_desc}, dramatic lighting, conceptual art style"

        # 2. Si Gemini está disponible, generar un prompt en inglés altamente detallado
        if GEMINI_AVAILABLE and api_key:
            try:
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                
                gemini_prompt = (
                    f"Eres un director de arte de videojuegos de rol y fantasía. Tu tarea es escribir un prompt en INGLÉS "
                    f"para un generador de imágenes (Stable Diffusion). El prompt debe describir la escena actual, "
                    f"asegurando coherencia estilística e histórica con las escenas previas.\n\n"
                    f"Contexto general de la Historia:\n"
                    f"Título: {story_context.get('title')}\n"
                    f"Descripción: {story_context.get('description')}\n\n"
                    f"Línea de tiempo narrativa (Escenas anteriores):\n"
                    f"{predecessor_context}\n\n"
                    f"Escena actual a ilustrar:\n"
                    f"Título: {scene_title}\n"
                    f"Descripción: {scene_desc}\n\n"
                    f"Instrucciones del Prompt:\n"
                    f"- Escribe únicamente el prompt en inglés, separado por comas.\n"
                    f"- Especifica estilo visual (ej. digital art, fantasy concept art, cinematic lighting).\n"
                    f"- Describe los elementos físicos, la atmósfera y los colores basados en la descripción.\n"
                    f"- Mantén consistencia con el estilo que sugieren las escenas previas.\n"
                    f"- Sé descriptivo pero conciso. No agregues explicaciones adicionales en español ni comillas."
                )

                response = model.generate_content(gemini_prompt)
                ai_prompt = response.text.strip()
                if ai_prompt:
                    default_prompt = ai_prompt
            except Exception as e:
                logger.error(f"Error generando prompt con Gemini: {e}")

        # 3. Codificar prompt y construir URL de Pollinations AI
        encoded_prompt = urllib.parse.quote(default_prompt)
        image_url = f"https://image.pollinations.ai/p/{encoded_prompt}?width=1024&height=768&nologo=true&seed=42"
        
        logger.info(f"Generated Image URL: {image_url}")
        return {"image_url": image_url, "prompt": default_prompt}

    @classmethod
    def _fallback_heuristic(cls, prompt_type, story_context, current_scene_context=""):
        # Respuestas mock con alta calidad contextual para no romper el desarrollo
        if prompt_type == 'scene_content':
            return {
                "title": f"La Encrucijada de {story_context.get('title', 'Destino')}",
                "description": f"Te encuentras en un punto de no retorno. Los susurros del viento parecen hablar de: '{story_context.get('description', 'una gran aventura')}'."
            }
        elif prompt_type == 'choices':
            title = current_scene_context.get('title', 'la sala')
            return [
                {"text": f"Inspeccionar con cautela {title}", "next_scene_title": "El Pasadizo Oculto"},
                {"text": "Avanzar sin mirar atrás", "next_scene_title": "La Emboscada Silenciosa"},
                {"text": "Usar un recurso para encender una antorcha", "next_scene_title": "La Cámara Iluminada"}
            ]
        return {}
