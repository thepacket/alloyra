export function EmptyState({
  phase,
  title,
  desc,
}: {
  phase: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="empty-state">
      <span className="phase-tag">{phase}</span>
      <span className="t">{title}</span>
      <span className="d">{desc}</span>
    </div>
  );
}
