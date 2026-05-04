import { listVersions } from '@/lib/content-write';
import { VersionsList } from './VersionsList';

export default async function Page() {
  const versions = await listVersions();
  return (
    <div className="p-6 sm:p-10 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Versions</p>
      <h1 className="mt-1 display text-3xl font-extrabold">Roll back any change</h1>
      <p className="mt-2 text-cream/70">The last 30 saves are kept. Restoring a version creates a new entry — nothing is lost.</p>
      <VersionsList versions={versions} />
    </div>
  );
}
