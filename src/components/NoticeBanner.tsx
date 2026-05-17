export function NoticeBanner({ notice }: { notice: string }) {
  if (!notice.trim()) return null;
  return (
    <div className="bg-ember-500 text-ink-950 text-sm font-medium">
      <div className="container-x py-2 text-center">{notice}</div>
    </div>
  );
}
