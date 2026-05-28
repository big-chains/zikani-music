let currentTab = 'videos';
let editingId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => switchTab('videos'));

async function switchTab(tab) {
    currentTab = tab;

    // Update UI Active State
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-nav'));
    document.getElementById(`nav-${tab}`).classList.add('active-nav');
    document.getElementById('page-title').innerText = `Manage ${tab.charAt(0).toUpperCase() + tab.slice(1)}`;

    loadData();
}

async function loadData() {
    const container = document.getElementById('data-container');
    container.innerHTML = `<div class="col-span-full text-center py-10 opacity-50">Loading ${currentTab}...</div>`;

    const data = await api.request(`/${currentTab}`);
    container.innerHTML = '';

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-card border border-white/5 p-6 rounded-xl hover:border-accent/30 transition-all";

        // Dynamic content based on tab
        let details = currentTab === 'videos' ? item.platform : currentTab === 'events' ? new Date(item.date).toLocaleDateString() : `MWK ${item.price.toLocaleString()}`;
        let title = item.title || item.name;

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <span class="text-xs font-bold uppercase tracking-widest text-accent/60">${details}</span>
                <div class="flex gap-2">
                    <button onclick="editItem(${item.id})" class="text-gray-500 hover:text-white"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="deleteItem(${item.id})" class="text-gray-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <h3 class="text-lg font-bold truncate">${title}</h3>
            ${item.thumbnail || item.image ? `<img src="${item.thumbnail || item.image}" class="w-full h-32 object-cover rounded mt-4 opacity-50">` : ''}
        `;
        container.appendChild(card);
    });
}

// --- MODAL & FORM LOGIC ---

function openModal(item = null) {
    editingId = item ? item.id : null;
    document.getElementById('modal-title').innerText = item ? `Edit ${currentTab}` : `Add New ${currentTab}`;

    const fields = document.getElementById('form-fields');
    if (currentTab === 'videos') {
        fields.innerHTML = `
            <input type="text" id="f-title" placeholder="Video Title" class="w-full bg-black p-3 rounded" value="${item?.title || ''}">
            <select id="f-platform" class="w-full bg-black p-3 rounded">
                <option value="YouTube" ${item?.platform === 'YouTube' ? 'selected' : ''}>YouTube</option>
                <option value="Spotify" ${item?.platform === 'Spotify' ? 'selected' : ''}>Spotify</option>
            </select>
            <input type="text" id="f-url" placeholder="URL" class="w-full bg-black p-3 rounded" value="${item?.url || ''}">
            <input type="text" id="f-thumb" placeholder="Thumbnail URL" class="w-full bg-black p-3 rounded" value="${item?.thumbnail || ''}">
        `;
    } else if (currentTab === 'products') {
        fields.innerHTML = `
            <input type="text" id="f-name" placeholder="Product Name" class="w-full bg-black p-3 rounded" value="${item?.name || ''}">
            <input type="number" id="f-price" placeholder="Price" class="w-full bg-black p-3 rounded" value="${item?.price || ''}">
            <input type="number" id="f-stock" placeholder="Stock Quantity" class="w-full bg-black p-3 rounded" value="${item?.stock || ''}">
            <input type="text" id="f-image" placeholder="Image URL" class="w-full bg-black p-3 rounded" value="${item?.image || ''}">
        `;
    } else if (currentTab === 'events') {
        // Format ISO date to YYYY-MM-DDThh:mm for datetime-local input
        let dateVal = '';
        if (item?.date) {
            const d = new Date(item.date);
            // subtract timezone offset to get correct local time for input
            dateVal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        }
        fields.innerHTML = `
            <input type="text" id="f-title" placeholder="Event Title" class="w-full bg-black p-3 rounded" value="${item?.title || ''}">
            <input type="datetime-local" id="f-date" placeholder="Date" class="w-full bg-black p-3 rounded" value="${dateVal}">
            <input type="text" id="f-location" placeholder="Location" class="w-full bg-black p-3 rounded" value="${item?.location || ''}">
            <input type="number" id="f-price" placeholder="Ticket Price (MWK)" class="w-full bg-black p-3 rounded" value="${item?.price || ''}">
        `;
    }

    document.getElementById('modal').classList.remove('hidden');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const data = {};
    if (currentTab === 'videos') {
        data.title = document.getElementById('f-title').value;
        data.platform = document.getElementById('f-platform').value;
        data.url = document.getElementById('f-url').value;
        data.thumbnail = document.getElementById('f-thumb').value;
    } else if (currentTab === 'products') {
        data.name = document.getElementById('f-name').value;
        data.price = parseFloat(document.getElementById('f-price').value);
        data.stock = parseInt(document.getElementById('f-stock').value);
        data.image = document.getElementById('f-image').value;
    } else if (currentTab === 'events') {
        data.title = document.getElementById('f-title').value;
        const localDate = document.getElementById('f-date').value;
        // Append :00 to format properly for Python ISO 8601 parsing 
        data.date = new Date(localDate).toISOString();
        data.location = document.getElementById('f-location').value;
        data.price = parseFloat(document.getElementById('f-price').value);
    }

    const method = editingId ? 'PUT' : 'POST';
    const endpoint = editingId ? `/${currentTab}/${editingId}` : `/${currentTab}`;

    const result = await api.request(endpoint, method, data);
    if (result) {
        closeModal();
        loadData();
    }
}

async function deleteItem(id) {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    const result = await api.request(`/${currentTab}/${id}`, 'DELETE');
    if (result) loadData();
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('content-form').reset();
}