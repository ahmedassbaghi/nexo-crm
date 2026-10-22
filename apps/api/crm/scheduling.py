from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import Appointment, Block


def local_instant(value, business):
    try:
        naive = datetime.strptime(value, "%Y-%m-%dT%H:%M")
        zone = ZoneInfo(business.timezone)
        instant = naive.replace(tzinfo=zone)
        if (
            instant.utcoffset() != naive.replace(tzinfo=zone, fold=1).utcoffset()
            or instant.astimezone(ZoneInfo("UTC")).astimezone(zone).replace(tzinfo=None)
            != naive
        ):
            raise ValueError()
        return instant
    except (ValueError, TypeError, ZoneInfoNotFoundError):
        raise ValidationError(
            {"start_local": "Fecha no válida o ambigua por cambio horario."}
        )


def validate_slot(
    business, professional, service, start, resource=None, exclude=None, duration=None
):
    start = start.astimezone(ZoneInfo(business.timezone))
    end = (
        start.astimezone(ZoneInfo("UTC"))
        + timedelta(minutes=duration or service.duration)
    ).astimezone(ZoneInfo(business.timezone))
    if (
        not professional.active
        or not service.active
        or not professional.services.filter(pk=service.pk).exists()
    ):
        raise ValidationError("El profesional no tiene habilitado este servicio.")
    if resource and not resource.active:
        raise ValidationError("El recurso está inactivo.")
    if start <= timezone.now() or start > timezone.now() + timedelta(days=365):
        raise ValidationError(
            "Selecciona una hora futura dentro de los próximos 365 días."
        )
    if (
        start.weekday() not in business.weekdays
        or start.time() < business.opening
        or end.time() > business.closing
        or start.date() != end.date()
        or start.minute % 15
        or start.second
    ):
        raise ValidationError(
            "La cita queda fuera del horario o de los intervalos de 15 minutos."
        )
    if (
        Block.objects.filter(business=business, starts_at__lt=end, ends_at__gt=start)
        .filter(Q(professional=professional) | Q(professional__isnull=True))
        .exists()
    ):
        raise ValidationError("Este horario está bloqueado.")
    criteria = Q(professional=professional)
    if resource:
        criteria |= Q(resource=resource)
    conflicts = (
        Appointment.objects.filter(
            business=business, starts_at__lt=end, ends_at__gt=start
        )
        .exclude(status="cancelled")
        .filter(criteria)
    )
    if exclude:
        conflicts = conflicts.exclude(pk=exclude)
    if conflicts.exists():
        raise ValidationError("Esta hora acaba de ocuparse. Elige otra disponible.")
    return end


def availability(
    business, professional, service, month, resource=None, exclude=None, duration=None
):
    try:
        first = datetime.strptime(month, "%Y-%m").date().replace(day=1)
    except (ValueError, TypeError):
        raise ValidationError({"month": "Usa el formato AAAA-MM."})
    days = []
    current = first
    zone = ZoneInfo(business.timezone)
    # Load intervals once; do not perform one query per candidate slot.
    until = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    busy = Appointment.objects.filter(
        business=business,
        starts_at__lt=datetime.combine(until, time.min, zone),
        ends_at__gt=datetime.combine(first, time.min, zone),
    ).exclude(status="cancelled")
    match = Q(professional=professional)
    if resource:
        match |= Q(resource=resource)
    busy = busy.filter(match)
    if exclude:
        busy = busy.exclude(pk=exclude)
    intervals = list(busy.values_list("starts_at", "ends_at"))
    intervals += list(
        Block.objects.filter(
            business=business,
            starts_at__lt=datetime.combine(until, time.min, zone),
            ends_at__gt=datetime.combine(first, time.min, zone),
        )
        .filter(Q(professional=professional) | Q(professional__isnull=True))
        .values_list("starts_at", "ends_at")
    )
    enabled = (
        professional.active
        and service.active
        and professional.services.filter(pk=service.pk).exists()
        and (not resource or resource.active)
    )
    now = timezone.now()
    while current < until:
        slots, capacity = [], 0
        start = datetime.combine(current, business.opening, zone)
        closing = datetime.combine(current, business.closing, zone)
        if enabled and current.weekday() in business.weekdays:
            while start + timedelta(minutes=duration or service.duration) <= closing:
                end = start + timedelta(minutes=duration or service.duration)
                capacity += 1
                valid_dst = start.utcoffset() == start.replace(
                    fold=1
                ).utcoffset() and start.astimezone(ZoneInfo("UTC")).astimezone(
                    zone
                ).replace(tzinfo=None) == start.replace(tzinfo=None)
                if (
                    valid_dst
                    and now < start <= now + timedelta(days=365)
                    and not any(a < end and b > start for a, b in intervals)
                ):
                    slots.append(start.strftime("%Y-%m-%dT%H:%M"))
                start += timedelta(minutes=15)
        days.append(
            {
                "date": current.isoformat(),
                "available_count": len(slots),
                "capacity_count": capacity,
                "slots": slots,
            }
        )
        current += timedelta(days=1)
    return days
