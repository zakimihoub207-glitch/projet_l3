// ===============================
// CHECK USER FROM STORAGE
// ===============================
function loadUser() {
    const userData =
        localStorage.getItem('user') ||
        sessionStorage.getItem('user');

    if (!userData) {
        window.location.href = "/login/";
        return;
    }

    const user = JSON.parse(userData);

    document.getElementById("userName").textContent =
        user.first_name + " " + user.last_name;
}

// ===============================
// LOGOUT
// ===============================
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login/";
});

// ===============================
// INIT
// ===============================
loadUser();