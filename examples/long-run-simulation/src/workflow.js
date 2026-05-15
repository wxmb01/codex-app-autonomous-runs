export function runHealthSummary(events) {
  const failed = events.filter((event) => event.validation !== "passed");
  const reviewerEvents = events.filter((event) => event.reviewer && event.reviewer !== "not needed this cycle");
  return {
    cycles: events.length,
    failed_cycles: failed.length,
    reviewer_events: reviewerEvents.length,
    ready: failed.length === 0 && reviewerEvents.length >= 2
  };
}
