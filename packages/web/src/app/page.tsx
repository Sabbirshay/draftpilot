import Hero from '@/components/Hero';
import ProblemSection from '@/components/ProblemSection';
import HowItWorks from '@/components/HowItWorks';
import Features from '@/components/Features';
import Pricing from '@/components/Pricing';
import Comparison from '@/components/Comparison';
import TrustCTA from '@/components/TrustCTA';
import ScrollReveal from '@/components/ScrollReveal';

export default function Home() {
  return (
    <>
      <ScrollReveal variant="fade-up" duration={0.8} margin="0px">
        <Hero />
      </ScrollReveal>
      <ScrollReveal variant="fade-up" delay={0.1}>
        <ProblemSection />
      </ScrollReveal>
      <ScrollReveal variant="fade-up" delay={0.1}>
        <HowItWorks />
      </ScrollReveal>
      <ScrollReveal variant="fade-up" delay={0.1}>
        <Features />
      </ScrollReveal>
      <ScrollReveal variant="fade-up" delay={0.1}>
        <Pricing />
      </ScrollReveal>
      <ScrollReveal variant="fade-up" delay={0.1}>
        <Comparison />
      </ScrollReveal>
      <ScrollReveal variant="fade-scale" delay={0.15}>
        <TrustCTA />
      </ScrollReveal>
    </>
  );
}
