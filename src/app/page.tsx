// app/page.tsx
import Link from 'next/link';
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-black">PaceWise</div>
        <div className="flex items-center gap-6">
          <a href="#" className="text-gray-700 hover:text-black">HOME</a>
          <Link
            href="/login"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            GET STARTED
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <h1 className="text-6xl md:text-7xl font-bold text-black mb-16">
          TRAIN SMART. <span className="text-blue-600">RUN BETTER.</span>
        </h1>

        {/* Two Column Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Left: Image */}
          <div className="bg-gray-200 h-64 md:h-96">
            {/* Replace with actual image */}
            <img src="/pic1.jpeg" alt="Runner" className="w-full h-full object-cover" />
          </div>

          {/* Right: Text Content */}
          <div className="flex flex-col justify-center">
            <h2 className="text-3xl font-bold text-black mb-4">FOR THE COMMITTED</h2>
            <p className="text-gray-600">
              Data-driven running training web app that adapts to your body, not a generic plan.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section - 3 Column Grid */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="border-t-2 border-black pt-6">
            <h3 className="text-2xl font-bold text-black mb-4">ADAPTIVE</h3>
            <p className="text-gray-600 text-sm">
              By analyzing heart rate, pace, cadence, and training history from your runs, 
              we generate personalized weekly guidance that evolves as your fitness changes.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="border-t-2 border-black pt-6">
            <h3 className="text-2xl font-bold text-black mb-4">SAFER, SUSTAINABLE</h3>
            <p className="text-gray-600 text-sm">
              Instead of forcing everyone into the same starting mileage, we meet you where you are
              — helping you build endurance safely, reduce injury risk, and train smarter over time.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-gray-200 h-64">
            {/* Image */}
            <img src="/pic3.jpeg" alt="Race" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <h2 className="text-5xl md:text-6xl font-bold text-black mb-12">
          JOIN THE <span className="text-blue-600">COMMUNITY</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Benefits List */}
          <div>
            <h3 className="text-2xl font-bold text-black mb-8">DISCOVER YOUR POTENTIAL</h3>
            
            <div className="space-y-6">
              <div className="border-t border-gray-300 pt-4">
                <p className="font-semibold">MEET YOUR STARTING POINT 💪</p>
              </div>
              <div className="border-t border-gray-300 pt-4">
                <p className="font-semibold">PROGRESSION WITHOUT GUESSWORK</p>
              </div>
              <div className="border-t border-gray-300 pt-4">
                <p className="font-semibold">ADAPTIVE WEEKLY RECOMMENDATIONS</p>
              </div>
            </div>
          </div>

          {/* Right: Image */}
          <div className="bg-red-900 h-96">
            {/* Track image */}
            <img src="/pic2.jpeg" alt="Track" className="w-full h-full object-cover" />
            <div className="text-white text-center py-8 text-2xl font-semibold">
              You got this.
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-blue-600 py-24">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-black mb-8">
            JOIN PACEWISE TODAY
          </h2>
          <Link
            href="/login"
            className="bg-white text-black px-8 py-3 rounded-md font-semibold hover:bg-gray-100"
          >
            GET STARTED
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-8 text-center">
        </div>
      </footer>
    </div>
  );
}
