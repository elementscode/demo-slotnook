![Appointment booking with calendar invites, built by Claude Code on Elements: a public booking page for a strategy session with a month calendar and the open times for one day, shown in the guest's own time zone.](https://elements.dev/demos/01a0f40a-56f5-7ef5-b1d1-beeab4e2ca36/poster?v=f36f514fb859)

# Appointment booking with calendar invites, built by Claude Code on Elements

> Slotnook is a full-stack app built with Claude Code on Elements.

Meeting types, weekly hours and date overrides, booking pages shown in each guest's own time zone, and emailed calendar invites with reminders, reschedule and cancel.

[Run this app on your machine](https://elements.dev/demos/01a0f40a-56f5-7ef5-b1d1-beeab4e2ca36). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## How it's built

Slotnook needed open slots computed from weekly hours and overrides, booking pages that update while a guest is looking, emailed calendar invites, and reminders on a schedule. Each of those is a part of Elements, so the agent spent its 21 minutes on the scheduling itself.

- **Booking pages that update live.** A channel tells every open booking page when a host's calendar changes, so a time another guest just took drops out of the picker on the spot.

- **Booking as a function call.** The booking page calls `@rpc` functions to read open times, book, reschedule and cancel, with types checked from the page to the database. Booking locks the host inside a transaction, so each time goes to exactly one guest.

- **Open times from SQL.** A migration defines meeting types, weekly hours, date overrides and bookings, plus a SQL function that turns them into open start times with buffers. A second migration seeds two consultants in Los Angeles and Berlin with five meeting types and bookings from guests in their own time zones.

- **Invites by email.** Each confirmation, reschedule and cancellation is a background job that sends an email with a calendar file attached, so the guest's calendar follows every change.

- **Reminders on a schedule.** One cron line runs a job every five minutes that sends a reminder for each booking starting within a day.

- **Sessions.** Hosts sign in to manage their meeting types, hours and bookings, and every host action checks that the booking belongs to the signed-in user.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.
