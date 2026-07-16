from django.core.management.base import BaseCommand
from core.models import Story, Scene, Choice

class Command(BaseCommand):
    help = 'Seeds the database with a high-quality sample interactive story'

    def handle(self, *args, **options):
        # 1. Clean existing records to avoid duplicates
        self.stdout.write("Limpiando la base de datos...")
        Choice.objects.all().delete()
        Scene.objects.all().delete()
        Story.objects.all().delete()

        # 2. Create the Story
        self.stdout.write("Creando historia base...")
        story = Story.objects.create(
            title="El Secreto del Faro",
            description="Investigas un faro abandonado en una isla remota. Dicen que su luz brilla en noches de tormenta, a pesar de estar apagado hace cincuenta años."
        )

        # 3. Create the Scenes
        self.stdout.write("Creando escenas de la historia...")
        
        # Scene 1: Arrival
        scene_arrival = Scene.objects.create(
            story=story,
            title="Llegada al Muelle",
            description="Llegas a la costa rocosa frente al imponente faro abandonado. La noche se cierra y la bruma de mar cubre tus pasos. Tienes dos caminos frente a ti.",
            media_type="IMAGE"
        )
        
        # Update story's start scene
        story.start_scene = scene_arrival
        story.save()

        # Scene 2: The Main Entrance Hall
        scene_hall = Scene.objects.create(
            story=story,
            title="El Vestíbulo Principal",
            description="Entras en el faro. El olor a salitre y madera vieja lo inunda todo. Escuchas crujidos arriba y un silbido frío proveniente de una compuerta metálica en el suelo. Tienes poco tiempo para decidir antes de que tu linterna se apague.",
            media_type="IMAGE",
            timer_duration=12,
            # We will assign default_next_scene below once the cellar scene is created
        )

        # Scene 3: Cliff Side Path
        scene_cliff = Scene.objects.create(
            story=story,
            title="El Acantilado Susurrante",
            description="Rodeas la base de piedra del faro. El viento marino silba entre las grietas de la roca. Divisas una abertura estrecha similar a una gruta un poco más abajo, pero el suelo parece inestable.",
            media_type="IMAGE"
        )

        # Scene 4: Spiral Stairs (Good Ending)
        scene_stairs = Scene.objects.create(
            story=story,
            title="La Linterna del Faro",
            description="Subes las empinadas escaleras de caracol. En la cima, encuentras la lente de Fresnel brillando con un fulgor místico y cálido. Descubres una bitácora abierta que revela el mayor secreto de la isla. ¡Has logrado resolver el misterio del faro!",
            media_type="IMAGE"
        )

        # Scene 5: Basement Cellar (Bad Ending / Fallback)
        scene_cellar = Scene.objects.create(
            story=story,
            title="El Sótano Abandonado",
            description="Bajas apresuradamente. La compuerta se cierra de golpe tras de ti dejándote en completa oscuridad. Escuchas pasos acercándose y te das cuenta de que no estás solo. Estás atrapado.",
            media_type="IMAGE"
        )

        # Now update Scene 2's default fallback (if timer runs out, you fall to cellar)
        scene_hall.default_next_scene = scene_cellar
        scene_hall.save()

        # Scene 6: Hidden Cave (Secret Ending)
        scene_cave = Scene.objects.create(
            story=story,
            title="La Gruta Secreta",
            description="Te deslizas con cuidado hacia la gruta. Adentro encuentras cofres antiguos cubiertos de algas y oro español, además de un pasaje subterráneo que conecta con la costa lejana. ¡Has descubierto el tesoro perdido de los contrabandistas!",
            media_type="IMAGE"
        )

        # 4. Create Choices (Edges of the graph)
        self.stdout.write("Conectando escenas con decisiones...")

        # Choices from Arrival
        Choice.objects.create(
            source_scene=scene_arrival,
            text="Entrar por el portal principal",
            next_scene=scene_hall
        )
        Choice.objects.create(
            source_scene=scene_arrival,
            text="Rodear el faro por las rocas",
            next_scene=scene_cliff
        )

        # Choices from Hall
        Choice.objects.create(
            source_scene=scene_hall,
            text="Subir las escaleras de caracol",
            next_scene=scene_stairs
        )
        Choice.objects.create(
            source_scene=scene_hall,
            text="Bajar a la compuerta metálica",
            next_scene=scene_cellar
        )

        # Choices from Cliff Path
        Choice.objects.create(
            source_scene=scene_cliff,
            text="Descender a la gruta rocosa",
            next_scene=scene_cave
        )
        Choice.objects.create(
            source_scene=scene_cliff,
            text="Volver y entrar por la puerta",
            next_scene=scene_hall
        )

        self.stdout.write(self.style.SUCCESS("¡Historia 'El Secreto del Faro' sembrada con éxito!"))
