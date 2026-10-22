import csv
import io
from uuid import UUID
from datetime import datetime
from zoneinfo import ZoneInfo
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from .models import (
    Business,
    Membership,
    Client,
    Service,
    Professional,
    Resource,
    Block,
    Appointment,
    Payment,
    Opportunity,
    Task,
    Audit,
    Activity,
    Quote,
)
from .serializers import (
    BusinessSerializer,
    ClientSerializer,
    ServiceSerializer,
    ProfessionalSerializer,
    ResourceSerializer,
    BlockSerializer,
    AppointmentSerializer,
    PaymentSerializer,
    OpportunitySerializer,
    TaskSerializer,
    ActivitySerializer,
    QuoteSerializer,
    AuditSerializer,
)
from .scheduling import availability


def member(request):
    try:
        return request.user.membership
    except (Membership.DoesNotExist, AttributeError):
        raise PermissionDenied("No tienes acceso a ningún negocio.")


def admin(request):
    if member(request).role != "admin":
        raise PermissionDenied("Solo el administrador puede realizar esta operación.")


def log(request, business, action, obj):
    Audit.objects.create(
        business=business,
        actor=request.user.username
        if request.user.is_authenticated
        else "Reserva pública",
        action=action,
        entity=obj.__class__.__name__,
        object_id=obj.pk,
    )


class SessionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        data = {"csrf": get_token(request), "user": None}
        if request.user.is_authenticated:
            membership = member(request)
            data["user"] = {
                "name": request.user.first_name or request.user.username,
                "username": request.user.username,
                "role": membership.role,
            }
            data["business"] = BusinessSerializer(membership.business).data
        response = Response(data)
        response["Cache-Control"] = "no-store"
        return response


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        user = authenticate(
            request,
            username=request.data.get("username", ""),
            password=request.data.get("password", ""),
        )
        if not user or not Membership.objects.filter(user=user).exists():
            return Response({"detail": "Usuario o contraseña incorrectos."}, status=400)
        login(request, user)
        return Response({"ok": True, "csrf": get_token(request)})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"ok": True})


class PasswordView(APIView):
    def post(self, request):
        if not request.user.check_password(request.data.get("current", "")):
            raise ValidationError("La contraseña actual no es correcta.")
        password = request.data.get("password", "")
        try:
            validate_password(password, request.user)
        except DjangoValidationError as error:
            raise ValidationError(error.messages)
        request.user.set_password(password)
        request.user.save()
        logout(request)
        return Response({"ok": True})


COLLECTIONS = {
    "activities": (Activity, ActivitySerializer),
    "quotes": (Quote, QuoteSerializer),
    "clients": (Client, ClientSerializer),
    "services": (Service, ServiceSerializer),
    "professionals": (Professional, ProfessionalSerializer),
    "resources": (Resource, ResourceSerializer),
    "blocks": (Block, BlockSerializer),
    "appointments": (Appointment, AppointmentSerializer),
    "payments": (Payment, PaymentSerializer),
    "opportunities": (Opportunity, OpportunitySerializer),
    "tasks": (Task, TaskSerializer),
}


class BootstrapView(APIView):
    def get(self, request):
        business = member(request).business
        result = {"business": BusinessSerializer(business).data}
        for name, (model, serializer) in COLLECTIONS.items():
            query = model.objects.filter(business=business)
            if name == "appointments":
                query = query.select_related("client", "professional").prefetch_related(
                    "payments"
                )
            elif name == "payments":
                query = query.select_related("appointment__client")
            elif name == "professionals":
                query = query.prefetch_related("services")
            result[name] = serializer(query, many=True).data
        result["audit"] = AuditSerializer(
            Audit.objects.filter(business=business)[:15], many=True
        ).data
        return Response(result, headers={"Cache-Control": "no-store"})


class OwnedViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return self.queryset.filter(business=member(self.request).business)

    def get_serializer_context(self):
        return {
            **super().get_serializer_context(),
            "business": member(self.request).business,
        }

    def authorize(self):
        if self.queryset.model in [Service, Professional, Resource, Block]:
            admin(self.request)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        self.authorize()
        business = Business.objects.select_for_update().get(
            pk=member(request).business_id
        )
        if self.queryset.model in [Appointment, Payment, Quote] and request.data.get(
            "request_key"
        ):
            try:
                key = UUID(str(request.data["request_key"]))
            except ValueError:
                raise ValidationError("Clave de solicitud no válida.")
            existing = self.get_queryset().filter(request_key=key).first()
            if existing:
                return Response(self.get_serializer(existing).data)
            if self.queryset.model.objects.filter(request_key=key).exists():
                raise ValidationError(
                    "Clave de solicitud no válida. Vuelve a abrir el formulario."
                )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(
            business=business,
            **(
                {"author": request.user.get_full_name() or request.user.username}
                if self.queryset.model is Activity
                else {}
            ),
        )
        log(request, business, "Creado", obj)
        return Response(serializer.data, status=201)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        self.authorize()
        business = Business.objects.select_for_update().get(
            pk=member(request).business_id
        )
        if self.queryset.model in [Payment, Activity]:
            raise ValidationError(
                "Los cobros y las conversaciones registradas son inmutables. Añade una nota para corregir el historial."
            )
        obj = self.get_object()
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        log(request, business, "Actualizado", obj)
        return Response(serializer.data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        self.authorize()
        business = Business.objects.select_for_update().get(
            pk=member(request).business_id
        )
        obj = self.get_object()
        if not isinstance(obj, (Task, Block)):
            raise ValidationError(
                "Este registro debe archivarse o cancelarse para conservar su historial."
            )
        log(request, business, "Eliminado", obj)
        obj.delete()
        return Response(status=204)


class SettingsView(APIView):
    @transaction.atomic
    def patch(self, request):
        admin(request)
        business = Business.objects.select_for_update().get(
            pk=member(request).business_id
        )
        serializer = BusinessSerializer(business, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log(request, business, "Configuración actualizada", business)
        return Response(serializer.data)


class AvailabilityView(APIView):
    def get(self, request):
        business = member(request).business
        try:
            professional = get_object_or_404(
                Professional,
                pk=int(request.query_params.get("professional", "0")),
                business=business,
            )
            service = get_object_or_404(
                Service,
                pk=int(request.query_params.get("service", "0")),
                business=business,
            )
            resource = (
                get_object_or_404(
                    Resource,
                    pk=int(request.query_params["resource"]),
                    business=business,
                )
                if request.query_params.get("resource")
                else None
            )
            visit = (
                get_object_or_404(
                    Appointment,
                    pk=int(request.query_params["exclude"]),
                    business=business,
                )
                if request.query_params.get("exclude")
                else None
            )
        except ValueError:
            raise ValidationError("Referencia no válida.")
        return Response(
            {
                "days": availability(
                    business,
                    professional,
                    service,
                    request.query_params.get("month", ""),
                    resource,
                    visit.pk if visit else None,
                    visit.duration if visit else None,
                )
            }
        )


class ExportView(APIView):
    def get(self, request):
        admin(request)
        business = member(request).business
        kind = request.query_params.get("kind", "clients")
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")

        def safe(value):
            value = str(value)
            return (
                "'" + value
                if value.lstrip().startswith(("=", "+", "-", "@"))
                or value.startswith(("\t", "\r", "\n"))
                else value
            )

        if kind == "clients":
            writer.writerow(["Nombre", "Email", "Teléfono", "Empresa", "Etiqueta"])
            for client in Client.objects.filter(business=business):
                writer.writerow(
                    [
                        safe(v)
                        for v in [
                            client.name,
                            client.email,
                            client.phone,
                            client.company,
                            client.tag,
                        ]
                    ]
                )
        elif kind == "payments":
            writer.writerow(
                ["Fecha", "Cliente", "Servicio", "Importe EUR", "Método", "Referencia"]
            )
            query = Payment.objects.filter(business=business).select_related(
                "appointment__client"
            )
            zone = ZoneInfo(business.timezone)
            try:
                for key, lookup in [("from", "paid_at__gte"), ("to", "paid_at__lt")]:
                    if request.query_params.get(key):
                        date = datetime.strptime(
                            request.query_params[key], "%Y-%m-%d"
                        ).replace(tzinfo=zone)
                        if key == "to":
                            from datetime import timedelta

                            date += timedelta(days=1)
                        query = query.filter(**{lookup: date})
            except ValueError:
                raise ValidationError("Intervalo de fechas no válido.")
            for payment in query:
                writer.writerow(
                    [
                        safe(v)
                        for v in [
                            payment.paid_at.astimezone(zone).isoformat(),
                            payment.appointment.client.name,
                            payment.appointment.service_name,
                            f"{payment.amount / 100:.2f}",
                            payment.get_method_display(),
                            payment.reference,
                        ]
                    ]
                )
        else:
            raise ValidationError("Exportación no disponible.")
        response = HttpResponse(
            "\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8"
        )
        response["Content-Disposition"] = f'attachment; filename="nexo-{kind}.csv"'
        log(request, business, "Exportación " + kind, business)
        return response


class UserInput(serializers.Serializer):
    username = serializers.RegexField(r"^[\w.@+-]+$", max_length=150)
    name = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=10, max_length=128, write_only=True)
    role = serializers.ChoiceField(choices=["admin", "staff"])


class UsersView(APIView):
    def get(self, request):
        admin(request)
        return Response(
            [
                {
                    "id": m.user_id,
                    "username": m.user.username,
                    "name": m.user.first_name,
                    "role": m.role,
                    "active": m.user.is_active,
                }
                for m in Membership.objects.filter(
                    business=member(request).business
                ).select_related("user")
            ]
        )

    @transaction.atomic
    def post(self, request):
        admin(request)
        business = Business.objects.select_for_update().get(
            pk=member(request).business_id
        )
        serializer = UserInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if get_user_model().objects.filter(username=data["username"]).exists():
            raise ValidationError("El nombre de usuario ya está en uso.")
        try:
            validate_password(data["password"])
        except DjangoValidationError as error:
            raise ValidationError(error.messages)
        user = get_user_model().objects.create_user(
            username=data["username"],
            first_name=data["name"],
            password=data["password"],
        )
        Membership.objects.create(user=user, business=business, role=data["role"])
        log(request, business, "Usuario creado", user)
        return Response({"id": user.pk}, status=201)

    @transaction.atomic
    def patch(self, request):
        admin(request)
        business = Business.objects.select_for_update().get(
            pk=member(request).business_id
        )
        try:
            user_id = int(request.data.get("id", 0))
        except (ValueError, TypeError):
            raise ValidationError("Usuario no válido.")
        membership = get_object_or_404(Membership, user_id=user_id, business=business)
        if membership.user_id == request.user.pk:
            raise ValidationError("No puedes desactivar tu propio acceso.")
        if type(request.data.get("active")) is not bool:
            raise ValidationError("Estado no válido.")
        membership.user.is_active = request.data["active"]
        membership.user.save()
        log(request, business, "Acceso actualizado", membership.user)
        return Response({"ok": True})


class PublicView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "availability"

    def get(self, request, slug):
        business = get_object_or_404(Business, slug=slug, public_booking=True)
        if request.query_params.get("month"):
            try:
                service = get_object_or_404(
                    Service,
                    pk=int(request.query_params.get("service", "0")),
                    business=business,
                    active=True,
                )
                professional = get_object_or_404(
                    Professional,
                    pk=int(request.query_params.get("professional", "0")),
                    business=business,
                    active=True,
                )
            except ValueError:
                raise ValidationError("Referencia no válida.")
            return Response(
                {
                    "days": availability(
                        business, professional, service, request.query_params["month"]
                    )
                }
            )
        return Response(
            {
                "business": {
                    "name": business.name,
                    "industry": business.industry,
                    "address": business.address,
                    "phone": business.phone,
                    "timezone": business.timezone,
                },
                "services": ServiceSerializer(
                    Service.objects.filter(business=business, active=True), many=True
                ).data,
                "professionals": ProfessionalSerializer(
                    Professional.objects.filter(
                        business=business, active=True
                    ).prefetch_related("services"),
                    many=True,
                ).data,
                "csrf": get_token(request),
            }
        )


class PublicBookingInput(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    service = serializers.IntegerField(min_value=1)
    professional = serializers.IntegerField(min_value=1)
    start_local = serializers.CharField(max_length=16)
    request_key = serializers.UUIDField()
    accepted = serializers.BooleanField()


@method_decorator(csrf_protect, name="dispatch")
class PublicBookingView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking"

    @transaction.atomic
    def post(self, request, slug):
        business = get_object_or_404(
            Business.objects.select_for_update(), slug=slug, public_booking=True
        )
        form = PublicBookingInput(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data
        if not data["accepted"]:
            raise ValidationError(
                "Acepta el tratamiento de datos necesario para gestionar tu cita."
            )
        if Appointment.objects.filter(request_key=data["request_key"]).exists():
            return Response({"ok": True})
        # Never join anonymous submissions to an existing customer's private history.
        client = Client.objects.create(
            business=business,
            name=data["name"],
            email=data["email"],
            phone=data["phone"],
        )
        booking = AppointmentSerializer(
            data={
                "client": client.pk,
                "service": data["service"],
                "professional": data["professional"],
                "start_local": data["start_local"],
                "request_key": str(data["request_key"]),
                "status": "pending",
                "notes": "Reserva pública. Datos facilitados para gestionar esta cita.",
            },
            context={"business": business},
        )
        booking.is_valid(raise_exception=True)
        visit = booking.save(business=business)
        log(request, business, "Reserva pública recibida", visit)
        return Response({"ok": True}, status=201)
