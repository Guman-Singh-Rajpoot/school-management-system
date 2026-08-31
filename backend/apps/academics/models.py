from django.db import models


class Session(models.Model):
    """
    Academic session/year.

    Example:
        2025-2026
        2026-2027
    """

    name = models.CharField(
        max_length=20,
        unique=True
    )

    start_date = models.DateField()

    end_date = models.DateField()

    is_current = models.BooleanField(
        default=False
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "Academic Session"
        verbose_name_plural = "Academic Sessions"


class SchoolClass(models.Model):
    name = models.CharField(
        max_length=100
    )

    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name="school_classes",
        null=True,
        blank=True
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]
        unique_together = ["session", "name"]
        verbose_name = "School Class"
        verbose_name_plural = "School Classes"


class Section(models.Model):
    """
    Section belonging to a school class.

    Example:
        Class 10 - A
        Class 10 - B
    """

    class_room = models.ForeignKey(
        SchoolClass,
        on_delete=models.CASCADE,
        related_name="sections"
    )

    name = models.CharField(
        max_length=50
    )

    def __str__(self):
        return f"{self.class_room.name} - {self.name}"

    class Meta:
        ordering = ["name"]
        unique_together = ["class_room", "name"]
        verbose_name = "Section"
        verbose_name_plural = "Sections"


class Subject(models.Model):
    """
    Subject belonging to a school class.
    """

    name = models.CharField(
        max_length=100
    )

    code = models.CharField(
        max_length=20,
        unique=True
    )

    school_class = models.ForeignKey(
        SchoolClass,
        on_delete=models.CASCADE,
        related_name="subjects"
    )

    is_elective = models.BooleanField(
        default=False
    )

    def __str__(self):
        return f"{self.name} ({self.code})"

    class Meta:
        ordering = ["name"]
        verbose_name = "Subject"
        verbose_name_plural = "Subjects"
        