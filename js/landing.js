const API_URL = "/api";
let cart = JSON.parse(localStorage.getItem('zikani_cart')) || [];

// ─── DYNAMIC RENDERING ───────────────────────────────────────────────────────

async function loadDynamicContent() {
    try {
        const [videosRes, eventsRes, prodRes] = await Promise.all([
            fetch(API_URL + '/videos'),
            fetch(API_URL + '/events'),
            fetch(API_URL + '/products')
        ]);

        const videos = await videosRes.json();
        const events = await eventsRes.json();
        const products = await prodRes.json();

        renderVideos(videos);
        renderEvents(events);
        renderMerch(products);

    } catch (err) {
        console.error('Failed to load content:', err);
        ['music-grid', 'tour-grid', 'merch-grid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<div style="color:#f87171;padding:2rem;text-align:center">Could not load content. Is the server running?</div>';
        });
    }
}

// ─── YOUTUBE HELPER ──────────────────────────────────────────────────────────

/**
 * Extracts the YouTube video ID from any YouTube URL variant and
 * returns the embeddable iframe src.
 * Supports:
 *   https://youtu.be/VIDEO_ID?si=...
 *   https://www.youtube.com/watch?v=VIDEO_ID&...
 *   https://youtube.com/embed/VIDEO_ID
 */
function getYouTubeEmbedUrl(url) {
    try {
        const u = new URL(url);
        // youtu.be short links
        if (u.hostname === 'youtu.be') {
            const id = u.pathname.replace('/', '');
            return 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0';
        }
        // Already an embed URL
        if (u.pathname.startsWith('/embed/')) {
            return url + (url.includes('?') ? '&' : '?') + 'autoplay=1&rel=0';
        }
        // Standard watch URL
        const v = u.searchParams.get('v');
        if (v) return 'https://www.youtube.com/embed/' + v + '?autoplay=1&rel=0';
    } catch (_) { }
    return null;
}

function renderVideos(videos) {
    const grid = document.getElementById('music-grid');
    if (!grid) return;

    if (!videos || videos.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">No releases yet — check back soon!</div>';
        return;
    }

    grid.innerHTML = '';
    videos.forEach(v => {
        const card = document.createElement('div');
        card.className = 'glass rounded-3xl overflow-hidden group hover:-translate-y-2 transition-all duration-300';

        const isYT = v.platform === 'YouTube';
        const isSpotify = v.platform === 'Spotify';
        const iconClass = isYT ? 'fa-brands fa-youtube text-red-500'
            : isSpotify ? 'fa-brands fa-spotify text-green-400'
                : 'fa-brands fa-apple';

        const embedUrl = isYT ? getYouTubeEmbedUrl(v.url) : null;

        // Use YT thumbnail if admin didn't set one
        let thumbSrc = v.thumbnail;
        if (!thumbSrc && embedUrl) {
            const idMatch = embedUrl.match(/embed\/([^?]+)/);
            if (idMatch) thumbSrc = 'https://img.youtube.com/vi/' + idMatch[1] + '/hqdefault.jpg';
        }

        const thumbHTML = thumbSrc
            ? '<img src="' + thumbSrc + '" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="' + escHtml(v.title) + '">'
            : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-music text-5xl text-gray-600"></i></div>';

        // Play overlay — triggers modal for YT, external link otherwise
        const overlayAction = embedUrl
            ? 'javascript:void(0)" data-embed="' + escAttr(embedUrl) + '" data-title="' + escAttr(v.title) + '" class="play-overlay-btn'
            : escHtml(v.url) + '" target="_blank';
        const overlayTag = embedUrl ? 'button' : 'a href';
        const overlayTagEnd = embedUrl ? 'button' : 'a';

        // Bottom action — Watch (opens modal) for YT, Listen link otherwise
        const actionHTML = embedUrl
            ? '<button class="watch-btn text-gray-400 text-sm hover:text-accent transition-colors" data-embed="' + escAttr(embedUrl) + '" data-title="' + escAttr(v.title) + '">Watch Now &rarr;</button>'
            : '<a href="' + escHtml(v.url) + '" target="_blank" class="text-gray-400 text-sm hover:text-accent transition-colors">Listen Now &rarr;</a>';

        card.innerHTML =
            '<div class="h-48 bg-gray-800 relative overflow-hidden">' +
            thumbHTML +
            '<div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">' +
            (embedUrl
                ? '<button class="play-overlay-btn" data-embed="' + escAttr(embedUrl) + '" data-title="' + escAttr(v.title) + '"><i class="fa-solid fa-play text-5xl text-accent drop-shadow-lg"></i></button>'
                : '<a href="' + escHtml(v.url) + '" target="_blank"><i class="fa-solid fa-play text-5xl text-accent drop-shadow-lg"></i></a>'
            ) +
            '</div>' +
            '</div>' +
            '<div class="p-6">' +
            '<h3 class="text-xl font-bold mb-2">' + escHtml(v.title) + '</h3>' +
            '<p class="text-sm mb-4"><i class="' + iconClass + '"></i> ' + escHtml(v.platform) + '</p>' +
            actionHTML +
            '</div>';

        // Wire up modal triggers
        card.querySelectorAll('.play-overlay-btn, .watch-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                showVideoModal(this.dataset.embed, this.dataset.title);
            });
        });

        grid.appendChild(card);
    });
}

