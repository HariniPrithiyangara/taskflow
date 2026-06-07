from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Task, Project


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user


class ProjectSerializer(serializers.ModelSerializer):
    task_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'created_at', 'updated_at', 'task_count']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_task_count(self, obj):
        return obj.tasks.count()


class TaskSerializer(serializers.ModelSerializer):
    # Always include project_name — returns null when project is None
    project_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'priority',
            'due_date', 'created_at', 'updated_at', 'project', 'project_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'project_name']

    def get_project_name(self, obj):
        """Always return project name or None — never omit the field."""
        return obj.project.name if obj.project_id else None

    def validate_due_date(self, value):
        """Accept empty string or None as null due date."""
        if value == '' or value is None:
            return None
        return value

    def to_internal_value(self, data):
        """Convert empty string due_date to None before field validation."""
        mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        if mutable.get('due_date') == '':
            mutable['due_date'] = None
        return super().to_internal_value(mutable)
