import Hero from '@/components/Hero';
import ProblemSection from '@/components/ProblemSection';
import HowItWorks from '@/components/HowItWorks';
import Features from '@/components/Features';
import Pricing from '@/components/Pricing';
import Comparison from '@/components/Comparison';
import TrustCTA from '@/components/TrustCTA';

export default function Home() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <Features />
      <Pricing />
      <Comparison />
      <TrustCTA />
    </>
  );
}
