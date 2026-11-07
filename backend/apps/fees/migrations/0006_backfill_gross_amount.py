from django.db import migrations


def backfill_gross_amount(apps, schema_editor):
    """
    Legacy StudentFee rows (pre- capture) had no amount of their own;
    their payable amount came live from FeeStructure.amount.

    Copy the structure amount once into gross_amount. Existing rows were
    created only through the per-student assign flow, which always
    matched a structure amount, so copying is the faithful migration.
    Rows for 0-amount structures copy 0 and remain free.
    """
    StudentFee = apps.get_model('fees', 'StudentFee')
    for fee in StudentFee.objects.select_related('fee_structure').iterator():
        fee.gross_amount = fee.fee_structure.amount
        fee.save(update_fields=['gross_amount'])


def unbackfill_gross_amount(apps, schema_editor):
    StudentFee = apps.get_model('fees', 'StudentFee')
    StudentFee.objects.update(gross_amount=0)


class Migration(migrations.Migration):

    dependencies = [
        ('fees', '0005_alter_feestructure_created_at_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_gross_amount, unbackfill_gross_amount),
    ]
