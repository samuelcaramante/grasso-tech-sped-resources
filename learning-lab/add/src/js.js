// ----- Firebase Configuration -----
const firebaseConfig = {
  apiKey: "AIzaSyBzqUu_saUN1K87ZzWwqWIDbwAzqPHBDFo",
  authDomain: "special-education-resources.firebaseapp.com",
  projectId: "special-education-resources",
  storageBucket: "special-education-resources.firebasestorage.app",
  messagingSenderId: "743837753384",
  appId: "1:743837753384:web:c0ab8bad757c2a01bc951d",
  measurementId: "G-7PCZFPY8HH"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// Navigation Functions
function switchTab(evt, tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  evt.currentTarget.classList.add('active');
}

function openCrisisModal() { document.getElementById('crisis-modal').style.display = 'flex'; }
function closeCrisisModal() { document.getElementById('crisis-modal').style.display = 'none'; }

function filterMatrix() {
  const filter = document.getElementById('matrixSearch').value.toLowerCase();
  document.querySelectorAll('.search-target tbody tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(filter) ? '' : 'none';
  });
}

function filterDirectory() {
  const filter = document.getElementById('directorySearch').value.toLowerCase();
  document.querySelectorAll('#directoryTable tbody tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(filter) ? '' : 'none';
  });
}

// Calendar Logic
let requests = {};
let today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let activeDate = null;

const MAX_CAPACITY = 13;
const periods = ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5", "Period 6", "Period 7"];

function startRealtimeListener() {
  db.collection("requests").onSnapshot(snapshot => {
    requests = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!requests[data.dateKey]) requests[data.dateKey] = [];
      requests[data.dateKey].push(data);
    });
    renderCalendar();
  }, error => {
    console.error("Firestore listener error:", error);
  });
}

// Get aggregate total of students per period for a specific date
function getPeriodTotals(dateKey) {
  const totals = {};
  periods.forEach(p => totals[p] = 0);
  
  if (requests[dateKey]) {
    requests[dateKey].forEach(req => {
      if (totals[req.period] !== undefined) {
        totals[req.period] += (parseInt(req.num, 10) || 0);
      }
    });
  }
  return totals;
}

// Determine status color class based on student count
function getStatusClass(total) {
  if (total >= 1 && total <= 6) return 'status-green';
  if (total >= 7 && total <= 10) return 'status-yellow';
  if (total >= 11 && total <= 13) return 'status-red';
  if (total > 13) return 'status-full';
  return '';
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
    if (weekday === 0 || weekday === 6) continue; // Skip weekends

    const dayIndex = (weekday + 6) % 7;
    if (!started) {
      for (let e = 0; e < dayIndex; e++) row.appendChild(document.createElement('td'));
      started = true;
    }

    const cell = document.createElement('td');
    const dateKey = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    cell.innerHTML = `<span class="day-number">${day}</span><div id="list-${dateKey}" class="request-list"></div>`;
    cell.onclick = () => openModal(dateKey);
    row.appendChild(cell);

    if (dayIndex === 4) {
      body.appendChild(row);
      row = document.createElement('tr');
      started = false;
    }
  }
  if (row.children.length) body.appendChild(row);

  // Group and display requests color-coded per period
  Object.keys(requests).forEach(dateKey => {
    const container = document.getElementById(`list-${dateKey}`);
    if (container) {
      const periodTotals = getPeriodTotals(dateKey);
      
      // Render entries by period
      periods.forEach(p => {
        const periodRequests = requests[dateKey].filter(r => r.period === p);
        if (periodRequests.length > 0) {
          const totalForPeriod = periodTotals[p];
          const colorClass = getStatusClass(totalForPeriod);

          periodRequests.forEach(req => {
            const item = document.createElement('div');
            item.className = `request-item ${colorClass}`;
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

function openModal(dateKey) {
  activeDate = dateKey;
  document.getElementById('modal-date').textContent = `Request for ${dateKey}`;
  
  const totals = getPeriodTotals(dateKey);
  const select = document.getElementById('period-select');
  
  // Populate dropdown options showing current period occupancy & availability
  select.innerHTML = periods.map(p => {
    const currentCount = totals[p];
    const available = MAX_CAPACITY - currentCount;
    if (available <= 0) {
      return `<option value="${p}" disabled>${p} - FULL (${currentCount}/${MAX_CAPACITY})</option>`;
    } else {
      return `<option value="${p}">${p} - ${currentCount}/${MAX_CAPACITY} booked (${available} seats left)</option>`;
    }
  }).join('');

  // Automatically select first non-disabled option
  const firstAvailable = select.querySelector('option:not([disabled])');
  if (firstAvailable) {
    select.value = firstAvailable.value;
  }

  updateMaxStudents();
  document.getElementById('modal').style.display = 'flex';
}

function handleStudentNamesInput() {
  const namesVal = document.getElementById('student-names').value;
  const namesArray = namesVal.split(',').map(n => n.trim()).filter(n => n.length > 0);
  if (namesArray.length > 0) {
    document.getElementById('student-count').value = namesArray.length;
  }
  updateMaxStudents();
}

function updateMaxStudents() {
  const select = document.getElementById('period-select');
  if (!select.value) return;

  const period = select.value;
  const totals = getPeriodTotals(activeDate);
  const currentCount = totals[period] || 0;
  const seatsLeft = Math.max(0, MAX_CAPACITY - currentCount);
  
  const studentInput = document.getElementById('student-count');
  const warning = document.getElementById('seat-warning');
  const submitBtn = document.getElementById('submit-btn');

  studentInput.max = seatsLeft;
  if (seatsLeft <= 0) {
    studentInput.value = 0;
    warning.textContent = "This period has reached full capacity (13 students).";
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
  } else {
    if (parseInt(studentInput.value, 10) > seatsLeft) {
      studentInput.value = seatsLeft;
    }
    if (parseInt(studentInput.value, 10) < 1) {
      studentInput.value = 1;
    }
    warning.textContent = `Maximum ${seatsLeft} additional student(s) can be added.`;
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('teacher-name').value = '';
  document.getElementById('student-names').value = '';
  document.getElementById('notes').value = '';
}

async function submitRequest() {
  const period = document.getElementById('period-select').value;
  const num = parseInt(document.getElementById('student-count').value, 10);
  const teacher = document.getElementById('teacher-name').value;
  const studentNamesRaw = document.getElementById('student-names').value;
  const notes = document.getElementById('notes').value;

  if (!teacher.trim()) {
    alert("Please enter your name/teacher name.");
    return;
  }

  // Validate student first and last names
  const studentList = studentNamesRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  if (studentList.length === 0) {
    alert("Please enter at least one student's first and last name.");
    return;
  }

  const invalidNames = studentList.filter(name => name.split(/\s+/).length < 2);
  if (invalidNames.length > 0) {
    alert(`Please provide both FIRST and LAST names for all students. Invalid entries: "${invalidNames.join(', ')}"`);
    return;
  }

  // Validate Capacity Cap before submitting
  const totals = getPeriodTotals(activeDate);
  const currentTotal = totals[period] || 0;
  
  if (currentTotal + num > MAX_CAPACITY) {
    alert(`Cannot submit: Adding ${num} student(s) would exceed the maximum limit of 13 students for ${period}. Only ${MAX_CAPACITY - currentTotal} seat(s) remaining.`);
    return;
  }

  try {
    await db.collection("requests").add({
      dateKey: activeDate,
      period,
      num,
      teacher,
      studentNames: studentList.join(', '),
      notes,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeModal();
  } catch(e) {
    alert("Error saving request: " + e.message);
  }
}

// Initial Run
startRealtimeListener();