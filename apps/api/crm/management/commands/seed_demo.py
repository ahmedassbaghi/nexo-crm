import os
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import transaction
from django.utils import timezone
from crm.models import (
    Business,
    Membership,
    Client,
    Service,
    Professional,
    Resource,
    Appointment,
    Payment,
    Opportunity,
    Task,
    Audit,
)


class Command(BaseCommand):
    help = "Crea datos ficticios solo cuando no existe el negocio demo. No reinicia datos existentes."

    @transaction.atomic
    def handle(self, *args, **options):
        if Business.objects.filter(slug="estudio-norte").exists():
            call_command("seed_crm_demo")
            self.stdout.write("La demostración ya existe; datos conservados.")
            return
        business = Business.objects.create(
            name="Estudio Norte",
            slug="estudio-norte",
            industry="Asesoría y servicios profesionales",
            email="hola@example.com",
            phone="930 000 000",
            address="Carrer Major, 24 · Barcelona",
            weekdays=[0, 1, 2, 3, 4],
            public_booking=True,
            is_demo=True,
        )
        for username, name, role in [
            ("admin", "Alex", "admin"),
            ("equipo", "Marina", "staff"),
        ]:
            user = get_user_model().objects.create_user(
                username=username, first_name=name, password=os.environ["DEMO_PASSWORD"]
            )
            Membership.objects.create(user=user, business=business, role=role)
        services = [
            Service.objects.create(
                business=business,
                name=name,
                duration=duration,
                price=price,
                color=color,
                description=description,
            )
            for name, duration, price, color, description in [
                (
                    "Asesoría personalizada",
                    60,
                    6500,
                    "mint",
                    "Una sesión para analizar necesidades y trazar los próximos pasos.",
                ),
                (
                    "Diagnóstico inicial",
                    45,
                    4500,
                    "blue",
                    "Primera visita para conocer el negocio y definir prioridades.",
                ),
                (
                    "Sesión de seguimiento",
                    30,
                    3500,
                    "lavender",
                    "Revisión de avances, resolución de dudas y ajustes del plan.",
                ),
                (
                    "Revisión técnica",
                    90,
                    9500,
                    "peach",
                    "Revisión en profundidad de procesos, equipos o instalaciones.",
                ),
            ]
        ]
        professionals = []
        for name, title, color in [
            ("Marina Costa", "Asesora de negocio", "mint"),
            ("Daniel Vidal", "Consultor técnico", "blue"),
            ("Laura Serra", "Atención y seguimiento", "lavender"),
        ]:
            person = Professional.objects.create(
                business=business, name=name, title=title, color=color
            )
            person.services.set(services)
            professionals.append(person)
        Resource.objects.create(business=business, name="Sala principal")
        Resource.objects.create(business=business, name="Sala de reuniones")
        clients = []
        for i, (name, company) in enumerate(
            [
                ("Clara Martín", "Floristería Clara"),
                ("Jordi Ferrer", "Taller Ferrer"),
                ("Lucía Navarro", "Estudio Lúmina"),
                ("Marc Soler", "Cafè del Barri"),
                ("Elena Ruiz", "Papelería El Trazo"),
                ("Pau Roca", "Roca Instalaciones"),
                ("Anna Bosch", "Boutique Anna"),
                ("David López", "Carpintería López"),
                ("Marta Gil", "La Panera"),
                ("Sergio Vidal", "Vidal Motor"),
                ("Núria Puig", "Espai Verd"),
                ("Carlos Romero", "Romero & Hijos"),
                ("Laia Casas", "Óptica Casas"),
                ("Adrián Pérez", "AP Reformas"),
                ("Irene Font", "Centro Font"),
                ("Hugo Torres", "Torres Servicios"),
            ]
        ):
            clients.append(
                Client.objects.create(
                    business=business,
                    name=name,
                    company=company,
                    email=f"cliente{i + 1}@example.com",
                    phone=f"600 000 {i + 1:03}",
                    tag=["habitual", "vip", "nuevo"][i % 3],
                    notes="Cliente de demostración. Prefiere contacto por teléfono."
                    if i % 2 == 0
                    else "",
                )
            )
        today = timezone.localdate()
        for offset in range(-27, 12):
            day = today + timedelta(days=offset)
            if day.weekday() > 4:
                continue
            for n in range(6 if offset == 0 else 3):
                service = services[(n + offset) % 4]
                professional = professionals[n % 3]
                start = datetime.combine(
                    day, time(9 + n, 0 if n % 2 == 0 else 30), ZoneInfo("Europe/Madrid")
                )
                status = (
                    "completed"
                    if start < timezone.now()
                    else ("pending" if n % 3 == 2 else "confirmed")
                )
                if offset < 0 and offset % 7 == 0 and n == 1:
                    status = "cancelled"
                visit = Appointment.objects.create(
                    business=business,
                    client=clients[(n + offset) % len(clients)],
                    service=service,
                    professional=professional,
                    starts_at=start,
                    ends_at=start + timedelta(minutes=service.duration),
                    service_name=service.name,
                    duration=service.duration,
                    price=service.price,
                    status=status,
                )
                if status == "completed" and (offset + n) % 5 != 0:
                    Payment.objects.create(
                        business=business,
                        appointment=visit,
                        amount=visit.price,
                        method=["card", "cash", "transfer"][n % 3],
                        paid_at=visit.ends_at
                        if visit.ends_at < timezone.now()
                        else timezone.now(),
                        reference="DEMO",
                    )
        for i, (title, stage, value, action) in enumerate(
            [
                (
                    "Plan de acompañamiento trimestral",
                    "proposal",
                    48000,
                    "Enviar propuesta revisada",
                ),
                (
                    "Puesta a punto del taller",
                    "contacted",
                    32000,
                    "Concretar visita técnica",
                ),
                (
                    "Asesoría para nueva apertura",
                    "new",
                    65000,
                    "Primera llamada de contacto",
                ),
                ("Mantenimiento mensual", "won", 18000, "Preparar bienvenida"),
                (
                    "Optimización de procesos",
                    "proposal",
                    85000,
                    "Resolver dudas del presupuesto",
                ),
            ]
        ):
            Opportunity.objects.create(
                business=business,
                client=clients[i],
                title=title,
                stage=stage,
                value=value,
                next_action=action,
                due_date=today + timedelta(days=i),
            )
        for i, title in enumerate(
            [
                "Enviar propuesta a Clara",
                "Preparar diagnóstico de Taller Ferrer",
                "Llamar a Lucía para el seguimiento",
                "Revisar cobros pendientes",
                "Confirmar visita de Marc",
                "Preparar documentación de Elena",
            ]
        ):
            Task.objects.create(
                business=business,
                title=title,
                client=clients[i],
                professional=professionals[i % 3],
                due_date=today + timedelta(days=i // 2),
                priority="high" if i == 0 else "normal",
                done=i == 5,
            )
        Audit.objects.create(
            business=business,
            actor="Sistema",
            action="Espacio de demostración preparado",
            entity="Business",
            object_id=business.pk,
        )
        self.stdout.write(
            "Demostración creada. Usuarios: admin y equipo. Contraseña en .local/ACCESO.md."
        )

        call_command("seed_crm_demo")
