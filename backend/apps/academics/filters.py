import django_filters
from .models import SchoolClass


class SchoolClassFilter(django_filters.FilterSet):
    class Meta:
        model = SchoolClass
        fields = ["name", "session"]