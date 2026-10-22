from django.urls import path, include
from rest_framework.routers import DefaultRouter
from crm.views import (
    COLLECTIONS,
    OwnedViewSet,
    SessionView,
    LoginView,
    LogoutView,
    PasswordView,
    BootstrapView,
    SettingsView,
    AvailabilityView,
    ExportView,
    UsersView,
    PublicView,
    PublicBookingView,
)

router = DefaultRouter()
for name, (model, serializer) in COLLECTIONS.items():
    view = type(
        name.title() + "ViewSet",
        (OwnedViewSet,),
        {"queryset": model.objects.all(), "serializer_class": serializer},
    )
    router.register(name, view, basename=name)
urlpatterns = [
    path("api/session/", SessionView.as_view()),
    path("api/login/", LoginView.as_view()),
    path("api/logout/", LogoutView.as_view()),
    path("api/password/", PasswordView.as_view()),
    path("api/bootstrap/", BootstrapView.as_view()),
    path("api/settings/", SettingsView.as_view()),
    path("api/availability/", AvailabilityView.as_view()),
    path("api/export/", ExportView.as_view()),
    path("api/users/", UsersView.as_view()),
    path("api/public/<slug:slug>/", PublicView.as_view()),
    path("api/public/<slug:slug>/book/", PublicBookingView.as_view()),
    path("api/", include(router.urls)),
]
