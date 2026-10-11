(function () {
  "use strict";

  const equipment = {
    prepare: { name: "培地調製", short: "調製", icon: "mix", color: "#358c87", role: "細胞を育てるための培地を調製し、培養工程へ供給します。薬液・緩衝液調製のすべてを表す設備ではありません。", material: "例：使い捨ての混合バッグ・チューブ。支持容器や駆動機器は再使用します。" },
    culture: { name: "培養", short: "培養", icon: "vessel", color: "#467db5", role: "培地を使って細胞を育て、抗体を生産します。ここでは細胞培養用のシングルユースバイオリアクターを想定しています。", material: "例：使い捨ての培養バッグ。支持架台・制御装置などは再使用します。" },
    harvest: { name: "回収", short: "回収", icon: "filter", color: "#b38943", role: "培養液から細胞や細胞片などを除き、抗体を含む液を次の精製へ送ります。このゲームでは清澄化などを一つにまとめています。", material: "例：使い捨てのデプスフィルター・回収バッグ。フィルターだけで最終品質が保証されるわけではありません。" },
    purify: { name: "精製", short: "精製", icon: "columns", color: "#8c75b2", role: "抗体を分離し、不純物を減らします。クロマトグラフィー、ウイルス安全性に関する処理、濃縮・液交換などの複数工程をまとめた表現です。", material: "例：バッグ・チューブなどに使い捨てを採用。カラムや樹脂の再使用可否は仕様・工程に依存します。" },
    store: { name: "原薬保管", short: "保管", icon: "bag", color: "#47917a", role: "精製された原薬を、定められた条件で保管する工程です。原薬は最終容器へ充填された製剤とは異なります。", material: "例：保管用バッグ。実際の容器・保管条件は製品や工程の仕様に基づいて決めます。" }
  };
  const stages = [
    { title: "培養の準備をしよう", description: "細胞を育てるには、まず何が必要？ 培地を用意して、培養設備へ届けよう。", required: ["prepare", "culture"], lesson: "培地調製は、培養に必要な培地を用意する工程。培養では細胞が抗体を生産します。バッグと、それを支える機器の違いも覚えておきましょう。" },
    { title: "培養液を、原薬へつなごう", description: "培養は完了しています。抗体を含む培養液から、回収・精製を経て原薬保管までの経路を作ろう。", required: ["culture", "harvest", "purify", "store"], lesson: "回収は主に細胞や細胞片などを除く工程。精製は抗体の分離と不純物の低減などを行う複数工程です。回収だけでは原薬保管へ進めません。" },
    { title: "ひとつの工場を組み立てよう", description: "培地の準備から原薬の保管まで。5つの工程を一本につなぎ、工場全体の流れを完成させよう。", required: ["prepare", "culture", "harvest", "purify", "store"], lesson: "培地調製 → 培養 → 回収 → 精製 → 原薬保管。これが今回学んだ概念上の主流路です。実際には種培養、緩衝液供給、複数の精製操作や検査なども必要で、すべてが単純な連続運転ではありません。" }
  ];
  const createState = () => ({ nodes: [], edges: [] });
  const fail = (message) => ({ ok: false, message });

  function place(state, id, slot) {
    if (!equipment[id]) return fail("選択した設備が見つかりません。");
    if (!Number.isInteger(slot) || slot < 0 || slot >= 18) return fail("配置区画が無効です。");
    if (state.nodes.some((node) => node.slot === slot)) return fail("この区画には設備があります。空き区画を選んでください。");
    if (state.nodes.some((node) => node.id === id)) return fail("同じ設備は1台までです。配置済みの設備を使ってください。");
    state.nodes.push({ id, slot });
    return { ok: true };
  }

  function connect(state, from, to, port = "product") {
    if (!state.nodes.some((node) => node.id === from) || !state.nodes.some((node) => node.id === to)) return fail("接続する両方の設備を先に配置してください。");
    if (from === to) return fail("同じ設備には接続できません。別の接続先を選んでください。");
    if (state.edges.some((edge) => edge.from === from && edge.to === to)) return fail("この接続はすでにあります。別の接続先を選んでください。");
    if (!["product", "bufferA", "bufferB"].includes(port)) return fail("接続口が無効です。指定された接続口を選んでください。");
    state.edges.push({ from, to, port });
    return { ok: true };
  }

  function removeNode(state, id) {
    if (!state.nodes.some((node) => node.id === id)) return fail("削除する設備が見つかりません。");
    state.nodes = state.nodes.filter((node) => node.id !== id);
    state.edges = state.edges.filter((edge) => edge.from !== id && edge.to !== id);
    return { ok: true };
  }

  function disconnect(state, from, to) {
    const index = state.edges.findIndex((edge) => edge.from === from && edge.to === to);
    if (index < 0) return fail("削除する接続が見つかりません。");
    state.edges.splice(index, 1);
    return { ok: true };
  }

  function validate(state, stage) {
    const route = [];
    const problem = (title, message, stop = null) => ({ ok: false, title, message, route: [...route], stop });
    if (!stage || !Array.isArray(stage.required) || stage.required.length === 0) return problem("ミッションが無効です", "ミッションを選び直してください。");
    const ids = state.nodes.map((node) => node.id);
    if (ids.some((id) => !equipment[id]) || new Set(ids).size !== ids.length) return problem("設備データが無効です", "ステージをリセットしてください。");
    const missing = stage.required.filter((id) => !ids.includes(id));
    if (missing.length) return problem("必要な設備が足りません", `${missing.map((id) => equipment[id].name).join("・")}を配置しましょう。`);
    const extra = ids.find((id) => !stage.required.includes(id));
    if (extra) return problem("今回使わない設備があります", `このミッションには${equipment[extra].name}は不要です。「設備を削除」で取り除きましょう。`, extra);
    if (state.edges.some((edge) => !ids.includes(edge.from) || !ids.includes(edge.to))) return problem("接続データが無効です", "配置されていない設備への接続があります。リセットしてください。");
    if (new Set(state.edges.map((edge) => `${edge.from}:${edge.to}`)).size !== state.edges.length) return problem("接続が重複しています", "同じ向きの接続は一本にしてください。");

    const visiting = new Set();
    const visited = new Set();
    function cycle(id) {
      if (visiting.has(id)) return id;
      if (visited.has(id)) return null;
      visiting.add(id);
      for (const edge of state.edges.filter((item) => item.from === id)) {
        const found = cycle(edge.to);
        if (found) return found;
      }
      visiting.delete(id);
      visited.add(id);
      return null;
    }
    for (const id of ids) {
      const found = cycle(id);
      if (found) return problem("経路が循環しています", `${equipment[found].name}へ戻るループがあります。今回は戻り道のない一本の工程を作りましょう。`, found);
    }
    const start = stage.required[0];
    if (state.edges.some((edge) => edge.to === start)) return problem("開始設備に逆流する接続があります", `今回は${equipment[start].name}が出発点です。ここへ入る接続を削除しましょう。`, start);
    for (let i = 0; i < stage.required.length; i += 1) {
      const id = stage.required[i];
      route.push(id);
      const incoming = state.edges.filter((edge) => edge.to === id);
      const outgoing = state.edges.filter((edge) => edge.from === id);
      if (incoming.length > 1) return problem("接続が合流しています", `${equipment[id].name}に複数の接続が入っています。今回は分岐・合流のない主流路を作ります。`, id);
      if (outgoing.length > 1) return problem("接続が分岐しています", `${equipment[id].name}から複数の接続が出ています。次の工程への一本だけを残しましょう。`, id);
      const next = stage.required[i + 1];
      if (!next && outgoing.length) return problem("終点に余分な接続があります", `${equipment[id].name}が今回の終点です。ここから出る接続を削除しましょう。`, id);
      if (next && !outgoing.length) return problem("ここで流れが止まりました", `${equipment[id].name}の次が未接続です。${equipment[next].name}へつなぎましょう。`, id);
      if (next && outgoing[0].to !== next) return problem("工程の順番を見直そう", `${equipment[id].name}の次は${equipment[next].name}です。${equipment[next].role}`, id);
    }
    if (state.edges.length !== stage.required.length - 1) return problem("余分な接続があります", "主流路以外の接続を取り除いてください。");
    return { ok: true, title: "ミッション成功！", message: stage.lesson, route, stop: null };
  }

  globalThis.FactoryGame = { equipment, stages, createState, place, connect, removeNode, disconnect, validate };
}());
