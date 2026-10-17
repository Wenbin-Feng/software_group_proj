(function () {
  "use strict";

  const topics = window.ReviewRoomStudyData;
  const steps = ["白話理解", "工作例子", "對回術語"];
  const supported = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance === "function";
  const synth = supported ? window.speechSynthesis : null;
  const state = { topic: 0, step: 0, example: 0, rate: 1, voice: "", audio: "idle" };
  let root = null;
  let voices = [];
  let utterance = null;
  let generation = 0;
  let startTimer;
  let audioMessage = "";

  function escape(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  }

  function currentCard() {
    const topic = topics[state.topic];
    const example = topic.examples[state.example];
    if (state.step === 0) return { title: topic.question, blocks: [["白話解釋", topic.definition], ["一句記住", topic.takeaway]] };
    if (state.step === 1) return { title: example.title, blocks: [["工作情境", example.situation], ["可以點做", example.action]] };
    return { title: "原來，工作上呢件事就係…", blocks: [[topic.term + " · " + topic.name, example.mapping], ["記住界線", topic.caveat]] };
  }

  function stop() {
    generation += 1;
    window.clearTimeout(startTimer);
    if (utterance && synth) synth.cancel();
    utterance = null;
    state.audio = "idle";
    audioMessage = "";
    updateAudio();
  }

  function refreshVoices() {
    voices = synth ? synth.getVoices().filter((voice) => /^(zh|yue)(-|_|$)/i.test(voice.lang)) : [];
    if (!voices.some((voice) => voice.voiceURI === state.voice)) {
      const preferred = voices.find((voice) => /^(zh[-_]HK|yue)/i.test(voice.lang)) || voices.find((voice) => /^zh[-_]TW/i.test(voice.lang)) || voices[0];
      state.voice = preferred ? preferred.voiceURI : "";
    }
    updateAudio();
  }

  function updateAudio() {
    if (!root) return;
    const play = root.querySelector("#study-play");
    const pause = root.querySelector("#study-pause");
    const stopButton = root.querySelector("#study-stop");
    const voiceSelect = root.querySelector("#study-voice");
    const rateSelect = root.querySelector("#study-rate");
    const busy = ["starting", "speaking", "paused"].includes(state.audio);
    voiceSelect.innerHTML = voices.length
      ? voices.map((voice) => `<option value="${escape(voice.voiceURI)}" ${state.voice === voice.voiceURI ? "selected" : ""}>${escape(voice.name)} · ${escape(voice.lang)}</option>`).join("")
      : '<option value="">暫無可用中文聲音</option>';
    voiceSelect.disabled = !voices.length || busy;
    rateSelect.disabled = busy || !voices.length;
    play.disabled = !supported || !voices.length || ["starting", "speaking"].includes(state.audio);
    play.textContent = state.audio === "paused" ? "繼續播放" : state.audio === "starting" ? "準備聲音…" : "▶ 聽這張卡";
    pause.disabled = state.audio !== "speaking";
    stopButton.disabled = !busy;
    let message = "按播放才會朗讀；每次只讀目前這張卡。";
    if (!supported) message = "此瀏覽器不支援朗讀，仍可閱讀所有短卡。";
    else if (!voices.length) message = "裝置暫未提供中文聲音；可檢查系統語音設定，或直接閱讀短卡。";
    else if (state.audio === "starting") message = "正在啟動裝置語音…";
    else if (state.audio === "speaking") message = "正在朗讀目前這張卡。";
    else if (state.audio === "paused") message = "已暫停，可繼續或停止。";
    root.querySelector("#study-audio-status").textContent = audioMessage || message;
  }

  function speak() {
    if (!synth || !voices.length) return;
    if (state.audio === "paused") {
      synth.resume();
      return;
    }
    stop();
    const token = generation;
    const card = currentCard();
    const topic = topics[state.topic];
    const voice = voices.find((item) => item.voiceURI === state.voice) || voices[0];
    utterance = new SpeechSynthesisUtterance([topic.name, `第 ${state.step + 1} 張，${steps[state.step]}`, card.title, ...card.blocks.flat()].join("。"));
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = state.rate;
    const active = () => root && token === generation;
    utterance.onstart = () => {
      if (!active()) return;
      window.clearTimeout(startTimer);
      state.audio = "speaking";
      updateAudio();
    };
    utterance.onpause = () => { if (active()) { state.audio = "paused"; updateAudio(); } };
    utterance.onresume = () => { if (active()) { state.audio = "speaking"; updateAudio(); } };
    utterance.onend = () => {
      if (!active()) return;
      window.clearTimeout(startTimer);
      utterance = null;
      state.audio = "idle";
      audioMessage = "這張卡已讀完。可重播或自行翻到下一張。";
      updateAudio();
    };
    const fail = () => {
      if (!active()) return;
      stop();
      audioMessage = "語音未能播放。請重試、選另一個聲音，或直接閱讀短卡。";
      updateAudio();
    };
    utterance.onerror = fail;
    state.audio = "starting";
    updateAudio();
    startTimer = window.setTimeout(fail, 7000);
    try {
      synth.resume();
      synth.speak(utterance);
    } catch {
      fail();
    }
  }

  function render(focusCard) {
    if (!root) return;
    const topic = topics[state.topic];
    const card = currentCard();
    root.innerHTML = `
      <section class="study-page" lang="zh-Hant">
        <header class="page-header study-header">
          <div><span class="eyebrow">Study cards · From work to theory</span>
            <h1>把術語，對回熟悉的工作。</h1>
            <p>一次一個概念。先用白話理解，再用項目例子連結學術用語。</p>
          </div><span class="pill">3 張短卡 / 概念</span>
        </header>
        <div class="study-layout">
          <aside class="study-topics" aria-label="選擇學習概念">
            <h2>今次讀邊個？</h2>
            ${topics.map((item, index) => `<button type="button" class="study-topic ${state.topic === index ? "selected" : ""}" data-study-topic="${index}" aria-pressed="${state.topic === index}"><span class="study-topic-number">0${index + 1}</span><span><strong lang="en">${escape(item.term)}</strong><b>${escape(item.name)}</b><small>${escape(item.hint)}</small></span></button>`).join("")}
            <p class="study-small">幾分鐘也可讀一張。毋須先答題，想練習時再進入情境。</p>
          </aside>
          <div class="study-reader">
            <nav class="study-steps" aria-label="短卡步驟">${steps.map((step, index) => `<button type="button" data-study-step="${index}" ${state.step === index ? 'aria-current="step"' : ""}><span>${index + 1}</span>${step}</button>`).join("")}</nav>
            <article class="study-card">
              <div class="study-card-meta"><span>${escape(topic.term)} · ${escape(topic.name)}</span><span>${state.step + 1} / 3</span></div>
              <h2 id="study-card-title" tabindex="-1">${escape(card.title)}</h2>
              ${card.blocks.map(([label, content], index) => `<div class="study-block ${index === 1 ? "study-highlight" : ""}"><h3>${escape(label)}</h3><p>${escape(content)}</p></div>`).join("")}
              ${state.step === 1 ? `<div class="study-example-switch"><span>示例 ${state.example + 1} / ${topic.examples.length} · 虛構工作情境</span><button type="button" class="text-button" id="study-example">換個工作例子 ↻</button></div>` : ""}
              <div class="study-card-footer"><button class="secondary-button" type="button" id="study-prev" ${state.step === 0 ? "disabled" : ""}>← 上一張</button>${state.step < 2 ? '<button class="primary-button" type="button" id="study-next">下一張 →</button>' : `<button class="primary-button" type="button" data-start="${topic.scenario}">想試下？去練習 →</button>`}</div>
            </article>
            <section class="study-audio" aria-labelledby="study-audio-heading">
              <div><h2 id="study-audio-heading">唔方便睇？聽這張卡。</h2><p>朗讀與畫面相同的解說，唔會自動跳卡。</p></div>
              <div class="study-audio-controls"><button class="secondary-button" type="button" id="study-play">▶ 聽這張卡</button><button class="secondary-button" type="button" id="study-pause" disabled>暫停</button><button class="secondary-button" type="button" id="study-stop" disabled>停止</button></div>
              <div class="study-voice-settings"><label>裝置聲音<select id="study-voice"></select></label><label>語速<select id="study-rate">${[0.85, 1, 1.15].map((rate) => `<option value="${rate}" ${state.rate === rate ? "selected" : ""}>${rate}×</option>`).join("")}</select></label></div>
              <p class="study-small" id="study-audio-status" role="status" aria-live="polite"></p>
              <p class="study-small">聲音、語言及暫停支援視乎裝置；不保證廣東話、離線或鎖屏播放。部分系統聲音可能使用網絡服務。</p>
            </section>
            <details class="study-notes"><summary>例子來源與使用界線</summary><p>這些是預先編寫的教學示例，不是真實客戶案例，亦不是從你的課堂 PPT 自動產生。請以課堂定義及老師要求為準。</p><p>延伸閱讀（非課堂教材）：<a href="${escape(topic.reference.url)}" target="_blank" rel="noopener noreferrer">${escape(topic.reference.title)}</a></p><p>延伸練習：${escape(topic.practice)}。現有練習為英文、回應為預設示範，並不評核你是否掌握這個概念。</p></details>
          </div>
        </div>
      </section>`;
    updateAudio();
    if (focusCard) {
      const heading = root.querySelector("#study-card-title");
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }

  function onClick(event) {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.studyTopic !== undefined) {
      stop();
      state.topic = Number(button.dataset.studyTopic);
      state.step = 0;
      state.example = 0;
      render(true);
    } else if (button.dataset.studyStep !== undefined || ["study-prev", "study-next", "study-example"].includes(button.id)) {
      stop();
      if (button.dataset.studyStep !== undefined) state.step = Number(button.dataset.studyStep);
      if (button.id === "study-prev") state.step = Math.max(0, state.step - 1);
      if (button.id === "study-next") state.step = Math.min(2, state.step + 1);
      if (button.id === "study-example") state.example = (state.example + 1) % topics[state.topic].examples.length;
      render(true);
    } else if (button.id === "study-play") speak();
    else if (button.id === "study-pause" && synth) synth.pause();
    else if (button.id === "study-stop") stop();
  }

  function onChange(event) {
    if (event.target.id === "study-voice") state.voice = event.target.value;
    if (event.target.id === "study-rate") state.rate = Number(event.target.value);
  }

  function leave() {
    stop();
    if (root) {
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
    }
    root = null;
  }

  window.ReviewRoomStudy = {
    mount(container) {
      leave();
      root = container;
      render(false);
      refreshVoices();
      root.addEventListener("click", onClick);
      root.addEventListener("change", onChange);
    },
    leave
  };
  if (synth) synth.addEventListener("voiceschanged", refreshVoices);
  window.addEventListener("pagehide", stop);
})();
