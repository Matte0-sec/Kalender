// Simple client-side calendar with localStorage persistence
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WEEKDAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];

const calendarEl = document.getElementById('calendar');
const currentMonthEl = document.getElementById('currentMonth');
const currentDateEl = document.getElementById('currentDate');
const prevBtn = document.getElementById('prevMonth');
const nextBtn = document.getElementById('nextMonth');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const eventForm = document.getElementById('eventForm');
const eventDate = document.getElementById('eventDate');
const eventEndDate = document.getElementById('eventEndDate');
const eventType = document.getElementById('eventType');
const eventRecurring = document.getElementById('eventRecurring');
const recurrenceOptions = document.getElementById('recurrenceOptions');
const eventRecurrenceType = document.getElementById('eventRecurrenceType');
const eventRecurrenceEnd = document.getElementById('eventRecurrenceEnd');
const eventTitle = document.getElementById('eventTitle');
const eventDesc = document.getElementById('eventDesc');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Dark mode toggle (button may be present in header)
const darkModeBtn = document.getElementById('darkModeBtn');
let darkMode = false;
try { darkMode = JSON.parse(localStorage.getItem('school-calendar-dark') || 'false'); } catch (e) { darkMode = false; }
function applyDarkMode(val) { if (val) document.documentElement.classList.add('dark-mode'); else document.documentElement.classList.remove('dark-mode'); }
applyDarkMode(darkMode);
if (darkModeBtn) darkModeBtn.addEventListener('click', () => { darkMode = !darkMode; localStorage.setItem('school-calendar-dark', JSON.stringify(darkMode)); applyDarkMode(darkMode); });

let state = {
	viewYear: new Date().getFullYear(),
	viewMonth: new Date().getMonth(), // 0-index
	events: loadEvents(),
	editingId: null,
};

function loadEvents(){
	try{
		let events = JSON.parse(localStorage.getItem('school-calendar-events') || '[]');
		// Migrate old events: if has 'date', convert to 'startDate' and 'endDate'
		events = events.map(ev => {
			if (ev.date && !ev.startDate) {
				ev.startDate = ev.date;
				ev.endDate = ev.date; // single day
				delete ev.date;
			}
			return ev;
		});
		return events;
	}catch(e){return []}
}

function saveEvents(){
	localStorage.setItem('school-calendar-events', JSON.stringify(state.events));
}

function render(){
	calendarEl.innerHTML = '';
	currentMonthEl.textContent = `${MONTHS[state.viewMonth]} ${state.viewYear}`;

	// weekdays header
	const wk = document.createElement('div'); wk.className='weekdays';
	for(let d of WEEKDAYS){ const w = document.createElement('div'); w.textContent=d; wk.appendChild(w);}  
	calendarEl.appendChild(wk);

	const grid = document.createElement('div'); grid.className='grid';

	const firstOfMonth = new Date(state.viewYear, state.viewMonth, 1);
	// JS: Sunday=0, we want Monday-first. Compute offset
	const dayIndex = (firstOfMonth.getDay() + 6) % 7; // 0=Mon

	// previous month's tail
	const prevMonthLastDate = new Date(state.viewYear, state.viewMonth, 0).getDate();
	for(let i=0;i<dayIndex;i++){
		const dateNum = prevMonthLastDate - dayIndex + 1 + i;
		const d = new Date(state.viewYear, state.viewMonth-1, dateNum);
		grid.appendChild(renderDay(d, true));
	}

	// current month
	const daysInMonth = new Date(state.viewYear, state.viewMonth+1, 0).getDate();
	for(let d=1; d<=daysInMonth; d++){
		const date = new Date(state.viewYear, state.viewMonth, d);
		grid.appendChild(renderDay(date, false));
	}

	// next month fill to complete weeks
	while(grid.children.length % 7 !== 0){
		const nextDay = grid.children.length - dayIndex - daysInMonth + 1;
		const date = new Date(state.viewYear, state.viewMonth+1, nextDay);
		grid.appendChild(renderDay(date, true));
	}

	calendarEl.appendChild(grid);
}

