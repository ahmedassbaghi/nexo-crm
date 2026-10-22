from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Business,
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
from .scheduling import local_instant, validate_slot


class ScopedSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        business = self.context.get("business")
        if business:
            for field in self.fields.values():
                related = getattr(field, "child_relation", field)
                if getattr(related, "queryset", None) is not None and hasattr(
                    related.queryset.model, "business"
                ):
                    related.queryset = related.queryset.filter(business=business)


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = [
            "id",
            "name",
            "slug",
            "industry",
            "email",
            "phone",
            "address",
            "timezone",
            "currency",
            "opening",
            "closing",
            "weekdays",
            "public_booking",
            "is_demo",
        ]
        read_only_fields = ["id", "slug", "currency", "is_demo"]

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise serializers.ValidationError("Zona horaria no válida.")
        return value

    def validate_weekdays(self, value):
        if (
            not isinstance(value, list)
            or not value
            or any(type(i) is not int or not 0 <= i <= 6 for i in value)
            or len(set(value)) != len(value)
        ):
            raise serializers.ValidationError(
                "Selecciona al menos un día, sin duplicados."
            )
        return sorted(value)

    def validate(self, data):
        start = data.get("opening", self.instance.opening)
        end = data.get("closing", self.instance.closing)
        if (
            start >= end
            or start.minute % 15
            or end.minute % 15
            or start.second
            or end.second
        ):
            raise serializers.ValidationError(
                "El horario debe ser creciente y usar intervalos de 15 minutos."
            )
        return data


class ClientSerializer(ScopedSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "company",
            "lifecycle",
            "source",
            "owner",
            "tag",
            "notes",
            "active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ServiceSerializer(ScopedSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "description", "duration", "price", "color", "active"]

    def validate_duration(self, value):
        if value < 15 or value > 480 or value % 15:
            raise serializers.ValidationError(
                "Entre 15 y 480 minutos, en intervalos de 15."
            )
        return value

    def validate_color(self, value):
        if value not in ["mint", "blue", "peach", "lavender"]:
            raise serializers.ValidationError("Color no válido.")
        return value


class ProfessionalSerializer(ScopedSerializer):
    class Meta:
        model = Professional
        fields = ["id", "name", "title", "color", "active", "services"]


class ResourceSerializer(ScopedSerializer):
    class Meta:
        model = Resource
        fields = ["id", "name", "active"]


class BlockSerializer(ScopedSerializer):
    starts_local = serializers.CharField(write_only=True, required=False)
    ends_local = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Block
        fields = [
            "id",
            "professional",
            "reason",
            "starts_at",
            "ends_at",
            "starts_local",
            "ends_local",
        ]
        extra_kwargs = {
            "starts_at": {"required": False},
            "ends_at": {"required": False},
        }

    def validate(self, data):
        for source, target in [
            ("starts_local", "starts_at"),
            ("ends_local", "ends_at"),
        ]:
            if source in data:
                data[target] = local_instant(data.pop(source), self.context["business"])
        start = data.get("starts_at", getattr(self.instance, "starts_at", None))
        end = data.get("ends_at", getattr(self.instance, "ends_at", None))
        if not start or not end or end <= start:
            raise serializers.ValidationError("El final debe ser posterior al inicio.")
        visits = Appointment.objects.filter(
            business=self.context["business"], starts_at__lt=end, ends_at__gt=start
        ).exclude(status="cancelled")
        professional = data.get(
            "professional", getattr(self.instance, "professional", None)
        )
        if professional:
            visits = visits.filter(professional=professional)
        if visits.exists():
            raise serializers.ValidationError(
                "Hay citas en ese intervalo. Reprográmalas antes de bloquearlo."
            )
        return data


class AppointmentSerializer(ScopedSerializer):
    start_local = serializers.CharField(write_only=True, required=False)
    paid = serializers.SerializerMethodField()
    client_name = serializers.CharField(source="client.name", read_only=True)
    professional_name = serializers.CharField(
        source="professional.name", read_only=True
    )
    request_key = serializers.UUIDField(required=False)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "client",
            "client_name",
            "service",
            "service_name",
            "professional",
            "professional_name",
            "resource",
            "starts_at",
            "ends_at",
            "start_local",
            "status",
            "price",
            "duration",
            "notes",
            "version",
            "paid",
            "request_key",
        ]
        read_only_fields = [
            "id",
            "starts_at",
            "ends_at",
            "service_name",
            "price",
            "duration",
        ]

    def get_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def validate(self, data):
        current = self.instance
        business = self.context["business"]
        if current and data.get("version") != current.version:
            raise serializers.ValidationError(
                "Esta cita ha cambiado. Actualiza la agenda antes de guardar."
            )
        if current and "request_key" in data:
            raise serializers.ValidationError(
                "La clave de creación no se puede modificar."
            )
        if current and any(
            k in data and data[k] != getattr(current, k)
            for k in ["client", "service", "professional", "resource"]
        ):
            raise serializers.ValidationError(
                "Para cambiar cliente, servicio, profesional o recurso, cancela y crea otra cita."
            )
        start_local = data.pop("start_local", None)
        if not current and not start_local:
            raise serializers.ValidationError({"start_local": "Selecciona una hora."})
        status = data.get("status", current.status if current else "confirmed")
        if not current and status not in ["pending", "confirmed"]:
            raise serializers.ValidationError(
                "Una cita nueva debe estar pendiente o confirmada."
            )
        if current and current.status in ["cancelled", "completed", "no_show"]:
            raise serializers.ValidationError(
                "La cita está cerrada y no se puede modificar."
            )
        if (
            current
            and status in ["completed", "no_show"]
            and current.starts_at > timezone.now()
        ):
            raise serializers.ValidationError("La cita todavía no ha empezado.")
        if current and start_local and status not in ["pending", "confirmed"]:
            raise serializers.ValidationError(
                "No se puede reprogramar una cita cerrada."
            )
        if start_local:
            client = data.get("client", current.client if current else None)
            if not client.active:
                raise serializers.ValidationError("El cliente está archivado.")
            service = data.get("service", current.service if current else None)
            professional = data.get(
                "professional", current.professional if current else None
            )
            resource = data.get("resource", current.resource if current else None)
            start = local_instant(start_local, business)
            end = validate_slot(
                business,
                professional,
                service,
                start,
                resource,
                current.pk if current else None,
                current.duration if current else None,
            )
            data.update(starts_at=start, ends_at=end)
            if not current:
                data.update(
                    price=service.price,
                    service_name=service.name,
                    duration=service.duration,
                )
        data["version"] = current.version + 1 if current else 1
        return data


