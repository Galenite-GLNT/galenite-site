const yearPlaceholder = document.getElementById('year-placeholder');

if (yearPlaceholder) {
  yearPlaceholder.textContent = new Date().getFullYear();
}

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && revealItems.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
  });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('visible'));
}

// Parallax orbs
const hero = document.querySelector('.hero');
const orbs = document.querySelectorAll('[data-depth]');
if (hero && orbs.length) {
  hero.addEventListener('mousemove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    orbs.forEach((orb) => {
      const depth = Number(orb.dataset.depth || 0);
      const translateX = x * depth;
      const translateY = y * depth;
      orb.style.transform = `translate(${translateX}px, ${translateY}px)`;
    });
  });
}

// Tilt effect for cards and devices
const tiltTargets = document.querySelectorAll('[data-tilt]');
if (tiltTargets.length) {
  tiltTargets.forEach((target) => {
    target.addEventListener('mousemove', (event) => {
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateX = -(event.clientY - centerY) / 40;
      const rotateY = (event.clientX - centerX) / 40;
      target.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    target.addEventListener('mouseleave', () => {
      target.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  });
}
