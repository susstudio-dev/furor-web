export const metadata = {
  title: 'Terms & Services',
  description: 'Terms of service for Furor Dance Hyderabad — classes, payments, conduct and refunds.',
};

export default function TermsPage() {
  return (
    <article className="container-x pt-20 pb-24 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Legal</p>
      <h1 className="mt-3 display text-4xl font-extrabold sm:text-5xl tracking-tight">Terms &amp; Services</h1>
      <p className="mt-3 text-sm text-cream/50">Last updated: 14 May 2026</p>

      <div className="mt-10 space-y-6 text-cream/80 leading-relaxed">
        <section>
          <h2 className="display text-xl font-semibold text-cream">Booking a class</h2>
          <p className="mt-2">
            A seat in a batch is confirmed only after full payment or a token payment that we have acknowledged
            on WhatsApp. Without confirmation, seats are not held.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Make-up classes</h2>
          <p className="mt-2">
            If you miss a class, we offer a flexible make-up policy — message us on WhatsApp and we will find
            you a session in another batch of the same level, subject to availability. Make-ups are valid for
            the duration of your current batch.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Refunds</h2>
          <p className="mt-2">
            Full refunds are available before the batch starts. Once the batch has begun, refunds are pro-rated
            for the remaining unattended classes and require at least 7 days&apos; notice. Refunds for missed
            classes that were eligible for a make-up are not available.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Conduct on the floor</h2>
          <p className="mt-2">
            We expect respectful behaviour on the dance floor and in class — no harassment, no unsolicited
            advances, no negative coaching of fellow students. Repeat issues will result in removal from class
            and our weekly socials without refund. We take this seriously.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Photography</h2>
          <p className="mt-2">
            We occasionally photograph and film classes and socials for our website and social channels. If you
            would rather not appear in our content, tell any instructor and we will respect that — both at the
            point of capture and in any later edits you find online.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Injury and risk</h2>
          <p className="mt-2">
            Partner dancing carries a small risk of injury. By joining a class you confirm that you are
            physically able to participate, and that any medical conditions we should know about have been
            disclosed to us.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Changes</h2>
          <p className="mt-2">
            We may update these terms from time to time. The current version is always at this page, with the
            updated date at the top.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Contact</h2>
          <p className="mt-2">
            Questions about these terms? Email{' '}
            <a href="mailto:furorhyd@dancehyderabad.com" className="text-ember-400 hover:text-ember-300">
              furorhyd@dancehyderabad.com
            </a>{' '}
            or WhatsApp +91 88860 72572.
          </p>
        </section>
      </div>
    </article>
  );
}
