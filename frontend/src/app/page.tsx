import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center text-white font-bold text-lg">
              U
            </div>
            <span className="text-lg font-extrabold tracking-tight text-[#0F172A] uppercase">
              Unmatrix
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="#features"
              className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-[#0F172A] transition-colors px-4 py-2"
            >
              Features
            </Link>
            <Link
              href="#process"
              className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-[#0F172A] transition-colors px-4 py-2"
            >
              Process
            </Link>
            <div className="w-px h-5 bg-gray-200 mx-3" />
            <Link
              href="/login"
              className="text-xs font-bold uppercase tracking-widest text-[#0F172A] hover:text-gray-600 transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="ml-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold uppercase tracking-widest px-6 py-3 transition-colors"
            >
              Launch Your Studio
            </Link>
          </div>
          {/* Mobile menu button */}
          <button className="md:hidden p-2" aria-label="Menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-28 pb-20 px-6 overflow-hidden">
          {/* Subtle radial glow */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-gray-100 to-transparent opacity-60 rounded-full translate-x-1/3 -translate-y-1/4 pointer-events-none" />

          <div className="container mx-auto max-w-5xl relative">
            <div className="text-center space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-gray-200 bg-white shadow-sm">
                <Crown className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">
                  The Future of Interior Design Studios
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight text-[#0F172A] leading-[0.95]">
                Master Your
                <br />
                Studio.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F172A] to-gray-400">
                  Scale With
                </span>
                <br />
                Precision.
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-normal">
                The simplest operating system for interior design firms. Define your
                pricing, launch your branded site, and close projects faster than ever.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link
                  href="/login"
                  className="bg-[#0F172A] hover:bg-[#1E293B] text-white h-14 px-10 text-sm font-bold uppercase tracking-widest inline-flex items-center gap-3 transition-colors group"
                >
                  Launch Your Studio
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/amit-interiors"
                  className="border-2 border-[#0F172A] text-[#0F172A] hover:bg-[#0F172A] hover:text-white h-14 px-10 text-sm font-bold uppercase tracking-widest inline-flex items-center transition-colors"
                >
                  See The Demo
                </Link>
              </div>
            </div>

            {/* Application Preview */}
            <div className="mt-24 relative">
              <div className="absolute inset-0 bg-gray-200/40 blur-[100px] rounded-full max-w-4xl mx-auto" />
              <div className="relative rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white shadow-xl overflow-hidden aspect-[16/9] max-w-5xl mx-auto">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="w-14 h-14 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center mx-auto">
                      <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                    <p className="text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Dashboard Preview
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-28 border-t border-gray-100">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-[#0F172A]">
                Everything You Need
              </h2>
              <p className="mt-4 text-gray-400 text-lg max-w-xl mx-auto">
                Built for interior designers who want to run their studio like a business.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4 text-center md:text-left">
                <div className="w-12 h-12 bg-[#0F172A] rounded-lg flex items-center justify-center text-white mx-auto md:mx-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold text-[#0F172A] uppercase tracking-wide">
                  E-commerce Engine
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Full-featured storefront for furniture and finishes. Integrated inventory and order management system.
                </p>
              </div>
              <div className="space-y-4 text-center md:text-left">
                <div className="w-12 h-12 bg-[#0F172A] rounded-lg flex items-center justify-center text-white mx-auto md:mx-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold text-[#0F172A] uppercase tracking-wide">
                  Smart Estimates
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Built-in calculator for instant client quotes. Automate your sales funnel with precision logic.
                </p>
              </div>
              <div className="space-y-4 text-center md:text-left">
                <div className="w-12 h-12 bg-[#0F172A] rounded-lg flex items-center justify-center text-white mx-auto md:mx-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-extrabold text-[#0F172A] uppercase tracking-wide">
                  Multi-Tenant CRM
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  Isolated client data, communication logs, and project tracking for every designer on your platform.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section id="process" className="py-28 bg-[#0F172A] text-white">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                How It Works
              </h2>
              <p className="mt-4 text-gray-400 text-lg max-w-xl mx-auto">
                Go from zero to a fully branded design studio in three simple steps.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center space-y-4">
                <div className="text-5xl font-black text-white/10">01</div>
                <h3 className="text-lg font-extrabold uppercase tracking-wide">
                  Define Your Pricing
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Set up your service catalog with custom rates, packages, and modifiers. Your estimates, your rules.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="text-5xl font-black text-white/10">02</div>
                <h3 className="text-lg font-extrabold uppercase tracking-wide">
                  Launch Your Storefront
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Customize your branded website with your logo, colors, portfolio, and services. Live in minutes.
                </p>
              </div>
              <div className="text-center space-y-4">
                <div className="text-5xl font-black text-white/10">03</div>
                <h3 className="text-lg font-extrabold uppercase tracking-wide">
                  Close Projects Faster
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Clients get instant estimates on your site. You get qualified leads and signed projects on autopilot.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 px-6 bg-white">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2.5 opacity-40">
            <div className="w-8 h-8 bg-[#0F172A] rounded-lg flex items-center justify-center text-white font-bold text-sm">
              U
            </div>
            <span className="text-sm font-extrabold tracking-tight text-[#0F172A] uppercase">
              Unmatrix
            </span>
          </div>
          <div className="flex gap-8 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <Link href="/admin" className="hover:text-[#0F172A] transition-colors">
              Platform Admin
            </Link>
            <Link href="/dashboard" className="hover:text-[#0F172A] transition-colors">
              Designer Console
            </Link>
            <span>&copy; 2024 Unmatrix Inc.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
