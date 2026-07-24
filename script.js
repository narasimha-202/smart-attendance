const STORAGE_KEY = "attendancePortal";
let database = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: [] };
let currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
let currentViewDate = new Date();

function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isToday(date) {
    return formatLocalDate(date) === formatLocalDate(new Date());
}

function isFutureDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d > today;
}

function isSunday(date) {
    return date.getDay() === 0;
}

function saveDatabase() { 
    if (currentUser) {
        const index = database.users.findIndex(u => u.rollNo === currentUser.rollNo);
        if (index !== -1) database.users[index] = currentUser;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(database)); 
}

function showToast(message) { 
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.innerText = message; 
    toast.classList.add("show"); 
    setTimeout(() => toast.classList.remove("show"), 2500); 
}

// Auth / Nav
document.getElementById("gotoLogin").addEventListener("click", (e) => { e.preventDefault(); document.getElementById("registerPage").classList.add("hidden"); document.getElementById("loginPage").classList.remove("hidden"); });
document.getElementById("gotoRegister").addEventListener("click", (e) => { e.preventDefault(); document.getElementById("loginPage").classList.add("hidden"); document.getElementById("registerPage").classList.remove("hidden"); });

document.getElementById("registerBtn").addEventListener("click", () => {
    const name = document.getElementById("regName").value, roll = document.getElementById("regRoll").value.toUpperCase(), pass = document.getElementById("regPass").value, confirm = document.getElementById("regConfirm").value;
    if (!name || !roll || !pass) return showToast("All fields required");
    if (pass !== confirm) return showToast("Passwords don't match.");
    if (database.users.find(u => u.rollNo === roll)) return showToast("Roll exists.");
    database.users.push({ name, rollNo: roll, password: pass, attendance: [], registeredAt: formatLocalDate(new Date()) });
    saveDatabase(); showToast("Registered! Please login.");
});

document.getElementById("loginBtn").addEventListener("click", () => {
    const roll = document.getElementById("loginRoll").value.toUpperCase(), pass = document.getElementById("loginPass").value;
    const user = database.users.find(u => u.rollNo === roll && u.password === pass);
    if (!user) return showToast("Invalid Credentials.");
    currentUser = user; sessionStorage.setItem("currentUser", JSON.stringify(user)); openDashboard();
});

function openDashboard() {
    document.getElementById("registerPage").classList.add("hidden"); document.getElementById("loginPage").classList.add("hidden"); document.getElementById("dashboard").classList.remove("hidden");
    setInterval(updateDateTime, 1000); updateDateTime(); renderDashboard();
}

function updateAttendance(status, dateStr) {
    const existing = currentUser.attendance.find(i => i.date === dateStr);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (existing) { existing.status = status; existing.time = time; }
    else currentUser.attendance.push({ date: dateStr, time: time, status: status });
    saveDatabase(); sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
    renderDashboard(); showToast("Marked: " + status + " for " + dateStr);
}

