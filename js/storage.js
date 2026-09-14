// ================= 数据存取、云端同步与防覆盖合并逻辑 =================

// 日期工具函数
function getTodayKey() {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function formatDate(year, month, day) {
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

// 🧪 测试模式专用的独立内存沙盒（刷新即焚，不污染正式环境）
let sandboxMemoryStore = null;

// 本地存储读取 (测试模式下使用独立沙盒)
function getStoredData() {
  if (IS_TEST_MODE) {
    if (!sandboxMemoryStore) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        sandboxMemoryStore = raw ? JSON.parse(raw) : {};
      } catch (e) {
        sandboxMemoryStore = {};
      }
    }
    return sandboxMemoryStore;
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

// 本地存储保存 (测试模式下仅更新内存，绝不写硬盘)
function saveStoredData(data) {
  if (IS_TEST_MODE) {
    sandboxMemoryStore = data;
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

// 更新云同步状态提示
function setCloudStatus(text, type) {
  const el = document.getElementById('cloudSyncTag');
  if (!el) return;
  el.innerText = text;
  el.className = 'cloud-sync-tag' + (type ? ' ' + type : '');
}

// Upstash REST API 通用调用
async function executeUpstashCommand(commandArray) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + UPSTASH_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commandArray)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

// 智能双向合并规则 (以 updatedAt 时间戳仲裁最新操作，彻底解决文字清空被旧数据覆盖问题)
function mergeData(local, cloud) {
  if (!cloud) return local || {};
  if (!local) return cloud || {};
  const result = { ...local };

  for (const dateKey of Object.keys(cloud)) {
    if (!result[dateKey]) {
      result[dateKey] = cloud[dateKey];
    } else {
      const lDay = result[dateKey];
      const cDay = cloud[dateKey];

      function pickLatestMeal(lMeal, cMeal, defaultVal) {
        if (!lMeal && !cMeal) return defaultVal;
        if (!lMeal) return cMeal;
        if (!cMeal) return lMeal;
        const lTime = lMeal.updatedAt || 0;
        const cTime = cMeal.updatedAt || 0;
        if (lTime !== cTime) {
          return lTime > cTime ? lMeal : cMeal;
        }
        if (lMeal.done && !cMeal.done) return lMeal;
        if (cMeal.done && !lMeal.done) return cMeal;
        return lMeal;
      }

      function pickLatestWaterDay() {
        const lTime = lDay.waterUpdatedAt || 0;
        const cTime = cDay.waterUpdatedAt || 0;
        if (lTime !== cTime) return lTime > cTime ? lDay : cDay;
        const localHasExactMl = lDay.waterMl !== undefined && lDay.waterMl !== null;
        const cloudHasExactMl = cDay.waterMl !== undefined && cDay.waterMl !== null;
        if (localHasExactMl !== cloudHasExactMl) return localHasExactMl ? lDay : cDay;
        return lDay;
      }

      const waterSource = pickLatestWaterDay();
      const sourceWaterMl = waterSource.waterMl !== undefined && waterSource.waterMl !== null
        ? Math.max(0, Math.round(Number(waterSource.waterMl) || 0))
        : Math.max(0, Math.round((Number(waterSource.water) || 0) * 250));

      result[dateKey] = {
        ...cDay,
        ...lDay,
        // 同时保留新版毫升值与旧版杯数，旧页面仍能读取且不会覆盖精确数据
        water: waterSource.water !== undefined ? waterSource.water : sourceWaterMl / 250,
        waterMl: sourceWaterMl,
        waterUpdatedAt: Math.max(lDay.waterUpdatedAt || 0, cDay.waterUpdatedAt || 0),
        lunch: pickLatestMeal(lDay.lunch, cDay.lunch, { done: false, time: '', text: '', satiety: '刚好', updatedAt: 0 }),
        dinner: pickLatestMeal(lDay.dinner, cDay.dinner, { done: false, time: '', text: '', satiety: '刚好', updatedAt: 0 }),
        fitness: pickLatestMeal(lDay.fitness, cDay.fitness, { done: false, time: '', text: '', durationMinutes: null, updatedAt: 0 })
      };
    }
  }
  return result;
}

// 从云端拉取数据并合并
async function syncFromCloud() {
  setCloudStatus('☁️ 同步中...', 'syncing');
  try {
    const response = await executeUpstashCommand(['GET', STORAGE_KEY]);
    const localData = getStoredData();
    let cloudData = null;

    if (response && response.result) {
      try {
        cloudData = JSON.parse(response.result);
      } catch (e) {
        cloudData = null;
      }
    }

    const merged = mergeData(localData, cloudData);
    saveStoredData(merged);

    if (!IS_TEST_MODE && (!cloudData || JSON.stringify(merged) !== JSON.stringify(cloudData))) {
      await executeUpstashCommand(['SET', STORAGE_KEY, JSON.stringify(merged)]);
    }

    if (IS_TEST_MODE) {
      setCloudStatus('🧪 测试模式(不上云)', 'offline');
    } else {
      setCloudStatus('☁️ 已同步', '');
    }
    switchDate(currentViewDate);
  } catch (err) {
    console.warn('云端同步稍后重试:', err);
    setCloudStatus('☁️ 本地模式', 'offline');
  }
}

// 将本地数据推送到云端
async function pushToCloud() {
  if (IS_TEST_MODE) {
    console.log('【测试模式激活】打卡操作不会上传云端');
    setCloudStatus('🧪 测试中(不上云)', 'offline');
    return;
  }
  setCloudStatus('☁️ 保存中...', 'syncing');
  try {
    const allData = getStoredData();
    await executeUpstashCommand(['SET', STORAGE_KEY, JSON.stringify(allData)]);
    setCloudStatus('☁️ 已同步', '');
  } catch (err) {
    console.warn('云端推送稍后重试:', err);
    setCloudStatus('☁️ 本地待同步', 'offline');
  }
}

// 防抖上传定时器 (输入文字时防抖推流)
let cloudSyncDebounceTimer = null;
function triggerDebouncedCloudSync() {
  clearTimeout(cloudSyncDebounceTimer);
  cloudSyncDebounceTimer = setTimeout(() => {
    pushToCloud();
  }, 600);
}

function persistCurrentData() {
  const allData = getStoredData();
  allData[currentViewDate] = currentViewData;
  saveStoredData(allData);
  if (IS_TEST_MODE) {
    console.log('【测试模式】仅更新沙盒内存，未写入本地正式库，未上传云端');
  }
}