// ─── VIDEO MODAL ─────────────────────────────────────────────────────────────

function showVideoModal(embedUrl, title) {
    closeVideoModal(); // remove any existing
    const modal = document.createElement('div');
    modal.id = 'video-modal';
    modal.className = 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md';
    modal.innerHTML =
        '<div class="w-full max-w-4xl">' +
        '<div class="flex justify-between items-center mb-3">' +
        '<p class="font-bold text-lg truncate pr-4">' + escHtml(title) + '</p>' +
        '<button id="video-modal-close" class="w-9 h-9 glass rounded-full flex items-center justify-center hover:text-accent transition flex-shrink-0">' +
        '<i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="relative w-full" style="padding-bottom:56.25%">' +
        '<iframe src="' + escHtml(embedUrl) + '" class="absolute inset-0 w-full h-full rounded-2xl border border-white/10"' +
        ' frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
        ' allowfullscreen></iframe>' +
        '</div>' +
        '</div>';

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    document.getElementById('video-modal-close').addEventListener('click', closeVideoModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeVideoModal(); });
}

function closeVideoModal() {
    const m = document.getElementById('video-modal');
    if (m) { m.remove(); document.body.style.overflow = ''; }
}

// Close video modal on Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeVideoModal();
});


function renderEvents(events) {
    const grid = document.getElementById('tour-grid');
    if (!grid) return;

    if (!events || events.length === 0) {
        grid.innerHTML = '<div class="text-center py-10 text-gray-500">No upcoming events — check back soon!</div>';
        return;
    }

    grid.innerHTML = '';
    events.forEach(ev => {
        const dateStr = new Date(ev.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
        const row = document.createElement('div');
        row.className = 'glass p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 hover:border-accent/50 transition-colors';
        row.innerHTML =
            '<div class="text-center md:text-left">' +
            '<p class="text-accent font-bold text-lg mb-1">' + dateStr + '</p>' +
            '<h4 class="text-2xl font-bold">' + escHtml(ev.title) + '</h4>' +
            '<p class="text-gray-400 text-sm"><i class="fa-solid fa-location-dot mr-2"></i>' + escHtml(ev.location) + ' &mdash; MWK ' + Number(ev.price).toLocaleString() + '</p>' +
            '</div>' +
            '<button class="buy-ticket-btn bg-white/10 hover:bg-accent hover:text-dark text-white px-8 py-3 rounded-full font-bold transition-all w-full md:w-auto" data-id="' + ev.id + '" data-price="' + ev.price + '">Buy Ticket</button>';

        row.querySelector('.buy-ticket-btn').addEventListener('click', function () {
            buyTicket(this.dataset.id, parseFloat(this.dataset.price));
        });

        grid.appendChild(row);
    });
}

function renderMerch(products) {
    const grid = document.getElementById('merch-grid');
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">No merch available yet — check back soon!</div>';
        return;
    }

    grid.innerHTML = '';
    products.forEach(p => {
        const inStock = p.stock > 0;
        const card = document.createElement('div');
        card.className = 'glass rounded-2xl p-4 flex flex-col group relative';

        const imgHTML = p.image
            ? '<img src="' + escHtml(p.image) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="' + escHtml(p.name) + '">'
            : '<i class="fa-solid fa-shirt text-6xl text-gray-600 group-hover:text-accent transition-colors duration-300"></i>';

        card.innerHTML =
            (inStock ? '' : '<div class="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">Out of Stock</div>') +
            '<div class="bg-dark rounded-xl h-64 mb-4 overflow-hidden flex items-center justify-center">' + imgHTML + '</div>' +
            '<h4 class="font-bold text-lg">' + escHtml(p.name) + '</h4>' +
            '<p class="text-accent font-bold mt-1 mb-4">MWK ' + Number(p.price).toLocaleString() + '</p>' +
            '<button class="add-cart-btn mt-auto glass w-full py-2 rounded-full font-semibold hover:bg-accent hover:text-dark transition-all' + (inStock ? '' : ' opacity-50 cursor-not-allowed') + '" data-id="' + p.id + '" data-name="' + escAttr(p.name) + '" data-price="' + p.price + '"' + (inStock ? '' : ' disabled') + '>' +
            (inStock ? 'Add to Cart' : 'Sold Out') + '</button>';

        if (inStock) {
            card.querySelector('.add-cart-btn').addEventListener('click', function () {
                addToCart(parseInt(this.dataset.id), this.dataset.name, parseFloat(this.dataset.price));
            });
        }

        grid.appendChild(card);
    });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── CART ────────────────────────────────────────────────────────────────────

function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    localStorage.setItem('zikani_cart', JSON.stringify(cart));
    updateCartUI();
    // Flash the badge to give feedback
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.classList.add('scale-125');
        setTimeout(() => badge.classList.remove('scale-125'), 200);
    }
    // Briefly open the drawer so user knows cart was updated
    openCart();
}

