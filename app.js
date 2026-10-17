(function () {
  "use strict";

  const data = window.ReviewRoomData;
  const app = document.querySelector("#main-content");
  const toast = document.querySelector("#toast");

  const state = {
    view: "home",
    scenarioId: "pr-review",
    step: 0,
    messages: [],
    answers: [],
    selectedChallenge: null,
    teacherDraft: loadJson("reviewroom.teacherDraft", {
      title: "Explain a risky pull request",
      goal: "Give respectful feedback, explain the risk, and propose a safe next step.",
      difficulty: "Foundation",
      focus: "Clarity, evidence, action"
    })
  };

  function loadJson(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function selectedScenario() {
    return data.scenarios.find((scenario) => scenario.id === state.scenarioId) || data.scenarios[0];
  }

  function setView(view) {
    if (state.view === "study") window.ReviewRoomStudy.leave();
    state.view = view;
    document.querySelectorAll(".nav-link").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => app.focus({ preventScroll: true }), 0);
  }

  function startScenario(id) {
    state.scenarioId = id;
    state.step = 0;
    state.answers = [];
    const scenario = selectedScenario();
    state.messages = [{ type: "coach", text: scenario.questions[0] }];
    setView("practice");
  }

  function renderHome() {
    const cards = data.scenarios
      .map(
        (scenario) => `
          <article class="scenario-card">
            <span class="scenario-icon" aria-hidden="true">${scenario.icon}</span>
            <div class="meta-row">
              <span class="tag">${scenario.category}</span>
              <span class="tag">${scenario.duration}</span>
            </div>
            <h3>${scenario.title}</h3>
            <p>${scenario.description}</p>
            <button class="text-button" type="button" data-start="${scenario.id}">Start scenario →</button>
          </article>`
      )
      .join("");

    app.innerHTML = `
      <section class="hero">
        <span class="eyebrow">Guided role-play prototype</span>
        <h1>Practise the conversation before it counts.</h1>
        <p class="lead">Short, low-pressure simulations help software engineering students explain decisions, review code and collaborate with confidence.</p>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-start="pr-review">Start an 8-minute practice</button>
          <button class="secondary-button" type="button" data-view="coach">See the teacher view</button>
        </div>
      </section>

      <section class="study-entry" lang="zh-Hant" aria-labelledby="study-entry-title">
        <div><span class="eyebrow">Small moments, practical learning</span>
          <h2 id="study-entry-title">有幾分鐘？先讀懂一個概念。</h2>
          <p>用辦公室項目例子理解英文術語。三張短卡，可讀、可聽，再按需要進入練習。</p>
        </div>
        <button class="secondary-button" type="button" data-view="study">打開短卡 →</button>
      </section>

      <section aria-labelledby="practice-heading">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Practice library</span>
            <h2 id="practice-heading">Small situations, useful feedback</h2>
          </div>
          <p>Each activity has one clear communication goal, three prompts and a reflection step. AI responses are scripted in this prototype.</p>
        </div>
        <div class="scenario-grid">${cards}</div>
      </section>

      <section aria-label="Demo learning summary">
        <div class="section-heading">
          <div>
            <span class="eyebrow">This week</span>
            <h2>Your practice snapshot</h2>
          </div>
        </div>
        <div class="stats-grid">
          <article class="stat-card"><strong>2</strong><span>completed sessions</span></article>
          <article class="stat-card"><strong>14 min</strong><span>deliberate practice</span></article>
          <article class="stat-card"><strong>Clarity</strong><span>current growth focus</span></article>
        </div>
      </section>`;
  }

  function renderPractice() {
    const scenario = selectedScenario();
    if (!state.messages.length) {
      state.messages = [{ type: "coach", text: scenario.questions[state.step] }];
    }
    const progress = ((state.step + 1) / scenario.questions.length) * 100;
    const options = data.scenarios
      .map(
        (item) => `
          <button class="scenario-option ${item.id === scenario.id ? "selected" : ""}" type="button" data-scenario="${item.id}">
            <strong>${item.title}</strong>
            <span>${item.duration} · ${item.level}</span>
          </button>`
      )
      .join("");
    const messages = state.messages
      .map(
        (message) => `
          <div class="message ${message.type === "user" ? "user" : ""}">
            ${message.type === "user" ? "" : '<span class="message-avatar">AI</span>'}
            <div class="message-body">${escapeHtml(message.text)}<small>${message.type === "user" ? "Your response" : "Practice coach · scripted demo"}</small></div>
            ${message.type === "user" ? '<span class="message-avatar">LA</span>' : ""}
          </div>`
      )
      .join("");
    const complete = state.step >= scenario.questions.length;

    app.innerHTML = `
      <header class="page-header">
        <div><span class="eyebrow">Role-play practice</span><h1>${scenario.title}</h1><p>${scenario.category} · ${scenario.duration} · ${scenario.level}</p></div>
        <button class="secondary-button" type="button" data-view="home">Exit practice</button>
      </header>
      <div class="workspace-grid">
        <aside class="panel">
          <h3>Choose a scenario</h3>
          <div class="scenario-list">${options}</div>
          <div class="goal-box"><strong>Learning goal</strong><br />${scenario.goal}</div>
        </aside>
        <section class="panel" aria-label="Practice conversation">
          <div class="meta-row"><span class="pill">${complete ? "Complete" : `Prompt ${state.step + 1} of ${scenario.questions.length}`}</span><span class="pill">Private practice</span></div>
          <div class="progress-track" aria-label="Practice progress"><div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div></div>
          <div class="conversation" id="conversation">${messages}</div>
          ${
            complete
              ? `<div class="empty-state"><h3>Practice complete</h3><p>You responded to all three prompts. Review the demo feedback and save a reflection.</p><button class="primary-button" type="button" data-view="feedback">View feedback</button></div>`
              : `<form class="composer" id="answer-form">
                  <label for="answer"><strong>Your response</strong></label>
                  <textarea id="answer" name="answer" maxlength="600" placeholder="Write what you would say to your teammate…" required></textarea>
                  <div class="composer-footer"><span>Try to include a reason and a next step.</span><button class="primary-button" type="submit">Send response</button></div>
                </form>`
          }
        </section>
      </div>`;

    const conversation = document.querySelector("#conversation");
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }

  function submitAnswer(answer) {
    const scenario = selectedScenario();
    const cleanAnswer = answer.trim();
    if (cleanAnswer.length < 12) {
      showToast("Add a little more detail so the coach can respond.");
      return;
    }
    const current = state.step;
    state.answers.push(cleanAnswer);
    state.messages.push({ type: "user", text: cleanAnswer });
    state.messages.push({ type: "coach", text: scenario.feedback[current] });
    state.step += 1;
    if (state.step < scenario.questions.length) {
      state.messages.push({ type: "coach", text: scenario.questions[state.step] });
    }
    renderPractice();
  }

  function renderCodeLab() {
    const challengeButtons = data.reviewChallenges
      .map(
        (challenge) => `
          <button class="challenge ${state.selectedChallenge === challenge.id ? "selected" : ""}" type="button" data-challenge="${challenge.id}">
            <strong>${challenge.label}</strong><span>Inspect line ${challenge.line}</span>
          </button>`
      )
      .join("");
    const selected = data.reviewChallenges.find((item) => item.id === state.selectedChallenge);

    app.innerHTML = `
      <header class="page-header">
        <div><span class="eyebrow">Interactive activity</span><h1>Code review lab</h1><p>Find one risk, explain why it matters, and compare a safer alternative.</p></div>
        <span class="pill">3 review points</span>
      </header>
      <div class="code-layout">
        <section class="code-window" aria-label="JavaScript code sample">
          <div class="code-toolbar"><span>course-service.js</span><span class="window-dots"><i></i><i></i><i></i></span></div>
          <pre><code><span class="line-number">1</span><span class="code-keyword">async function</span> loadCourses(userId) {
<span class="line-number">2</span>  <span class="code-keyword">try</span> {
<span class="line-number">3</span>    <span class="code-keyword">const</span> response = <span class="code-keyword">await</span> fetch(<span class="code-string">"/api/users/&lt;userId&gt;/courses"</span>);
<span class="line-number">4</span>    <span class="code-keyword">const</span> data = <span class="code-keyword">await</span> response.json();
<span class="line-number">5</span>    <span class="code-keyword">return</span> data.courses;
<span class="line-number">6</span>  } <span class="code-keyword">catch</span> (error) {
<span class="line-number">7</span>    <span class="code-keyword">return</span> [];
<span class="line-number">8</span>  }
<span class="line-number">9</span>}</code></pre>
        </section>
        <aside class="panel">
          <h3>What would you comment on?</h3>
          <p class="lead" style="font-size: 14px">Select a concern to reveal the reasoning. A real version could ask the learner to write the review first.</p>
          <div class="challenge-list">${challengeButtons}</div>
          <div class="review-feedback">
            ${
              selected
                ? `<h3>${selected.label}</h3><p>${selected.explanation}</p><strong>Suggested next step</strong><p>${selected.suggestion}</p>`
                : `<h3>Choose a review point</h3><p>The coach will explain the impact and suggest a constructive comment.</p>`
            }
          </div>
        </aside>
      </div>`;
  }

  function renderTeacherStudio() {
    const draft = state.teacherDraft;
    app.innerHTML = `
      <header class="page-header">
        <div><span class="eyebrow">Instructor prototype</span><h1>Teacher studio</h1><p>Adapt one short practice activity to a class topic and assessment goal.</p></div>
        <span class="pill">Draft · not published</span>
      </header>
      <div class="studio-grid">
        <form class="panel" id="teacher-form">
          <h3>Activity details</h3>
          <div class="field"><label for="draft-title">Scenario title</label><input id="draft-title" name="title" value="${escapeHtml(draft.title)}" maxlength="80" required /></div>
          <div class="field"><label for="draft-goal">Learning goal</label><textarea id="draft-goal" name="goal" maxlength="300" required>${escapeHtml(draft.goal)}</textarea></div>
          <div class="field"><label for="draft-difficulty">Difficulty</label><select id="draft-difficulty" name="difficulty"><option ${draft.difficulty === "Foundation" ? "selected" : ""}>Foundation</option><option ${draft.difficulty === "Intermediate" ? "selected" : ""}>Intermediate</option><option ${draft.difficulty === "Advanced" ? "selected" : ""}>Advanced</option></select></div>
          <div class="field"><label for="draft-focus">Feedback focus</label><input id="draft-focus" name="focus" value="${escapeHtml(draft.focus)}" maxlength="100" required /></div>
          <div class="button-row"><button class="primary-button" type="submit">Save draft</button><button class="secondary-button" type="button" id="reset-draft">Reset example</button></div>
          <div class="info-box"><strong>Prototype boundary:</strong> saving uses this browser only. AI prompt generation, student assignment and teacher analytics are future ideas.</div>
        </form>
        <aside class="preview-card" aria-label="Student activity preview">
          <div class="meta-row"><span class="pill">${escapeHtml(draft.difficulty)}</span><span class="pill">8 min</span></div>
          <h2>${escapeHtml(draft.title)}</h2>
          <p>${escapeHtml(draft.goal)}</p>
          <h3>What students practise</h3>
          <ul class="check-list"><li>Respond to three realistic prompts</li><li>Receive immediate, focused coaching</li><li>Write a short reflection after the activity</li></ul>
          <p><strong>Feedback focus:</strong><br />${escapeHtml(draft.focus)}</p>
        </aside>
      </div>`;
  }

  function renderFeedback() {
    const scenario = selectedScenario();
    const hasSession = state.answers.length > 0;
    const score = hasSession ? Math.min(88, 72 + state.answers.length * 4) : 78;
    const reflection = localStorage.getItem("reviewroom.reflection") || "";
    app.innerHTML = `
      <header class="page-header"><div><span class="eyebrow">Practice reflection</span><h1>Your feedback</h1><p>${scenario.title}</p></div><button class="secondary-button" type="button" data-view="practice">Practise again</button></header>
      <section class="score-hero">
        <div class="score-ring"><span>${score}</span></div>
        <div><h2>A clear and constructive response</h2><p>You explained the risk without blaming the teammate and suggested a concrete next step. The next improvement is to support the comment with evidence from the code or expected user behaviour.</p><div class="meta-row"><span class="pill">Demo assessment</span><span class="pill">Not an academic grade</span></div></div>
      </section>
      <section class="score-grid" aria-label="Skill breakdown">
        <article class="score-card"><strong><span>Clarity</span><span>84</span></strong><div class="mini-track"><i style="width: 84%"></i></div></article>
        <article class="score-card"><strong><span>Evidence</span><span>72</span></strong><div class="mini-track"><i style="width: 72%"></i></div></article>
        <article class="score-card"><strong><span>Action</span><span>81</span></strong><div class="mini-track"><i style="width: 81%"></i></div></article>
      </section>
      <section class="panel reflection-panel">
        <div class="field" style="margin: 0"><label for="reflection">One thing I will try in my next team discussion</label><textarea id="reflection" maxlength="400" placeholder="For example: I will explain the user impact before suggesting a code change.">${escapeHtml(reflection)}</textarea></div>
        <button class="primary-button" type="button" id="save-reflection">Save reflection</button>
      </section>`;
  }

  function render() {
    if (state.view === "home") renderHome();
    if (state.view === "study") window.ReviewRoomStudy.mount(app);
    if (state.view === "practice") renderPractice();
    if (state.view === "code-lab") renderCodeLab();
    if (state.view === "coach") renderTeacherStudio();
    if (state.view === "feedback") renderFeedback();
  }

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      setView(viewButton.dataset.view);
      return;
    }

    const startButton = event.target.closest("[data-start]");
    if (startButton) {
      startScenario(startButton.dataset.start);
      return;
    }

    const scenarioButton = event.target.closest("[data-scenario]");
    if (scenarioButton) {
      startScenario(scenarioButton.dataset.scenario);
      return;
    }

    const challengeButton = event.target.closest("[data-challenge]");
    if (challengeButton) {
      state.selectedChallenge = challengeButton.dataset.challenge;
      renderCodeLab();
      return;
    }

    if (event.target.closest("#reset-draft")) {
      state.teacherDraft = {
        title: "Explain a risky pull request",
        goal: "Give respectful feedback, explain the risk, and propose a safe next step.",
        difficulty: "Foundation",
        focus: "Clarity, evidence, action"
      };
      localStorage.removeItem("reviewroom.teacherDraft");
      renderTeacherStudio();
      showToast("Example activity restored.");
    }

    if (event.target.closest("#save-reflection")) {
      const value = document.querySelector("#reflection").value.trim();
      localStorage.setItem("reviewroom.reflection", value);
      showToast("Reflection saved in this browser.");
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "answer-form") {
      event.preventDefault();
      submitAnswer(new FormData(event.target).get("answer"));
    }

    if (event.target.id === "teacher-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      state.teacherDraft = {
        title: form.get("title").trim(),
        goal: form.get("goal").trim(),
        difficulty: form.get("difficulty"),
        focus: form.get("focus").trim()
      };
      localStorage.setItem("reviewroom.teacherDraft", JSON.stringify(state.teacherDraft));
      renderTeacherStudio();
      showToast("Draft saved locally. Student preview updated.");
    }
  });

  render();
})();
