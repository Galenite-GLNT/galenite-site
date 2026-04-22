function setupReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.16 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

function setupOfficeTilt() {
  const section = document.getElementById('office');
  const card = document.getElementById('officeCard');
  if (!section || !card) return;

  const updateTilt = () => {
    const rect = section.getBoundingClientRect();
    const viewport = window.innerHeight || 1;
    const progress = (viewport - rect.top) / (viewport + rect.height);
    const clamped = Math.max(0, Math.min(1, progress));

    const start = 28;
    const end = -28;
    const rotateX = start + (end - start) * clamped;
    const translateY = (0.5 - clamped) * 32;
    const scale = 0.96 + Math.sin(clamped * Math.PI) * 0.04;

    card.style.transform = `perspective(1800px) rotateX(${rotateX}deg) translateY(${translateY}px) scale(${scale})`;
  };

  updateTilt();
  window.addEventListener('scroll', updateTilt, { passive: true });
  window.addEventListener('resize', updateTilt);
}

setupReveal();
setupOfficeTilt();
