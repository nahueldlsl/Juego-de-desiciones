from django.db import migrations

def setup_groups_and_authors(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    User = apps.get_model('auth', 'User')
    Story = apps.get_model('core', 'Story')
    
    # 1. Create 'Profesores' group
    Group.objects.get_or_create(name='Profesores')
    
    # 2. Find first superuser or staff or any user to assign
    superuser = User.objects.filter(is_superuser=True).first()
    if not superuser:
        superuser = User.objects.filter(is_staff=True).first()
        if not superuser:
            superuser = User.objects.first()
            
    if superuser:
        # Assign all orphaned stories to the superuser
        Story.objects.filter(author__isnull=True).update(author=superuser)

def reverse_setup(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_story_author_story_is_public_alter_room_host"),
    ]

    operations = [
        migrations.RunPython(setup_groups_and_authors, reverse_setup),
    ]
