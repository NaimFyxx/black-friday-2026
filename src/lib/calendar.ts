// "Add to calendar" for Fyxx Friday: a Google Calendar link and an .ics file
// (Apple Calendar, Outlook), built from bf_settings sale_start / sale_end.
// Ends one minute before sale_end (23:59 instead of 00:00).

const EVENT_URL =
  "https://friday.myfyxx.com/?utm_source=calendar&utm_medium=reminder&utm_campaign=fyxx-friday-2026-11-27";
const TITLE = "Fyxx Friday";
const DETAILS = `One day only. Prices drop at 10:00 Amman time. No code needed. ${EVENT_URL}`;

/** 20261127T070000Z */
const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

function times(saleStart: string, saleEnd: string) {
  const start = new Date(saleStart);
  const end = new Date(new Date(saleEnd).getTime() - 60_000);
  return { start: utc(start), end: utc(end) };
}

export function googleCalendarUrl(saleStart: string, saleEnd: string): string {
  const t = times(saleStart, saleEnd);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: TITLE,
    dates: `${t.start}/${t.end}`,
    details: DETAILS,
    location: EVENT_URL,
    ctz: "Asia/Amman",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function icsDataUrl(saleStart: string, saleEnd: string): string {
  const t = times(saleStart, saleEnd);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fyxx//Fyxx Friday//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:fyxx-friday-${t.start}@friday.myfyxx.com`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${t.start}`,
    `DTEND:${t.end}`,
    `SUMMARY:${TITLE}`,
    `DESCRIPTION:${DETAILS}`,
    `URL:${EVENT_URL}`,
    `LOCATION:${EVENT_URL}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${TITLE} has started`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
