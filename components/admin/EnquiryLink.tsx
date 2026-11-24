// EnquiryLink — "🔗 View enquiry →", shown on a booking that came from a CRM
// enquiry (founder 4 Nov 2026). Opens that enquiry's detail drawer on the
// Enquiries board via ?open=<id>. Only rendered where a reverse lookup found a
// linked enquiry (see loadEnquiryIdsByBookingIds). Styled like the other
// secondary-action link pills on the booking cards.
import Link from "next/link";

export default function EnquiryLink({
  enquiryId,
  className = "",
}: {
  enquiryId: string;
  className?: string;
}) {
  return (
    <Link
      href={`/admin/enquiries?open=${enquiryId}`}
      title="Open this booking's CRM enquiry + email thread"
      className={
        "inline-flex items-center gap-1 rounded-full border border-plonkTeal/40 bg-plonkTeal/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-plonkTeal transition hover:bg-plonkTeal/20 " +
        className
      }
    >
      🔗 View enquiry →
    </Link>
  );
}
