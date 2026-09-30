import { App } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import signin from "#app/pages/signin";
import signup from "#app/pages/signup";
import hostProfile from "#app/pages/host-profile";
import book from "#app/pages/book";
import manageBooking from "#app/pages/manage-booking";
import bookings from "#app/pages/bookings";
import hostReschedule from "#app/pages/host-reschedule";
import meetingTypes from "#app/pages/meeting-types";
import availability from "#app/pages/availability";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";
import { SendRemindersJob } from "#app/jobs/send-reminders";

const app = new App();

app.route("/", home);
app.route("/signin", signin);
app.route("/signup", signup);
app.route("/booking/:token/:action?", manageBooking);
app.route("/bookings", bookings);
app.route("/bookings/:id/reschedule", hostReschedule);
app.route("/meeting-types", meetingTypes);
app.route("/availability", availability);

// Public host pages come last: a host slug is any first path segment the app does not own.
app.route("/:host", hostProfile);
app.route("/:host/:type", book);

app.cron("every 5m", "booking reminders", () => new SendRemindersJob().schedule());

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);
