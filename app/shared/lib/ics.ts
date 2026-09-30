/**
 * A single-event iCalendar file. REQUEST adds or updates the event in the
 * guest's calendar; CANCEL with the same UID and a higher SEQUENCE removes it.
 */

export interface IcsEvent {
  uid: string;
  sequence: number;
  method: "REQUEST" | "CANCEL";
  startsAt: Date;
  endsAt: Date;
  summary: string;
  description: string;
  url: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function escapeParam(s: string): string {
  return s.replace(/"/g, "'");
}

// RFC 5545 caps a line at 75 octets; longer lines continue after CRLF + space.
function fold(line: string): string {
  let bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) {
    return line;
  }

  let out: string[] = [];
  let current = "";
  let size = 0;
  for (let ch of line) {
    let n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }

    current += ch;
    size += n;
  }

  out.push(current);

  return out.join("\r\n ");
}

export function buildIcs(e: IcsEvent): string {
  let lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//slotnook//booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `SEQUENCE:${e.sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${escapeText(e.summary)}`,
    `DESCRIPTION:${escapeText(e.description)}`,
    `URL:${e.url}`,
    `ORGANIZER;CN="${escapeParam(e.organizerName)}":mailto:${e.organizerEmail}`,
    `ATTENDEE;CN="${escapeParam(e.attendeeName)}";ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${e.attendeeEmail}`,
    `STATUS:${e.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(fold).join("\r\n") + "\r\n";
}
