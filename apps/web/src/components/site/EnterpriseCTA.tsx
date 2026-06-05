import Link from 'next/link';

export default function EnterpriseCTA() {
  return (
    <section className="px-6 pb-28">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07070a] px-8 py-20 text-center">
        <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-70" />
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0" />
        <div className="relative">
          <h2 className="font-display text-4xl font-semibold text-white sm:text-5xl">
            Stop managing information.
            <br />
            Start making better decisions.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/60">
            LifeNavigator is in invite-only beta. Request access and preview the future of personal
            decision intelligence — grounded in your data, governed for trust.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/beta"
              className="w-full rounded-xl bg-white px-8 py-3.5 font-medium text-[#07070a] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Request Beta Invite
            </Link>
            <Link
              href="/how-it-works"
              className="w-full rounded-xl border border-white/20 px-8 py-3.5 font-medium text-white transition-colors hover:bg-white/5 sm:w-auto"
            >
              Explore the Platform
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