function renderDashboard() {
    const today = new Date();
    const todayStr = formatLocalDate(today);
    const rec = currentUser.attendance.find(i => i.date === todayStr);
    
    // 1. Overall Stats (Excluding Sundays and Holidays)
    const allWorkingDays = currentUser.attendance.filter(a => !isSunday(new Date(a.date)) && a.status !== "Holiday");
    const allPresents = allWorkingDays.filter(i => i.status === "Present").length;
    const totalWorkingDaysCount = allWorkingDays.length;
    const allPercent = totalWorkingDaysCount ? ((allPresents / totalWorkingDaysCount) * 100) : 0;
    
    // 2. Monthly Stats (Excluding Sundays and Holidays)
    const monthWorkingDays = currentUser.attendance.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === currentViewDate.getMonth() &&
               d.getFullYear() === currentViewDate.getFullYear() &&
               !isSunday(d) &&
               a.status !== "Holiday";
    });
    const monthPresents = monthWorkingDays.filter(i => i.status === "Present").length;
    const monthWorkingCount = monthWorkingDays.length;
    const monthAbsents = monthWorkingCount - monthPresents;
    const monthPercent = monthWorkingCount ? ((monthPresents / monthWorkingCount) * 100) : 0;

    // Update Overall Stats
    document.getElementById("presentCount").textContent = allPresents;
    document.getElementById("absentCount").textContent = totalWorkingDaysCount - allPresents;
    document.getElementById("overallPercent").textContent = allPercent.toFixed(0) + "%";
    document.getElementById("workingDays").textContent = totalWorkingDaysCount;
    
    // Profile Info
    document.getElementById("profileName").textContent = currentUser.name;
    document.getElementById("profileRoll").textContent = currentUser.rollNo;
    document.getElementById("registeredDate").textContent = currentUser.registeredAt || "N/A";
    document.getElementById("profileStatus").textContent = allPercent >= 75 ? "Clear" : "Shortage";

    const btnContainer = document.getElementById("attendanceControls");
    if (btnContainer) btnContainer.style.display = isSunday(today) ? "none" : "flex";
    document.getElementById("todayStatus").innerText = isSunday(today) ? "Sunday: Holiday" : (rec ? "Status: " + rec.status : "Status: Not Marked");
    
    document.getElementById("currentStreak").textContent = currentStreak();
    document.getElementById("longestStreak").textContent = longestStreak();
    
    let status = allPercent >= 95 ? "Outstanding" : allPercent >= 90 ? "Excellent" : allPercent >= 80 ? "Very Good" : allPercent >= 75 ? "Good" : allPercent >= 60 ? "Average" : allPercent >= 40 ? "Poor" : "Critical";
    document.getElementById("attendanceStatus").textContent = `${status}`;
    document.getElementById("neededDays").textContent = Math.max(0, Math.ceil((0.75 * totalWorkingDaysCount - allPresents) / 0.25));

    renderHistory(); 
    renderCalendar(monthPresents, monthAbsents, monthWorkingCount, monthPercent);
}

function renderCalendar(mPresents, mAbsents, mWorking, mPercent) {
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = `
        <div class="col-span-7 mb-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <h4 class="font-bold text-indigo-900 mb-2">${currentViewDate.toLocaleString("default", {month: "long"})} Attendance</h4>
            <div class="grid grid-cols-3 gap-2 text-sm">
                <div class="bg-white p-2 rounded shadow-sm"><span class="block font-bold text-green-600">${mPresents}</span>Present</div>
                <div class="bg-white p-2 rounded shadow-sm"><span class="block font-bold text-red-600">${mAbsents}</span>Absent</div>
                <div class="bg-white p-2 rounded shadow-sm"><span class="block font-bold text-indigo-600">${mPercent.toFixed(0)}%</span>Efficiency</div>
            </div>
        </div>
        <div class="col-span-7 flex justify-between items-center mb-2">
            <button onclick="changeMonth(-1)" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">◀</button>
            <span class="font-bold text-lg">${currentViewDate.toLocaleString("default", {month: "long"})} ${currentViewDate.getFullYear()}</span>
            <button onclick="changeMonth(1)" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">▶</button>
        </div>`;
    "MTWTFSS".split("").forEach(d => grid.innerHTML += `<div class="font-bold text-blue-600">${d}</div>`);

    const firstDay = (new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), 1).getDay() || 7) - 1;
    const totalDays = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 0).getDate();

    for(let i = 0; i < firstDay; i++) grid.innerHTML += "<div></div>";

    for(let d = 1; d <= totalDays; d++) {
        const date = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), d);
        const dateStr = formatLocalDate(date);
        const rec = currentUser.attendance.find(a => a.date === dateStr);
        
        let cellBg = "bg-blue-50 hover:bg-blue-200";
        if (isSunday(date)) {
            cellBg = "bg-gray-200 text-gray-400";
        } else if (rec) {
            if (rec.status === "Present") cellBg = "bg-green-500 text-white";
            else if (rec.status === "Absent") cellBg = "bg-red-500 text-white";
            else if (rec.status === "Holiday") cellBg = "bg-purple-500 text-white";
        } else if (isFutureDate(date)) {
            cellBg = "bg-gray-100 cursor-not-allowed";
        }

        let cell = document.createElement("div");
        cell.className = `p-2 rounded text-center transition cursor-pointer ${isToday(date) ? "ring-2 ring-blue-500 font-bold" : ""} ${cellBg}`;
        cell.innerText = d;

        if (!isFutureDate(date) && !isSunday(date)) {
            cell.onclick = () => {
                const choice = prompt(rec ? `Edit ${dateStr} (${rec.status})\nEnter: P for Present, A for Absent, H for Holiday` : `Mark ${dateStr}:\nEnter: P for Present, A for Absent, H for Holiday`);
                if (choice) {
                    const upper = choice.toUpperCase();
                    if (upper === 'P') updateAttendance("Present", dateStr);
                    else if (upper === 'A') updateAttendance("Absent", dateStr);
                    else if (upper === 'H') updateAttendance("Holiday", dateStr);
                    else showToast("Invalid selection");
                }
            };
        }
        grid.appendChild(cell);
    }
}

