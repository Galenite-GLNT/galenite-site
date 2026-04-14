'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ecosystemItems = [
  {
    title: 'Core Intelligence',
    copy: 'Unified decision systems orchestrating product, operations, and customer outcomes in real time.',
  },
  {
    title: 'Infrastructure Layer',
    copy: 'Secure compute and integration fabric engineered for scale, resilience, and enterprise-grade reliability.',
  },
  {
    title: 'Experience Surface',
    copy: 'Elegant interfaces and adaptive workflows that elevate every interaction across teams and markets.',
  },
];

const modules = [
  {
    name: 'Galenite Orbit',
    type: 'Predictive AI Engine',
    copy: 'Forecast demand, detect risk patterns, and recommend strategic action before signals become noise.',
  },
  {
    name: 'Galenite Pulse',
    type: 'Autonomous Workflow Core',
    copy: 'Connect fragmented operations and continuously optimize execution with machine-guided automation.',
  },
  {
    name: 'Galenite Prism',
    type: 'Cognitive Insight Layer',
    copy: 'Transform raw enterprise data into high-clarity insights with explainable intelligence and precision.',
  },
];

const valuePoints = [
  'Reduce operational latency through real-time orchestration.',
  'Scale intelligent automation across departments without complexity.',
  'Increase strategic confidence with transparent machine intelligence.',
];

function Section({ id, label, title, subtitle, children, className = '' }) {
  return (
    <section id={id} className={`section ${className}`}>
      <div className="section-head">
        <p className="eyebrow">{label}</p>
        <h2>{title}</h2>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function LandingPage() {
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero intro timeline: staged entrance for premium cinematic first impression.
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      heroTl
        .from('.hero-kicker, .hero-title, .hero-copy, .hero-actions', {
          y: 42,
          opacity: 0,
          duration: 1,
          stagger: 0.15,
        })
        .from(
          '.hero-glow',
          {
            scale: 0.92,
            opacity: 0,
            duration: 1.4,
          },
          '-=0.8',
        );

      // Scroll-triggered reveal for all narrative blocks keeps storytelling smooth and progressive.
      gsap.utils.toArray('.reveal').forEach((element) => {
        gsap.from(element, {
          y: 80,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      // Subtle parallax depth on visual cards to avoid flat/static sections.
      gsap.utils.toArray('.parallax-card').forEach((card) => {
        gsap.to(card, {
          yPercent: -10,
          ease: 'none',
          scrollTrigger: {
            trigger: card,
            scrub: true,
            start: 'top bottom',
            end: 'bottom top',
          },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <main ref={rootRef} className="landing-root">
      <section className="hero section">
        <div className="hero-glow" aria-hidden="true" />
        <p className="hero-kicker">GALENITE</p>
        <h1 className="hero-title">Engineering intelligence for a world that moves ahead of time.</h1>
        <p className="hero-copy">
          A premium AI ecosystem for modern enterprises. Designed to automate operations, amplify decisions,
          and build enduring digital advantage.
        </p>
        <div className="hero-actions">
          <a href="#cta" className="btn btn-primary">
            Start the conversation
          </a>
          <a href="#ecosystem" className="btn btn-ghost">
            Explore the ecosystem
          </a>
        </div>
      </section>

      <Section
        id="ecosystem"
        label="Product Ecosystem"
        title="One ecosystem. Infinite operational clarity."
        subtitle="Every layer is designed as part of one coherent system to ensure consistent performance, security, and strategic velocity."
        className="reveal"
      >
        <div className="grid-3">
          {ecosystemItems.map((item) => (
            <article className="card parallax-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="modules"
        label="AI Systems"
        title="A modular intelligence stack for ambitious organizations."
        subtitle="Placeholder naming and copy can be replaced with finalized module architecture and product taxonomy."
        className="reveal"
      >
        <div className="module-list">
          {modules.map((module) => (
            <article className="module-item" key={module.name}>
              <p className="module-type">{module.type}</p>
              <h3>{module.name}</h3>
              <p>{module.copy}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="automation"
        label="Business Automation"
        title="Convert complexity into autonomous execution."
        subtitle="From fragmented process chains to synchronized machine-assisted operations, Galenite drives measurable business outcomes."
        className="reveal"
      >
        <div className="value-shell parallax-card">
          {valuePoints.map((point) => (
            <div className="value-row" key={point}>
              <span className="value-dot" aria-hidden="true" />
              <p>{point}</p>
            </div>
          ))}
        </div>
      </Section>

      <section id="cta" className="section cta reveal">
        <p className="eyebrow">Premium Partnership</p>
        <h2>Build your next competitive moat with Galenite.</h2>
        <p className="section-subtitle">
          Placeholder for final sales copy, lead funnel hooks, or regional messaging for galenite.ru launch.
        </p>
        <a href="mailto:hello@galenite.ru" className="btn btn-primary">
          Request private demo
        </a>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Galenite. Crafted for the next era of intelligent enterprise.</p>
      </footer>
    </main>
  );
}
