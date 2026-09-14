// ================= 页面核心交互驱动与事件绑定 =================

let currentViewDate = getTodayKey();
let currentViewData = {};
const todayKey = getTodayKey();

function getEmptyDayData() {
  return {
    water: 0,
    waterUpdatedAt: Date.now(),
    lunch: { done: false, time: '', text: '', satiety: '刚好', updatedAt: Date.now() },
    dinner: { done: false, time: '', text: '', satiety: '刚好', updatedAt: Date.now() },
    fitness: { done: false, time: '', text: '', duration: '30~60分钟', updatedAt: Date.now() }
  };
}

// 切换查看的日期
function switchDate(targetDateKey) {
  currentViewDate = targetDateKey;
  const allData = getStoredData();
  currentViewData = allData[currentViewDate] || getEmptyDayData();

  const isToday = (currentViewDate === todayKey);
  const isPast = (currentViewDate < todayKey);

  // 顶部提示条控制
  const banner = document.getElementById('historyBanner');
  const bannerText = document.getElementById('historyBannerText');
  if (!isToday) {
    banner.classList.add('active');
    const parts = currentViewDate.split('-');
    bannerText.innerText = '📅 正在查看 ' + parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日 的打卡历史 (只读)';
  } else {
    banner.classList.remove('active');
  }

  // 动态问候语
  const hour = new Date().getHours();
  const greetingEl = document.getElementById('greetingMsg');
  const subGreetingEl = document.getElementById('subGreeting');

  if (isToday) {
    if (hour < 10) greetingEl.innerText = "早安，牛牛！";
    else if (hour < 14) greetingEl.innerText = "午安，牛牛！";
    else if (hour < 18) greetingEl.innerText = "下午好，牛牛！";
    else greetingEl.innerText = "晚上好，牛牛！";
    subGreetingEl.innerText = "今天也是认真爱自己的一天";
  } else {
    const parts = currentViewDate.split('-');
    greetingEl.innerText = parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日 打卡记录';
    subGreetingEl.innerText = isPast ? "温习自律的点滴回忆～" : "未来的计划还没到来呢";
  }

  updateStreakBadge();
  renderWater();
  CARD_TYPES.forEach(type => renderCard(type));
}

function updateStreakBadge() {
  const allData = getStoredData();
  let totalValidDays = 0;
  Object.keys(allData).forEach(key => {
    if (getDayLevel(allData[key]) > 0) {
      totalValidDays++;
    }
  });
  document.getElementById('streakBadge').innerText = '已累计打卡 ' + totalValidDays + ' 天';
}

// 渲染喝水组件 (点第几个是几杯，再次点击直接清空归零)
function renderWater() {
  const container = document.getElementById('waterCupsContainer');
  container.innerHTML = '';
  const count = currentViewData.water || 0;
  const isToday = (currentViewDate === todayKey);

  document.getElementById('waterCount').innerText = count + ' / 8 杯 (' + (count * 250) + 'ml)';

  for (let i = 1; i <= 8; i++) {
    const cup = document.createElement('button');
    cup.className = 'cup-btn ' + (i <= count ? 'filled' : '');
    cup.innerText = '💧';
    if (!isToday) {
      cup.disabled = true;
    } else {
      cup.onclick = () => {
        currentViewData.water = (i === currentViewData.water) ? 0 : i;
        currentViewData.waterUpdatedAt = Date.now();
        persistCurrentData();
        renderWater();
        pushToCloud();
      };
    }
    container.appendChild(cup);
  }
}

// 渲染打卡卡片 (午餐、晚餐、健身)
function renderCard(type) {
  const card = document.getElementById('card-' + type);
  if (!card) return;

  const data = currentViewData[type] || (type === 'fitness' 
    ? { done: false, time: '', text: '', duration: '30~60分钟' } 
    : { done: false, time: '', text: '', satiety: '刚好' });

  const timeTag = document.getElementById('time-' + type);
  const input = document.getElementById('input-' + type);
  const btn = card.querySelector('.punch-btn');
  const isToday = (currentViewDate === todayKey);

  // 设置选择器激活项
  const selectorBtns = card.querySelectorAll('.satiety-btn');
  const targetVal = type === 'fitness' ? (data.duration || '30~60分钟') : (data.satiety || '刚好');
  selectorBtns.forEach(b => {
    b.classList.remove('active');
    if (b.dataset.val === targetVal) {
      b.classList.add('active');
    }
    if (!isToday || data.done) {
      b.classList.add('disabled-view');
    } else {
      b.classList.remove('disabled-view');
    }
  });

  const typeName = type === 'lunch' ? '午餐' : (type === 'dinner' ? '晚餐' : '健身');

  if (data.done) {
    card.classList.add('completed');
    if (isToday) {
      card.classList.add('can-undo');
    } else {
      card.classList.remove('can-undo');
    }

    const tagExtra = type === 'fitness' ? ` · ${data.duration || '30~60分钟'}` : (data.satiety ? ` · ${data.satiety}` : '');
    timeTag.innerText = `已打卡 ${data.time}${tagExtra}`;
    input.value = data.text !== undefined ? data.text : '';
    input.disabled = true;
    btn.innerText = '✓ 已完成打卡';
    btn.disabled = true;
    btn.classList.remove('history-locked');
  } else {
    card.classList.remove('completed');
    card.classList.remove('can-undo');
    input.value = data.text !== undefined ? data.text : '';

    if (isToday) {
      input.disabled = false;
      input.placeholder = DEFAULT_PLACEHOLDERS[type] || '请输入打卡内容';
      btn.innerText = type === 'fitness' ? '完成健身打卡' : `完成${typeName}打卡`;
      btn.disabled = false;
      btn.classList.remove('history-locked');
    } else {
      input.disabled = true;
      input.placeholder = '当天空白，未记录打卡';
      btn.innerText = '未打卡 (历史记录已归档)';
      btn.disabled = true;
      btn.classList.add('history-locked');
    }
  }
}