function checkoutCart() {
    if (cart.length === 0) return alert('Your cart is empty!');
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    closeCart();
    processCheckout('merch', null, total, cart);
}

function buyTicket(eventId, price) {
    processCheckout('ticket', eventId, price, null);
}

// ─── CHECKOUT ────────────────────────────────────────────────────────────────

// ⚠️  IMPORTANT: Replace the value below with your real Flutterwave public key.
//    Get it from: https://dashboard.flutterwave.com → Settings → API
const FLW_PUBLIC_KEY = 'FLWPUBK_TEST-fb3a5ff1da1cc9e659d7659b88236a8c-X';

async function processCheckout(type, itemId, amount, cartData) {
    // Guard: block payment if key is still a placeholder
    if (!FLW_PUBLIC_KEY || FLW_PUBLIC_KEY.includes('XXXX')) {
        alert('Payment is not yet configured. Please contact the site administrator.');
        return;
    }

    const email = prompt('Enter your email address for your receipt / ticket:');
    if (!email || !email.includes('@')) {
        if (email !== null) alert('Please enter a valid email address.');
        return;
    }

    // Show email confirmation banner so the user can see what they entered
    showEmailBanner(email);

    // 1. Create the pending order in the backend first
    let orderId = null;
    try {
        const orderReq = await fetch(API_URL + '/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                item_type: type,
                item_id: itemId || 0,
                amount: amount
            })
        });
        const orderRes = await orderReq.json();
        if (!orderReq.ok) throw new Error(orderRes.error || 'Could not create order');
        orderId = orderRes.order_id;
    } catch (err) {
        alert("Error initializing payment: " + err.message);
        const banner = document.getElementById('zikani-email-banner');
        if (banner) banner.remove();
        return;
    }

    // 2. Launch Flutterwave Checkout
    FlutterwaveCheckout({
        public_key: FLW_PUBLIC_KEY,
        tx_ref: 'ZIKANI-' + Date.now(),
        amount: amount,
        currency: 'MWK',
        payment_options: 'card, mobilemoney',
        customer: { email: email },
        customizations: { title: 'Zikani Store', description: 'Payment for ' + type },
        callback: async function (res) {
            if (res.status === 'successful') {
                const verifyReq = await fetch(API_URL + '/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transaction_id: res.transaction_id, order_id: orderId, cart: cartData })
                });
                const verifyRes = await verifyReq.json();
                if (type === 'ticket' && verifyRes.qr_code) {
                    showTicketModal(verifyRes.ticket_id, verifyRes.qr_code);
                } else {
                    alert('Payment successful! Merch order placed.');
                    cart = [];
                    localStorage.setItem('zikani_cart', JSON.stringify(cart));
                    updateCartUI();
                }
            }
        },
        onclose: function () {
            // Remove banner when user closes the payment modal
            const banner = document.getElementById('zikani-email-banner');
            if (banner) banner.remove();
        }
    });
}

