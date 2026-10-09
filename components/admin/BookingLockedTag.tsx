// BookingLockedTag — a booked slot shown as "locked in": a green tick, the
// booker's name and a padlock, e.g.  ✅ George's 🔒
//
// Used across every admin booking view (table/pool/bar reservations, golf
// bookings, tournament entries and the calendar) so staff can see at a glance
// which slots are held. A manually-added booking is created already
// confirmed, so it gets this tag the moment it's added.
export default function BookingLockedTag({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      title="Booking locked in"
      className={`inline-flex items-center gap-1.5 rounded-full border border-green-400/40 bg-green-400/15 px-2.5 py-1 text-[11px] font-bold text-green-300 ${className}`}
    >
      <span aria-hidden>✅</span>
      <span className="max-w-[18ch] truncate tracking-normal">
        {name?.trim() || "Booking"}
      </span>
      <span aria-hidden>🔒</span>
    </span>
  );
}
