import { redirect } from 'next/navigation';
import { listVersions } from '@/lib/content-write';
import { hasCapability } from '@/lib/authz';
import { resolveSubject } from '@/lib/subject';
import { VersionsList } from './VersionsList';

export default async function Page() {
  // This page rendered a Restore button for every session while the API 403'd,
  // and its snapshot filenames leak every actor's email address. Gate it with
  // the same capability the API enforces.
  const subject = await resolveSubject();
  if (!subject) redirect('/admin/login');
  if (!hasCapability(subject, 'versions.restore')) redirect('/admin');

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
