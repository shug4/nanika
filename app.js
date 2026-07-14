const el = id => document.getElementById(id);
let raw = [], families = [], groups = [], currentGroup = "", currentWords = [], currentColor = { name: "桃", hex: "#F472B6" };
let randomSeed = 1, ratings = [], savedOnly = [], currentSceneId = "";
let pendingComfort = "", pendingRecall = "", pendingTag = "";

function parseCsv(t) {
    const lines = t.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const h = lines.shift().split(",").map(s => s.trim());
    const idx = {}; h.forEach((x, i) => idx[x] = i);
    return lines.map(line => {
        const c = line.split(",").map(s => s.trim());
        return {
            id: c[idx.id], cue_family: c[idx.cue_family], cue_group: c[idx.cue_group],
            default_color: c[idx.default_color], default_color_hex: c[idx.default_color_hex],
            word: c.slice(idx.word).join(",").trim()
        };
    }).filter(x => x.id && x.cue_family && x.cue_group && x.word);
}

function seeded(seed) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }
function shuffle(a, seed) {
    a = a.slice();
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
function refreshSelectors() {
    raw = parseCsv(el("stimuliCsv").value);
    families = [...new Set(raw.map(x => x.cue_family))];
    groups = [...new Set(raw.map(x => x.cue_group))];
    const prevFam = el("family").value;
    el("family").innerHTML = "";
    families.forEach(f => { const op = document.createElement("option"); op.value = f; op.textContent = f; el("family").appendChild(op); });
    if (families.includes(prevFam)) el("family").value = prevFam;
    else if (families.length) el("family").value = families[0];
    refreshGroups();
    el("groupCount").textContent = String(groups.length);
}
function refreshGroups() {
    const fam = el("family").value;
    const prev = el("group").value;
    const filtered = groups.filter(g => raw.find(x => x.cue_group === g)?.cue_family === fam);
    el("group").innerHTML = "";
    filtered.forEach(g => { const s = raw.find(x => x.cue_group === g); const op = document.createElement("option"); op.value = g; op.textContent = `${g} / ${s?.default_color || ""}`; el("group").appendChild(op); });
    if (filtered.includes(prev)) el("group").value = prev;
    else if (filtered.length) el("group").value = filtered[0];
}
function pickGroup() {
    if (el("mode").value === "selectedGroup") return el("group").value;
    let pool = groups;
    if (el("mode").value === "selectedFamily") {
        const f = el("family").value;
        pool = groups.filter(g => raw.find(x => x.cue_group === g)?.cue_family === f);
    }
    const i = Math.floor(seeded(randomSeed * 19 + 5) * pool.length);
    return pool[i] || el("group").value;
}
function randomizeScene() {
    randomSeed++;
    currentGroup = pickGroup();
    const items = raw.filter(x => x.cue_group === currentGroup);
    const sample = items[0];
    if (sample) { el("family").value = sample.cue_family; refreshGroups(); el("group").value = currentGroup; }
    currentColor = { name: sample?.default_color || "桃", hex: sample?.default_color_hex || "#F472B6" };
    const n = Number(el("displayCount").value);
    currentWords = shuffle(items, randomSeed * 101).slice(0, Math.min(n, items.length));
    currentSceneId = `${Date.now()}_${randomSeed}_${currentGroup}`;
    pendingComfort = ""; pendingRecall = ""; pendingTag = "";
    render();
}
function changeGroup(delta) {
    const opts = Array.from(el("group").options).map(o => o.value);
    if (!opts.length) return;
    let idx = opts.indexOf(el("group").value);
    if (idx < 0) idx = 0;
    idx = (idx + delta + opts.length) % opts.length;
    el("mode").value = "selectedGroup";
    el("group").value = opts[idx];
    randomizeScene();
}
function renderField() {
    const f = el("field"); f.innerHTML = "";
    if (!currentWords.length) return;
    document.documentElement.style.setProperty("--hue", currentColor.hex);
    const density = el("density").value;
    const mult = density === "light" ? 1 : density === "normal" ? 2 : 3;
    const total = Math.max(currentWords.length, Number(el("displayCount").value) * mult);
    const layers = [
        { c: Math.ceil(total * .55), min: .65, max: 1.05, op: .12, blur: 1.2, xMin: 6, xMax: 94, yMin: 8, yMax: 90 },
        { c: Math.ceil(total * .33), min: 1.05, max: 1.65, op: .22, blur: .35, xMin: 10, xMax: 90, yMin: 12, yMax: 86 },
        { c: Math.ceil(total * .12), min: 1.55, max: 2.35, op: .34, blur: 0, xMin: 18, xMax: 82, yMin: 18, yMax: 78 }
    ];
    const fontScale = Number(el("fontScale").value), driftScale = Number(el("driftScale").value);
    let idx = 0;
    layers.forEach((layer, li) => {
        const cols = Math.max(3, Math.ceil(Math.sqrt(layer.c * 1.7)));
        const rows = Math.max(2, Math.ceil(layer.c / cols));
        const spanX = layer.xMax - layer.xMin, spanY = layer.yMax - layer.yMin;
        for (let i = 0; i < layer.c; i++) {
            const item = currentWords[(idx + i) % currentWords.length];
            const d = document.createElement("div"); d.className = "spaceWord"; d.textContent = item.word;
            const col = Math.floor(seeded((randomSeed + 3) * (i + 1) * (li + 5)) * cols);
            const row = Math.floor(seeded((randomSeed + 5) * (i + 1) * (li + 7)) * rows);
            const baseX = layer.xMin + ((col + .5) / cols) * spanX;
            const baseY = layer.yMin + ((row + .5) / rows) * spanY;
            const x = Math.max(4, Math.min(96, baseX + (seeded((randomSeed + 7) * (i + 1) * (li + 11)) * 2 - 1) * (spanX / cols) * .52));
            const y = Math.max(6, Math.min(92, baseY + (seeded((randomSeed + 9) * (i + 1) * (li + 13)) * 2 - 1) * (spanY / rows) * .48));
            const fs = (15 + seeded((randomSeed + 11) * (i + 1) * 37) * 20) * fontScale * (layer.min + seeded((randomSeed + 13) * (i + 1) * 13) * (layer.max - layer.min));
            const dx = (seeded((randomSeed + 17) * (i + 1) * 29) * 2 - 1) * 30 * driftScale;
            const dy = (seeded((randomSeed + 19) * (i + 1) * 31) * 2 - 1) * 20 * driftScale;
            const dur = 4200 + seeded((randomSeed + 23) * (i + 1) * 23) * 4200;
            const delay = -seeded((randomSeed + 29) * (i + 1) * 17) * 3400;
            d.style.left = `${x}%`; d.style.top = `${y}%`; d.style.fontSize = `${fs}px`;
            d.style.opacity = layer.op + seeded((randomSeed + 31) * (i + 1) * 13) * .16;
            d.style.filter = `blur(${layer.blur}px)`;
            d.style.setProperty("--dx", `${dx}px`); d.style.setProperty("--dy", `${dy}px`);
            d.style.setProperty("--dur", `${dur}ms`); d.style.setProperty("--delay", `${delay}ms`);
            f.appendChild(d);
        }
        idx += layer.c;
    });
}
function rowFor() {
    const s = currentWords[0] || {};
    return {
        timestamp_iso: new Date().toISOString(),
        scene_id: currentSceneId,
        cue_family: s.cue_family || "",
        cue_group: currentGroup,
        color_name: currentColor.name,
        color_hex: currentColor.hex,
        comfort_1_5: pendingComfort,
        automatic_recall_1_5: pendingRecall,
        comfort_kind: pendingTag,
        display_count: currentWords.length,
        density: el("density").value,
        font_scale: el("fontScale").value,
        drift_scale: el("driftScale").value,
        view_context: el("viewContext").value,
        mood_context: el("moodContext").value,
        words_joined: currentWords.map(w => w.word).join(" / ")
    };
}
function commitAndNext() { ratings.push(rowFor()); render(); randomizeScene(); }
function rateComfort(n) { pendingComfort = String(n); commitAndNext(); }
function rateRecall(n) { pendingRecall = String(n); render(); }
function saveOnly() { savedOnly.push(rowFor()); render(); }
function avgBy(field, key) {
    const m = {};
    ratings.filter(r => r[field]).forEach(r => { const k = r[key]; if (!m[k]) m[k] = { sum: 0, n: 0 }; m[k].sum += Number(r[field]); m[k].n += 1; });
    return Object.entries(m).map(([k, v]) => ({ k, avg: v.sum / v.n, n: v.n })).sort((a, b) => b.avg - a.avg);
}
function countsBy(key) {
    const m = {};
    ratings.filter(r => r[key]).forEach(r => m[r[key]] = (m[r[key]] || 0) + 1);
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`);
}
function renderSide() {
    const s = currentWords[0] || {};
    el("leftInfo").textContent = `${s.cue_family || ""} / ${currentGroup}`;
    el("rightInfo").textContent = `${currentColor.name} / v21`;
    el("meta").textContent = `${s.cue_family || ""} / ${currentGroup} / ${currentColor.name} / ${el("viewContext").value}`;
    el("tokens").innerHTML = "";
    currentWords.forEach(w => { const t = document.createElement("span"); t.className = "token"; t.textContent = w.word; el("tokens").appendChild(t); });
    el("ratedCount").textContent = String(ratings.length);
    el("savedCount").textContent = String(savedOnly.length);
    document.querySelectorAll("#recallRating button").forEach((b, i) => b.classList.toggle("selected", pendingRecall === String(i + 1)));
    document.querySelectorAll("#feelTags button").forEach(b => b.classList.toggle("selected", pendingTag === b.dataset.tag));
    const topGroups = avgBy("comfort_1_5", "cue_group").slice(0, 10).map(x => `${x.k}: ${x.avg.toFixed(2)} (${x.n})`);
    const topFamilies = avgBy("comfort_1_5", "cue_family").map(x => `${x.k}: ${x.avg.toFixed(2)} (${x.n})`);
    const topRecall = avgBy("automatic_recall_1_5", "cue_group").slice(0, 8).map(x => `${x.k}: ${x.avg.toFixed(2)} (${x.n})`);
    const lines = [];
    lines.push("系統別 心地よさ:");
    lines.push(topFamilies.join("\n") || "(まだなし)");
    lines.push("");
    lines.push("cue群別 心地よさ 上位:");
    lines.push(topGroups.join("\n") || "(まだなし)");
    lines.push("");
    lines.push("勝手に入る感じ 上位:");
    lines.push(topRecall.join("\n") || "(まだなし)");
    lines.push("");
    lines.push("ポジティブの種類:");
    lines.push(countsBy("comfort_kind").join("\n") || "(まだなし)");
    el("summary").textContent = lines.join("\n");
}
function renderTimeline() {
    const t = el("timeline"); t.innerHTML = "";
    groups.forEach(g => { const s = raw.find(x => x.cue_group === g); const b = document.createElement("button"); b.className = "chip"; if (g === currentGroup) b.classList.add("current"); if (ratings.some(r => r.cue_group === g)) b.classList.add("rated"); b.textContent = `${s?.cue_family || ""} / ${g}`; b.onclick = () => { el("mode").value = "selectedGroup"; el("family").value = s.cue_family; refreshGroups(); el("group").value = g; randomizeScene(); }; t.appendChild(b); });
}
function render() { el("fontLabel").textContent = Number(el("fontScale").value).toFixed(2) + "x"; el("driftLabel").textContent = Number(el("driftScale").value).toFixed(2) + "x"; renderField(); renderSide(); renderTimeline(); }
function buildRating() {
    const c = el("comfortRating"); c.innerHTML = "";
    for (let i = 1; i <= 5; i++) { const b = document.createElement("button"); b.textContent = String(i); b.onclick = () => rateComfort(i); c.appendChild(b); }
    const r = el("recallRating"); r.innerHTML = "";
    for (let i = 1; i <= 5; i++) { const b = document.createElement("button"); b.textContent = String(i); b.onclick = () => rateRecall(i); r.appendChild(b); }
    document.querySelectorAll("#feelTags button").forEach(b => b.onclick = () => { pendingTag = b.dataset.tag; render(); });
}
function addCustom(kind) {
    const words = el("customWords").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (!words.length) return;
    let family = "生活ぬくさ系", group = "カスタム_生活ぬくさ", color = "白", hex = "#E8E4F8";
    if (kind === "nature") { family = "自然系"; group = "カスタム_自然系"; color = "緑"; hex = "#5DCAA5"; }
    if (kind === "praise") { family = "褒めかわいい系"; group = "カスタム_褒めかわいい"; color = "桃"; hex = "#F472B6"; }
    const start = raw.length + 1;
    const extra = words.map((w, i) => `CUSTOM_${start + i},${family},${group},${color},${hex},${w}`).join("\n");
    el("stimuliCsv").value = el("stimuliCsv").value.trim() + "\n" + extra;
    refreshSelectors();
    el("mode").value = "selectedGroup"; el("family").value = family; refreshGroups(); el("group").value = group;
    randomizeScene();
}
function csvEscape(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function downloadCsv(name, data) {
    if (!data.length) return;
    const h = Object.keys(data[0]);
    const csv = [h.join(","), ...data.map(r => h.map(k => csvEscape(r[k])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function build() { refreshSelectors(); buildRating(); randomizeScene(); }

el("reloadBtn").onclick = build;
el("randomizeBtn").onclick = randomizeScene;
el("focusBtn").onclick = () => { document.body.classList.toggle("focus"); render(); };
el("saveSceneBtn").onclick = saveOnly;
el("clearSavedBtn").onclick = () => { savedOnly = []; render(); };
el("addCustomWarm").onclick = () => addCustom("warm");
el("addCustomNature").onclick = () => addCustom("nature");
el("addCustomPraise").onclick = () => addCustom("praise");
el("downloadRatings").onclick = () => downloadCsv("comfort_resonance_v21_ratings.csv", ratings.length ? ratings : [rowFor()]);
el("downloadStimuli").onclick = () => downloadCsv("comfort_resonance_words_v21.csv", parseCsv(el("stimuliCsv").value));
el("copySummary").onclick = async () => { try { await navigator.clipboard.writeText(el("summary").textContent); el("copySummary").textContent = "コピー済み"; setTimeout(() => el("copySummary").textContent = "傾向コピー", 900); } catch (e) { } };
el("family").onchange = () => { refreshGroups(); randomizeScene(); };
["mode", "group", "displayCount", "density", "viewContext", "moodContext"].forEach(id => el(id).onchange = render);
["fontScale", "driftScale"].forEach(id => el(id).oninput = render);

document.addEventListener("keydown", e => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const edit = tag === "textarea" || tag === "input" || tag === "select";
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); downloadCsv("comfort_resonance_v21_ratings.csv", ratings); return; }
    if (edit) return;
    if (/^[1-5]$/.test(e.key) && e.shiftKey) rateRecall(Number(e.key));
    else if (/^[1-5]$/.test(e.key)) rateComfort(Number(e.key));
    else if (e.key.toLowerCase() === "w" || e.key.toLowerCase() === "r") randomizeScene();
    else if (e.key.toLowerCase() === "s") saveOnly();
    else if (e.key.toLowerCase() === "f") { document.body.classList.toggle("focus"); render(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); changeGroup(-1); }
    else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); changeGroup(1); }
});

build();