function changeMonth(offset) { 
    currentViewDate.setMonth(currentViewDate.getMonth() + offset); 
    renderDashboard(); 
}

function renderHistory() {
    const tbody = document.getElementById("historyTable"); 
    if(!tbody) return;
    tbody.innerHTML = "";
    [...currentUser.attendance].sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(r => {
        let colorClass = 'text-gray-600';
        if (r.status === 'Present') colorClass = 'text-green-600';
        else if (r.status === 'Absent') colorClass = 'text-red-600';
        else if (r.status === 'Holiday') colorClass = 'text-purple-600';

        tbody.innerHTML += `<tr><td>${r.date}</td><td>${r.time || '-'}</td><td class="font-bold ${colorClass}">${r.status}</td></tr>`;
    });
}

function updateDateTime() {
    const now = new Date();
    if(document.getElementById("liveDateTime")) document.getElementById("liveDateTime").textContent = now.toLocaleString();
    if(document.getElementById("greeting")) document.getElementById("greeting").textContent = now.getHours() < 12 ? "🌅 Good Morning" : now.getHours() < 17 ? "☀️ Good Afternoon" : "🌙 Good Evening";
}

function currentStreak() {
    let streak = 0;
    const sorted = [...currentUser.attendance].filter(a => !isSunday(new Date(a.date)) && a.status !== "Holiday").sort((a,b) => new Date(b.date) - new Date(a.date));
    for(let entry of sorted) { if(entry.status === "Present") streak++; else break; }
    return streak;
}

function longestStreak() {
    let max = 0, count = 0;
    [...currentUser.attendance].filter(a => !isSunday(new Date(a.date)) && a.status !== "Holiday").sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(a => {
        if(a.status === "Present") { count++; if(count > max) max = count; } else count = 0;
    });
    return max;
}

document.getElementById("presentBtn").addEventListener("click", () => updateAttendance("Present", formatLocalDate(new Date())));
document.getElementById("absentBtn").addEventListener("click", () => updateAttendance("Absent", formatLocalDate(new Date())));

const holidayBtn = document.getElementById("holidayBtn");
if(holidayBtn) {
    holidayBtn.addEventListener("click", () => updateAttendance("Holiday", formatLocalDate(new Date())));
}

document.getElementById("logoutBtn").addEventListener("click", () => { sessionStorage.clear(); location.reload(); });
document.getElementById("resetAttendanceBtn").addEventListener("click", () => {
    if(confirm("Reset ALL attendance?")) { currentUser.attendance = []; saveDatabase(); renderDashboard(); showToast("Reset complete."); }
});
window.addEventListener("load", () => { if(currentUser) openDashboard(); });
