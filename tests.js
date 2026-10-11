(function () {
  "use strict";
  const game = globalThis.FactoryGame;
  const cases = [];
  const test = (name, run) => cases.push({ name, run });
  function assert(condition, message = "期待した結果と異なります") {
    if (!condition) throw new Error(message);
  }
  function equal(actual, expected) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
  function solution(index, slots = [0, 1, 2, 3, 4]) {
    const state = game.createState();
    const required = game.stages[index].required;
    required.forEach((id, i) => assert(game.place(state, id, slots[i]).ok));
    required.slice(1).forEach((id, i) => assert(game.connect(state, required[i], id).ok));
    return state;
  }
  function rejects(state, index, title) {
    const result = game.validate(state, game.stages[index]);
    assert(!result.ok);
    assert(result.title.includes(title), result.title);
    return result;
  }
  game.stages.slice(0, 3).forEach((stage, index) => {
    test(`ステージ${index + 1}：正しい工程でクリア`, () => {
      const result = game.validate(solution(index), stage);
      assert(result.ok);
      equal(result.route, stage.required);
      assert(result.message === stage.lesson);
    });
    test(`ステージ${index + 1}：位置を逆順・別行に変えてもクリア`, () => {
      assert(game.validate(solution(index, [17, 6, 15, 0, 11]), stage).ok);
    });
  });
  test("未配置の設備を名前で知らせる", () => {
    const result = rejects(game.createState(), 0, "足りません");
    assert(result.message.includes("培地調製") && result.message.includes("培養"));
    equal(result.route, []);
  });
  test("未接続で出発設備に停止する", () => {
    const state = solution(0);
    state.edges = [];
    const result = rejects(state, 0, "止まり");
    equal(result.route, ["prepare"]);
    equal(result.stop, "prepare");
  });
  test("途中の接続切れまで流れを表示する", () => {
    const state = solution(2);
    game.disconnect(state, "harvest", "purify");
    const result = rejects(state, 2, "止まり");
    equal(result.route, ["prepare", "culture", "harvest"]);
    equal(result.stop, "harvest");
  });
  test("回収を飛ばして精製に接続すると理由が出る", () => {
    const state = solution(2);
    game.disconnect(state, "culture", "harvest");
    game.connect(state, "culture", "purify");
    const result = rejects(state, 2, "順番");
    equal(result.stop, "culture");
    assert(result.message.includes("回収"));
  });
  test("逆順の接続を誤クリアしない", () => {
    const state = solution(0);
    state.edges = [{ from: "culture", to: "prepare" }];
    rejects(state, 0, "逆流");
  });
  test("正しい経路があっても分岐を誤クリアしない", () => {
    const state = solution(2);
    game.connect(state, "culture", "purify");
    rejects(state, 2, "分岐");
  });
  test("循環経路を検知する", () => {
    const state = solution(2);
    game.connect(state, "store", "culture");
    rejects(state, 2, "循環");
  });
  test("出発点から到達しない循環も検知する", () => {
    const state = solution(2);
    state.edges = [{ from: "prepare", to: "culture" }, { from: "purify", to: "store" }, { from: "store", to: "purify" }];
    rejects(state, 2, "循環");
  });
  test("正しい経路に不要設備があってもクリアしない", () => {
    const state = solution(0);
    game.place(state, "store", 7);
    rejects(state, 0, "使わない");
  });
  test("未配置設備への接続を検知する", () => {
    const state = solution(0);
    state.edges.push({ from: "culture", to: "store" });
    rejects(state, 0, "接続データ");
  });
  test("重複接続データを検知する", () => {
    const state = solution(0);
    state.edges.push({ from: "prepare", to: "culture" });
    rejects(state, 0, "重複");
  });
  test("無効なミッションを明示する", () => {
    assert(!game.validate(game.createState(), null).ok);
  });
  test("重複設備データを検知する", () => {
    const state = solution(0);
    state.nodes.push({ id: "culture", slot: 8 });
    rejects(state, 0, "設備データ");
  });
  test("存在しない設備を配置しない", () => {
    const state = game.createState();
    assert(!game.place(state, "unknown", 0).ok);
    equal(state.nodes, []);
  });
  test("区画の範囲と整数を検証する", () => {
    [-1, 18, 1.5, NaN].forEach((slot) => assert(!game.place(game.createState(), "culture", slot).ok));
  });
  test("同じ区画には二台置けない", () => {
    const state = game.createState();
    game.place(state, "prepare", 0);
    assert(!game.place(state, "culture", 0).ok);
    assert(state.nodes.length === 1);
  });
  test("同じ設備は一台まで", () => {
    const state = game.createState();
    game.place(state, "prepare", 0);
    assert(!game.place(state, "prepare", 1).ok);
  });
  test("自己接続は操作時に理由付きで拒否する", () => {
    const state = solution(0);
    const result = game.connect(state, "prepare", "prepare");
    assert(!result.ok && result.message.includes("同じ設備"));
    assert(state.edges.length === 1);
  });
  test("重複接続は操作時に拒否する", () => {
    const state = solution(0);
    assert(!game.connect(state, "prepare", "culture").ok);
    assert(state.edges.length === 1);
  });
  test("未配置設備は接続できない", () => {
    assert(!game.connect(game.createState(), "prepare", "culture").ok);
  });
  test("設備削除は入出力の接続も削除する", () => {
    const state = solution(2);
    assert(game.removeNode(state, "harvest").ok);
    assert(!state.nodes.some((node) => node.id === "harvest"));
    assert(!state.edges.some((edge) => edge.from === "harvest" || edge.to === "harvest"));
    assert(state.edges.length === 2);
  });
  test("接続削除・再接続でクリアできる", () => {
    const state = solution(0);
    assert(game.disconnect(state, "prepare", "culture").ok);
    assert(!game.validate(state, game.stages[0]).ok);
    assert(game.connect(state, "prepare", "culture").ok);
    assert(game.validate(state, game.stages[0]).ok);
  });
  test("存在しない設備・接続の削除を明示する", () => {
    const state = game.createState();
    assert(!game.removeNode(state, "culture").ok);
    assert(!game.disconnect(state, "prepare", "culture").ok);
  });
  test("検査自体は設計状態を変更しない", () => {
    const state = solution(2);
    const before = JSON.stringify(state);
    game.validate(state, game.stages[2]);
    assert(JSON.stringify(state) === before);
  });
  test("全ての設備・ステージに教材説明がある", () => {
    Object.values(game.equipment).forEach((item) => assert(item.name && item.role && item.material));
    game.stages.forEach((stage) => assert(stage.required.every((id) => game.equipment[id]) && stage.lesson));
  });
  test("2つの設計状態は独立している", () => {
    const first = game.createState();
    const second = game.createState();
    game.place(first, "culture", 0);
    equal(second.nodes, []);
  });
  function advancedSolution(index, capacity = 150) {
    const stage = game.stages[index];
    const state = game.missions.initialState(stage);
    state.nodes = [];
    const slots = stage.layout ? [0, 2, 4, 12, 14, 16] : [0, 2, 4, 6, 8, 10];
    stage.required.forEach((id, i) => assert(game.place(state, id, slots[i]).ok));
    state.edges = stage.connections.map((edge) => ({ ...edge }));
    state.capacity = capacity;
    state.tube = "AB";
    state.parts = { bag: "new", tubing: "new", frame: "retain", drive: "retain" };
    state.checks = { specified: true, package: true, connected: true, reusable: true };
    return state;
  }
  test("ミッションは計10件、初期の総合問題は不備5件", () => {
    assert(game.stages.length === 10);
    assert(game.missions.issues(game.missions.initialState(game.stages[9]), game.stages[9]).length === 5);
  });
  game.stages.slice(3).forEach((stage, offset) => {
    const index = offset + 3;
    test(`ミッション${index + 1}：指定条件を満たす設計でクリア`, () => {
      const state = advancedSolution(index);
      const before = JSON.stringify(state);
      assert(game.validate(state, stage).ok);
      assert(JSON.stringify(state) === before);
    });
    test(`ミッション${index + 1}：未修正の初期状態はクリアしない`, () => {
      assert(!game.validate(game.missions.initialState(stage), stage).ok);
    });
    test(`ミッション${index + 1}：必要設備の削除を検知`, () => {
      const state = advancedSolution(index);
      game.removeNode(state, stage.required[0]);
      assert(!game.validate(state, stage).ok);
    });
    test(`ミッション${index + 1}：余分な接続・循環を誤クリアしない`, () => {
      const state = advancedSolution(index);
      state.edges.push({ from: stage.required[stage.required.length - 1], to: stage.required[0], port: "product" });
      assert(!game.validate(state, stage).ok);
    });
  });
  test("ミッション5：緩衝液を抗体液入口へつないだ場合は拒否", () => {
    const state = advancedSolution(4);
    state.edges.find((edge) => edge.from === "bufferA").port = "product";
    assert(!game.validate(state, game.stages[4]).ok);
  });
  test("ミッション5：緩衝液A・Bを逆の口へつないだ場合は拒否", () => {
    const state = advancedSolution(4);
    state.edges.find((edge) => edge.from === "bufferA").port = "bufferB";
    state.edges.find((edge) => edge.from === "bufferB").port = "bufferA";
    assert(!game.validate(state, game.stages[4]).ok);
  });
  [5, 9].forEach((index) => {
    test(`ミッション${index + 1}：150 Lと250 Lはいずれも正解、80 Lは不可`, () => {
      [150, 250].forEach((capacity) => assert(game.validate(advancedSolution(index, capacity), game.stages[index]).ok));
      assert(!game.validate(advancedSolution(index, 80), game.stages[index]).ok);
    });
  });
  test("ミッション7：片端のみの適合と逆向きは拒否", () => {
    ["AA", "BB", "BA"].forEach((tube) => {
      const state = advancedSolution(6);
      state.tube = tube;
      assert(!game.validate(state, game.stages[6]).ok);
    });
  });
  test("ミッション8：確認済みでも包装損傷・使用済み部材は拒否", () => {
    ["bag", "tubing"].forEach((part) => {
      ["used", "damaged"].forEach((value) => {
        const state = advancedSolution(7);
        state.parts[part] = value;
        assert(!game.validate(state, game.stages[7]).ok);
      });
    });
  });
  test("ミッション8：再使用機器の廃棄・確認の欠落は拒否", () => {
    ["frame", "drive"].forEach((part) => {
      const state = advancedSolution(7);
      state.parts[part] = "discard";
      assert(!game.validate(state, game.stages[7]).ok);
    });
    Object.keys(advancedSolution(7).checks).forEach((check) => {
      const state = advancedSolution(7);
      state.checks[check] = false;
      assert(!game.validate(state, game.stages[7]).ok);
    });
  });
  test("ミッション9：複数の配置でクリアできる", () => {
    [[0, 4], [12, 17], [2, 12]].forEach(([culture, store]) => {
      const state = advancedSolution(8);
      state.nodes.find((node) => node.id === "culture").slot = culture;
      state.nodes.find((node) => node.id === "store").slot = store;
      assert(game.validate(state, game.stages[8]).ok);
    });
  });
  test("ミッション9：通路・作業領域・右端の配置を検査する", () => {
    [[7, 4], [0, 1], [5, 12], [12, 13]].forEach(([culture, store]) => {
      const state = advancedSolution(8);
      state.nodes.find((node) => node.id === "culture").slot = culture;
      state.nodes.find((node) => node.id === "store").slot = store;
      assert(!game.validate(state, game.stages[8]).ok);
    });
  });
  test("総合レビューは全ての未達条件を返す", () => {
    const stage = game.stages[9];
    const state = game.missions.initialState(stage);
    const result = game.validate(state, stage);
    assert(result.issues.length === 5);
    ["接続", "容量", "規格", "部材", "配置"].forEach((word) => assert(result.message.includes(word)));
    state.capacity = 150;
    assert(game.validate(state, stage).issues.length === 4);
  });
  test("高度ミッションの状態はリセット用に独立生成する", () => {
    const stage = game.stages[9];
    const first = game.missions.initialState(stage);
    first.parts.bag = "new";
    first.edges[0].port = "bufferA";
    first.nodes[0].slot = 17;
    const second = game.missions.initialState(stage);
    assert(second.parts.bag === "used");
    assert(second.edges[0].port === "product");
    assert(second.nodes[0].slot === 0);
  });
  test("不正な接続口・重複接続を追加できない", () => {
    const state = solution(0);
    game.disconnect(state, "prepare", "culture");
    assert(!game.connect(state, "prepare", "culture", "unknown").ok);
    assert(game.connect(state, "prepare", "culture", "bufferA").ok);
    assert(!game.connect(state, "prepare", "culture", "bufferB").ok);
  });
  test("ミッション4〜10の設備重複・区画重複を検出", () => {
    const state = advancedSolution(9);
    state.nodes[0].slot = state.nodes[1].slot;
    assert(!game.validate(state, game.stages[9]).ok);
  });
  const act = (state, stage, action, target, item) => game.workshop.action(state, stage, action, target, item);
  function exchange(state, stage, target, value = "new") {
    assert(act(state, stage, "remove", target).ok);
    assert(act(state, stage, "install", target, `${target}-${value}`).ok);
  }
  function inspectBoth(state, stage) {
    ["bag", "tubing"].forEach((target) => ["specified", "package", "connected"].forEach((kind) => assert(act(state, stage, kind, target).ok)));
    ["frame", "drive"].forEach((target) => assert(act(state, stage, "service", target).ok));
  }
  test("部材棚：各ミッションで使える部材だけ表示", () => {
    equal(game.workshop.available(game.stages[5]).map((item) => item.kind), ["capacity", "capacity", "capacity"]);
    equal(game.workshop.available(game.stages[6]).map((item) => item.kind), ["tube", "tube", "tube", "tube"]);
    assert(game.workshop.available(game.stages[7]).length === 4);
    assert(game.workshop.available(game.stages[9]).length === 11);
  });
  test("容量バッグ：取り付ける操作で複数正解を維持", () => {
    [80, 150, 250].forEach((capacity) => {
      const stage = game.stages[5], state = game.missions.initialState(stage);
      assert(act(state, stage, "install", "capacity", `capacity-${capacity}`).ok);
      assert(game.validate(state, stage).ok === (capacity >= 120));
    });
  });
  test("規格チューブ：取り付ける操作で両端を評価", () => {
    ["AA", "AB", "BB", "BA"].forEach((tube) => {
      const stage = game.stages[6], state = game.missions.initialState(stage);
      assert(act(state, stage, "install", "tubing", `tube-${tube}`).ok);
      assert(game.validate(state, stage).ok === (tube === "AB"));
    });
  });
  test("部材操作：違う取付先・不明部材は状態を変更せず通知", () => {
    const stage = game.stages[9], state = game.missions.initialState(stage), before = JSON.stringify(state);
    [["bag", "capacity-150"], ["capacity", "tube-AB"], ["tubing", "unknown"]].forEach(([target, item]) => {
      const result = act(state, stage, "install", target, item);
      assert(!result.ok && result.message.length > 0);
      assert(JSON.stringify(state) === before);
    });
  });
  test("交換：使用済みを先に外す必要があり、設備と経路は保持", () => {
    const stage = game.stages[7], state = game.missions.initialState(stage);
    assert(!act(state, stage, "install", "bag", "bag-new").ok);
    const nodes = JSON.stringify(state.nodes), edges = JSON.stringify(state.edges);
    assert(act(state, stage, "remove", "bag").ok);
    assert(state.parts.bag === null && state.parts.frame === "retain");
    assert(JSON.stringify(state.nodes) === nodes && JSON.stringify(state.edges) === edges);
    assert(!game.validate(state, stage).ok);
    assert(!act(state, stage, "remove", "bag").ok);
    assert(act(state, stage, "install", "bag", "bag-new").ok);
  });
  test("包装確認：使用済み・包装損傷を確認済みにはできない", () => {
    const stage = game.stages[7], state = game.missions.initialState(stage);
    assert(!act(state, stage, "package", "bag").ok);
    exchange(state, stage, "bag", "damaged");
    assert(!act(state, stage, "package", "bag").ok);
    assert(!state.checks.package);
  });
  test("取付確認：部材が外れたまま確認できない", () => {
    const stage = game.stages[7], state = game.missions.initialState(stage);
    exchange(state, stage, "bag");
    assert(act(state, stage, "remove", "tubing").ok);
    assert(!act(state, stage, "connected", "bag").ok);
    assert(!act(state, stage, "specified", "tubing").ok);
  });
  test("清掃確認：架台と駆動機器の両方を扱って完了", () => {
    const stage = game.stages[7], state = game.missions.initialState(stage);
    assert(act(state, stage, "service", "frame").ok);
    assert(!state.checks.reusable);
    assert(act(state, stage, "service", "drive").ok);
    assert(state.checks.reusable && state.parts.drive === "retain");
  });
  test("使用前確認：両接液部材の確認が必要", () => {
    const stage = game.stages[7], state = game.missions.initialState(stage);
    exchange(state, stage, "bag");
    exchange(state, stage, "tubing");
    assert(act(state, stage, "package", "bag").ok);
    assert(!state.checks.package);
    inspectBoth(state, stage);
    assert(game.validate(state, stage).ok);
  });
  test("部材再交換：確認を取り消し、再使用機器の確認は保持", () => {
    const stage = game.stages[7], state = game.missions.initialState(stage);
    exchange(state, stage, "bag");
    exchange(state, stage, "tubing");
    inspectBoth(state, stage);
    exchange(state, stage, "bag");
    assert(!state.checks.specified && !state.checks.package && !state.checks.connected);
    assert(state.checks.reusable && state.service.frame && state.service.drive);
  });
  test("接続変更：取付確認を取り消し他の確認は保持", () => {
    const stage = game.stages[7], state = game.missions.initialState(stage);
    exchange(state, stage, "bag");
    exchange(state, stage, "tubing");
    inspectBoth(state, stage);
    game.workshop.invalidate(state, "connected");
    assert(!state.checks.connected && state.checks.package && state.checks.reusable);
  });
  test("部材操作：取付設備・経路がないと操作できない", () => {
    const stage = game.stages[9], state = game.missions.initialState(stage);
    game.removeNode(state, "store");
    assert(!act(state, stage, "install", "capacity", "capacity-150").ok);
    assert(!act(state, stage, "install", "tubing", "tube-AB").ok);
  });
  test("総合：部材操作で修正してクリアでき、リセット状態と独立", () => {
    const stage = game.stages[9], state = game.missions.initialState(stage);
    state.edges = stage.connections.map((edge) => ({ ...edge }));
    state.nodes.find((node) => node.id === "store").slot = 17;
    assert(act(state, stage, "install", "capacity", "capacity-250").ok);
    assert(act(state, stage, "install", "tubing", "tube-AB").ok);
    exchange(state, stage, "bag");
    exchange(state, stage, "tubing");
    inspectBoth(state, stage);
    assert(game.validate(state, stage).ok);
    const reset = game.missions.initialState(stage);
    assert(!reset.service.frame && !reset.inspections.bag.package && reset.capacity === 80);
    assert(game.validate(reset, stage).issues.length === 5);
  });
  let passed = 0;
  cases.forEach(({ name, run }) => {
    const row = document.createElement("li");
    try {
      run();
      passed += 1;
      row.className = "pass";
      row.textContent = `PASS — ${name}`;
    } catch (error) {
      row.className = "fail";
      row.textContent = `FAIL — ${name}: ${error.message}`;
      console.error(name, error);
    }
    document.getElementById("results").append(row);
  });
  const failed = cases.length - passed;
  document.getElementById("summary").textContent = `${passed}/${cases.length} passed; ${failed} failed`;
  document.body.dataset.testStatus = failed ? "failed" : "passed";
}());
