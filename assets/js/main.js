const yearPlaceholder = document.getElementById('year-placeholder');

if (yearPlaceholder) {
  yearPlaceholder.textContent = new Date().getFullYear();
}

const navToggle = document.querySelector('.nav-toggle');
const navList = document.querySelector('.nav-list');

if (navToggle && navList) {
  navToggle.addEventListener('click', () => {
    const isOpen = navList.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

navList?.addEventListener('click', (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    navList.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }
});

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const targetId = anchor.getAttribute('href')?.slice(1);
    const target = targetId ? document.getElementById(targetId) : null;

    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
