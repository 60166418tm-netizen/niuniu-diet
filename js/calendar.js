// ================= 日历组件逻辑 (周一至周日自适应网格) =================

let calDisplayYear = new Date().getFullYear();
let calDisplayMonth = new Date().getMonth(); // 0-11

// 计算某一天的打卡完成等级 (0: 未打卡, 1: 1项, 2: 2项, 3: 3项满级)
function getDayLevel(dayRecord) {
  if (!dayRecord) return 0;
  let count = 0;
  if (dayRecord.lunch && dayRecord.lunch.done) count++;
  if (dayRecord.dinner && dayRecord.dinner.done) count++;
  if (dayRecord.fitness && dayRecord.fitness.done) count++;
  return count;
}

// 打开日历 (自动对齐当前视图所在的当月)
function openCalendar() {
  if (currentViewDate) {
    const parts = currentViewDate.split('-');
    calDisplayYear = parseInt(parts[0], 10);
    calDisplayMonth = parseInt(parts[1], 10) - 1;
  } else {
    const now = new Date();
    calDisplayYear = now.getFullYear();
    calDisplayMonth = now.getMonth();
  }
  renderCalendar();
  document.getElementById('calendarOverlay').classList.add('open');
}

function closeCalendar() {
  document.getElementById('calendarOverlay').classList.remove('open');
}

function changeCalMonth(offset) {
  calDisplayMonth += offset;
  if (calDisplayMonth < 0) {
    calDisplayMonth = 11;
    calDisplayYear--;
  } else if (calDisplayMonth > 11) {
    calDisplayMonth = 0;
    calDisplayYear++;
  }
  renderCalendar();
}

function renderCalendar() {
  document.getElementById('calMonthTitle').innerText = calDisplayYear + '年 ' + (calDisplayMonth + 1) + '月';

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const allData = getStoredData();

  // 周一作为一周的第一天，周日作为最后一天
  const firstDayIndex = (new Date(calDisplayYear, calDisplayMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calDisplayYear, calDisplayMonth + 1, 0).getDate();

  // 填充前面的空白
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day-cell empty';
    grid.appendChild(emptyCell);
  }

  // 填充当月每一天的格子
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = formatDate(calDisplayYear, calDisplayMonth + 1, d);
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    cell.innerText = d;

    const isToday = (dateKey === todayKey);
    const isFuture = (dateKey > todayKey);
    const isSelected = (dateKey === currentViewDate);

    if (isToday) cell.classList.add('is-today');
    if (isSelected) cell.classList.add('selected');
    if (isFuture) cell.classList.add('future');

    // 计算该日期的完成等级 (0~3)
    const level = getDayLevel(allData[dateKey]);
    if (level > 0) {
      cell.classList.add('level-' + level);
      const badge = document.createElement('span');
      badge.className = 'day-badge-icon';
      if (level === 1) badge.innerText = '🌱';
      else if (level === 2) badge.innerText = '🌸';
      else if (level === 3) badge.innerText = '👑';
      cell.appendChild(badge);
    }

    if (!isFuture) {
      cell.onclick = () => {
        switchDate(dateKey);
        closeCalendar();
      };
    }

    grid.appendChild(cell);
  }
}
