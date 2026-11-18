from rest_framework import serializers
from .models import GeneratedDocument, BackupRecord


class GeneratedDocumentSerializer(serializers.ModelSerializer):
    document_type_display = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)

    def get_document_type_display(self, obj):
        return obj.get_document_type_display()

    class Meta:
        model = GeneratedDocument
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'uploaded_at']


class BackupRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupRecord
        fields = '__all__'
        read_only_fields = ['triggered_by', 'created_at']
