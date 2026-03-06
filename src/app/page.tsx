// app/page.tsx
import Link from 'next/link';
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-4 md:px-8 py-5 md:py-6 max-w-7xl mx-auto">
        <div className="text-xl md:text-2xl font-bold text-black">PaceWise</div>
        <div className="flex items-center gap-3 md:gap-6">
          <a href="#" className="text-gray-700 hover:text-black text-sm md:text-base hidden sm:block">HOME</a>
          <Link
            href="/login"
            className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded-md hover:bg-blue-700 text-sm md:text-base whitespace-nowrap"
          >
            GET STARTED
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-black mb-10 md:mb-16">
          TRAIN SMART. <span className="text-blue-600">RUN BETTER.</span>
        </h1>

        {/* Two Column Grid */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 mb-10 md:mb-16">
          {/* Left: Image */}
          <div className="bg-gray-200 h-56 sm:h-72 md:h-96">
            <img src="/pic1.jpeg" alt="Runner" className="w-full h-full object-cover" />
          </div>

          {/* Right: Text Content */}
          <div className="flex flex-col justify-center">
            <h2 className="text-2xl md:text-3xl font-bold text-black mb-4">FOR THE COMMITTED</h2>
            <p className="text-gray-600">
              Data-driven running training web app that adapts to your body, not a generic plan.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section - 3 Column Grid */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
          {/* Feature 1 */}
          <div className="border-t-2 border-black pt-6">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-4">ADAPTIVE</h3>
            <p className="text-gray-600 text-sm">
              By analyzing heart rate, pace, cadence, and training history from your runs,
              we generate personalized weekly guidance that evolves as your fitness changes.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="border-t-2 border-black pt-6">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-4">SAFER, SUSTAINABLE</h3>
            <p className="text-gray-600 text-sm">
              Instead of forcing everyone into the same starting mileage, we meet you where you are
              — helping you build endurance safely, reduce injury risk, and train smarter over time.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-gray-200 h-56 sm:col-span-2 md:col-span-1">
            <img src="/pic3.jpeg" alt="Race" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-8 md:mb-12">
          JOIN THE <span className="text-blue-600">COMMUNITY</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Left: Benefits List */}
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-black mb-6 md:mb-8">DISCOVER YOUR POTENTIAL</h3>

            <div className="space-y-4 md:space-y-6">
              <div className="border-t border-gray-300 pt-4">
                <p className="font-semibold text-sm md:text-base">MEET YOUR STARTING POINT 💪</p>
              </div>
              <div className="border-t border-gray-300 pt-4">
                <p className="font-semibold text-sm md:text-base">PROGRESSION WITHOUT GUESSWORK</p>
              </div>
              <div className="border-t border-gray-300 pt-4">
                <p className="font-semibold text-sm md:text-base">ADAPTIVE WEEKLY RECOMMENDATIONS</p>
              </div>
            </div>
          </div>

          {/* Right: Image */}
          <div className="relative bg-red-900 h-72 md:h-96 overflow-hidden">
            <img src="/pic2.jpeg" alt="Track" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 w-full text-white text-center py-4 text-xl md:text-2xl font-semibold bg-gradient-to-t from-black/40 to-transparent">
              You got this.
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-blue-600 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-black mb-6 md:mb-8">
            JOIN PACEWISE TODAY
          </h2>
          <Link
            href="/login"
            className="bg-white text-black px-8 py-3 rounded-md font-semibold hover:bg-gray-100 inline-block"
          >
            GET STARTED
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
        </div>
      </footer>
    </div>
  );
}
