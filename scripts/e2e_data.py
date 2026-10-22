"""Isolated tenant for browser tests. Never uses or resets the demonstration tenant."""

import json
import os
import secrets
import sys
from pathlib import Path
from datetime import timedelta

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "apps/api"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()
from django.db import transaction
from django.contrib.auth import get_user_model
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
    Block,
    Audit,
    Activity,
    Quote,
)

FILE = ROOT / ".local/e2e-access.json"
with transaction.atomic():
    if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
        if FILE.exists():
            saved = json.loads(FILE.read_text())
            business = Business.objects.filter(
                pk=saved["business"],
                slug=saved["slug"],
                name="Pruebas automatizadas Nexo",
            ).first()
            if business and business.slug.startswith("qa-nexo-"):
                user_ids = list(
                    Membership.objects.filter(business=business).values_list(
                        "user_id", flat=True
                    )
                )
                for model in [
                    Audit,
                    Activity,
                    Quote,
                    Payment,
                    Task,
                    Opportunity,
                    Appointment,
                    Block,
                    Client,
                    Professional,
                    Service,
                    Resource,
                    Membership,
                ]:
                    model.objects.filter(business=business).delete()
                business.delete()
                get_user_model().objects.filter(pk__in=user_ids).delete()
            FILE.unlink()
        print("Datos de pruebas retirados; demostración conservada.")
    else:
        if FILE.exists():
            raise SystemExit(
                "Retira la instancia de pruebas previa con e2e_data.py cleanup."
            )
        suffix = secrets.token_hex(4)
        slug = f"qa-nexo-{suffix}"
        business = Business.objects.create(
            name="Pruebas automatizadas Nexo",
            slug=slug,
            weekdays=[0, 1, 2, 3, 4, 5, 6],
            public_booking=True,
        )
        password = secrets.token_urlsafe(20)
        user = get_user_model().objects.create_user(
            username=slug, first_name="QA", password=password
        )
        Membership.objects.create(user=user, business=business, role="admin")
        service = Service.objects.create(
            business=business, name="Asesoría QA", duration=60, price=6500
        )
        person = Professional.objects.create(
            business=business, name="Profesional QA", title="Asesoría"
        )
        person.services.add(service)
        client = Client.objects.create(
            business=business, name="Cliente QA", email="qa@example.com"
        )
        Resource.objects.create(business=business, name="Sala QA")
        payload = {
            "business": business.pk,
            "slug": slug,
            "username": slug,
            "password": password,
            "client": client.pk,
            "service": service.pk,
            "professional": person.pk,
            "day": str(timezone.localdate() + timedelta(days=2)),
        }
        FILE.write_text(json.dumps(payload), encoding="utf-8")
        print("Negocio aislado de pruebas creado.")