// 修改打卡功能
function undoCard(type) {
  if (currentViewDate !== todayKey) return;
  if (!currentViewData[type] || !currentViewData[type].done) return;

  currentViewData[type].done = false;
  currentViewData[type].time = '';
  currentViewData[type].updatedAt = Date.now();

  persistCurrentData();
  renderCard(type);
  updateStreakBadge();
  pushToCloud();

  const typeName = type === 'lunch' ? '午餐' : (type === 'dinner' ? '晚餐' : '健身');
  showModal(`已切换为修改模式，可以重新编辑${typeName}内容啦～✏️`, "✏️");
}

// 今日打卡动作 (必填校验 + 乐观更新)
function punchCard(type) {
  if (currentViewDate !== todayKey) return;
  if (currentViewData[type] && currentViewData[type].done) return;

  const input = document.getElementById('input-' + type);
  const textVal = input.value.trim();

  // 必填输入校验与活泼提醒
  if (!textVal) {
    if (type === 'fitness') {
      showModal("🏃‍♀️ 抓到一只偷懒小牛！今天练了什么秘密武器？快写上再打卡吧～💪", "👀");
    } else if (type === 'lunch') {
      showModal("🍱 嗷呜！午餐吃了什么美味减脂餐？偷偷告诉我再打卡嘛～😋", "🥢");
    } else if (type === 'dinner') {
      showModal("🍲 晚餐写个名字呗！牛牛今天吃了什么清爽健康的好吃的？🥗", "✨");
    } else {
      showModal("👀 还没有写内容呢，写几个字让某人夸夸你～", "📝");
    }
    input.focus();
    return;
  }

  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  if (!currentViewData[type]) {
    currentViewData[type] = {};
  }
  currentViewData[type].done = true;
  currentViewData[type].time = timeStr;
  currentViewData[type].text = textVal;
  currentViewData[type].updatedAt = Date.now();

  persistCurrentData();
  renderCard(type);
  updateStreakBadge();

  triggerConfetti();
  const randomQuote = cheerQuotes[Math.floor(Math.random() * cheerQuotes.length)];
  showModal(randomQuote, "🎉");

  pushToCloud();
}

function showModal(msg, icon) {
  document.getElementById('modalQuote').innerText = msg;
  document.getElementById('modalIcon').innerText = icon || "🎉";
  document.getElementById('cheerModal').classList.add('active');
}

function closeModal() {
  document.getElementById('cheerModal').classList.remove('active');
}

// 页面初始化逻辑
function initPage() {
  switchDate(todayKey);
  syncFromCloud();

  // 饱腹感 / 健身时长选择器事件绑定
  document.querySelectorAll('.satiety-selector').forEach(container => {
    const itemType = container.dataset.item;
    const btns = container.querySelectorAll('.satiety-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentViewDate !== todayKey) return;
        if (currentViewData[itemType] && currentViewData[itemType].done) return;
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (itemType === 'fitness') {
          currentViewData.fitness.duration = btn.dataset.val;
        } else {
          currentViewData[itemType].satiety = btn.dataset.val;
        }
        if (currentViewData[itemType]) {
          currentViewData[itemType].updatedAt = Date.now();
        }
        persistCurrentData();
        triggerDebouncedCloudSync();
      });
    });
  });

  // ✍️ 实时监听输入框操作（无论是输入、修改还是清空，实时同步）
  CARD_TYPES.forEach(type => {
    const input = document.getElementById('input-' + type);
    if (input) {
      input.addEventListener('input', () => {
        if (currentViewDate !== todayKey) return;
        if (!currentViewData[type]) currentViewData[type] = {};
        currentViewData[type].text = input.value;
        currentViewData[type].updatedAt = Date.now();
        persistCurrentData();
        triggerDebouncedCloudSync();
      });
      input.addEventListener('blur', () => {
        if (currentViewDate !== todayKey) return;
        clearTimeout(cloudSyncDebounceTimer);
        pushToCloud();
      });
    }
  });

  // 牛牛头像专属隐藏彩蛋 (连戳 3 次触发)
  let cowClicks = 0;
  let lastWhisperIdx = -1;
  let cowClickTimer = null;

  document.getElementById('cowAvatar').addEventListener('click', () => {
    cowClicks++;
    clearTimeout(cowClickTimer);
    cowClickTimer = setTimeout(() => { cowClicks = 0; }, 1500);

    if (cowClicks === 3) {
      triggerConfetti();
      let randIdx;
      do {
        randIdx = Math.floor(Math.random() * secretWhispers.length);
      } while (randIdx === lastWhisperIdx && secretWhispers.length > 1);
      lastWhisperIdx = randIdx;

      showModal(secretWhispers[randIdx], "🐮");
      cowClicks = 0;
    }
  });
}

window.onload = initPage;
