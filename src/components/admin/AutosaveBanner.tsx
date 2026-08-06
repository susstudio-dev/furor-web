'use client';

// The restore offer for an autosave stash. Restoring is always the user's
// explicit choice — especially when the site moved on since the stash was
// taken, where applying it blindly would revert someone else's published
// work.
export function AutosaveBanner({
  savedAt,
  matchesVersion,
  onRestore,
  onDiscard,
}: {
  savedAt: string;
  matchesVersion: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-500/40 bg-gold-500/10 p-4">
      <p className="text-sm text-cream/85">
        You have unsaved edits from {new Date(savedAt).toLocaleString('en-IN')}.
        {matchesVersion
          ? ''
          : ' The site has changed since — restoring will overwrite those newer changes here.'}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onRestore} className="pill bg-gold-500/20 text-gold-400 hover:bg-gold-500/30">
          Restore
        </button>
        <button type="button" onClick={onDiscard} className="pill bg-cream/5 text-cream/70 hover:bg-cream/10">
          Discard
        </button>
      </div>
    </div>
  );
}
