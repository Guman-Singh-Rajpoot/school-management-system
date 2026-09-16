from rest_framework import serializers
from .models import GeneratedDocument, BackupRecord


class GeneratedDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneratedDocument
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'uploaded_at']


class BackupRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupRecord
        fields = '__all__'
        read_only_fields = ['triggered_by', 'created_at']
