"""Add commercial examples to the explicitly marked demo, once, without resetting it."""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from zoneinfo import ZoneInfo
from crm.models import Business, Client, Professional, Opportunity, Activity, Audit
from crm.serializers import QuoteSerializer


class Command(BaseCommand):
    help = "Añade ejemplos comerciales solo a Estudio Norte si está marcado como demostración."

    @transaction.atomic
    def handle(self, *args, **options):
        business = (
            Business.objects.select_for_update()
            .filter(slug="estudio-norte", is_demo=True)
            .first()
        )
        if not business:
            self.stdout.write(
                "No existe el negocio de demostración; no se modifica ningún dato."
            )
            return
        marker = "Ejemplos CRM comercial preparados"
        if Audit.objects.filter(business=business, action=marker).exists():
            self.stdout.write("Los ejemplos comerciales ya existen; datos conservados.")
            return
        now = timezone.now()
        today = timezone.localdate(timezone=ZoneInfo(business.timezone))
        owners = list(Professional.objects.filter(business=business, active=True))
        examples = [
            (
                "Sofía Vidal",
                "Vidal Interiorismo",
                "Recomendación",
                "Acompañamiento comercial",
                145000,
                "proposal",
                75,
                "Resolver dudas sobre el alcance",
                "sent",
            ),
            (
                "Diego Roca",
                "Roca Talleres",
                "Web",
                "Plan de mantenimiento preventivo",
                96000,
                "contacted",
                40,
                "Preparar diagnóstico del taller",
                "draft",
            ),
            (
                "Elena Soler",
                "Soler & Co.",
                "Evento local",
                "Organización de procesos",
                210000,
                "won",
                100,
                "Acordar reunión de inicio",
                "accepted",
            ),
        ]
        for index, (
            name,
            company,
            source,
            title,
            value,
            stage,
            probability,
            next_action,
            quote_status,
        ) in enumerate(examples):
            owner = owners[index % len(owners)] if owners else None
            client = Client.objects.create(
                business=business,
                name=name,
                company=company,
                email=f"demo.crm.{index + 1}@example.com",
                lifecycle="customer" if stage == "won" else "lead",
                source=source,
                owner=owner,
                notes="Ejemplo ficticio de CRM. Prefiere propuestas con alcance y plazos bien definidos.",
            )
            Opportunity.objects.create(
                business=business,
                client=client,
                title=title,
                value=value,
                stage=stage,
                probability=probability,
                owner=owner,
                next_action=next_action,
                due_date=today - timedelta(days=1)
                if index == 0
                else today + timedelta(days=2),
                expected_close=today + timedelta(days=14),
            )
            Activity.objects.create(
                business=business,
                client=client,
                kind="call",
                subject="Primera conversación y necesidades",
                body="Hablamos sobre prioridades, alcance y plazos. El cliente valora tener una persona de referencia durante todo el proyecto.",
                occurred_at=now - timedelta(days=3 + index),
                author=owner.name if owner else "Equipo demo",
            )
            Activity.objects.create(
                business=business,
                client=client,
                kind="meeting" if index == 2 else "note",
                subject=next_action,
                body="El siguiente paso está acordado y recogido en la oportunidad comercial.",
                occurred_at=now - timedelta(hours=2 + index),
                author=owner.name if owner else "Equipo demo",
            )
            serializer = QuoteSerializer(
                data={
                    "client": client.pk,
                    "title": title,
                    "valid_until": today + timedelta(days=30),
                    "items": [
                        {"description": title, "quantity": "1", "unit_price": value}
                    ],
                    "tax_percent": 21,
                    "notes": "Incluye diagnóstico inicial, propuesta de trabajo y sesión de seguimiento. Forma de pago a acordar con el cliente. Ejemplo ficticio.",
                },
                context={"business": business},
            )
            serializer.is_valid(raise_exception=True)
            quote = serializer.save(business=business)
            if quote_status in ["sent", "accepted"]:
                serializer = QuoteSerializer(
                    quote,
                    data={"status": "sent", "version": quote.version},
                    partial=True,
                    context={"business": business},
                )
                serializer.is_valid(raise_exception=True)
                quote = serializer.save()
            if quote_status == "accepted":
                serializer = QuoteSerializer(
                    quote,
                    data={"status": "accepted", "version": quote.version},
                    partial=True,
                    context={"business": business},
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()
        Audit.objects.create(
            business=business,
            actor="Sistema",
            action=marker,
            entity="Business",
            object_id=business.pk,
        )
        self.stdout.write(
            "Ejemplos CRM añadidos: 3 contactos, 3 oportunidades, 6 conversaciones y 3 presupuestos. Datos anteriores conservados."
        )
