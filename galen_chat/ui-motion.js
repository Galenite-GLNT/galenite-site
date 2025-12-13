const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function readyPageIntro() {
  if (prefersReducedMotion.matches) return;
  requestAnimationFrame(() => {
    document.body.classList.add('motion-ready');
  });
}

function animateMessage(node) {
  if (prefersReducedMotion.matches) return;
  if (!(node instanceof HTMLElement)) return;
  if (!node.classList.contains('msg')) return;

  const delay = 60 + Math.random() * 60;
  node.style.setProperty('--msg-delay', `${delay}ms`);
  node.classList.add('motion-fresh');

  setTimeout(() => {
    node.classList.remove('motion-fresh');
  }, 900);
}

function observeChatMessages() {
  const chat = document.getElementById('chat');
  if (!chat) return;

  const observer = new MutationObserver((entries) => {
    entries.forEach((entry) => {
      entry.addedNodes.forEach((node) => animateMessage(node));
    });
  });

  observer.observe(chat, { childList: true });

  chat.querySelectorAll('.msg').forEach((node) => animateMessage(node));
}

readyPageIntro();
observeChatMessages();
