// Redirect to admin login if no token found
const token = localStorage.getItem('admin_token');
if (!token) {
    window.location.href = '/admin';
}

function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin';
}