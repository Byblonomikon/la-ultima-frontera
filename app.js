const HEADER_PATH = 'header.html';

const FALLBACK_BOOKS = [
  {
    titulo: 'Leviatán',
    autor: 'Thomas Hobbes',
    descripcion: 'Edició en castellà del clàssic del pensament polític sobre poder, contracte social i naturalesa humana.',
    estado: 'Muy bueno',
    venta: false,
    precio: 0,
    isbn: ''
  },
  {
    titulo: '1984',
    autor: 'George Orwell',
    descripcion: 'Distopia essencial sobre vigilància, repressió i llibertat individual.',
    estado: 'Bueno',
    venta: true,
    precio: 12,
    isbn: ''
  },
  {
    titulo: 'El nom de la rosa',
    autor: 'Umberto Eco',
    descripcion: 'Novel·la històrica i detectivesca que barreja teologia, poder i biblioteques medievals.',
    estado: 'Muy bueno',
    venta: true,
    precio: 18,
    isbn: ''
  },
  {
    titulo: "Pedagogia de l'oprimit",
    autor: 'Paulo Freire',
    descripcion: 'Text clau per repensar educació, emancipació i consciència crítica.',
    estado: 'Bueno',
    venta: true,
    precio: 14,
    isbn: ''
  }
];

async function loadHeader() {
  const placeholder = document.getElementById('header-placeholder');
  if (!placeholder) return;

  try {
    const res = await fetch(HEADER_PATH);
    if (!res.ok) throw new Error('No s\'ha pogut carregar el header');
    placeholder.innerHTML = await res.text();
  } catch (error) {
    console.error(error);
    placeholder.innerHTML = '';
  }

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach((link) => {
    if (link.getAttribute('href') === path) link.classList.add('active');
  });

  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'dark';
  root.dataset.theme = savedTheme;
  if (toggle) toggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem('theme', next);
      toggle.textContent = next === 'dark' ? '🌙' : '☀️';
    });
  }

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
  let baseBooks = [];
  try {
    const res = await fetch('data/libros.json');
    if (!res.ok) throw new Error('No s\'ha pogut carregar el catàleg base');
    baseBooks = await res.json();
  } catch (error) {
    console.error(error);
    baseBooks = FALLBACK_BOOKS;
  }

  const customBooks = getCustomBooks();
  return [...customBooks, ...baseBooks].map((book) => ({
    titulo: book.titulo || 'Sense títol',
    autor: book.autor || 'Autor desconegut',
    descripcion: book.descripcion || 'Sense descripció',
    estado: book.estado || 'Bueno',
    venta: Boolean(book.venta),
    precio: Number(book.precio || 0),
    isbn: book.isbn || ''
  }));
}

function getCustomBooks() {
  return JSON.parse(localStorage.getItem('llibresCustom') || '[]');
}

function mergeCustomBooks(incomingBooks) {
  const current = getCustomBooks();
  const merged = [...current];
  let added = 0;

  incomingBooks.forEach((book) => {
    const exists = merged.some((item) => {
      if (item.isbn && book.isbn) return item.isbn === book.isbn;
      return item.titulo === book.titulo && item.autor === book.autor;
    });

    if (!exists) {
      merged.push(book);
      added += 1;
    }
  });

  localStorage.setItem('llibresCustom', JSON.stringify(merged));
  return added;
}

function exportCustomBooksToken() {
  const raw = JSON.stringify(getCustomBooks());
  return btoa(unescape(encodeURIComponent(raw)));
}

function importCustomBooksToken(token) {
  try {
    const raw = decodeURIComponent(escape(atob(token)));
    const books = JSON.parse(raw);
    if (!Array.isArray(books)) return { ok: false, added: 0 };

    const normalized = books.map((book) => ({
      titulo: book.titulo || 'Sense títol',
      autor: book.autor || 'Autor desconegut',
      descripcion: book.descripcion || 'Sense descripció',
      estado: book.estado || 'Bueno',
      venta: Boolean(book.venta),
      precio: Number(book.precio || 0),
      isbn: book.isbn || ''
    }));

    return { ok: true, added: mergeCustomBooks(normalized) };
  } catch (error) {
    console.error(error);
    return { ok: false, added: 0 };
  }
}

function saveCustomBook(book) {
  const customBooks = getCustomBooks();
  const alreadyExists = customBooks.some((item) => item.isbn && item.isbn === book.isbn);
  if (alreadyExists) return false;
  customBooks.push(book);
  localStorage.setItem('llibresCustom', JSON.stringify(customBooks));
  return true;
}

function normalizeFetchedBook(info, isbn) {
  return {
    titulo: info.title || 'Sense títol',
    autor: (info.authors && info.authors.length ? info.authors.join(', ') : 'Autor desconegut'),
    descripcion: info.description || 'Sense descripció disponible',
    estado: 'Muy bueno',
    venta: false,
    precio: 0,
    isbn
  };
}

function normalizeOpenLibraryBook(data, isbn) {
  return {
    titulo: data.title || 'Sense títol',
    autor: (data.authors && data.authors.length ? data.authors.map((a) => a.name).filter(Boolean).join(', ') : 'Autor desconegut'),
    descripcion: data.subtitle || 'Resultat obtingut d’Open Library.',
    estado: 'Muy bueno',
    venta: false,
    precio: 0,
    isbn
  };
}

async function fetchGoogleBookByIsbn(code, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 12000);
  const cleanCode = code.replace(/[^\dXx]/g, '');
  if (!cleanCode) return { status: 'invalid_code', book: null };

  async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) return { status: 'api_error', data: null };
      const data = await response.json();
      return { status: 'ok', data };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error && error.name === 'AbortError') return { status: 'timeout', data: null };
      console.error(error);
      return { status: 'network_error', data: null };
    }
  }

  const google = await fetchJsonWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanCode)}`
  );

  if (google.status === 'ok') {
    const item = google.data.items && google.data.items.length ? google.data.items[0] : null;
    if (item) {
      return { status: 'ok', book: normalizeFetchedBook(item.volumeInfo || {}, cleanCode) };
    }
  } else if (google.status === 'timeout') {
    return { status: 'timeout', book: null };
  }

  const openLibrary = await fetchJsonWithTimeout(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(cleanCode)}&format=json&jscmd=data`
  );

  if (openLibrary.status === 'ok') {
    const key = `ISBN:${cleanCode}`;
    const olData = openLibrary.data && openLibrary.data[key] ? openLibrary.data[key] : null;
    if (olData) {
      return { status: 'ok', book: normalizeOpenLibraryBook(olData, cleanCode) };
    }
  }

  if (google.status === 'network_error' || openLibrary.status === 'network_error') return { status: 'network_error', book: null };
  if (google.status === 'timeout' || openLibrary.status === 'timeout') return { status: 'timeout', book: null };
  if (google.status === 'api_error' && openLibrary.status === 'api_error') return { status: 'api_error', book: null };

  return { status: 'not_found', book: null };
}

window.app = {
  loadHeader,
  getBooks,
  getCart,
  setCart,
  addToCart,
  updateCartBadge,
  getCustomBooks,
  mergeCustomBooks,
  exportCustomBooksToken,
  importCustomBooksToken,
  saveCustomBook,
  fetchGoogleBookByIsbn
};
