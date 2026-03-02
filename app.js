const HEADER_PATH = 'header.html';

async function loadHeader() {
  const placeholder = document.getElementById('header-placeholder');
  if (!placeholder) return;

  const res = await fetch(HEADER_PATH);
  placeholder.innerHTML = await res.text();

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach((link) => {
    if (link.getAttribute('href') === path) link.classList.add('active');
  });

  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'dark';
  root.dataset.theme = savedTheme;
  toggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    localStorage.setItem('theme', next);
    toggle.textContent = next === 'dark' ? '🌙' : '☀️';
  });

  updateCartBadge();
}

function getCart() {
  return JSON.parse(localStorage.getItem('cesta') || '[]');
}

function setCart(cart) {
  localStorage.setItem('cesta', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) badge.textContent = getCart().length;
}

function addToCart(book) {
  const cart = getCart();
  if (cart.some((item) => item.titulo === book.titulo)) return false;
  cart.push(book);
  setCart(cart);
  return true;
}

async function getBooks() {
  const res = await fetch('data/libros.json');
  const baseBooks = await res.json();
  const customBooks = getCustomBooks();
  return [...customBooks, ...baseBooks];
}

function getCustomBooks() {
  return JSON.parse(localStorage.getItem('llibresCustom') || '[]');
}

function saveCustomBook(book) {
  const customBooks = getCustomBooks();
  const alreadyExists = customBooks.some((item) => item.isbn && item.isbn === book.isbn);
  if (alreadyExists) return false;
  customBooks.push(book);
  localStorage.setItem('llibresCustom', JSON.stringify(customBooks));
  return true;
}

async function fetchGoogleBookByIsbn(code) {
  const cleanCode = code.replace(/[^\dXx]/g, '');
  if (!cleanCode) return null;

  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanCode)}`);
  if (!res.ok) return null;

  const data = await res.json();
  const item = data.items && data.items.length ? data.items[0] : null;
  if (!item) return null;

  const info = item.volumeInfo || {};
  return {
    titulo: info.title || 'Sense títol',
    autor: (info.authors && info.authors.length ? info.authors.join(', ') : 'Autor desconegut'),
    descripcion: info.description || 'Sense descripció disponible',
    estado: 'Muy bueno',
    venta: false,
    precio: 0,
    isbn: cleanCode
  };
}

window.app = {
  loadHeader,
  getBooks,
  getCart,
  setCart,
  addToCart,
  updateCartBadge,
  getCustomBooks,
  saveCustomBook,
  fetchGoogleBookByIsbn
};