function renderDay(date, otherMonth){
	const el = document.createElement('div'); el.className='day';
	if(otherMonth) el.classList.add('other-month');
	const num = document.createElement('div'); num.className='date-num'; num.textContent = date.getDate();
	el.appendChild(num);

	const eventsWrap = document.createElement('div'); eventsWrap.className='events';
	const dayKey = isoDate(date);
	const events = getEventsForDay(dayKey);
	events.forEach(ev => {
			const evEl = document.createElement('div');
			evEl.className = `event ${ev.type}`;
			if (ev.done) evEl.classList.add('done');

			// Title
			const titleSpan = document.createElement('span');
			titleSpan.className = 'event-title';
			titleSpan.textContent = ev.title;
			evEl.appendChild(titleSpan);

			// Done button
			const doneBtn = document.createElement('button');
			doneBtn.type = 'button';
			doneBtn.className = 'done-btn';
			doneBtn.title = 'Als erledigt markieren';
			doneBtn.textContent = ev.done ? '✓' : '○';
			doneBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				// toggle done
				ev.done = !ev.done;
				saveEvents();
				render();
			});
			evEl.appendChild(doneBtn);

			evEl.title = ev.desc || '';
			evEl.dataset.id = ev.id;
			evEl.addEventListener('click', (evnt)=>{ evnt.stopPropagation(); openEditEvent(ev.id); });
			eventsWrap.appendChild(evEl);
	});

	el.appendChild(eventsWrap);

	el.addEventListener('click', ()=>{ openNewEvent(date); });
	return el;
}

function isoDate(d){
	return d.toISOString().slice(0,10);
}

function getEventsForDay(dayKey) {
	let events = [];
	// Add regular events
	state.events.forEach(ev => {
		if (!ev.recurrence && dayKey >= ev.startDate && dayKey <= ev.endDate) {
			events.push(ev);
		}
	});
	// Add recurring instances
	state.events.forEach(ev => {
		if (ev.recurrence && ev.recurrence.type === 'weekly') {
			const start = new Date(ev.startDate);
			const end = new Date(ev.recurrence.endDate);
			const target = new Date(dayKey);
			if (target >= start && target <= end) {
				const dayOfWeek = target.getDay(); // 0=Sun, 1=Mon, etc.
				if (ev.recurrence.weekdays.includes(dayOfWeek)) {
					// Create instance
					events.push({ ...ev, instanceDate: dayKey });
				}
			}
		}
	});
	return events;
}

function openNewEvent(date){
	state.editingId = null;
	modalTitle.textContent = 'Ereignis hinzufügen';
	deleteBtn.classList.add('hidden');
	eventDate.value = isoDate(date);
	eventEndDate.value = '';
	eventType.value = 'hausaufgabe';
	eventRecurring.checked = false;
	recurrenceOptions.style.display = 'none';
	eventRecurrenceType.value = 'weekly';
	document.querySelectorAll('.weekday').forEach(cb => cb.checked = false);
	eventRecurrenceEnd.value = '';
	eventTitle.value = '';
	eventDesc.value = '';
	showModal();
}

function openEditEvent(id){
	const ev = state.events.find(x=>x.id===id);
	if(!ev) return;
	state.editingId = id;
	modalTitle.textContent = 'Ereignis bearbeiten';
	deleteBtn.classList.remove('hidden');
	eventDate.value = ev.startDate;
	eventEndDate.value = ev.endDate || '';
	eventType.value = ev.type;
	eventRecurring.checked = !!ev.recurrence;
	recurrenceOptions.style.display = ev.recurrence ? 'block' : 'none';
	if (ev.recurrence) {
		eventRecurrenceType.value = ev.recurrence.type;
		document.querySelectorAll('.weekday').forEach(cb => cb.checked = ev.recurrence.weekdays.includes(parseInt(cb.value)));
		eventRecurrenceEnd.value = ev.recurrence.endDate || '';
	}
	eventTitle.value = ev.title;
	eventDesc.value = ev.desc || '';
	showModal();
}

function showModal(){ modal.classList.remove('hidden'); }
function closeModal(){ modal.classList.add('hidden'); state.editingId=null; }

