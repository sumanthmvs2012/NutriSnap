const $ = (id) => document.getElementById(id);
let selectedPhoto = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function showSampleResult() {
  $('scanResult').hidden = false;
  $('scanResult').innerHTML =
    '<strong>Sample only: Grilled chicken bowl</strong><br>' +
    '520 kcal · Protein 42g · Carbs 53g · Fat 15g<br>' +
    '<button class="result-add">Add sample to today’s log</button>';

  document.querySelector('.result-add').addEventListener('click', () => {
    addMeal({
      icon: '🧪',
      name: 'Sample: grilled chicken bowl',
      detail: 'Illustration only',
      calories: 520,
      protein: 42,
      carbs: 53,
      fat: 15
    });
    $('scanResult').innerHTML = '<strong>Sample added ✓</strong>';
  });
}

async function analyzePhoto() {
  if (!selectedPhoto) return;

  const button = $('demoScan');
  const result = $('scanResult');

  button.disabled = true;
  result.hidden = false;
  result.textContent = 'Analyzing the photo…';


  try {
    const bytes = new Uint8Array(await selectedPhoto.arrayBuffer());
    let binary = '';

    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mimeType: selectedPhoto.type || 'image/jpeg',
        data: btoa(binary)
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Photo analysis failed.');
    }

    const name = payload.name || 'Food or drink';
    const calories = Math.max(0, Number(payload.estimated_calories) || 0);
    const protein = Math.max(0, Number(payload.protein_g) || 0);
    const carbs = Math.max(0, Number(payload.carbs_g) || 0);
    const fat = Math.max(0, Number(payload.fat_g) || 0);

   // ...existing code...
    const icon = { 'Good': '✅', 'Okay': '🟡', 'Not so good': '⚠️' }[payload.health_verdict] || 'ℹ️';
    const ingredients = (payload.ingredients || []).map(escapeHtml).join(', ');
    const alternatives = (payload.alternatives || []).map(escapeHtml).join(', ');

    result.innerHTML =
      `<strong>${escapeHtml(name)}</strong><br>` +
      `<span>AI estimate · ${escapeHtml(payload.confidence || 'low')} confidence</span><br>` +
      `${calories} kcal · Protein ${protein}g · Carbs ${carbs}g · Fat ${fat}g<br>` +
      `Estimated weight: ~${Number(payload.estimated_weight_g) || 0} g` +
      `<p><b>Ingredients:</b> ${ingredients}</p>` +
      `<p><b>${icon} ${escapeHtml(payload.health_verdict || '')}:</b> ${escapeHtml(payload.health_note || '')}</p>` +
      (alternatives ? `<p><small>Could also be: ${alternatives}</small></p>` : '') +
      `<p><b>Assumptions:</b> ${escapeHtml(payload.assumptions || 'Ingredients or serving size may be uncertain.')}</p>` +
      '<button class="result-add">Review and add to log</button>';
// ...existing code...

    document.querySelector('.result-add').addEventListener('click', () => {
      $('mealName').value = name;
      $('mealCals').value = calories;
      $('mealProtein').value = protein;
      $('mealCarbs').value = carbs;
      $('mealFat').value = fat;
      $('mealDialog').showModal();
    });

  } catch (error) {
    result.textContent = `Could not analyze the photo: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

$('demoScan').addEventListener('click', () => {
  selectedPhoto ? analyzePhoto() : showSampleResult();
});

$('photoInput').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    $('scanResult').hidden = false;
    $('scanResult').textContent = 'Choose a JPG, PNG, or WebP photo.';
    return;
  }

  if (file.size > 7 * 1024 * 1024) {
    $('scanResult').hidden = false;
    $('scanResult').textContent = 'Choose an image smaller than 7 MB.';
    return;
  }

  selectedPhoto = file;

  if ($('foodPreview').dataset.objectUrl) {
    URL.revokeObjectURL($('foodPreview').dataset.objectUrl);
  }

  const url = URL.createObjectURL(file);
  $('foodPreview').dataset.objectUrl = url;
  $('foodPreview').src = url;
  $('foodPreview').hidden = false;
  $('uploadPrompt').hidden = true;
  $('clearPhoto').hidden = false;
  $('scanResult').hidden = true;
  $('demoScan').textContent = 'Analyze this photo';
});

$('clearPhoto').addEventListener('click', () => {
  $('photoInput').value = '';
  selectedPhoto = null;

  if ($('foodPreview').dataset.objectUrl) {
    URL.revokeObjectURL($('foodPreview').dataset.objectUrl);
  }

  $('foodPreview').removeAttribute('src');
  $('foodPreview').removeAttribute('data-object-url');
  $('foodPreview').hidden = true;
  $('uploadPrompt').hidden = false;
  $('clearPhoto').hidden = true;
  $('scanResult').hidden = true;
  $('demoScan').textContent = 'Try a sample scan';
});


// ...existing code...
result.textContent = 'Analyzing the photo…';
// ...existing code...

// ---- Meal log, water, dialog (add at the end of the file) ----
const GOALS = { calories: 1800, protein: 120, carbs: 190, fat: 60, water: 8 };
const state = JSON.parse(localStorage.getItem('nutrisnap-state') || 'null') || {
  date: new Date().toDateString(),
  meals: [],
  water: 0
};

if (state.date !== new Date().toDateString()) {
  state.date = new Date().toDateString();
  state.meals = [];
  state.water = 0;
}

function save() {
  localStorage.setItem('nutrisnap-state', JSON.stringify(state));
}

function addMeal(meal) {
  state.meals.push(meal);
  save();
  render();
}

function render() {
  const total = state.meals.reduce((t, m) => ({
    calories: t.calories + m.calories,
    protein: t.protein + m.protein,
    carbs: t.carbs + m.carbs,
    fat: t.fat + m.fat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const pct = (v, g) => Math.min(100, Math.round((v / g) * 100)) + '%';

  $('remainingCalories').textContent = Math.max(0, GOALS.calories - total.calories);
  $('ringCalories').textContent = Math.round(total.calories);
  $('proteinValue').textContent = Math.round(total.protein);
  $('carbValue').textContent = Math.round(total.carbs);
  $('fatValue').textContent = Math.round(total.fat);
  $('waterValue').textContent = state.water;
  $('proteinMeter').style.width = pct(total.protein, GOALS.protein);
  $('carbMeter').style.width = pct(total.carbs, GOALS.carbs);
  $('fatMeter').style.width = pct(total.fat, GOALS.fat);
  $('waterMeter').style.width = pct(state.water, GOALS.water);

  $('mealList').innerHTML = state.meals.length
    ? state.meals.map(m =>
        `<div class="meal-item"><div class="meal-icon">${escapeHtml(m.icon || '🍽️')}</div>` +
        `<div><div class="meal-title">${escapeHtml(m.name)}</div>` +
        `<div class="meal-detail">${escapeHtml(m.detail || `P ${m.protein}g · C ${m.carbs}g · F ${m.fat}g`)}</div></div>` +
        `<div class="meal-calories">${Math.round(m.calories)}<small>kcal</small></div></div>`
      ).join('')
    : '<p class="meal-detail">No meals logged yet.</p>';
}

$('waterBtn').addEventListener('click', () => {
  state.water = Math.min(GOALS.water, state.water + 1);
  save();
  render();
});

$('addMealBtn').addEventListener('click', () => {
  $('mealForm').reset();
  $('mealDialog').showModal();
});

$('closeDialog').addEventListener('click', () => $('mealDialog').close());

$('mealForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('mealName').value.trim();
  if (!name) return;

  addMeal({
    icon: '🍽️',
    name,
    calories: Number($('mealCals').value) || 0,
    protein: Number($('mealProtein').value) || 0,
    carbs: Number($('mealCarbs').value) || 0,
    fat: Number($('mealFat').value) || 0
  });
  $('mealDialog').close();
});

render();