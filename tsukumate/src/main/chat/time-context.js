"use strict";

function getPart(parts, type) {
  const part = parts.find((item) => item.type === type);
  return part ? part.value : "";
}

function buildTimeContext(date = new Date(), timeZone) {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const stamp = `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")} ${getPart(parts, "hour")}:${getPart(parts, "minute")}:${getPart(parts, "second")}`;
  return `Trusted local time context: current local date and time is ${stamp}, ${getPart(parts, "weekday")}; time zone is ${zone}. Use this only when time or date is relevant, and do not claim a different current time.`;
}

module.exports = { buildTimeContext };
