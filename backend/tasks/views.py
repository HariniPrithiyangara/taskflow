from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Q, F, Case, When, IntegerField
from .models import Task, Project
from .serializers import TaskSerializer, UserSerializer, ProjectSerializer
from .pagination import TaskPagination


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # No pagination for projects (usually small list)

    def get_queryset(self):
        queryset = Project.objects.filter(user=self.request.user)
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = TaskPagination

    def get_queryset(self):
        queryset = Task.objects.filter(user=self.request.user).select_related('project')

        # Status filter
        status_param = self.request.query_params.get('status', '').strip()
        if status_param and status_param != 'All':
            queryset = queryset.filter(status=status_param)

        # Project filter
        project_param = self.request.query_params.get('project', '').strip()
        if project_param:
            queryset = queryset.filter(project_id=project_param)

        # Full-text search
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        # Ordering
        ordering = self.request.query_params.get('ordering', '-created_at').strip()
        if ordering == 'due_date':
            queryset = queryset.order_by(F('due_date').asc(nulls_last=True))
        elif ordering == 'title':
            queryset = queryset.order_by('title')
        elif ordering == 'priority':
            queryset = queryset.annotate(
                priority_weight=Case(
                    When(priority='High', then=1),
                    When(priority='Medium', then=2),
                    When(priority='Low', then=3),
                    default=4,
                    output_field=IntegerField(),
                )
            ).order_by('priority_weight', F('due_date').asc(nulls_last=True))
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='stats', pagination_class=None)
    def stats(self, request):
        """
        Returns aggregate task counts for the current user.
        Not filtered by search/status — always returns global totals
        so the frontend stats cards are accurate regardless of active filter.
        """
        today = timezone.now().date()
        queryset = Task.objects.filter(user=request.user)
        return Response({
            'total': queryset.count(),
            'pending': queryset.filter(status='Pending').count(),
            'in_progress': queryset.filter(status='In Progress').count(),
            'completed': queryset.filter(status='Completed').count(),
            'overdue': queryset.filter(
                status__in=['Pending', 'In Progress'],
                due_date__lt=today
            ).count(),
        })


# ---------------------------------------------------------------------------
# Auth Views
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': {'id': user.id, 'username': user.username, 'email': user.email}
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        if not username or not password:
            return Response(
                {'detail': 'Username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user = authenticate(username=username, password=password)
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': {'id': user.id, 'username': user.username, 'email': user.email}
            })
        return Response(
            {'detail': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED
        )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        return Response({'detail': 'Successfully logged out.'})


class UserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email
        })
