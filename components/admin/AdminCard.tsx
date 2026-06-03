export function AdminCard({
  title,
  children,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cream/10 bg-ink/40">
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-cream/10 px-5 py-3">
          {title && <h2 className="font-display text-lg">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

