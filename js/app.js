// ================= 页面核心交互驱动与事件绑定 =================

let currentViewDate = getTodayKey();
let currentViewData = {};
const todayKey = getTodayKey();

function getEmptyDayData() {
  return {
    water: 0,
    waterMl: 0,
    waterUpdatedAt: Date.now(),
    lunch: { done: false, time: '', text: '', satiety: '刚好', updatedAt: Date.now() },
    dinner: { done: false, time: '', text: '', satiety: '刚好', updatedAt: Date.now() },
    fitness: { done: false, time: '', text: '', durationMinutes: null, updatedAt: Date.now() }
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

// 兼容旧版“杯数”数据，新版统一以毫升展示
function getWaterAmountMl(dayData) {
  if (dayData && dayData.waterMl !== undefined && dayData.waterMl !== null && dayData.waterMl !== '') {
    const exactMl = Number(dayData.waterMl);
    if (Number.isFinite(exactMl)) return Math.max(0, Math.round(exactMl));
  }
  const legacyCups = Number(dayData && dayData.water);
  return Number.isFinite(legacyCups) ? Math.max(0, Math.round(legacyCups * 250)) : 0;
}

function getWaterMessage(amountMl) {
  if (amountMl <= 0) return '水壶还空空的，等牛牛来装满它～';
  if (amountMl < WATER_HALF_ML) return '每一口都算数，水位正在陪牛牛慢慢长高 💧';
  if (amountMl < WATER_TARGET_ML) return '已经超过今日一半啦，稳稳补水的牛牛真棒 🌊';
  return '1500ml 建议目标达成！今天的牛牛水润润 ✨';
}

function updateWaterVisual(amountMl) {
  const safeAmount = Math.max(0, Math.min(Number(amountMl) || 0, WATER_INPUT_MAX_ML));
  const fillPercent = Math.min(safeAmount / WATER_JUG_CAPACITY_ML * 100, 100);
  const fill = document.getElementById('waterFill');
  const jug = document.getElementById('waterJug');
  if (fill) fill.style.height = fillPercent + '%';
  if (jug) {
    jug.classList.toggle('goal-reached', safeAmount >= WATER_TARGET_ML);
    jug.setAttribute('aria-label', `今日饮水量 ${Math.round(safeAmount)} 毫升`);
  }
  document.getElementById('waterCount').innerText = Math.round(safeAmount) + ' ml';
  document.getElementById('waterMessage').innerText = getWaterMessage(safeAmount);
}

// 渲染精确喝水组件
function renderWater() {
  const amountMl = getWaterAmountMl(currentViewData);
  const isToday = (currentViewDate === todayKey);
  const input = document.getElementById('waterInput');
  const saveBtn = document.getElementById('waterSaveBtn');

  input.value = amountMl || '';
  input.disabled = !isToday;
  saveBtn.disabled = !isToday;
  saveBtn.innerText = isToday ? '保存今日水量' : '历史记录';
  updateWaterVisual(amountMl);
  if (!isToday) {
    document.getElementById('waterMessage').innerText = amountMl > 0
      ? `当日记录了 ${amountMl} ml 饮水量。`
      : '当日没有记录饮水量。';
  }
}

function saveWaterAmount() {
  if (currentViewDate !== todayKey) return;
  const input = document.getElementById('waterInput');
  const rawValue = input.value.trim();
  const amountMl = Number(rawValue);
  if (rawValue === '' || !Number.isFinite(amountMl) || amountMl < 0 || amountMl > WATER_INPUT_MAX_ML) {
    showModal(`请输入 0～${WATER_INPUT_MAX_ML} 之间的饮水量哦～`, '💧');
    input.focus();
    return;
  }

  const roundedMl = Math.round(amountMl);
  const previousMl = getWaterAmountMl(currentViewData);
  currentViewData.waterMl = roundedMl;
  currentViewData.water = roundedMl / 250;
  currentViewData.waterUpdatedAt = Date.now();
  persistCurrentData();
  renderWater();
  pushToCloud();

  if (previousMl < WATER_TARGET_ML && roundedMl >= WATER_TARGET_ML) {
    triggerConfetti();
    showModal('今日 1500ml 饮水目标达成！水润润的牛牛也太棒啦～', '💦');
  }
}

function getLegacyDurationBucket(minutes) {
  if (minutes < 30) return '30分钟以内';
  if (minutes < 60) return '30~60分钟';
  if (minutes < 90) return '60~90分钟';
  return '90分钟以上';
}

function getFitnessDurationMinutes(data) {
  const minutes = Number(data && data.durationMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;
}

function getFitnessDurationLabel(data) {
  const minutes = getFitnessDurationMinutes(data);
  if (minutes !== null) return minutes + '分钟';
  return data && data.duration ? data.duration : '';
}

function getFitnessDurationQuote(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '填入准确时长，看看今天会收到哪句夸夸～';
  }
  const level = minutes < 30 ? 'light' : (minutes < 60 ? 'steady' : (minutes < 90 ? 'strong' : 'champion'));
  const quotes = fitnessDurationQuotes[level];
  return quotes[Math.floor(minutes / 5) % quotes.length];
}

function updateFitnessDurationPreview(minutes, legacyDuration) {
  const quote = document.getElementById('fitnessDurationQuote');
  if (!quote) return;
  if ((!Number.isFinite(minutes) || minutes <= 0) && legacyDuration) {
    quote.innerText = `此前记录：${legacyDuration}。重新修改时可填写准确分钟。`;
    return;
  }
  quote.innerText = getFitnessDurationQuote(minutes);
}

// 渲染打卡卡片 (午餐、晚餐、健身)
function renderCard(type) {
  const card = document.getElementById('card-' + type);
  if (!card) return;

  const data = currentViewData[type] || (type === 'fitness'
    ? { done: false, time: '', text: '', durationMinutes: null }
    : { done: false, time: '', text: '', satiety: '刚好' });

  const timeTag = document.getElementById('time-' + type);
  const input = document.getElementById('input-' + type);
  const btn = card.querySelector('.punch-btn');
  const isToday = (currentViewDate === todayKey);

  // 设置午晚餐饱腹感选择器
  if (type !== 'fitness') {
    const selectorBtns = card.querySelectorAll('.satiety-btn');
    const targetVal = data.satiety || '刚好';
    selectorBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.val === targetVal);
      b.classList.toggle('disabled-view', !isToday || data.done);
    });
  }

  if (type === 'fitness') {
    const durationInput = document.getElementById('fitnessDurationInput');
    const durationMinutes = getFitnessDurationMinutes(data);
    durationInput.value = durationMinutes === null ? '' : durationMinutes;
    durationInput.disabled = !isToday || data.done;
    updateFitnessDurationPreview(durationMinutes, data.duration);
  }

  const typeName = type === 'lunch' ? '午餐' : (type === 'dinner' ? '晚餐' : '健身');

  if (data.done) {
    card.classList.add('completed');
    if (isToday) {
      card.classList.add('can-undo');
    } else {
      card.classList.remove('can-undo');
    }

    const durationLabel = getFitnessDurationLabel(data);
    const tagExtra = type === 'fitness' ? (durationLabel ? ` · ${durationLabel}` : '') : (data.satiety ? ` · ${data.satiety}` : '');
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

  let fitnessMinutes = null;
  if (type === 'fitness') {
    const durationInput = document.getElementById('fitnessDurationInput');
    fitnessMinutes = Number(durationInput.value);
    if (!Number.isInteger(fitnessMinutes) || fitnessMinutes < 1 || fitnessMinutes > 600) {
      showModal('请输入 1～600 之间的准确运动分钟数哦～', '⏱️');
      durationInput.focus();
      return;
    }
  }

  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  if (!currentViewData[type]) {
    currentViewData[type] = {};
  }
  currentViewData[type].done = true;
  currentViewData[type].time = timeStr;
  currentViewData[type].text = textVal;
  if (type === 'fitness') {
    currentViewData[type].durationMinutes = fitnessMinutes;
    // 保留一个旧版区间字段，防止仍打开的旧页面无法识别新记录
    currentViewData[type].duration = getLegacyDurationBucket(fitnessMinutes);
  }
  currentViewData[type].updatedAt = Date.now();

  persistCurrentData();
  renderCard(type);
  updateStreakBadge();

  triggerConfetti();
  const randomQuote = type === 'fitness'
    ? getFitnessDurationQuote(fitnessMinutes)
    : cheerQuotes[Math.floor(Math.random() * cheerQuotes.length)];
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

  // 午晚餐饱腹感选择器事件绑定
  document.querySelectorAll('.satiety-selector').forEach(container => {
    const itemType = container.dataset.item;
    const btns = container.querySelectorAll('.satiety-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (currentViewDate !== todayKey) return;
        if (currentViewData[itemType] && currentViewData[itemType].done) return;
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentViewData[itemType].satiety = btn.dataset.val;
        if (currentViewData[itemType]) {
          currentViewData[itemType].updatedAt = Date.now();
        }
        persistCurrentData();
        triggerDebouncedCloudSync();
      });
    });
  });

  // 喝水输入时先实时预览水位，点击保存或按回车后才写入数据
  const waterInput = document.getElementById('waterInput');
  waterInput.addEventListener('input', () => {
    if (currentViewDate !== todayKey) return;
    const previewMl = Number(waterInput.value);
    updateWaterVisual(Number.isFinite(previewMl) && previewMl >= 0 ? previewMl : 0);
  });
  waterInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveWaterAmount();
    }
  });

  // 精确健身分钟数实时保存，并同步刷新小标语
  const durationInput = document.getElementById('fitnessDurationInput');
  durationInput.addEventListener('input', () => {
    if (currentViewDate !== todayKey) return;
    if (currentViewData.fitness && currentViewData.fitness.done) return;
    if (!currentViewData.fitness) currentViewData.fitness = {};
    const minutes = Number(durationInput.value);
    const validMinutes = Number.isInteger(minutes) && minutes > 0 && minutes <= 600 ? minutes : null;
    currentViewData.fitness.durationMinutes = validMinutes;
    if (validMinutes !== null) currentViewData.fitness.duration = getLegacyDurationBucket(validMinutes);
    currentViewData.fitness.updatedAt = Date.now();
    updateFitnessDurationPreview(validMinutes, validMinutes === null ? null : currentViewData.fitness.duration);
    persistCurrentData();
    triggerDebouncedCloudSync();
  });
  durationInput.addEventListener('blur', () => {
    if (currentViewDate !== todayKey) return;
    clearTimeout(cloudSyncDebounceTimer);
    pushToCloud();
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