/** Shows a slim banner at the top of the page confirming the email. */
function showEmailBanner(email, customMessage) {
    // Remove any existing banner first
    const existing = document.getElementById('zikani-email-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'zikani-email-banner';
    banner.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
        'background:linear-gradient(90deg,#1e2128,#2b2f38)',
        'border-bottom:1px solid rgba(76,219,176,0.4)',
        'padding:10px 20px',
        'display:flex', 'align-items:center', 'justify-content:center', 'gap:10px',
        'font-family:Outfit,sans-serif', 'font-size:14px', 'color:#fff'
    ].join(';');

    if (customMessage) {
        banner.innerHTML =
            '<i class="fa-solid fa-check-circle" style="color:#4cdbb0"></i>' +
            '<span>' + escHtml(customMessage) + ' (<strong style="color:#4cdbb0">' + escHtml(email) + '</strong>)</span>';
        document.body.prepend(banner);
        setTimeout(() => {
            if (document.body.contains(banner)) banner.remove();
        }, 4000);
    } else {
        banner.innerHTML =
            '<i class="fa-solid fa-envelope" style="color:#4cdbb0"></i>' +
            '<span>Sending receipt to: <strong style="color:#4cdbb0">' + escHtml(email) + '</strong></span>' +
            '<span style="color:#9ca3af;font-size:12px">&nbsp;— complete payment in the window below</span>';
        document.body.prepend(banner);
    }
}

function showTicketModal(ticketId, qrBase64) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md';
    modal.innerHTML =
        '<div class="glass p-8 rounded-3xl text-center max-w-sm w-full border border-accent/30">' +
        '<h3 class="text-2xl font-bold font-display text-accent mb-2">OFFICIAL TICKET</h3>' +
        '<p class="text-sm text-gray-400 mb-6">ID: ' + ticketId.split('-')[0] + '</p>' +
        '<div class="bg-white p-4 rounded-xl inline-block mb-6">' +
        '<img src="data:image/png;base64,' + qrBase64 + '" class="w-48 h-48" alt="QR">' +
        '</div>' +
        '<p class="text-xs text-gray-400 mb-6">Scan this code at the venue entrance.</p>' +
        '<button class="close-modal bg-white/10 hover:bg-white text-white hover:text-dark w-full py-3 rounded-full font-bold transition-all">Close</button>' +
        '</div>';

    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
}

