(function () {
  "use strict";
  const game = globalThis.FactoryGame;
  const $ = (id) => document.getElementById(id);
  const icons = {
    mix: '<path d="M17 13h30l3 8v28c0 7-36 7-36 0V21z" fill="currentColor" opacity=".15"/><path d="M17 13h30l3 8v28c0 7-36 7-36 0V21zM32 5v39m-9-7 18 7m-18 0 18-7M9 54h46"/>',
    vessel: '<rect x="16" y="12" width="32" height="40" rx="10" fill="currentColor" opacity=".15"/><path d="M16 22c0-14 32-14 32 0v24c0 13-32 13-32 0zM32 4v38m-9-4h18M10 56h44M16 50v6m32-6v6M48 25h8V12"/>',
    filter: '<path d="M17 14h30v32H17z" fill="currentColor" opacity=".15"/><path d="M17 14h30v32H17zM23 14v32m9-32v32m9-32v32M5 30h12m30 0h12M32 5v9m0 32v12M22 58h20"/>',
    columns: '<rect x="12" y="13" width="12" height="36" rx="4" fill="currentColor" opacity=".15"/><rect x="39" y="13" width="12" height="36" rx="4" fill="currentColor" opacity=".15"/><path d="M12 18c0-7 12-7 12 0v26c0 7-12 7-12 0zM39 18c0-7 12-7 12 0v26c0 7-12 7-12 0zM18 12V6h27v6M24 31h15M18 49v9m27-9v9M7 58h49"/>',
    bag: '<path d="M20 10h24l8 12-3 29c-8 5-26 5-34 0l-3-29z" fill="currentColor" opacity=".15"/><path d="M20 10h24l8 12-3 29c-8 5-26 5-34 0l-3-29zM24 10V5h16v5M20 26h24M21 33h22M32 53v7"/>'
  };
  const icon = (id) => `<svg viewBox="0 0 64 64" aria-hidden="true" style="color:${game.equipment[id].color}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[game.equipment[id].icon]}</svg>`;
  let state = game.createState();
  let stageIndex = 0;
  let mode = "connect";
  let selectedEquipment = null;
  let source = null;
  let previewTarget = null;
  let previewPort = "product";
  let running = false;
  let cleared = false;
  let active = null;
  let stopped = null;
  let timer = null;
  let generation = 0;
  const completed = new Set();
  let animatedEdges = [];
  let lastDisconnected = null;
  let pipeGeometry = [];
  let selectedPart = null;
  let inspectedPart = null;
  let workTarget = null;
  let reviewStep = 0;
  let reviewShown = false;
  let reviewIssues = [];
  const partNames = { capacity: "保管バッグ", tubing: "移送チューブ", bag: "接液バッグ一式", frame: "支持架台", drive: "駆動機器" };
  const conditionNames = { used: "使用済み", new: "新品・包装健全", damaged: "新品・包装損傷", retain: "再使用", discard: "廃棄", null: "取り外し済み" };
  const hasWorkshop = (stage) => Boolean(stage.capacity || stage.tube || stage.parts);
  function workButton(id, text, action) {
    const button = document.createElement("button");
    button.id = id;
    button.dataset.workFocus = id;
    button.textContent = text;
    button.disabled = running;
    button.addEventListener("click", () => { if (!running) action(); });
    return button;
  }
  function applyPart(action, target, itemId) {
    const result = game.workshop.action(state, game.stages[stageIndex], action, target, itemId);
    if (!result.ok) { feedback("error", "部材操作を確認してください", result.message); return; }
    if (action === "install") selectedPart = null;
    workTarget = target;
    edited(result.message);
  }
  function openTarget(target) {
    if (running) return;
    if (selectedPart) { applyPart("install", target, selectedPart.id); return; }
    workTarget = target;
    source = null;
    selectedEquipment = null;
    mode = "workshop";
    feedback("info", `${partNames[target]}を選びました`, "下の作業台で現在の部材を調べます。交換する部材は左の部材棚から選び、ボード上の取付先をクリックしてください。");
    render();
    $("workbench").scrollIntoView({ block: "nearest" });
  }
  const edgeLabel = (edge) => `${game.equipment[edge.from].name} → ${game.equipment[edge.to].name}${game.stages[stageIndex].ports ? `［${edge.to === "purify" ? game.missions.portNames[edge.port || "product"] : "抗体を含む液"}］` : ""}`;
  function closePicker() {
    $("connection-picker").hidden = true;
    $("connection-options").replaceChildren();
  }
  function detach(edge) {
    if (running) return;
    const index = state.edges.findIndex((item) => item.from === edge.from && item.to === edge.to);
    const result = game.disconnect(state, edge.from, edge.to);
    if (!result.ok) { feedback("error", "接続を外せません", result.message); return; }
    selectedEquipment = null;
    source = null;
    if (game.stages[stageIndex].parts) game.workshop.invalidate(state, "connected");
    lastDisconnected = { edge: { ...edge }, index };
    edited(`${edgeLabel(edge)}の接続を外しました。設備は残っています。`, true);
    $("disconnect-message").textContent = `${edgeLabel(edge)}の接続を外しました。設備は残っています。`;
    $("disconnect-notice").hidden = false;
  }
  function cancelSelection() {
    const label = selectedPart ? "部材の取付" : selectedEquipment ? "配置" : mode === "move" ? "移動" : "接続";
    selectedEquipment = null;
    selectedPart = null;
    source = null;
    closePicker();
    feedback("info", `${label}操作をキャンセルしました`, "既存の設備・接続は変更していません。");
    render();
  }
  function renderControls(stage) {
    $("specification-panel").hidden = !stage.advanced;
    $("specification-text").textContent = stage.specification || "";
    const guides = [
      "", "", "",
      "不足するバッグを左から選ぶ → 空き区画へ置く → 設備同士をつなぐ → レビュー。供給と受入の経路を自分で完成させます。",
      "緩衝液バッグを置く → バッグを選ぶ → 精製設備の入口へつなぐ → レビュー。Aで練習し、Bは仕様書から判断します。",
      "接続は完成済み。左の部材棚で容量バッグを調べる → 持つ → ボードの原薬保管をクリックして交換 → レビューで120 Lの受入を確認。",
      "経路のつなぎ直しは不要。左で両端規格のチューブを調べる → 持つ → ボードの「チューブ」ボタンへ取り付ける → レビュー。左端が精製側、右端が保管側です。",
      "「部材を扱う」で培養設備・チューブを選ぶ → 使用済み接液部材を外す → 包装を調べて新品を持つ → 同じ部位へ取り付ける。部位ごとの仕様・包装・取付を確認し、架台と駆動機器を残して清掃・確認。",
      "「設備を移動」→ 設備 → 空き区画。中央の青い通路と、培養の右隣の交換作業区画を空ける → レビューで搬入・搬出の模式表示を確認。",
      "不備は5件。下の操作を選び、接続修正・部材交換・機器確認・配置変更で工場を直します。正解は強調しません。レビューすると未達条件と理由が分かります。"
    ];
    $("operation-guide").hidden = !stage.advanced;
    $("operation-text").textContent = guides[stageIndex];
    $("operation-shortcuts").replaceChildren();
    const shortcuts = [];
    if (stage.ports || stageIndex === 3) shortcuts.push(["connect", "つなぐ"], ["disconnect", "接続を外す"]);
    if (hasWorkshop(stage)) shortcuts.push(["workshop", "部材を扱う"]);
    if (stage.layout) shortcuts.push(["move", "設備を移動"]);
    shortcuts.forEach(([value, label]) => {
      $("operation-shortcuts").append(workButton(`guide-${value}`, label, () => chooseMode(value)));
    });
    $("workshop-mode").hidden = !hasWorkshop(stage);
    $("stock-panel").hidden = !hasWorkshop(stage);
    $("stock-items").replaceChildren();
    game.workshop.available(stage).forEach((item) => {
      const button = workButton(`stock-${item.id}`, "", () => {
        inspectedPart = item;
        render();
        $("pick-part").focus({ preventScroll: true });
      });
      button.className = "stock-card";
      button.setAttribute("aria-pressed", String(inspectedPart && inspectedPart.id === item.id));
      const drawing = item.kind === "tube" ? `<span class="connector type-${item.value[0]}">${item.value[0]}</span>─<span class="connector type-${item.value[1]}">${item.value[1]}</span>` : item.kind === "capacity" ? `${item.value} L` : "SU";
      button.innerHTML = `<span class="part-drawing ${item.shape}${item.value === "damaged" ? " damaged-package" : ""}" aria-hidden="true">${drawing}</span><strong>${item.name}</strong><small>仕様・包装を調べる</small>`;
      $("stock-items").append(button);
    });
    $("stock-detail").replaceChildren();
    if (inspectedPart) {
      const description = document.createElement("p");
      description.textContent = `${inspectedPart.name}：${inspectedPart.detail}`;
      $("stock-detail").append(description, workButton("pick-part", "この部材を持つ →", () => {
        selectedPart = inspectedPart;
        selectedEquipment = null;
        source = null;
        mode = "workshop";
        feedback("info", `${selectedPart.name}を持っています`, "ボード上の取付先をクリック。間違った取付先では変更されません。キャンセルで持つ操作を解除できます。");
        render();
      }));
    }
    renderWorkbench(stage);
    renderReview(stage);
  }
  function renderWorkbench(stage) {
    const bench = $("workbench");
    bench.hidden = !hasWorkshop(stage);
    bench.replaceChildren();
    if (!hasWorkshop(stage)) return;
    const nav = document.createElement("div");
    nav.className = "work-targets";
    const targets = [...(stage.capacity ? ["capacity"] : []), ...(stage.tube || stage.parts ? ["tubing"] : []), ...(stage.parts ? ["bag", "frame", "drive"] : [])];
    targets.forEach((target) => {
      const button = workButton(`target-${target}`, partNames[target], () => openTarget(target));
      button.setAttribute("aria-pressed", String(workTarget === target));
      nav.append(button);
    });
    bench.append(nav);
    if (stage.parts) {
      const assembly = document.createElement("div");
      assembly.className = "assembly-diagram";
      assembly.setAttribute("aria-label", "接液部材と再使用機器の模式図");
      ["bag", "frame", "drive", "tubing"].forEach((target) => {
        const button = workButton(`assembly-${target}`, `${partNames[target]}：${conditionNames[state.parts[target]]}`, () => openTarget(target));
        button.className = `assembly-${target}`;
        button.classList.toggle("removed-part", state.parts[target] === null);
        assembly.append(button);
      });
      bench.append(assembly);
    }
    const heading = document.createElement("h3");
    heading.textContent = selectedPart ? `手持ち：${selectedPart.name} — 取付先を選んでください` : workTarget ? `${partNames[workTarget]}の作業台` : "ボードの設備・チューブを選んで部材を扱います";
    bench.append(heading);
    if (!workTarget) return;
    const status = document.createElement("p");
    const target = workTarget;
    status.textContent = target === "capacity" ? `取付済み：使用可能容量 ${state.capacity} L ／ 受入予定：120 L` :
      target === "tubing" ? `取付済み：${stage.tube ? `${state.tube[0]}型 → ${state.tube[1]}型。` : ""}${stage.parts ? conditionNames[state.parts.tubing] : ""}` :
      `現在：${conditionNames[state.parts[target]]}。${target === "bag" && stage.review ? "培養・保管の接液バッグ一式を代表しています。" : ""}`;
    bench.append(status);
    if (target === "capacity" || (target === "tubing" && !stage.parts)) {
      const tip = document.createElement("p");
      tip.textContent = "左の部材棚で仕様を調べて部材を持ち、ボード上の取付先を選んで交換します。";
      bench.append(tip);
    } else if (target === "frame" || target === "drive") {
      const tip = document.createElement("p");
      tip.textContent = "接液部材ではない再使用機器です。設備全体を廃棄せず、残して所定の清掃・確認を行います。";
      bench.append(tip, workButton(`service-${target}`, state.service[target] ? "清掃・確認済み（再確認する）" : "残して清掃・確認する", () => applyPart("service", target)));
    } else {
      const observation = document.createElement("p");
      const value = state.parts[target];
      observation.className = "inspection-observation";
      observation.textContent = value === null ? "部材が外れています。取付位置だけを残し、新品を取り付けるまで確認できません。" :
        `仕様ラベル：${value === "used" ? "使用済み・次バッチ用に非適合" : "指定部材"} ／ 包装：${value === "damaged" ? "破れあり" : value === "used" ? "使用済み" : "損傷なし"} ／ 取付部：${state.parts.bag === null || state.parts.tubing === null ? "接液部材が不足" : "両接液部材が取付済み"}。下の各部位を確認して記録します。`;
      bench.append(observation);
      const actions = document.createElement("div");
      actions.className = "part-actions";
      actions.append(workButton(`remove-${target}`, "接液部材を外す", () => applyPart("remove", target)));
      [["specified", "仕様ラベル"], ["package", "包装"], ["connected", "取付部"]].forEach(([kind, label]) => {
        actions.append(workButton(`inspect-${target}-${kind}`, `${state.inspections[target][kind] ? "✓ " : ""}${label}を確認`, () => applyPart(kind, target)));
      });
      bench.append(actions);
    }
    if (stage.parts) {
      const progress = document.createElement("p");
      progress.textContent = `使用前確認：仕様 ${state.checks.specified ? "済" : "未"} ／ 包装 ${state.checks.package ? "済" : "未"} ／ 取付 ${state.checks.connected ? "済" : "未"} ／ 再使用機器 ${state.checks.reusable ? "済" : "未"}。部材の確認は両部材で行います。清掃・確認操作は学習上の記録で、実作業の代替ではありません。`;
      bench.append(progress);
    }
  }
  function renderReview(stage) {
    const scene = $("review-scene");
    scene.hidden = !reviewShown || !(stage.capacity || stage.layout);
    scene.replaceChildren();
    if (scene.hidden) return;
    const title = document.createElement("h3");
    title.textContent = "設計を試す（受入・作業性の模式表示）";
    scene.append(title);
    if (stage.capacity) {
      const amount = Math.min(120, reviewStep * 20);
      const text = document.createElement("p");
      text.textContent = `受入予定120 L ／ 使用可能容量${state.capacity} L。確認量：${amount} L${amount > state.capacity ? " — 容量を超えます。このバッグでは全量を受け入れられません。" : ""}`;
      const meter = document.createElement("div");
      meter.className = "capacity-meter";
      const fill = document.createElement("span");
      fill.style.width = `${Math.min(100, amount / state.capacity * 100)}%`;
      meter.classList.toggle("over-capacity", amount > state.capacity);
      meter.append(fill);
      scene.append(text, meter);
    }
    if (stage.layout) {
      const blocked = state.nodes.find((node) => node.slot >= 6 && node.slot <= 11);
      const firstBlock = Math.min(...state.nodes.filter((node) => node.slot >= 6 && node.slot <= 11).map((node) => node.slot - 6), 6);
      const position = Math.min(reviewStep, firstBlock);
      const route = document.createElement("div");
      route.className = "delivery-route";
      for (let index = 0; index < 6; index += 1) {
        const cell = document.createElement("span");
        const occupied = state.nodes.some((node) => node.slot === index + 6);
        cell.textContent = occupied ? "設備" : position === index ? "搬送 →" : `区画${index + 7}`;
        cell.classList.toggle("blocked", occupied);
        cell.classList.toggle("traveler", position === index && !occupied);
        route.append(cell);
      }
      const text = document.createElement("p");
      const culture = state.nodes.find((node) => node.id === "culture");
      const workClear = culture && culture.slot % 6 !== 5 && !state.nodes.some((node) => node.slot === culture.slot + 1) && !(culture.slot >= 6 && culture.slot < 12);
      text.textContent = `${blocked && reviewStep >= firstBlock ? "搬送停止：中央通路に設備があります。" : reviewStep >= 6 ? "搬入 → 搬出の通路を通れました。" : "中央通路を搬送中。"} 交換作業区画：${workClear ? "確保" : "未確保"}。配管線は概念表示のため通路障害には数えません。`;
      scene.append(route, text);
    }
  }
  function showCompletion() {
    const stage = game.stages[stageIndex];
    $("completion-mission").textContent = `MISSION ${stageIndex + 1} / ${game.stages.length} — ${stage.title}`;
    $("completion-lesson").textContent = stage.lesson;
    $("completion-next").hidden = stageIndex === game.stages.length - 1;
    $("completion-finale").hidden = completed.size !== game.stages.length;
    $("completion").showModal();
    ($("completion-next").hidden ? $("completion-close") : $("completion-next")).focus();
  }

  function feedback(kind, title, message) {
    $("feedback-box").dataset.kind = kind;
    $("feedback-label").textContent = { info: "DESIGN NOTE", error: "TRY AGAIN / 改善のヒント", running: "PROCESS IN MOTION", success: "MISSION COMPLETE" }[kind];
    $("feedback-title").textContent = title;
    $("feedback-message").textContent = message;
  }
  function note(id) {
    const item = game.equipment[id];
    $("equipment-title").textContent = item.name;
    $("equipment-description").textContent = item.role;
    $("equipment-material").textContent = item.material;
  }
  function cancelRun() {
    generation += 1;
    clearTimeout(timer);
    timer = null;
    running = false;
    active = null;
    stopped = null;
    animatedEdges = [];
    reviewShown = false;
  }
  function edited(message, preserveUndo = false) {
    reviewShown = false;
    reviewIssues = [];
    if (!preserveUndo) lastDisconnected = null;
    $("disconnect-notice").hidden = !lastDisconnected;
    closePicker();
    cleared = false;
    active = null;
    stopped = null;
    animatedEdges = [];
    feedback("info", "設計を更新しました", message);
    render();
  }
  function loadStage(index) {
    cancelRun();
    lastDisconnected = null;
    $("disconnect-notice").hidden = true;
    closePicker();
    if ($("completion").open) $("completion").close();
    stageIndex = index;
    state = game.missions.initialState(game.stages[index]);
    selectedEquipment = null;
    source = null;
    selectedPart = null;
    inspectedPart = null;
    workTarget = null;
    reviewShown = false;
    reviewIssues = [];
    $("equipment-library").open = index < 5;
    mode = index >= 5 && index <= 7 ? "workshop" : index === 8 ? "move" : "connect";
    cleared = false;
    $("equipment-title").textContent = "シングルユースって？";
    $("equipment-description").textContent = "製品に触れるバッグやチューブなどに、使い捨て部材を使う仕組み。設備全体を捨てるわけではありません。";
    $("equipment-material").textContent = "設備を選ぶと、役割と接液部材の例をここに表示します。";
    feedback("info", "まずは設備を置いてみよう", "左の設備を選び、ボードの空き区画をクリックしてください。");
    if (game.stages[index].advanced) feedback("info", game.stages[index].review ? "不備は5件。設計レビューを始めよう" : hasWorkshop(game.stages[index]) ? "部材棚とボードで工場を整えよう" : index === 8 ? "設備を移動して作業場所を作ろう" : "課題仕様書を確認しよう", game.stages[index].description);
    render();
  }
  function chooseMode(value) {
    mode = value;
    selectedEquipment = null;
    source = null;
    selectedPart = null;
    feedback("info", value === "delete" ? "削除する設備を選ぼう" : "接続元を選ぼう",
      value === "delete" ? "設備をクリックすると、関連する接続も削除します。" : "接続元をクリックし、「ここへ」の設備にマウスを重ねて矢印を確認しましょう。");
    if (value === "move") feedback("info", "移動する設備を選ぼう", "設備をクリックし、空き区画をクリック。接続はそのまま残します。");
    if (value === "disconnect") feedback("info", "外す接続線を選ぼう", "線にマウスを重ねて対象を確認し、クリックで外します。設備は残ります。右の接続一覧からも外せます。");
    if (value === "workshop") feedback("info", "部材を扱おう", "左の部材棚で部材を調べて持つ → ボード上の設備・チューブへ取り付ける。使用済み接液部材は先に外します。");
    closePicker();
    render();
  }
  function clickSlot(slot) {
    if (running) return;
    const node = state.nodes.find((item) => item.slot === slot);
    if (mode === "workshop") {
      if (!node) { feedback("info", "取付先の設備・チューブを選ぼう", "部材は空き区画に置くのではなく、配置済みの設備・接続へ取り付けます。"); return; }
      const stage = game.stages[stageIndex];
      const target = node.id === "store" && stage.capacity ? "capacity" : node.id === "culture" && stage.parts ? "bag" : null;
      if (target) { openTarget(target); return; }
      feedback("info", "この設備には対象部材を取り付けません", "容量バッグは原薬保管、接液バッグは培養、チューブは線上の「チューブ」ボタンを選んでください。架台・駆動機器は作業台で選びます。");
      return;
    }
    if (mode === "disconnect") {
      if (node) note(node.id);
      feedback("info", "設備ではなく接続線を選んでください", "このモードでは設備を削除しません。接続線または接続一覧の「外す」を選びます。");
      return;
    }
    if (mode === "move" && source) {
      if (node) { feedback("error", "この区画は使用中です", "移動先には空き区画を選んでください。"); return; }
      state.nodes.find((item) => item.id === source).slot = slot;
      source = null;
      edited("設備を移動しました。接続は保持しています。");
      return;
    }
    if (selectedEquipment) {
      const result = game.place(state, selectedEquipment, slot);
      if (!result.ok) { feedback("error", "ここには配置できません", result.message); return; }
      const name = game.equipment[selectedEquipment].name;
      selectedEquipment = null;
      edited(`${name}を配置しました。「つなぐ」で接続元 → 接続先を選びましょう。`);
      return;
    }
    if (!node) { feedback("info", "設備を選んでください", "左の設備ライブラリーから、配置したい設備を選びましょう。"); return; }
    note(node.id);
    if (mode === "move") {
      source = node.id;
      feedback("info", "移動先の空き区画を選ぼう", `${game.equipment[source].name}を選択中。接続を残して移動します。`);
      render();
      return;
    }
    if (mode === "delete") {
      const result = game.removeNode(state, node.id);
      if (!result.ok) { feedback("error", "削除できません", result.message); return; }
      if (game.stages[stageIndex].parts) game.workshop.invalidate(state, "connected");
      edited(`${game.equipment[node.id].name}と、それにつながる接続を削除しました。`);
      return;
    }
    if (!source) {
      source = node.id;
      feedback("info", "接続先を選ぼう", `${game.equipment[source].name}から、次の設備へ。接続先をクリックしてください。`);
      render();
      return;
    }
    if (game.stages[stageIndex].ports && node.id === "purify") {
      feedback("info", "精製設備の入口を選ぼう", "設備本体ではなく、下に表示された「抗体液入口」「緩衝液A入口」「緩衝液B入口」をクリックしてください。");
      return;
    }
    finishConnection(node.id, "product");
  }
  function finishConnection(to, port) {
    const result = game.connect(state, source, to, port);
    if (!result.ok) { feedback("error", "接続できません", result.message); return; }
    const name = game.equipment[source].name;
    source = null;
    if (game.stages[stageIndex].parts) game.workshop.invalidate(state, "connected");
    edited(`${name} → ${game.equipment[to].name}${game.stages[stageIndex].ports && to === "purify" ? `［${game.missions.portNames[port]}］` : ""}を接続しました。レビューで条件を確かめましょう。`);
  }
  function canPreview(id) {
    return source && id !== source && !running && mode === "connect" && !selectedEquipment &&
      !state.edges.some((edge) => edge.from === source && edge.to === id);
  }
  function renderPipes() {
    const board = $("pipes").getBoundingClientRect();
    if (!board.width || !board.height) return;
    $("pipes").setAttribute("viewBox", `0 0 ${board.width} ${board.height}`);
    $("pipe-lines").replaceChildren();
    $("pipe-tools").replaceChildren();
    $("pipe-tools").hidden = mode !== "workshop";
    pipeGeometry = [];
    const bounds = (id, port = null) => {
      const selector = port && id === "purify" && game.stages[stageIndex].ports ? `[data-port="${port}"]` : `[data-node="${id}"]`;
      const rect = $("slots").querySelector(selector).getBoundingClientRect();
      return { x: rect.left - board.left + rect.width / 2, y: rect.top - board.top + rect.height / 2, halfWidth: rect.width / 2, halfHeight: rect.height / 2 };
    };
    const draw = (edge, preview = false) => {
      const from = bounds(edge.from);
      const to = bounds(edge.to, edge.port || "product");
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const dx = (to.x - from.x) / distance;
      const dy = (to.y - from.y) / distance;
      // Intersect the actual card boundary, then leave room for the arrowhead.
      const offset = (rect) => Math.min(dx ? rect.halfWidth / Math.abs(dx) : Infinity, dy ? rect.halfHeight / Math.abs(dy) : Infinity) + 3;
      const start = offset(from);
      const end = offset(to);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", from.x + dx * start);
      line.setAttribute("y1", from.y + dy * start);
      line.setAttribute("x2", to.x - dx * end);
      line.setAttribute("y2", to.y - dy * end);
      if (!preview) pipeGeometry.push({ edge, x1: from.x + dx * start, y1: from.y + dy * start, x2: to.x - dx * end, y2: to.y - dy * end });
      const halo = line.cloneNode();
      halo.classList.add("pipe-halo");
      $("pipe-lines").append(halo);
      line.classList.add("pipe");
      line.dataset.from = edge.from;
      line.dataset.to = edge.to;
      line.setAttribute("marker-end", "url(#arrow)");
      if (game.stages[stageIndex].ports && edge.port && edge.port !== "product") line.classList.add("supply-pipe");
      if (preview) line.classList.add("preview");
      else if (animatedEdges.includes(`${edge.from}:${edge.to}`)) line.classList.add(running && active === edge.to ? "running" : "finished");
      $("pipe-lines").append(line);
      const stage = game.stages[stageIndex];
      if (!preview && stage.parts && state.parts.tubing === null) line.classList.add("uninstalled-pipe");
      if (!preview && (stage.tube || stage.parts) && edge.to === "store" && edge.from === (stage.required.includes("purify") ? "purify" : "culture")) {
        const button = workButton("board-tubing", `チューブ${stage.tube ? ` ${state.tube[0]}→${state.tube[1]}` : ` ${conditionNames[state.parts.tubing]}`}`, () => openTarget("tubing"));
        button.style.left = `${(from.x + to.x) / 2}px`;
        button.style.top = `${(from.y + to.y) / 2}px`;
        button.classList.toggle("install-target", Boolean(selectedPart && ["tube", "tubing"].includes(selectedPart.kind)));
        $("pipe-tools").append(button);
      }
      if (!preview && mode === "disconnect" && !running) {
        const hit = line.cloneNode();
        hit.removeAttribute("marker-end");
        hit.setAttribute("class", "pipe-hit");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${edgeLabel(edge)}の接続を外す`;
        hit.append(title);
        hit.addEventListener("pointerenter", () => {
          line.classList.add("detach-target");
          $("mode-instruction").textContent = `${edgeLabel(edge)}の接続を外す。クリックで解除（設備は残ります）。`;
        });
        hit.addEventListener("pointerleave", () => {
          line.classList.remove("detach-target");
          $("mode-instruction").textContent = "外す接続線をクリック。交差・重なり部分では接続を選択します。";
        });
        hit.addEventListener("click", (event) => {
          const rect = $("pipes").getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const nearby = pipeGeometry.filter((item) => {
            const vx = item.x2 - item.x1, vy = item.y2 - item.y1;
            const length = vx * vx + vy * vy;
            const t = length ? Math.max(0, Math.min(1, ((x - item.x1) * vx + (y - item.y1) * vy) / length)) : 0;
            return Math.hypot(x - item.x1 - t * vx, y - item.y1 - t * vy) <= 11;
          });
          if (nearby.length <= 1) { detach(edge); return; }
          $("connection-options").replaceChildren();
          nearby.forEach((item) => {
            const button = document.createElement("button");
            button.textContent = `${edgeLabel(item.edge)}を外す`;
            button.addEventListener("click", () => {
              detach(item.edge);
              $("undo-disconnect").focus();
            });
            $("connection-options").append(button);
          });
          $("connection-picker").hidden = false;
          $("connection-options").firstElementChild.focus();
        });
        $("pipe-lines").append(hit);
      }
      if (game.stages[stageIndex].ports || game.stages[stageIndex].tube) {
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", (from.x + to.x) / 2);
        label.setAttribute("y", (from.y + to.y) / 2 - 8);
        label.setAttribute("text-anchor", "middle");
        label.classList.add("pipe-label");
        label.textContent = game.stages[stageIndex].tube && edge.from === "purify" && edge.to === "store" ? `チューブ ${state.tube[0]}型 → ${state.tube[1]}型` : edge.to === "purify" ? game.missions.portNames[edge.port || "product"] : "抗体を含む液";
        $("pipe-lines").append(label);
      }
    };
    state.edges.forEach((edge) => draw(edge));
    if (previewTarget && canPreview(previewTarget)) draw({ from: source, to: previewTarget, port: previewPort }, true);
  }
  function render() {
    const focusedSlot = document.activeElement && document.activeElement.dataset.slot;
    const focusedPort = document.activeElement && document.activeElement.dataset.port;
    const focusedWork = document.activeElement && document.activeElement.dataset.workFocus;
    previewTarget = null;
    const stage = game.stages[stageIndex];
    $("mission-number").textContent = String(stageIndex + 1).padStart(2, "0");
    $("mission-title").textContent = stage.title;
    $("mission-description").textContent = stage.description;
    $("mission-equipment").textContent = stage.required.map((id) => game.equipment[id].name).join("・");
    renderControls(stage);
    $("review-actions").replaceChildren();
    if (!running) reviewIssues.forEach((issue, index) => {
      const actions = {
        connections: ["接続を直す", () => chooseMode("connect")],
        capacity: ["容量バッグを交換", () => openTarget("capacity")],
        tube: ["規格チューブを交換", () => openTarget("tubing")],
        parts: ["接液部材・機器を確認", () => openTarget("bag")],
        layout: ["設備を移動", () => chooseMode("move")]
      };
      const [text, action] = actions[issue.category];
      $("review-actions").append(workButton(`review-fix-${index}`, `${index + 1}. ${text}`, action));
    });
    $("port-introduction").hidden = stageIndex !== 4;
    const aConnected = state.edges.some((edge) => edge.from === "bufferA" && edge.to === "purify" && edge.port === "bufferA");
    $("port-guidance").textContent = aConnected ? "後半：Aの接続はできました。次は緩衝液Bを配置し、仕様書を見て入口を選びましょう。" : "前半：緩衝液Aバッグを配置・選択し、精製設備の強調された「緩衝液A入口」へつなぎましょう。";
    $("board").classList.toggle("ports-visible", Boolean(stage.ports));
    $("board").classList.toggle("workshop-visible", hasWorkshop(stage));
    $("board").classList.toggle("layout-challenge", Boolean(stage.layout));
    $("stages").replaceChildren();
    game.stages.forEach((item, index) => {
      const button = document.createElement("button");
      button.className = "stage-button";
      if (index === stageIndex) button.setAttribute("aria-current", "step");
      button.innerHTML = `<span class="step-index">${String(index + 1).padStart(2, "0")}</span><span><small>MISSION ${index + 1}</small>${item.title}</span>${completed.has(index) ? '<span class="step-complete" aria-label="クリア済み">✓</span>' : ""}`;
      button.addEventListener("click", () => loadStage(index));
      $("stages").append(button);
    });
    $("palette").replaceChildren();
    Object.entries(game.equipment).forEach(([id, item]) => {
      if (stage.advanced ? !stage.required.includes(id) : !["prepare", "culture", "harvest", "purify", "store"].includes(id)) return;
      const placed = state.nodes.some((node) => node.id === id);
      const button = document.createElement("button");
      button.className = "equipment-button";
      button.dataset.equipment = id;
      button.setAttribute("aria-pressed", String(selectedEquipment === id));
      button.disabled = running;
      button.innerHTML = `${icon(id)}<span><strong>${item.name}</strong><small class="${placed ? "placed" : ""}">${placed ? "配置済み / 役割を見る" : stage.required.includes(id) ? "今回使う設備 / 配置する" : "今回は使いません"}</small></span>`;
      button.addEventListener("click", () => {
        note(id);
        if (placed) { feedback("info", `${item.name}は配置済みです`, "役割を表示しました。移動は「設備を移動」、部材交換は「部材を扱う」で行います。"); return; }
        selectedEquipment = id;
        selectedPart = null;
        source = null;
        mode = "connect";
        feedback("info", `${item.name}の配置場所を選ぼう`, stage.layout ? "通路と交換作業区画を確保して配置してください。" : "空いている区画をクリックしてください。位置はクリア判定に影響しません。");
        render();
      });
      $("palette").append(button);
    });
    $("slots").replaceChildren();
    for (let slot = 0; slot < 18; slot += 1) {
      const node = state.nodes.find((item) => item.slot === slot);
      const button = document.createElement("button");
      button.className = `slot ${node ? "node" : "empty"}`;
      button.dataset.slot = slot;
      button.disabled = running;
      button.classList.toggle("corridor", Boolean(stage.layout && slot >= 6 && slot <= 11));
      const culture = state.nodes.find((item) => item.id === "culture");
      button.classList.toggle("work-area", Boolean(stage.layout && culture && culture.slot % 6 !== 5 && slot === culture.slot + 1));
      if (node) {
        button.dataset.node = node.id;
        button.innerHTML = `${icon(node.id)}<strong>${game.equipment[node.id].name}</strong><small>${stage.capacity && node.id === "store" ? `${state.capacity} L` : "SU EQUIPMENT"}</small>`;
        if (stage.tube && (node.id === "purify" || node.id === "store")) {
          const spec = document.createElement("span");
          spec.className = "component-status";
          spec.textContent = node.id === "purify" ? "出口 A型" : "入口 B型";
          button.append(spec);
        }
        if (stage.parts && node.id === "culture") {
          const status = document.createElement("span");
          status.className = "component-status";
          status.textContent = `バッグ：${conditionNames[state.parts.bag]}`;
          button.append(status);
        }
        const installTarget = selectedPart && (node.id === "store" && selectedPart.kind === "capacity" || node.id === "culture" && selectedPart.kind === "bag");
        button.classList.toggle("install-target", Boolean(installTarget));
        if (mode === "workshop" && (node.id === "store" && stage.capacity || node.id === "culture" && stage.parts)) {
          const badge = document.createElement("span");
          badge.className = "component-status";
          badge.textContent = installTarget ? "ここへ取り付ける" : "部材を見る";
          button.append(badge);
        }
        button.setAttribute("aria-label", `${game.equipment[node.id].name}、区画${slot + 1}`);
        button.classList.toggle("selected", source === node.id);
        const candidate = canPreview(node.id) && !(stage.ports && node.id === "purify");
        button.classList.toggle("candidate", Boolean(candidate));
        if ((source === node.id && mode === "connect") || candidate) {
          const badge = document.createElement("span");
          badge.className = "connection-badge";
          badge.textContent = source === node.id ? "ここから" : "ここへ";
          button.append(badge);
          button.setAttribute("aria-label", `${game.equipment[node.id].name}、${badge.textContent}、区画${slot + 1}`);
        }
        const preview = () => {
          previewTarget = candidate ? node.id : null;
          previewPort = "product";
          renderPipes();
        };
        const clearPreview = () => {
          if (previewTarget === node.id) {
            previewTarget = null;
            renderPipes();
          }
        };
        button.addEventListener("pointerenter", preview);
        button.addEventListener("focus", preview);
        button.addEventListener("pointerleave", () => {
          if (document.activeElement !== button) clearPreview();
        });
        button.addEventListener("blur", () => {
          if (!button.matches(":hover")) clearPreview();
        });
        button.classList.toggle("active", active === node.id);
        button.classList.toggle("stopped", stopped === node.id);
      } else {
        const zone = stage.layout && slot >= 6 && slot <= 11 ? (slot === 6 ? "搬入 →" : slot === 11 ? "→ 搬出" : "通路") : button.classList.contains("work-area") ? "交換作業" : mode === "move" && source ? "移動先" : "+";
        button.classList.toggle("move-destination", Boolean(mode === "move" && source));
        button.textContent = zone;
        button.setAttribute("aria-label", `空き区画${slot + 1}${zone === "+" ? "" : `、${zone}`}`);
      }
      button.addEventListener("click", () => clickSlot(slot));
      if (node && node.id === "purify" && stage.ports) {
        const cell = document.createElement("div");
        cell.className = "port-cell";
        cell.append(button);
        const ports = document.createElement("div");
        ports.className = "equipment-ports";
        Object.entries(game.missions.portNames).forEach(([port, label]) => {
          const inlet = document.createElement("button");
          inlet.type = "button";
          inlet.dataset.port = port;
          inlet.textContent = label;
          inlet.setAttribute("aria-label", `精製設備の${label}へ接続`);
          inlet.disabled = running || mode !== "connect" || Boolean(selectedEquipment);
          inlet.classList.toggle("guided-port", stageIndex === 4 && !aConnected && source === "bufferA" && port === "bufferA");
          const preview = () => {
            previewTarget = canPreview("purify") ? "purify" : null;
            previewPort = port;
            renderPipes();
          };
          inlet.addEventListener("pointerenter", preview);
          inlet.addEventListener("focus", preview);
          inlet.addEventListener("pointerleave", () => { if (document.activeElement !== inlet) { previewTarget = null; renderPipes(); } });
          inlet.addEventListener("blur", () => { previewTarget = null; renderPipes(); });
          inlet.addEventListener("click", () => {
            if (running || mode !== "connect" || selectedEquipment) return;
            if (!source) { feedback("info", "まず接続元のバッグ・設備を選ぼう", "液を送り出すバッグまたは設備をクリックしてから、この入口を選びます。"); return; }
            finishConnection("purify", port);
          });
          ports.append(inlet);
        });
        cell.append(ports);
        $("slots").append(cell);
      } else $("slots").append(button);
    }
    $("connections").replaceChildren();
    state.edges.forEach((edge) => {
      const row = document.createElement("li");
      const label = edgeLabel(edge);
      const text = document.createElement("span");
      text.textContent = label;
      const button = document.createElement("button");
      button.textContent = "外す";
      button.setAttribute("aria-label", `${label}の接続を外す`);
      button.disabled = running;
      button.addEventListener("click", () => {
        detach(edge);
        $("undo-disconnect").focus();
      });
      row.append(text, button);
      $("connections").append(row);
    });
    if (!state.edges.length) {
      const empty = document.createElement("li");
      empty.textContent = "まだ接続はありません";
      $("connections").append(empty);
    }
    $("connection-count").textContent = state.edges.length;
    $("board-count").textContent = `${state.nodes.length} EQUIPMENT / ${state.edges.length} CONNECTIONS`;
    $("connect-mode").setAttribute("aria-pressed", String(mode === "connect"));
    $("delete-mode").setAttribute("aria-pressed", String(mode === "delete"));
    $("move-mode").setAttribute("aria-pressed", String(mode === "move"));
    $("disconnect-mode").setAttribute("aria-pressed", String(mode === "disconnect"));
    $("workshop-mode").setAttribute("aria-pressed", String(mode === "workshop"));
    ["connect-mode", "disconnect-mode", "delete-mode", "move-mode", "workshop-mode", "cancel-selection", "run", "undo-disconnect"].forEach((id) => { $(id).disabled = running; });
    $("cancel-selection").textContent = selectedPart ? "取付をキャンセル" : selectedEquipment ? "配置をキャンセル" : source ? mode === "move" ? "移動をキャンセル" : "接続をキャンセル" : "選択解除";
    $("run").textContent = running ? "確認中…" : stage.advanced ? "▶ レビューする" : "▶ 運転する";
    $("mode-instruction").textContent = running ? "学習用に加速した流れです。リセット・ミッション変更で中止できます。" : selectedEquipment ? `${game.equipment[selectedEquipment].name}：空き区画をクリックして配置` : mode === "delete" ? "削除する設備をクリック。関連する接続も削除します。" : source ? `② ${game.equipment[source].name}から「ここへ」の設備を選ぶ。マウスで矢印を確認 → クリックで確定。` : "① 接続元の設備をクリック → ②「ここへ」の設備をクリック。";
    $("next").hidden = !cleared || stageIndex === game.stages.length - 1;
    if (mode === "move" && !running) $("mode-instruction").textContent = source ? `${game.equipment[source].name}：移動先の空き区画をクリック。` : "設備をクリック → 空き区画をクリックで移動。接続は保持します。";
    if (source && mode === "connect" && !running) $("mode-instruction").textContent += " キャンセルしても既存の接続は残ります。";
    if (stage.ports && source && mode === "connect" && !running) $("mode-instruction").textContent = `${game.equipment[source].name}から：精製へ送る場合は、設備に表示された入口を直接クリック。キャンセルしても既存の接続は残ります。`;
    if (mode === "disconnect" && !running) $("mode-instruction").textContent = "外す接続線をクリック。交差・重なり部分では接続を選択します。設備は残ります。";
    if (mode === "workshop" && !running) $("mode-instruction").textContent = selectedPart ? `${selectedPart.name}を持っています → 対応する設備・チューブへ取り付ける。` : "部材棚で調べる → 持つ → 設備・チューブへ取り付ける。使用済み部材は対象を選んで先に外します。";
    renderPipes();
    if (focusedSlot !== undefined) {
      const replacement = $("slots").querySelector(`[data-slot="${focusedSlot}"]`);
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    }
    if (focusedPort !== undefined) {
      const replacement = $("slots").querySelector(`[data-port="${focusedPort}"]`);
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    }
    if (focusedWork) {
      const replacement = $(focusedWork);
      if (replacement && !replacement.disabled) replacement.focus({ preventScroll: true });
    }
  }
  function run() {
    if (running) return;
    closePicker();
    cancelRun();
    source = null;
    selectedEquipment = null;
    selectedPart = null;
    cleared = false;
    const stage = game.stages[stageIndex];
    const result = game.validate(state, stage);
    reviewIssues = [];
    reviewShown = Boolean(stage.capacity || stage.layout);
    reviewStep = 0;
    running = true;
    const token = generation;
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 180 : 700;
    let index = 0;
    function tick() {
      if (token !== generation) return;
      if (reviewShown && reviewStep < 6) {
        reviewStep += 1;
        feedback("running", "受入・作業性を試しています", "学習用の模式表示です。容量と作業区画の条件を確認します。");
        render();
        timer = setTimeout(tick, matchMedia("(prefers-reduced-motion: reduce)").matches ? 60 : 180);
        return;
      }
      if (index < result.route.length) {
        active = result.route[index];
        state.edges.filter((edge) => edge.to === active).forEach((edge) => animatedEdges.push(`${edge.from}:${edge.to}`));
        note(active);
        feedback("running", `${game.equipment[active].name}${game.stages[stageIndex].advanced ? "の仕様を確認中" : "を通過中"}`, game.equipment[active].role);
        index += 1;
        render();
        timer = setTimeout(tick, delay);
        return;
      }
      timer = null;
      running = false;
      active = null;
      stopped = result.stop;
      cleared = result.ok;
      reviewIssues = result.issues || [];
      if (result.ok) completed.add(stageIndex);
      feedback(result.ok ? "success" : "error", stageIndex === 2 && result.ok ? "工場完成！ 3つの学びをつなげたね" : result.title, result.message);
      render();
      if (result.ok) showCompletion();
    }
    tick();
  }
  $("connect-mode").addEventListener("click", () => chooseMode("connect"));
  $("delete-mode").addEventListener("click", () => chooseMode("delete"));
  $("move-mode").addEventListener("click", () => chooseMode("move"));
  $("disconnect-mode").addEventListener("click", () => chooseMode("disconnect"));
  $("workshop-mode").addEventListener("click", () => chooseMode("workshop"));
  $("picker-cancel").addEventListener("click", () => {
    closePicker();
    $("disconnect-mode").focus();
  });
  $("undo-disconnect").addEventListener("click", () => {
    if (running || !lastDisconnected) return;
    const { edge, index } = lastDisconnected;
    const result = game.connect(state, edge.from, edge.to, edge.port || "product");
    if (!result.ok) { feedback("error", "元に戻せません", result.message); return; }
    const restored = state.edges.pop();
    state.edges.splice(index, 0, restored);
    if (game.stages[stageIndex].parts) game.workshop.invalidate(state, "connected");
    edited(`${edgeLabel(edge)}の接続を元に戻しました。`);
    $("disconnect-mode").focus();
  });
  $("cancel-selection").addEventListener("click", cancelSelection);
  $("reset").addEventListener("click", () => loadStage(stageIndex));
  const nextStage = () => { if (cleared && stageIndex < game.stages.length - 1) loadStage(stageIndex + 1); };
  $("next").addEventListener("click", nextStage);
  $("completion-next").addEventListener("click", nextStage);
  $("completion-close").addEventListener("click", () => $("completion").close());
  $("completion").addEventListener("close", () => {
    if (cleared) $("run").focus();
  });
  $("run").addEventListener("click", run);
  $("help-toggle").addEventListener("click", () => {
    const expanded = $("help-toggle").getAttribute("aria-expanded") !== "true";
    $("help-toggle").setAttribute("aria-expanded", String(expanded));
    $("help").hidden = !expanded;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && $("completion").open) {
      event.preventDefault();
      $("completion").close();
      return;
    }
    if (event.key === "Escape" && !running) {
      cancelSelection();
    }
  });
  loadStage(0);
  new ResizeObserver(renderPipes).observe($("board"));
}());
