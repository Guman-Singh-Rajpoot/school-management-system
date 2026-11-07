# Generated for unique roll number per class and section
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0001_initial'),
        ('students', '0002_alter_student_school_class_alter_student_session'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='student',
            constraint=models.UniqueConstraint(
                condition=models.Q(('roll_number', ''), _negated=True),
                fields=('school_class', 'section', 'roll_number'),
                name='unique_roll_per_class_section',
            ),
        ),
    ]