// ─── CART UI & DRAWER ──────────────────────────────────────────────────────────────────

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    const itemsEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('cart-checkout-btn');

    const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
    const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    // Badge
    if (badge) {
        badge.textContent = totalQty;
        badge.classList.toggle('hidden', totalQty === 0);
    }

    // Total
    if (totalEl) totalEl.textContent = 'MWK ' + Number(totalPrice).toLocaleString();

    // Checkout button
    if (checkoutBtn) checkoutBtn.disabled = totalQty === 0;

    // Items list
    if (!itemsEl) return;
    if (cart.length === 0) {
        itemsEl.innerHTML =
            '<div class="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">' +
            '<i class="fa-solid fa-bag-shopping text-5xl text-gray-700"></i>' +
            '<p class="text-gray-500 text-sm">Your cart is empty.<br>Add some merch above!</p>' +
            '</div>';
        return;
    }

    itemsEl.innerHTML = '';
    cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-4 glass rounded-xl p-3';
        row.innerHTML =
            '<div class="w-10 h-10 bg-dark rounded-lg flex items-center justify-center flex-shrink-0">' +
            '<i class="fa-solid fa-shirt text-accent"></i></div>' +
            '<div class="flex-1 min-w-0">' +
            '<p class="font-semibold text-sm truncate">' + escHtml(item.name) + '</p>' +
            '<p class="text-accent text-xs font-bold">MWK ' + Number(item.price).toLocaleString() + ' &times; ' + item.quantity + '</p>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
            '<button class="qty-dec w-7 h-7 glass rounded-full text-sm hover:text-accent transition" data-id="' + item.id + '">&#8722;</button>' +
            '<span class="text-sm font-bold w-4 text-center">' + item.quantity + '</span>' +
            '<button class="qty-inc w-7 h-7 glass rounded-full text-sm hover:text-accent transition" data-id="' + item.id + '">&#43;</button>' +
            '<button class="qty-del w-7 h-7 glass rounded-full text-sm hover:text-red-400 transition ml-1" data-id="' + item.id + '"><i class="fa-solid fa-trash-can text-xs"></i></button>' +
            '</div>';

        // Quantity controls
        row.querySelector('.qty-dec').addEventListener('click', function () {
            const it = cart.find(c => c.id == this.dataset.id);
            if (it) { it.quantity > 1 ? it.quantity-- : cart.splice(cart.indexOf(it), 1); }
            localStorage.setItem('zikani_cart', JSON.stringify(cart));
            updateCartUI();
        });
        row.querySelector('.qty-inc').addEventListener('click', function () {
            const it = cart.find(c => c.id == this.dataset.id);
            if (it) it.quantity++;
            localStorage.setItem('zikani_cart', JSON.stringify(cart));
            updateCartUI();
        });
        row.querySelector('.qty-del').addEventListener('click', function () {
            cart = cart.filter(c => c.id != this.dataset.id);
            localStorage.setItem('zikani_cart', JSON.stringify(cart));
            updateCartUI();
        });

        itemsEl.appendChild(row);
    });
}

function openCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) drawer.classList.remove('translate-x-full');
    if (overlay) overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) drawer.classList.add('translate-x-full');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
}

function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    if (!drawer) return;
    drawer.classList.contains('translate-x-full') ? openCart() : closeCart();
}

// ─── SUBSCRIPTION ────────────────────────────────────────────────────────────────
const subscribeForm = document.getElementById('subscribe-form');
if (subscribeForm) {
    subscribeForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const emailInput = document.getElementById('sub-email');
        const btn = this.querySelector('button[type="submit"]');
        const email = emailInput.value.trim();

        if (!email) return;

        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Subscribing...';
        btn.disabled = true;
        btn.classList.add('opacity-70', 'cursor-not-allowed');

        try {
            const res = await fetch(API_URL + '/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            const data = await res.json();

            if (res.ok) {
                // Show a nice inline success message instead of boring alert
                showEmailBanner(email, "Subscribed successfully!");
                emailInput.value = '';
            } else {
                alert(data.error || 'Failed to subscribe');
            }
        } catch (err) {
            alert('An error occurred. Please try again.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
    });
}

// ─── CONTACT / BOOKING FORM ────────────────────────────────────────────────────────
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        const btn = document.getElementById('contact-submit-btn');
        const feedback = document.getElementById('contact-feedback');

        if (!name || !email || !message) return;

        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';
        btn.disabled = true;
        btn.classList.add('opacity-70', 'cursor-not-allowed');

        try {
            const res = await fetch(API_URL + '/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message })
            });
            const data = await res.json();

            if (res.ok) {
                feedback.textContent = 'Message sent! The management team will reply to ' + email + ' soon.';
                feedback.className = 'text-center text-sm mt-3 text-accent';
                contactForm.reset();
            } else {
                feedback.textContent = data.error || 'Failed to send message. Please try again.';
                feedback.className = 'text-center text-sm mt-3 text-red-400';
            }
        } catch (err) {
            feedback.textContent = 'An error occurred. Please try again.';
            feedback.className = 'text-center text-sm mt-3 text-red-400';
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
    });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────────────
loadDynamicContent();
updateCartUI();
