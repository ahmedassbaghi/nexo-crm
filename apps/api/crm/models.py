import uuid
from datetime import time
from django.conf import settings
from django.db import models
from django.core.validators import MaxValueValidator


class Business(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    industry = models.CharField(max_length=100, default="Servicios profesionales")
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=240, blank=True)
    timezone = models.CharField(max_length=64, default="Europe/Madrid")
    currency = models.CharField(max_length=3, default="EUR")
    is_demo = models.BooleanField(default=False)
    opening = models.TimeField(default=time(9))
    closing = models.TimeField(default=time(19))
    weekdays = models.JSONField(default=list)
    public_booking = models.BooleanField(default=False)


class Membership(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="membership"
    )
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    role = models.CharField(
        max_length=12,
        choices=[("admin", "Administrador"), ("staff", "Equipo")],
        default="staff",
    )


class Owned(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ["-id"]


class Client(Owned):
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    company = models.CharField(max_length=120, blank=True)
    tag = models.CharField(
        max_length=24,
        choices=[("nuevo", "Nuevo"), ("habitual", "Habitual"), ("vip", "VIP")],
        default="nuevo",
    )
    lifecycle = models.CharField(
        max_length=16,
        choices=[
            ("lead", "Potencial"),
            ("customer", "Cliente"),
            ("inactive", "Inactivo"),
        ],
        default="customer",
    )
    source = models.CharField(max_length=120, blank=True)
    owner = models.ForeignKey(
        "Professional",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="owned_clients",
    )
    notes = models.TextField(blank=True, max_length=5000)
    active = models.BooleanField(default=True)


class Service(Owned):
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=1000)
    duration = models.PositiveIntegerField(default=60)
    price = models.PositiveIntegerField(default=0)
    color = models.CharField(max_length=16, default="mint")
    active = models.BooleanField(default=True)


class Professional(Owned):
    name = models.CharField(max_length=120)
    title = models.CharField(max_length=120, blank=True)
    color = models.CharField(max_length=16, default="mint")
    active = models.BooleanField(default=True)
    services = models.ManyToManyField(Service, blank=True)


class Resource(Owned):
    name = models.CharField(max_length=120)
    active = models.BooleanField(default=True)


class Block(Owned):
    professional = models.ForeignKey(
        Professional, null=True, blank=True, on_delete=models.PROTECT
    )
    reason = models.CharField(max_length=120)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()


class Appointment(Owned):
    STATUS = [
        ("pending", "Pendiente"),
        ("confirmed", "Confirmada"),
        ("completed", "Completada"),
        ("cancelled", "Cancelada"),
        ("no_show", "No presentado"),
    ]
    client = models.ForeignKey(Client, on_delete=models.PROTECT)
    service = models.ForeignKey(Service, on_delete=models.PROTECT)
    professional = models.ForeignKey(Professional, on_delete=models.PROTECT)
    resource = models.ForeignKey(
        Resource, null=True, blank=True, on_delete=models.PROTECT
    )
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=STATUS, default="confirmed")
    price = models.PositiveIntegerField(default=0)
    service_name = models.CharField(max_length=120)
    duration = models.PositiveIntegerField()
    notes = models.TextField(blank=True, max_length=3000)
    version = models.PositiveIntegerField(default=1)
    request_key = models.UUIDField(default=uuid.uuid4, unique=True)

    class Meta:
        ordering = ["starts_at"]
        indexes = [models.Index(fields=["business", "professional", "starts_at"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(ends_at__gt=models.F("starts_at")),
                name="appointment_positive_interval",
            )
        ]


class Payment(Owned):
    appointment = models.ForeignKey(
        Appointment, related_name="payments", on_delete=models.PROTECT
    )
    amount = models.PositiveIntegerField()
    method = models.CharField(
        max_length=16,
        choices=[
            ("card", "Tarjeta"),
            ("cash", "Efectivo"),
            ("transfer", "Transferencia"),
        ],
        default="card",
    )
    reference = models.CharField(max_length=120, blank=True)
    paid_at = models.DateTimeField()
    request_key = models.UUIDField(default=uuid.uuid4, unique=True)


class Opportunity(Owned):
    title = models.CharField(max_length=160)
    client = models.ForeignKey(Client, on_delete=models.PROTECT)
    value = models.PositiveIntegerField(default=0)
    stage = models.CharField(
        max_length=16,
        choices=[
            ("new", "Nuevo"),
            ("contacted", "Contactado"),
            ("proposal", "Propuesta"),
            ("won", "Ganado"),
            ("lost", "Perdido"),
        ],
        default="new",
    )
    owner = models.ForeignKey(
        Professional,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="owned_opportunities",
    )
    probability = models.PositiveSmallIntegerField(
        default=50, validators=[MaxValueValidator(100)]
    )
    expected_close = models.DateField(null=True, blank=True)
    lost_reason = models.CharField(max_length=500, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    next_action = models.CharField(max_length=240, blank=True)
    due_date = models.DateField(null=True, blank=True)


class Task(Owned):
    title = models.CharField(max_length=160)
    client = models.ForeignKey(Client, null=True, blank=True, on_delete=models.PROTECT)
    professional = models.ForeignKey(
        Professional, null=True, blank=True, on_delete=models.PROTECT
    )
    due_date = models.DateField()
    priority = models.CharField(
        max_length=10,
        choices=[("normal", "Normal"), ("high", "Alta")],
        default="normal",
    )
    done = models.BooleanField(default=False)


class Audit(Owned):
    actor = models.CharField(max_length=150)
    action = models.CharField(max_length=80)
    entity = models.CharField(max_length=80)
    object_id = models.PositiveIntegerField()


class Activity(Owned):
    client = models.ForeignKey(Client, on_delete=models.PROTECT)
    kind = models.CharField(
        max_length=12,
        choices=[
            ("note", "Nota"),
            ("call", "Llamada"),
            ("email", "Correo"),
            ("meeting", "Reunión"),
        ],
        default="note",
    )
    subject = models.CharField(max_length=160)
    body = models.TextField(blank=True, max_length=5000)
    occurred_at = models.DateTimeField()
    author = models.CharField(max_length=150)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        indexes = [models.Index(fields=["business", "client", "occurred_at"])]


class Quote(Owned):
    client = models.ForeignKey(Client, on_delete=models.PROTECT)
    title = models.CharField(max_length=160)
    number = models.PositiveIntegerField()
    status = models.CharField(
        max_length=12,
        choices=[
            ("draft", "Borrador"),
            ("sent", "Enviado"),
            ("accepted", "Aceptado"),
            ("rejected", "Rechazado"),
            ("expired", "Caducado"),
        ],
        default="draft",
    )
    valid_until = models.DateField()
    items = models.JSONField(default=list)
    discount_percent = models.PositiveSmallIntegerField(
        default=0, validators=[MaxValueValidator(100)]
    )
    tax_percent = models.PositiveSmallIntegerField(
        default=21, validators=[MaxValueValidator(100)]
    )
    subtotal = models.PositiveIntegerField(default=0)
    discount = models.PositiveIntegerField(default=0)
    tax = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True, max_length=5000)
    issued_at = models.DateTimeField(null=True, blank=True)
    sender = models.JSONField(default=dict)
    recipient = models.JSONField(default=dict)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    request_key = models.UUIDField(default=uuid.uuid4, unique=True)

    class Meta:
        ordering = ["-number"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "number"], name="quote_number_per_business"
            )
        ]
