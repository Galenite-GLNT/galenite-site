'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ecosystemNarrative = [
  {
    label: '01 · Intelligence Core',
    title: 'A single cognitive backbone for every business decision.',
    copy: 'Galenite synchronizes strategic, operational, and customer data into one responsive intelligence layer.',
  },
  {
    label: '02 · Orchestration Fabric',
    title: 'Automation moves at enterprise scale without losing precision.',
    copy: 'Event-driven workflows and policy controls keep teams aligned, compliant, and continuously optimized.',
  },
  {
    label: '03 · Experience Surface',
    title: 'Premium interfaces that make complexity feel immediate.',
    copy: 'From command dashboards to guided copilots, every touchpoint is designed for confident execution.',
  },
];

const modules = [
  {
    name: 'Galenite Orbit',
    type: 'Predictive Intelligence Engine',
    copy: 'Anticipates market movement, operational risk, and demand inflection with continuously learning models.',
  },
  {
    name: 'Galenite Pulse',
    type: 'Autonomous Workflow Runtime',
    copy: 'Coordinates tasks, systems, and approvals in real time while preserving governance and observability.',
  },
  {
    name: 'Galenite Prism',
    type: 'Executive Insight Layer',
    copy: 'Transforms fragmented telemetry into high-fidelity strategic narratives for leadership and operators.',
  },
];

const automationStats = [
  { value: '42%', label: 'Faster cross-functional cycle time' },
  { value: '3.6x', label: 'Automation coverage growth in first 12 months' },
  { value: '< 90s', label: 'Median response latency for critical workflows' },
];

function SectionHeader({ label, title, subtitle }) {
  return (
    <div className="section-head reveal">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
    </div>
  );
}

export default function LandingPage() {
  const rootRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      heroTl
        .from('.hero-kicker, .hero-title, .hero-copy, .hero-actions', {
          y: 50,
          opacity: 0,
          duration: 0.95,
          stagger: 0.14,
        })
        .from(
          '.hero-device',
          {
            y: 70,
            scale: 0.9,
            opacity: 0,
            duration: 1.1,
          },
          '-=0.8',
        );

      gsap.utils.toArray('.reveal').forEach((element) => {
        gsap.from(element, {
          y: 64,
          opacity: 0,
          duration: 0.95,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      const chapters = gsap.utils.toArray('.scene-chapter');
      const visuals = gsap.utils.toArray('.scene-visual-layer');

      gsap.set(chapters, { opacity: 0.25 });
      gsap.set(visuals, { opacity: 0, scale: 1.08 });
      gsap.set(chapters[0], { opacity: 1 });
      gsap.set(visuals[0], { opacity: 1, scale: 1 });

      // Pinned cinematic chapter system: as user scrolls, one chapter and matching visual become primary.
      // This mirrors Apple-like product storytelling where copy and visual states transition in lockstep.
      const sceneTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.cinema-stage',
          start: 'top top',
          end: `+=${chapters.length * 520}`,
          scrub: true,
          pin: true,
        },
      });

      chapters.forEach((_, index) => {
        if (index === 0) return;

        sceneTl
          .to(chapters[index - 1], { opacity: 0.2, duration: 0.4 }, `step-${index}`)
          .to(visuals[index - 1], { opacity: 0, scale: 1.06, duration: 0.5 }, `step-${index}`)
          .to(chapters[index], { opacity: 1, duration: 0.5 }, `step-${index}`)
          .to(visuals[index], { opacity: 1, scale: 1, duration: 0.65 }, `step-${index}`);
      });

      gsap.to('.hero-device', {
        yPercent: -10,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          scrub: true,
          start: 'top top',
          end: 'bottom top',
        },
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <main ref={rootRef} className="landing-root">
      <section className="hero section">
        <div className="hero-content">
          <p className="hero-kicker">GALENITE</p>
          <h1 className="hero-title">An intelligent operating system for companies that lead the future.</h1>
          <p className="hero-copy">
            Galenite unifies AI reasoning, workflow automation, and executive control into one cinematic product
            experience.
          </p>
          <div className="hero-actions">
            <a href="#cta" className="btn btn-primary">
              Request private demo
            </a>
            <a href="#ecosystem" className="btn btn-ghost">
              Enter product story
            </a>
          </div>
        </div>

        <div className="hero-device" aria-hidden="true">
          <div className="hero-device-screen" />
          <div className="hero-device-reflection" />
        </div>
      </section>

      <section id="ecosystem" className="cinema-stage">
        <div className="cinema-layout section">
          <div className="scene-copy">
            <SectionHeader
              label="Product Ecosystem"
              title="One architecture. Three synchronized dimensions of intelligence."
              subtitle="Scroll to move through the product narrative the way premium hardware pages reveal capability over time."
            />
            <div className="scene-chapters">
              {ecosystemNarrative.map((item) => (
                <article className="scene-chapter" key={item.label}>
                  <p className="chapter-label">{item.label}</p>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="scene-visual-frame" aria-hidden="true">
            {ecosystemNarrative.map((item) => (
              <div className="scene-visual-layer" key={item.label}>
                <p>{item.label}</p>
                <h4>{item.title}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="section modules-section">
        <SectionHeader
          label="AI Systems"
          title="Composable modules for every mission-critical layer."
          subtitle="Replace placeholder names and claims with final launch positioning when product messaging is approved."
        />
        <div className="modules-grid">
          {modules.map((module) => (
            <article className="module-card reveal" key={module.name}>
              <p className="module-type">{module.type}</p>
              <h3>{module.name}</h3>
              <p>{module.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="automation" className="section automation-section">
        <SectionHeader
          label="Business Automation"
          title="From fragmented operations to autonomous momentum."
          subtitle="Designed for enterprise leaders who need fewer manual bottlenecks and more strategic throughput."
        />
        <div className="automation-shell reveal">
          {automationStats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <p className="stat-value">{stat.value}</p>
              <p className="stat-label">{stat.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="cta" className="section cta reveal">
        <p className="eyebrow">Premium Partnership</p>
        <h2>Build the next decade of your business on Galenite.</h2>
        <p className="section-subtitle">
          Placeholder for final go-to-market offer, regional trust indicators, and launch campaign messaging.
        </p>
        <a href="mailto:hello@galenite.ru" className="btn btn-primary">
          Start a private briefing
        </a>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Galenite. High-performance intelligence infrastructure for modern enterprise.</p>
      </footer>
    </main>
  );
}
