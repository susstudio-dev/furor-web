import { requireSubject } from '@/lib/guard';
import { ChangePasswordForm } from './ChangePasswordForm';

// The forced first-login stop for invited accounts (mustChangePassword), and
// the self-service password change for everyone else. The admin layout
// redirects a temp-password subject here from every other admin route.
export default async function Page() {
  const subject = await requireSubject();
  return (
    <div className="grid min-h-[70vh] place-items-center px-5 py-16">
      <ChangePasswordForm
        forced={!!subject.mustChangePassword}
        breakGlass={!!subject.breakGlass}
      />
    </div>
  );
}
