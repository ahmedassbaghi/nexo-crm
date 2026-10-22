"use client";
import { motion, LayoutGroup, useReducedMotion } from "motion/react";
import { useId } from "react";
import { type CalendarDay, addDays, shiftMonth, dateLabel } from "../lib/types";
import { Icon } from "./ui";

// Adaptación del calendario de Hub Local: densidad, teclado y selección animada.
export default function AvailabilityCalendar({
  month,
  day,
  days,
  loading,
  min,
  max,
  onMonth,
  onDay,
}: {
  month: string;
  day: string;
  days: CalendarDay[];
  loading: boolean;
  min: string;
  max: string;
  onMonth: (v: string) => void;
  onDay: (v: string) => void;
}) {
  const reduced = useReducedMotion(),
    id = useId();
  const first = new Date(month + "-01T12:00:00Z"),
    offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return (
    <section
      className="availability-calendar"
      aria-label="Calendario de disponibilidad"
      aria-busy={loading}
    >
      <div className="calendar-heading">
        <div>
          <p className="eyebrow">01 · Elige el día</p>
          <h3>
            {dateLabel(month + "-01", { month: "long", year: "numeric" })}
          </h3>
        </div>
        <div className="button-group">
          <button
            type="button"
            className="icon-button prev"
            aria-label="Mes anterior"
            disabled={month <= min.slice(0, 7) || loading}
            onClick={() => onMonth(shiftMonth(month, -1))}
          >
            <Icon name="chevron" size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Mes siguiente"
            disabled={month >= max.slice(0, 7) || loading}
            onClick={() => onMonth(shiftMonth(month, 1))}
          >
            <Icon name="chevron" size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {["L", "M", "X", "J", "V", "S", "D"].map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
      <LayoutGroup id={id}>
        <div className="calendar-days">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`e${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = month + "-" + String(i + 1).padStart(2, "0"),
              data = days.find((d) => d.date === date),
              available = data?.available_count || 0,
              ratio = available / Math.max(data?.capacity_count || 1, 1),
              level =
                ratio === 0
                  ? "none"
                  : ratio < 0.3
                    ? "low"
                    : ratio < 0.65
                      ? "medium"
                      : "high";
            return (
              <motion.button
                type="button"
                key={date}
                data-date={date}
                className={`calendar-day ${day === date ? "selected" : ""} availability-${level}`}
                disabled={loading || date < min || date > max || !available}
                aria-label={`${dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}, ${available} horas disponibles`}
                aria-pressed={day === date}
                onClick={() => onDay(date)}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                onKeyDown={(e) => {
                  const delta = (
                    {
                      ArrowLeft: -1,
                      ArrowRight: 1,
                      ArrowUp: -7,
                      ArrowDown: 7,
                    } as Record<string, number>
                  )[e.key];
                  if (delta) {
                    e.preventDefault();
                    for (let step = 1; step <= 31; step++) {
                      const target = addDays(date, delta * step);
                      if (target.slice(0, 7) !== month) break;
                      const el = e.currentTarget
                        .closest(".availability-calendar")
                        ?.querySelector<HTMLButtonElement>(
                          `[data-date="${target}"]:not(:disabled)`,
                        );
                      if (el) {
                        el.focus();
                        break;
                      }
                    }
                  }
                }}
              >
                {day === date && (
                  <motion.span
                    className="selection-surface"
                    layoutId="selected"
                    transition={{ duration: reduced ? 0 : 0.14 }}
                  />
                )}
                <span>{i + 1}</span>
                <span className="availability-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <small>{available || "—"}</small>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>
      <div className="calendar-legend">
        <span>
          <i className="high" />
          Amplia
        </span>
        <span>
          <i className="medium" />
          Media
        </span>
        <span>
          <i className="low" />
          Pocas horas
        </span>
      </div>
      <p className="hint">Los números indican horas de inicio disponibles.</p>
    </section>
  );
}