class PaymentSerializer(ScopedSerializer):
    client_name = serializers.CharField(
        source="appointment.client.name", read_only=True
    )
    service_name = serializers.CharField(
        source="appointment.service_name", read_only=True
    )
    request_key = serializers.UUIDField(required=False)

    class Meta:
        model = Payment
        fields = [
            "id",
            "appointment",
            "amount",
            "method",
            "reference",
            "paid_at",
            "client_name",
            "service_name",
            "request_key",
        ]

    def validate(self, data):
        visit = data["appointment"]
        paid = visit.payments.aggregate(total=Sum("amount"))["total"] or 0
        if data["amount"] <= 0 or paid + data["amount"] > visit.price:
            raise serializers.ValidationError(
                "El importe debe ser positivo y no superar el saldo pendiente."
            )
        if visit.status in ["cancelled", "no_show"]:
            raise serializers.ValidationError(
                "No se pueden registrar cobros en citas canceladas o no presentadas."
            )
        if data["paid_at"] > timezone.now():
            raise serializers.ValidationError(
                "La fecha de cobro no puede estar en el futuro."
            )
        return data


class OpportunitySerializer(ScopedSerializer):
    class Meta:
        model = Opportunity
        fields = [
            "id",
            "title",
            "client",
            "value",
            "stage",
            "next_action",
            "due_date",
            "owner",
            "probability",
            "expected_close",
            "lost_reason",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate(self, data):
        stage = data.get("stage", self.instance.stage if self.instance else "new")
        if (
            stage == "lost"
            and not data.get(
                "lost_reason", self.instance.lost_reason if self.instance else ""
            ).strip()
        ):
            raise serializers.ValidationError(
                {
                    "lost_reason": "Indica el motivo de pérdida para poder aprender de esta oportunidad."
                }
            )
        return data


class TaskSerializer(ScopedSerializer):
    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "client",
            "professional",
            "due_date",
            "priority",
            "done",
        ]


class AuditSerializer(ScopedSerializer):
    class Meta:
        model = Audit
        fields = ["id", "actor", "action", "entity", "object_id", "created_at"]


class ActivitySerializer(ScopedSerializer):
    class Meta:
        model = Activity
        fields = [
            "id",
            "client",
            "kind",
            "subject",
            "body",
            "occurred_at",
            "author",
            "created_at",
        ]
        read_only_fields = ["author", "created_at"]

    def validate_occurred_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError(
                "Registra conversaciones ya realizadas. Usa una tarea para planificar un seguimiento."
            )
        return value