eventForm.addEventListener('submit',(e)=>{
	e.preventDefault();
	const startDate = eventDate.value;
	const endDate = eventEndDate.value || startDate; // if no end, use start
	if (endDate < startDate) return alert('Enddatum darf nicht vor Startdatum liegen');
	let recurrence = null;
	if (eventRecurring.checked) {
		const weekdays = Array.from(document.querySelectorAll('.weekday:checked')).map(cb => parseInt(cb.value));
		if (weekdays.length === 0) return alert('Bitte mindestens einen Wochentag auswählen');
		const recurrenceEnd = eventRecurrenceEnd.value;
		if (!recurrenceEnd) return alert('Bitte Wiederholungs-Enddatum angeben');
		recurrence = { type: eventRecurrenceType.value, weekdays, endDate: recurrenceEnd };
	}
	const data = { startDate, endDate, type: eventType.value, title: eventTitle.value.trim(), desc: eventDesc.value.trim(), recurrence };
	if(!data.title) return alert('Bitte Titel eingeben');

	if(state.editingId){
		// update
		const idx = state.events.findIndex(x=>x.id===state.editingId);
		if(idx>=0){ state.events[idx] = {...state.events[idx], ...data}; }
	}else{
		state.events.push({ id: 'e'+Date.now(), ...data });
	}
	saveEvents();
	closeModal();
	render();
});

deleteBtn.addEventListener('click', ()=>{
	if(!state.editingId) return;
	state.events = state.events.filter(x=>x.id!==state.editingId);
	saveEvents();
	closeModal();
	render();
});

cancelBtn.addEventListener('click', ()=>{ closeModal(); });

prevBtn.addEventListener('click', ()=>{ changeMonth(-1); });
nextBtn.addEventListener('click', ()=>{ changeMonth(1); });

function changeMonth(delta){
	state.viewMonth += delta;
	if(state.viewMonth < 0){ state.viewMonth = 11; state.viewYear--; }
	if(state.viewMonth > 11){ state.viewMonth = 0; state.viewYear++; }
	render();
}

// initial render
render();

// Sidebar / todo panel logic
const sidebarToggle = document.getElementById('sidebarToggle');
const todoPanel = document.getElementById('todoPanel');
const todoList = document.getElementById('todoList');
const todoFilterEl = document.getElementById('todoFilter');

let todoFilter = 'offen'; // default to open tasks

function refreshTodoList(){
	if(!todoList) return;
	todoList.innerHTML = '';
	let todos = state.events.sort((a,b)=> a.startDate.localeCompare(b.startDate));
	if(todoFilter === 'offen') todos = todos.filter(e => !e.done);
	else if(todoFilter === 'erledigt') todos = todos.filter(e => e.done);
	// 'alle' shows all
	if(todos.length === 0){
		const li = document.createElement('li'); li.textContent = 'Keine Aufgaben'; todoList.appendChild(li); return;
	}
	todos.forEach(ev => {
		const li = document.createElement('li');
		const dateStr = ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} bis ${ev.endDate}`;
		li.textContent = `${dateStr} — ${ev.title}`;
		const btn = document.createElement('button'); btn.className='jump'; btn.textContent='Öffnen';
		btn.addEventListener('click',(e)=>{ e.stopPropagation(); openEditEvent(ev.id); });
		li.appendChild(btn);
		li.addEventListener('click', ()=> openEditEvent(ev.id));
		todoList.appendChild(li);
	});
}

if(sidebarToggle){
	sidebarToggle.addEventListener('click', ()=>{
		if(!todoPanel) return;
		const isHidden = todoPanel.classList.toggle('hidden');
		sidebarToggle.setAttribute('aria-expanded', !isHidden);
		todoPanel.setAttribute('aria-hidden', isHidden);
		if(!isHidden) refreshTodoList();
	});
}

if(todoFilterEl){
	todoFilterEl.addEventListener('change', (e) => {
		todoFilter = e.target.value;
		refreshTodoList();
	});
}

// Recurring event checkbox toggle
if(eventRecurring){
	eventRecurring.addEventListener('change', (e) => {
		recurrenceOptions.style.display = e.target.checked ? 'block' : 'none';
	});
}

// refresh todo list when events change
const originalSaveEvents = saveEvents;
saveEvents = function(){ originalSaveEvents(); refreshTodoList(); };

// Set current date
function setCurrentDate() {
	if (currentDateEl) {
		const now = new Date();
		const day = now.getDate();
		const month = MONTHS[now.getMonth()];
		const year = now.getFullYear();
		currentDateEl.textContent = `Heute: ${day}. ${month} ${year}`;
	}
}

// initial populate
refreshTodoList();
setCurrentDate();
