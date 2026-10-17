import { escapeHtml, sandboxCsp } from "./deck.js";
export const visualizationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "steps", "quiz"],
  properties: {
    title: { type: "string", maxLength: 160 },
    summary: { type: "string", maxLength: 1000 },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "explanation", "cards"],
        properties: {
          title: { type: "string", maxLength: 160 },
          explanation: { type: "string", maxLength: 1500 },
          cards: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "value", "active"],
              properties: {
                label: { type: "string", maxLength: 120 },
                value: { type: "string", maxLength: 400 },
                active: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    quiz: {
      type: "object",
      additionalProperties: false,
      required: ["question", "options", "correctIndex", "explanation"],
      properties: {
        question: { type: "string", maxLength: 500 },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: { type: "string", maxLength: 300 },
        },
        correctIndex: { type: "integer", minimum: 0, maximum: 3 },
        explanation: { type: "string", maxLength: 1000 },
      },
    },
  },
};
function string(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max)
    throw new Error("The visualization contains invalid text. Please retry.");
  return value;
}
export function validateVisualization(input: any) {
  if (
    !input ||
    !Array.isArray(input.steps) ||
    input.steps.length < 2 ||
    input.steps.length > 8 ||
    !input.quiz ||
    !Array.isArray(input.quiz.options) ||
    input.quiz.options.length < 2 ||
    input.quiz.options.length > 4 ||
    !Number.isInteger(input.quiz.correctIndex) ||
    input.quiz.correctIndex < 0 ||
    input.quiz.correctIndex >= input.quiz.options.length
  )
    throw new Error(
      "The generated visualization was incomplete. Please retry.",
    );
  return {
    title: string(input.title, 160),
    summary: string(input.summary, 1000),
    steps: input.steps.map((step: any) => {
      if (
        !Array.isArray(step.cards) ||
        !step.cards.length ||
        step.cards.length > 4
      )
        throw new Error(
          "The visualization contains invalid steps. Please retry.",
        );
      return {
        title: string(step.title, 160),
        explanation: string(step.explanation, 1500),
        cards: step.cards.map((card: any) => ({
          label: string(card.label, 120),
          value: string(card.value, 400),
          active: card.active === true,
        })),
      };
    }),
    quiz: {
      question: string(input.quiz.question, 500),
      options: input.quiz.options.map((option: any) => string(option, 300)),
      correctIndex: input.quiz.correctIndex,
      explanation: string(input.quiz.explanation, 1000),
    },
  };
}

export function visualizationHtml(raw: any) {
  const visual = validateVisualization(raw);
  const json = JSON.stringify(visual)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  // No model-supplied code reaches this document. Text goes through textContent or HTML escaping.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${sandboxCsp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px;color:#202d44;background:#f8fafc;font:14px/1.65 Arial,'Noto Sans CJK SC',sans-serif}main{max-width:840px;margin:auto}.kicker{font-size:10px;letter-spacing:.13em;color:#3156d3;font-weight:700}h1{font-size:26px;line-height:1.3;margin:10px 0}p{color:#64718a}article{background:#fff;border:1px solid #e1e5ee;border-radius:12px;padding:22px;margin:22px 0}h2{font-size:18px;line-height:1.4;margin:10px 0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:20px 0}.card{border:1px solid #e1e5ee;border-radius:8px;padding:15px;min-height:110px}.card.active{background:#edf1fc;border-color:#3156d3}.card strong,.card span{display:block}.card strong{font-size:11px;color:#758098}.card span{margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere}nav{display:flex;align-items:center;gap:10px;margin-top:20px}button{font:inherit;font-size:12px;cursor:pointer;border:1px solid #dce2ed;background:#fff;border-radius:6px;padding:9px 14px;color:#202d44}button:focus-visible{outline:2px solid #3156d3;outline-offset:3px}button.primary{background:#3156d3;color:#fff;border-color:#3156d3}button:disabled{opacity:.4;cursor:default}input[type=range]{width:100%;accent-color:#3156d3}#count{margin-left:auto;color:#758098;font-size:11px}.options{display:grid;gap:9px;margin:15px 0}.options button{text-align:left}.options button[aria-pressed=true]{border-color:#3156d3;background:#edf1fc}.feedback{padding:12px;border-radius:6px;background:#edf1fc;color:#3156d3}.feedback:empty{display:none}@media(max-width:480px){body{padding:16px}article{padding:16px}h1{font-size:22px}}@media(prefers-reduced-motion:no-preference){.card{transition:background .2s,border-color .2s}}</style></head><body><main><span class="kicker">FOLIO · INTERACTIVE EXPLANATION</span><h1>${escapeHtml(visual.title)}</h1><p>${escapeHtml(visual.summary)}</p><article><span class="kicker" id="step-label"></span><h2 id="step-title"></h2><div class="cards" id="cards"></div><p id="explanation" aria-live="polite"></p><label for="timeline">Explore the steps</label><input id="timeline" type="range" min="0" max="${visual.steps.length - 1}" value="0"><nav><button id="previous">Previous</button><button class="primary" id="next">Next step</button><span id="count"></span></nav></article><article><span class="kicker">CHECK YOUR UNDERSTANDING</span><h2>${escapeHtml(visual.quiz.question)}</h2><div class="options" id="options"></div><p class="feedback" id="feedback" role="status"></p></article></main><script>const data=${json};let index=0;const byId=id=>document.getElementById(id);function render(){const step=data.steps[index];byId('step-label').textContent='STEP '+(index+1);byId('step-title').textContent=step.title;byId('explanation').textContent=step.explanation;byId('cards').replaceChildren(...step.cards.map(card=>{const el=document.createElement('div');el.className='card'+(card.active?' active':'');const label=document.createElement('strong');label.textContent=card.label;const value=document.createElement('span');value.textContent=card.value;el.append(label,value);return el}));byId('previous').disabled=index===0;byId('next').disabled=index===data.steps.length-1;byId('timeline').value=index;byId('count').textContent=(index+1)+' / '+data.steps.length}byId('previous').onclick=()=>{index--;render()};byId('next').onclick=()=>{index++;render()};byId('timeline').oninput=e=>{index=Number(e.target.value);render()};data.quiz.options.forEach((option,i)=>{const button=document.createElement('button');button.textContent=option;button.setAttribute('aria-pressed','false');button.onclick=()=>{byId('options').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));button.setAttribute('aria-pressed','true');byId('feedback').textContent=(i===data.quiz.correctIndex?'Correct. ':'Try another option. ')+data.quiz.explanation};byId('options').append(button)});render();</script></body></html>`;
}