class QuoteSerializer(ScopedSerializer):
    request_key = serializers.UUIDField(required=False)

    class Meta:
        model = Quote
        fields = [
            "id",
            "client",
            "title",
            "number",
            "status",
            "valid_until",
            "items",
            "discount_percent",
            "tax_percent",
            "subtotal",
            "discount",
            "tax",
            "total",
            "notes",
            "issued_at",
            "sender",
            "recipient",
            "version",
            "created_at",
            "updated_at",
            "request_key",
        ]
        read_only_fields = [
            "number",
            "subtotal",
            "discount",
            "tax",
            "total",
            "issued_at",
            "sender",
            "recipient",
            "created_at",
            "updated_at",
        ]

    def validate_items(self, items):
        from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

        if not isinstance(items, list) or not 1 <= len(items) <= 100:
            raise serializers.ValidationError("Incluye entre 1 y 100 conceptos.")
        clean = []
        for item in items:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Concepto no válido.")
            description = item.get("description", "")
            if (
                not isinstance(description, str)
                or not description.strip()
                or len(description) > 240
            ):
                raise serializers.ValidationError(
                    "Cada concepto necesita una descripción de hasta 240 caracteres."
                )
            price = item.get("unit_price")
            if type(price) is not int or not 0 <= price <= 100000000:
                raise serializers.ValidationError(
                    "Precio no válido (céntimos enteros)."
                )
            try:
                quantity = Decimal(str(item.get("quantity", "")))
                if (
                    not quantity.is_finite()
                    or not Decimal("0.01") <= quantity <= 10000
                    or quantity != quantity.quantize(Decimal("0.01"))
                ):
                    raise ValueError()
            except (InvalidOperation, ValueError):
                raise serializers.ValidationError(
                    "La cantidad debe estar entre 0,01 y 10.000, con hasta dos decimales."
                )
            total = int(
                (quantity * price).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            )
            clean.append(
                {
                    "description": description.strip(),
                    "quantity": str(quantity),
                    "unit_price": price,
                    "total": total,
                }
            )
        return clean

    def validate(self, data):
        from decimal import Decimal, ROUND_HALF_UP
        from django.db.models import Max
        from zoneinfo import ZoneInfo

        current = self.instance
        business = self.context["business"]
        status = data.get("status", current.status if current else "draft")
        today = timezone.localdate(timezone=ZoneInfo(business.timezone))
        if current:
            if data.get("version") != current.version:
                raise serializers.ValidationError(
                    "El presupuesto ha cambiado. Actualiza los datos antes de continuar."
                )
            if "request_key" in data and data["request_key"] != current.request_key:
                raise serializers.ValidationError(
                    "No se puede cambiar la clave del presupuesto."
                )
            if current.status != "draft":
                if set(data) - {"status", "version"}:
                    raise serializers.ValidationError(
                        "El contenido de un presupuesto enviado no se puede modificar. Crea uno nuevo."
                    )
                if current.status != "sent" or status not in [
                    "accepted",
                    "rejected",
                    "expired",
                ]:
                    raise serializers.ValidationError(
                        "Transición de estado no permitida."
                    )
            elif status not in ["draft", "sent"]:
                raise serializers.ValidationError(
                    "Primero registra el envío del presupuesto."
                )
        elif status != "draft":
            raise serializers.ValidationError(
                "Los presupuestos nuevos se crean como borrador."
            )
        if (
            status in ["sent", "accepted"]
            and data.get("valid_until", current.valid_until if current else today)
            < today
        ):
            raise serializers.ValidationError(
                "El presupuesto ha caducado. Crea una nueva propuesta con una fecha vigente."
            )
        if status == "expired" and current.valid_until >= today:
            raise serializers.ValidationError(
                "Todavía no ha vencido la fecha de validez."
            )
        if not current or current.status == "draft":
            items = data.get("items", current.items if current else [])
            if not items:
                raise serializers.ValidationError("Añade al menos un concepto.")
            subtotal = sum(item["total"] for item in items)
            discount_rate = data.get(
                "discount_percent", current.discount_percent if current else 0
            )
            tax_rate = data.get("tax_percent", current.tax_percent if current else 21)
            rounded = lambda value: int(
                Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            )
            discount = rounded(Decimal(subtotal) * discount_rate / 100)
            tax = rounded(Decimal(subtotal - discount) * tax_rate / 100)
            total = subtotal - discount + tax
            if max(subtotal, discount, tax, total) > 2000000000:
                raise serializers.ValidationError(
                    "El presupuesto supera el importe máximo permitido."
                )
            data.update(subtotal=subtotal, discount=discount, tax=tax, total=total)
            if status == "sent":
                data["issued_at"] = timezone.now()
                client = data.get("client", current.client)
                data["sender"] = {
                    key: getattr(business, key)
                    for key in ["name", "email", "phone", "address"]
                }
                data["recipient"] = {
                    key: getattr(client, key)
                    for key in ["name", "company", "email", "phone"]
                }
        data["version"] = current.version + 1 if current else 1
        if not current:
            data["number"] = (
                Quote.objects.filter(business=business).aggregate(n=Max("number"))["n"]
                or 0
            ) + 1
        return data
