// ----- Firebase Configuration -----
const firebaseConfig = {
  apiKey: "AIzaSyBzqUu_saUN1K87ZzWwqWIDbwAzqPHBDFo",
  authDomain: "special-education-resources.firebaseapp.com",
  projectId: "special-education-resources",
  storageBucket: "special-education-resources.firebasestorage.app",
  messagingSenderId: "743837753384",
  appId: "1:743837753384:web:c0ab8bad757c2a01bc951d"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

let requests = {};
let today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let activeDate = null;

const periods = ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5", "Period 6", "Period 7"];

// Realtime Firestore Listener
function startRealtimeListener() {
  db.collection("requests").onSnapshot(snapshot => {
    requests = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      if (!requests[data.dateKey]) requests[data.dateKey] = [];
      requests[data.dateKey].push(data);
    });
    renderCalendar();
    if (activeDate) renderAttendanceList(activeDate);
  });
}

function renderCalendar() {
  const body = document.getElementById("calendar-body");
  if (!body) return;
  body.innerHTML = "";

  const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });
  document.getElementById("month-label").textContent = `${monthName} ${currentYear}`;

  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  let row = document.createElement('tr');
  let started = false;

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) continue;

    const dayIndex = (weekday + 6) % 7;
    if (!started) {
      for (let e = 0; e < dayIndex; e++) row.appendChild(document.createElement('td'));
      started = true;
    }

    const cell = document.createElement('td');
    const dateKey = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cell.innerHTML = `<span class="day-number">${day}</span><div id="list-${dateKey}" class="request-list"></div>`;
    cell.onclick = () => openAttendanceModal(dateKey);
    row.appendChild(cell);

    if (dayIndex === 4) {
      body.appendChild(row);
      row = document.createElement('tr');
      started = false;
    }
  }
  if (row.children.length) body.appendChild(row);

  // Populate entries
  Object.keys(requests).forEach(dateKey => {
    const container = document.getElementById(`list-${dateKey}`);
    if (container) {
      periods.forEach(p => {
        const periodRequests = requests[dateKey].filter(r => r.period === p);
        if (periodRequests.length > 0) {
          periodRequests.forEach(req => {
            const item = document.createElement('div');
            item.className = 'request-item';
            const teacherDisplay = req.teacher ? req.teacher : 'Student';
            const studDisplay = req.studentNames ? req.studentNames : 'Teacher';
            item.textContent = `${req.period}: ${req.num || 1} std (${teacherDisplay}), Students: (${studDisplay})`;
            container.appendChild(item);
          });
        }
      });
    }
  });
}

function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
}

function openAttendanceModal(dateKey) {
  activeDate = dateKey;
  document.getElementById('modal-date').textContent = `Roster for ${dateKey}`;
  renderAttendanceList(dateKey);
  document.getElementById('attendance-modal').style.display = 'flex';
}

function renderAttendanceList(dateKey) {
  const container = document.getElementById('attendance-roster-list');
  container.innerHTML = '';

  const dayRequests = requests[dateKey] || [];

  if (dayRequests.length === 0) {
    container.innerHTML = `<div class="empty-msg">No students scheduled for this date (All present or clear).</div>`;
    return;
  }

  dayRequests.forEach(req => {
    const card = document.createElement('div');
    card.className = 'attendance-card';
    
    const info = document.createElement('div');
    const teacherDisplay = req.teacherEmail ? req.teacherEmail : 'N/A';
    info.innerHTML = `
      <strong>${req.period} — ${req.num || 1} Student(s)</strong>
      <p><strong>Staff/Notes:</strong> ${req.notes || teacherDisplay}</p>
    `;

    const btn = document.createElement('button');
    btn.className = 'mark-present-btn';
    btn.textContent = '✓ Mark Present';
    btn.onclick = () => markPresentAndRemove(req.id);

    card.appendChild(info);
    card.appendChild(btn);
    container.appendChild(card);
  });
}

// Removes document from Firestore upon checking student present
async function markPresentAndRemove(docId) {
  try {
    await db.collection("requests").doc(docId).delete();
  } catch(e) {
    alert("Error marking student present: " + e.message);
  }
}

function closeModal() {
  activeDate = null;
  document.getElementById('attendance-modal').style.display = 'none';
}

// Attach event listeners after DOM loads
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("prev-month-btn").addEventListener("click", () => changeMonth(-1));
  document.getElementById("next-month-btn").addEventListener("click", () => changeMonth(1));
  document.getElementById("close-modal-btn").addEventListener("click", closeModal);
  
  // Start Firestore Listener
  startRealtimeListener();
});