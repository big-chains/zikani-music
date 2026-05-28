const API_BASE = "/api";

const api = {
    async request(endpoint, method = 'GET', body = null) {
        const headers = {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
            'Content-Type': 'application/json'
        };

        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);

            if (response.status === 401 || response.status === 403) {
                logout(); // Session expired or unauthorized
                return;
            }

            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            alert("Connection error. Is the backend running?");
        }
    }
};