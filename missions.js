(function () {
  "use strict";
  const game = globalThis.FactoryGame;
  const bag = (name, role) => ({ name, short: name, icon: "bag", color: "#3b998c", role, material: "この課題では使い捨てバッグを使用します。支持容器などは別の再使用機器です。" });
  Object.assign(game.equipment, {
    feed: bag("培地供給バッグ", "調製済みの培地を保持し、培養設備に供給します。この課題で指定された構成例です。"),
    receive: bag("培養液受入バッグ", "培養後の液を受け入れ、一時的に保持します。培地の供給バッグとは用途が異なります。"),
    bufferA: bag("緩衝液Aバッグ", "架空の緩衝液Aを、精製設備の緩衝液A入口へ供給します。Aは液の種類であり、チューブの接続規格ではありません。"),
    bufferB: bag("緩衝液Bバッグ", "架空の緩衝液Bを、精製設備の緩衝液B入口へ供給します。Bは液の種類であり、チューブの接続規格ではありません。")
  });
  const product = (from, to) => ({ from, to, port: "product" });
  const supply = (from, port) => ({ from, to: "purify", port });
  const graph = [product("culture", "harvest"), product("harvest", "purify"), product("purify", "store")];
  const buffers = [supply("bufferA", "bufferA"), supply("bufferB", "bufferB")];
  const stages = [
    {
      title: "培養の準備が整わない！", description: "設置済みの調製・培養設備に、培地の供給バッグと培養液の受入バッグを追加しよう。",
      required: ["prepare", "feed", "culture", "receive"], initial: [["prepare", 6], ["culture", 10]],
      connections: [product("prepare", "feed"), product("feed", "culture"), product("culture", "receive")],
      specification: "指定構成：培地調製 → 培地供給バッグ → 培養 → 培養液受入バッグ。ポンプなどは今回省略。",
      lesson: "液を調製する設備と、供給・受入のために保持する容器は役割が異なります。独立したバッグが常に必要とは限らず、これは課題で指定した構成です。"
    },
    {
      title: "精製に必要な液を届けよう", description: "製品の主流路は完成済み。2種類の緩衝液バッグを置き、指定された供給口へ接続しよう。",
      required: ["culture", "harvest", "purify", "store", "bufferA", "bufferB"],
      initial: [["culture", 6], ["harvest", 8], ["purify", 10], ["store", 16]], initialEdges: graph,
      connections: [...graph, ...buffers], ports: true,
      specification: "抗体を含む液は「抗体液入口」。緩衝液Aは精製の「緩衝液A入口」、Bは「緩衝液B入口」へ。バッグを選び、設備に表示された入口を直接クリックしてください。Aは案内付き、Bは自分で判断します。",
      lesson: "製品液の経路だけでは工程は動きません。補助液は、種類ごとに指定の供給口へ届けます。緩衝液A・Bは学習用の架空仕様です。"
    },
    {
      title: "このバッグで足りる？", description: "受入液量は120 L。部材棚で容量バッグを調べ、保管設備へ取り付けて受入を試そう。",
      required: ["purify", "store"], initial: [["purify", 6], ["store", 10]], initialEdges: [product("purify", "store")],
      connections: [product("purify", "store")], capacity: true,
      specification: "受入液量120 L。バッグの使用可能容量：80 L / 150 L / 250 L。分割受入は不可。容量以外の制約はありません。",
      lesson: "使用可能容量が受入液量以上であれば条件を満たします。150 Lと250 Lはどちらも正解。容量は外見ではなく仕様で確認します。"
    },
    {
      title: "合っているのは順番だけ？", description: "精製の出口はA型、原薬保管バッグの入口はB型。部材棚から両端に合うチューブを選び、移送経路へ取り付けよう。",
      required: ["purify", "store"], initial: [["purify", 6], ["store", 10]], initialEdges: [product("purify", "store")],
      connections: [product("purify", "store")], tube: true,
      specification: "架空の接続規格：精製出口A型 → バッグ入口B型。部材の表記は「接続元側 → 接続先側」。長さ・滅菌状態などの適格性は今回対象外。",
      lesson: "片端が合っていても接続は成立しません。今回はA型 → B型が適合。実際には承認仕様、材質、使用条件、滅菌状態などの確認も必要です。"
    },
    {
      title: "次のバッチの準備をしよう", description: "培養設備と移送経路の使用済み接液部材を外し、新品へ交換しよう。包装を調べて部位ごとに確認し、再使用機器は残して整備しよう。",
      required: ["culture", "store"], initial: [["culture", 6], ["store", 10]], initialEdges: [product("culture", "store")],
      connections: [product("culture", "store")], parts: true,
      specification: "交換対象：培養バッグと移送チューブ。架台・駆動機器は残して所定の清掃・確認を実施。指定の新品を使用し、包装の状態と接続状態を確認。図は交換対象を示す模式図で、培養から原薬が直接できる意味ではありません。",
      lesson: "シングルユースは設備全体を捨てることではありません。指定の接液部材を交換し、再使用機器の清掃・確認も行います。新品でも包装に損傷がある部材はこの課題では使用しません。"
    },
    {
      title: "つながるけれど、作業できない！", description: "工程は接続済み。でも搬入・搬出通路を設備がふさいでいます。「設備を移動」で作業可能な配置に直そう。",
      required: ["culture", "store"], initial: [["culture", 7], ["store", 8]], initialEdges: [product("culture", "store")],
      connections: [product("culture", "store")], layout: true,
      specification: "中央の6区画（区画7〜12）は搬入→搬出の通路として空ける。培養設備の右隣1区画を交換作業用に空ける（同じ行・通路との兼用不可）。配管線は概念表示で通路障害としては評価しません。図は配置練習用で実製造フローではありません。",
      lesson: "設備が収まるだけでは不十分。指定された作業領域と搬入・搬出経路を確保します。この課題の区画条件は法規やGMPの基準値ではありません。"
    },
    {
      title: "工場の設計レビューに挑戦！", description: "引き継いだ工場には5件の不備があります。仕様書を調べて修正し、「レビューする」で残る条件と理由を確認しよう。",
      required: ["culture", "harvest", "purify", "store", "bufferA", "bufferB"],
      initial: [["culture", 0], ["harvest", 2], ["purify", 4], ["store", 8], ["bufferA", 12], ["bufferB", 14]],
      initialEdges: [...graph, supply("bufferA", "bufferB"), supply("bufferB", "bufferB")],
      connections: [...graph, ...buffers], ports: true, capacity: true, tube: true, parts: true, layout: true, review: true,
      specification: "主流路：培養 → 回収 → 精製 → 原薬保管。緩衝液A・Bは精製の各指定口へ。受入120 L。精製出口A型→保管入口B型。指定の接液部材を新品に交換し使用前確認。再使用機器は清掃・確認して残す。中央通路を空け、培養の右隣を作業用に確保。",
      lesson: "供給・容量・接続・部材・作業性を横断して確認できました。条件を満たす配置やバッグ選定は一つではありません。ゲームの合格は実設計・GMP適合性を保証しません。"
    }
  ];
  stages.forEach((stage) => {
    stage.advanced = true;
    game.stages.push(stage);
  });
  const portNames = { product: "抗体液入口", bufferA: "緩衝液A入口", bufferB: "緩衝液B入口" };
  const key = (edge) => `${edge.from}:${edge.to}:${edge.port || "product"}`;

  function initialState(stage) {
    const state = game.createState();
    (stage.initial || []).forEach(([id, slot]) => game.place(state, id, slot));
    state.edges = (stage.initialEdges || []).map((edge) => ({ ...edge }));
    state.capacity = 80;
    state.tube = "AA";
    state.parts = { bag: "used", tubing: "used", frame: "retain", drive: "retain" };
    state.checks = { specified: false, package: false, connected: false, reusable: false };
    state.inspections = { bag: {}, tubing: {} };
    state.service = { frame: false, drive: false };
    return state;
  }
  const stock = [
    ...[80, 150, 250].map((value) => ({ id: `capacity-${value}`, kind: "capacity", value, name: `${value} Lバッグ`, detail: `使用可能容量 ${value} L。受入液量と比較して選びます。`, shape: "bag" })),
    ...["AA", "AB", "BB", "BA"].map((value) => ({ id: `tube-${value}`, kind: "tube", value, name: `${value[0]}型 → ${value[1]}型`, detail: `左が接続元側、右が接続先側。包装は健全な指定部材（学習用）。`, shape: "tube" })),
    ...["bag", "tubing"].flatMap((kind) => ["new", "damaged"].map((value) => ({
      id: `${kind}-${value}`, kind, value, name: `${kind === "bag" ? "接液バッグ一式" : "移送チューブ一式"}・新品${value === "damaged" ? "（包装損傷）" : ""}`,
      detail: `指定部材のラベルあり。${value === "damaged" ? "包装に破れがあります。新品であっても、この課題では使えません。" : "包装に損傷はありません。"}`,
      shape: kind === "bag" ? "bag" : "tube"
    })))
  ];
  function available(stage) {
    return stock.filter((item) => stage[item.kind === "bag" || item.kind === "tubing" ? "parts" : item.kind]);
  }
  function invalidate(state, kind) {
    ["bag", "tubing"].forEach((id) => {
      if (kind) delete state.inspections[id][kind];
      else state.inspections[id] = {};
    });
    (kind ? [kind] : ["specified", "package", "connected"]).forEach((id) => { state.checks[id] = false; });
  }
  function workshopAction(state, stage, action, target, itemId) {
    const fail = (message) => ({ ok: false, message });
    const tubeFrom = stage.required.includes("purify") ? "purify" : "culture";
    const mounted = target === "tubing" ? state.edges.some((edge) => edge.from === tubeFrom && edge.to === "store") :
      state.nodes.some((node) => node.id === (target === "capacity" ? "store" : "culture"));
    if (!mounted) return fail("取付対象がありません。設備・接続を先に戻してください。");
    if (action === "install") {
      const item = available(stage).find((entry) => entry.id === itemId);
      if (!item) return fail("このミッションでは使えない部材です。部材棚から選び直してください。");
      const destination = item.kind === "tube" ? "tubing" : item.kind;
      if (target !== destination) return fail("取付先が違います。容量バッグは保管設備、接液バッグは培養設備、チューブは移送経路へ取り付けます。");
      if ((item.kind === "bag" || item.kind === "tubing") && state.parts[item.kind] !== null) return fail("先に使用中の接液部材を外してください。架台・駆動機器は残します。");
      if (item.kind === "capacity" || item.kind === "tube") state[item.kind] = item.value;
      else state.parts[item.kind] = item.value;
      invalidate(state);
      return { ok: true, message: `${item.name}を取り付けました。${stage.parts ? "部材を変更したので、使用前確認をやり直してください。" : "レビューで仕様との適合を確認しましょう。"}` };
    }
    if (action === "remove") {
      if (!stage.parts || !["bag", "tubing"].includes(target)) return fail("交換対象は接液バッグと移送チューブです。");
      if (state.parts[target] === null) return fail("この部材はすでに外れています。新品を選んで取り付けてください。");
      state.parts[target] = null;
      invalidate(state);
      return { ok: true, message: "接液部材を外しました。支持架台・駆動機器と、設計上の接続経路は残っています。新品を部材棚から選んで取り付けましょう。" };
    }
    if (action === "service") {
      if (!stage.parts || !["frame", "drive"].includes(target)) return fail("清掃・確認する再使用機器を選んでください。");
      state.parts[target] = "retain";
      state.service[target] = true;
      state.checks.reusable = state.service.frame && state.service.drive;
      return { ok: true, message: `${target === "frame" ? "支持架台" : "駆動機器"}を残し、清掃・確認を学習上の記録として完了しました。実設備の清掃を実行する機能ではありません。` };
    }
    if (action === "specified" || action === "package" || action === "connected") {
      if (!stage.parts || !["bag", "tubing"].includes(target)) return fail("確認する接液部材を選んでください。");
      const value = state.parts[target];
      if (value === null) return fail("部材が外れています。取り付けてから確認してください。");
      if (value === "used") return fail("使用済み部材です。次のバッチには指定の新品へ交換してください。");
      if (action === "package" && value === "damaged") return fail("包装の破れを確認しました。確認済みにはできません。健全な新品へ交換してください。");
      if (action === "connected" && (state.parts.bag === null || state.parts.tubing === null)) return fail("バッグ・チューブの両方を取り付けてから取付部を確認してください。");
      state.inspections[target][action] = true;
      state.checks[action] = ["bag", "tubing"].every((id) => state.inspections[id][action] === true);
      return { ok: true, message: `${target === "bag" ? "接液バッグ" : "移送チューブ"}の${{ specified: "仕様ラベル", package: "包装", connected: "取付部" }[action]}を確認しました。両部材の確認がそろうと、使用前確認が完了します。` };
    }
    return fail("不明な部材操作です。操作を選び直してください。");
  }
  function issues(state, stage) {
    const errors = [];
    const add = (message, stop = null, category = "connections") => errors.push({ message, stop, category });
    const ids = state.nodes.map((node) => node.id);
    const missing = stage.required.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !stage.required.includes(id));
    if (missing.length) add(`不足設備：${missing.map((id) => game.equipment[id].name).join("・")}を追加してください。`);
    if (extra.length) add("このミッションで指定されていない設備を取り除いてください。");
    if (new Set(ids).size !== ids.length || new Set(state.nodes.map((node) => node.slot)).size !== ids.length ||
        state.nodes.some((node) => !game.equipment[node.id] || !Number.isInteger(node.slot) || node.slot < 0 || node.slot >= 18)) {
      add("設備データが無効です。リセットしてください。");
    }
    const expected = new Set(stage.connections.map(key));
    const actual = new Set(state.edges.map(key));
    const absent = stage.connections.filter((edge) => !actual.has(key(edge)));
    const unwanted = state.edges.filter((edge) => !expected.has(key(edge)));
    if (absent.length || unwanted.length || actual.size !== state.edges.length) {
      const descriptions = absent.map((edge) => `${game.equipment[edge.from].name} → ${game.equipment[edge.to].name}${edge.to === "purify" && stage.ports ? `［${portNames[edge.port]}］` : ""}`);
      add(`接続を確認：${descriptions.length ? `必要な接続は ${descriptions.join("、")}。` : ""}${unwanted.length ? "指定と異なる接続を削除してください。" : ""}${actual.size !== state.edges.length ? "重複接続を削除してください。" : ""}`, absent[0] ? absent[0].from : unwanted[0] ? unwanted[0].from : null);
    }
    if (stage.capacity && ![150, 250].includes(state.capacity)) add("容量不足：受入液量120 Lを全量保持できる、使用可能容量150 Lまたは250 Lのバッグを選んでください。", "store", "capacity");
    if (stage.tube && state.tube !== "AB") add("接続規格不適合：精製出口A型 → 保管入口B型の両端に合うA→Bチューブを選んでください。", "purify", "tube");
    if (stage.parts) {
      const parts = state.parts || {};
      const checks = state.checks || {};
      if (parts.bag !== "new" || parts.tubing !== "new" || parts.frame !== "retain" || parts.drive !== "retain" ||
          !["specified", "package", "connected", "reusable"].every((id) => checks[id] === true)) {
        add("部材・使用前確認：指定のバッグとチューブを新品に交換。損傷のある包装は不可。架台・駆動機器は残し、指定部材・包装・接続・再使用機器の清掃と確認をすべて完了してください。", "culture", "parts");
      }
    }
    if (stage.layout) {
      const occupied = new Set(state.nodes.map((node) => node.slot));
      const culture = state.nodes.find((node) => node.id === "culture");
      if (state.nodes.some((node) => node.slot >= 6 && node.slot <= 11) || !culture ||
          culture.slot % 6 === 5 || occupied.has(culture.slot + 1) || (culture.slot + 1 >= 6 && culture.slot + 1 <= 11)) {
        add("配置条件未達：中央通路（区画7〜12）を空け、培養の右隣を同じ行の交換作業区画として空けてください。通路との兼用は不可です。", "culture", "layout");
      }
    }
    return errors;
  }
  const basicValidate = game.validate;
  game.validate = (state, stage) => {
    if (!stage || !stage.advanced) return basicValidate(state, stage);
    const errors = issues(state, stage);
    return errors.length ? {
      ok: false, title: `未達条件が${errors.length}件あります`,
      message: errors.map((item, index) => `${index + 1}. ${item.message}`).join("\n\n"),
      route: [], stop: errors[0].stop, issues: errors
    } : { ok: true, title: "ミッション成功！", message: stage.lesson, route: [...stage.required], stop: null, issues: [] };
  };
  game.missions = { initialState, issues, portNames };
  game.workshop = { available, action: workshopAction, invalidate };
}());
