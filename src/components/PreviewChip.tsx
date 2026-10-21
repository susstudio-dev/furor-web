'use client';

// The always-visible marker that THIS render is a draft preview, with the way
// out. Without it, an owner who previews a draft and wanders off browses a
// site that quietly isn't real for up to 15 minutes.
export function PreviewChip({ draftId }: { draftId: string }) {
  async function exit() {
    try {
      await fetch('/api/admin/preview', { method: 'DELETE' });
    } finally {
      window.location.reload();
    }
  }

  return (
    <div className="relative z-[60] flex items-center justify-center gap-3 bg-gold-500 px-4 py-1.5 text-xs font-semibold text-ink-950">
      <span className="uppercase tracking-widest">Previewing a draft</span>
      <span className="hidden text-ink-950/70 sm:inline">{draftId.slice(0, 8)}</span>
      <button
        type="button"
        onClick={exit}
        className="rounded-full border border-ink-950/40 px-2.5 py-0.5 transition hover:bg-ink-950/10"
      >
        Exit preview
      </button>
    </div>
  );
}
