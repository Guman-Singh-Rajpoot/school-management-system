from django.db import models


class TimetableSlot(models.Model):
    class Day(models.IntegerChoices):
        MONDAY = 0, 'Monday'
        TUESDAY = 1, 'Tuesday'
        WEDNESDAY = 2, 'Wednesday'
        THURSDAY = 3, 'Thursday'
        FRIDAY = 4, 'Friday'
        SATURDAY = 5, 'Saturday'
        SUNDAY = 6, 'Sunday'

    section = models.ForeignKey('academics.Section', on_delete=models.CASCADE, related_name='timetable_slots')
    subject = models.ForeignKey('academics.Subject', on_delete=models.CASCADE, related_name='timetable_slots')
    teacher = models.ForeignKey('teachers.Teacher', on_delete=models.SET_NULL, null=True, related_name='timetable_slots')
    day_of_week = models.IntegerField(choices=Day.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room_number = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.section} - {self.subject} - {self.get_day_of_week_display()} {self.start_time}"
