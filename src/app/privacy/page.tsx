export const metadata = {
  title: 'Privacy Policy',
  description: 'How Furor Dance Hyderabad collects, uses and protects your information.',
};

export default function PrivacyPage() {
  return (
    <article className="container-x pt-20 pb-24 max-w-3xl">
      <p className="display text-sm uppercase tracking-widest text-ember-400">Legal</p>
      <h1 className="mt-3 display text-4xl font-extrabold sm:text-5xl tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-cream/50">Last updated: 14 May 2026</p>

      <div className="mt-10 space-y-6 text-cream/80 leading-relaxed">
        <section>
          <h2 className="display text-xl font-semibold text-cream">What we collect</h2>
          <p className="mt-2">
            When you contact us — through our website forms, WhatsApp, Instagram, email or in person — we collect
            the information you choose to share with us. Typically that is your name, phone number, and the
            class or batch you are interested in.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">How we use it</h2>
          <p className="mt-2">
            We use your information only to respond to your enquiry, schedule classes, send you class reminders
            and the occasional update about new batches or socials. We do not sell your data, ever.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Payments</h2>
          <p className="mt-2">
            Payments are processed by Razorpay. We do not store your card or bank details on our servers — those
            are held by Razorpay under PCI-DSS-compliant infrastructure.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Cookies and analytics</h2>
          <p className="mt-2">
            We use basic, privacy-respecting analytics to understand how the site is used (page views, referrers,
            general device type). We do not track you across other websites and we do not use advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Your rights</h2>
          <p className="mt-2">
            You can ask us at any time to share, correct or delete the information we have about you. Email{' '}
            <a href="mailto:furorhyd@dancehyderabad.com" className="text-ember-400 hover:text-ember-300">
              furorhyd@dancehyderabad.com
            </a>{' '}
            or message us on WhatsApp at +91 88860 72572 and we will get to it within 7 working days.
          </p>
        </section>

        <section>
          <h2 className="display text-xl font-semibold text-cream">Contact</h2>
          <p className="mt-2">
            Furor Dance Hyderabad, 2nd Floor, Alcazar Mall, Road No. 36, Jubilee Hills, Hyderabad 500033.
          </p>
        </section>
      </div>
    </article>
  );
}
