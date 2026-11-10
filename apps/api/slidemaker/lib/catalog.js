'use strict';

// =============================================================
// Authoring catalog for LLM deck generation.
//
// Only the layouts listed here are offered to the model. Each entry says WHEN to
// use the layout and documents every field the model may fill. Fields not listed
// (images, logos and legacy options) are omitted from the generation schema, and
// the renderer treats them as empty. Character caps come from lib/limits.js.
// =============================================================

const CATALOG = {
  title: {
    group: 'structure',
    use: 'Cover slide. Always the first slide.',
    fields: {
      title: 'Deck title: the main message or topic.',
      subtitle: 'One line of context (scope, audience or period).',
      presenter: 'Team or presenter name.',
      date: 'Date or event, e.g. "March 2027".',
    },
  },
  agenda: {
    group: 'structure',
    use: 'Table of contents for decks with 8+ slides. 3-6 short items that match the section titles.',
    fields: { title: 'Slide title, e.g. "Agenda".', items: 'Agenda items in order.' },
  },
  section: {
    group: 'structure',
    use: 'Chapter divider before each major part of a long deck. Use 2-5 per deck, never two in a row.',
    fields: {
      number: 'Chapter number, e.g. "01".',
      title: 'Chapter title.',
      subtitle: 'One line on what this chapter answers.',
      chapters: 'All chapter titles of the deck (same list on every section slide); the current one is highlighted.',
    },
  },
  bullets: {
    group: 'text',
    use: 'Explain 2-4 points that each need a sentence of support. Prefer more visual layouts when content allows.',
    fields: {
      title: 'Action title stating the takeaway.',
      lead: 'Optional one-line summary under the title.',
      items: 'Points: heading = the point, body = one supporting sentence.',
    },
  },
  'key-points': {
    group: 'text',
    use: 'Present 2-4 parallel pillars, principles, pillars of a strategy or recommendations as numbered cards.',
    fields: { title: 'Action title.', points: 'Cards: heading = short name, body = 1-2 sentences.' },
  },
  comparison: {
    group: 'text',
    use: 'Compare 2-3 options, segments or approaches side by side. Use highlight for the recommended one.',
    fields: {
      title: 'Action title stating which option wins and why.',
      col1Heading: 'Option 1 name.', col1Items: 'Option 1 attributes (same aspects in the same order across columns).',
      col2Heading: 'Option 2 name.', col2Items: 'Option 2 attributes.',
      col3Heading: 'Optional option 3 name.', col3Items: 'Option 3 attributes.',
      highlight: 'Column number to emphasise ("1"-"3"), or "".',
    },
  },
  'as-is-to-be': {
    group: 'text',
    use: 'Show a transformation: current state vs target state.',
    fields: {
      title: 'Action title.',
      asIsLabel: 'Left label, e.g. "Today".', asIsItems: 'Current-state pain points.',
      toBeLabel: 'Right label, e.g. "Target".', toBeItems: 'Target-state outcomes (mirror the left items).',
      transition: 'Short label on the arrow, e.g. "Automation".',
    },
  },
  quote: {
    group: 'text',
    use: 'A single customer, user or expert quote that makes the argument human. Never invent attributions: use a role or "Interview participant" when the source is generic.',
    fields: { title: 'Optional action title.', quote: 'The quote without quotation marks.', name: 'Speaker or source.', role: 'Role, organisation or context.' },
  },
  faq: {
    group: 'text',
    use: 'Anticipated questions and answers, objections handling.',
    fields: { title: 'Slide title.', items: 'heading = question, body = answer (1-2 sentences).' },
  },
  table: {
    group: 'text',
    use: 'Structured comparison across several attributes (2-5 columns, 2-5 rows). Prefer concise cell text.',
    fields: {
      title: 'Action title.', lead: 'Optional one-line context.',
      columns: 'Header labels; the first column names the rows.',
      rows: 'Each row is an array of cell strings with exactly one cell per column. Cell caps shrink as columns increase.',
      highlight: 'Column number to emphasise ("1"-"5"), or "".',
      note: 'Optional footnote / source.',
    },
  },
  'fact-profile': {
    group: 'text',
    use: 'Key facts as label/value rows: project overview, company profile, budget summary, scope definition.',
    fields: { title: 'Slide title.', lead: 'Optional one-line context.', facts: 'heading = label (very short), body = value.' },
  },
  'big-number': {
    group: 'data',
    use: 'One headline number that carries the slide, with explanation on the left.',
    fields: {
      title: 'Action title explaining the number.',
      value: 'The number only, e.g. "73" or "2.4" (no unit).',
      unit: 'Unit, e.g. "%", "x", "M".',
      caption: 'What the number measures.',
      description: '1-2 sentences of interpretation.',
      points: 'Optional supporting facts.',
    },
  },
  'kpi-cards': {
    group: 'data',
    use: 'Dashboard of 2-4 KPIs with change vs prior period and optional mini trend lines. Best for performance reviews.',
    fields: {
      title: 'Action title summarising performance.', lead: 'Optional one-line context.',
      kpis: 'KPI cards. value is the number without unit; delta like "+12%"; trend up/down/flat; tone good/bad/neutral when the direction is not obviously good (e.g. cost down = good); series 3-12 numbers for a sparkline.',
      note: 'Optional data definition or source.',
    },
  },
  chart: {
    group: 'data',
    use: 'Single-series chart with an explicit message: bar (compare periods/items), line (trend), hbar (ranking with long labels), waterfall (bridge: first value = start, then +/- changes; total is added).',
    fields: {
      title: 'Action title stating what the data shows.',
      chartType: 'bar | line | hbar | waterfall.',
      labels: 'Category labels.', values: 'Numbers, same count as labels.',
      unit: 'Unit for the axis.',
      highlight: 'Index (0-based, as a string) of the bar to emphasise; others are muted. bar/hbar only.',
      delta: 'Bar only: "fromIndex :: toIndex" draws a growth arrow with the % change.',
      callouts: 'Up to 2 short labels attached to data points (index 0-based).',
      points: 'Optional takeaways shown beside the chart.',
      note: 'Optional source or definition.',
    },
  },
  'chart-series': {
    group: 'data',
    use: 'Native multi-series chart (1-4 series): bar (grouped), stacked (composition over time), line (trends), area (cumulative volume), hbar (ranking).',
    fields: {
      title: 'Action title.', lead: 'Optional one-line context.',
      chartType: 'bar | stacked | line | area | hbar.',
      categories: 'X-axis categories.',
      series: 'Series: name + values (one value per category).',
      unit: 'Value unit.', points: 'Optional takeaways beside the chart.', note: 'Optional source.',
    },
  },
  donut: {
    group: 'data',
    use: 'Share / mix / composition of a whole (2-6 parts). Percentages are calculated automatically.',
    fields: {
      title: 'Action title.', lead: 'Optional one-line context.',
      segments: 'Parts: label + non-negative value, largest first.',
      unit: 'Value unit.', centerValue: 'Optional center number (defaults to the total).', centerLabel: 'Optional center caption.',
      points: 'Optional takeaways.',
    },
  },
  progress: {
    group: 'data',
    use: 'Progress toward targets: OKRs, budget burn, project completion (2-6 bars).',
    fields: {
      title: 'Action title.', lead: 'Optional one-line context.',
      items: 'Bars: value and target (default 100); display overrides the right-hand label, e.g. "4.2 / 5 M"; note is a short status.',
      note: 'Optional footnote.',
    },
  },
  funnel: {
    group: 'data',
    use: 'Conversion funnel with stage-to-stage rates computed automatically (sales pipeline, user journey, hiring).',
    fields: {
      title: 'Action title naming the biggest drop-off.', lead: 'Optional one-line context.',
      stages: 'Stages top to bottom with decreasing values; note is optional.',
      unit: 'Value unit.', points: 'Optional takeaways (an overall conversion panel is shown with them).',
    },
  },
  timeline: {
    group: 'plan',
    use: 'Roadmap or history with 3-5 milestones. Optional lanes/bands show who owns which period.',
    fields: {
      title: 'Action title.',
      milestones: 'label = time (e.g. "Q1 2027"), heading = milestone, body = one short sentence.',
      lanes: 'Optional owner names (1-3).',
      bands: 'Optional ownership bars: lane (1-based), start/end milestone numbers (1-based), short label.',
    },
  },
  gantt: {
    group: 'plan',
    use: 'Project schedule: tasks across 3-8 time columns.',
    fields: {
      title: 'Action title.', columns: 'Time columns, e.g. months.',
      tasks: 'Tasks with start and end column numbers (1-based, inclusive).', note: 'Optional footnote.',
    },
  },
  process: {
    group: 'plan',
    use: 'Sequential steps of a method, workflow or implementation path (3-6 steps).',
    fields: {
      title: 'Action title.', lead: 'Optional one-line context.',
      steps: 'Steps in order: heading = short verb phrase, body = one sentence.',
      conclusion: 'Optional bottom line, e.g. success criteria.',
    },
  },
  matrix: {
    group: 'plan',
    use: '2x2 matrix: prioritisation (value vs effort), SWOT, segmentation. Exactly 4 quadrants: top-left, top-right, bottom-left, bottom-right.',
    fields: {
      title: 'Action title.', xLabel: 'Horizontal axis meaning (increases to the right).', yLabel: 'Vertical axis meaning (increases upward).',
      quadrants: 'Four quadrants in reading order: heading + one-sentence body.',
      highlight: 'Quadrant number to emphasise ("1"-"4"), or "".',
    },
  },
  pyramid: {
    group: 'logic',
    use: 'Top-down argument: the governing claim on top, 2-4 supporting reasons below.',
    fields: {
      title: 'Slide title.', conclusionLabel: 'Short tag, e.g. "Goal".', conclusion: 'The governing claim (one sentence).',
      points: 'Supporting reasons: heading + short body.',
    },
  },
  converge: {
    group: 'logic',
    use: 'Several findings that lead to one conclusion (bottom-up synthesis).',
    fields: {
      title: 'Action title.', lead: 'Optional one-line context.',
      points: 'Findings: heading + short body.', conclusionLabel: 'Short tag, e.g. "So".', conclusion: 'The resulting conclusion.',
    },
  },
  drivers: {
    group: 'logic',
    use: 'Causes / drivers on the left leading to an effect or decision on the right.',
    fields: {
      title: 'Action title.', points: 'Drivers: heading + short body.',
      arrowLabel: 'Short arrow label, e.g. "Leads to".', conclusionLabel: 'Panel label, e.g. "Implication".',
      conclusion: 'The effect or decision.', conclusionPoints: 'Optional short follow-ups.',
    },
  },
  'case-summary': {
    group: 'logic',
    use: 'Case study or pilot result: challenge -> solution -> outcome, with an optional headline metric and quote.',
    fields: {
      title: 'Action title.', meta: 'Short tag, e.g. "Pilot · 6 stores".',
      challenge: 'Challenges.', solution: 'What was done.', outcome: 'Results.',
      metric: 'Optional headline metric, e.g. "7 mo" or "+62%".', metricLabel: 'What the metric means.',
      voice: 'Optional short quote.', voiceBy: 'Quote source (role, not an invented name).',
    },
  },
  pricing: {
    group: 'logic',
    use: 'Two or three packaged options with a price / investment and included items. Use highlight + badge for the recommendation.',
    fields: {
      title: 'Action title.',
      plan1Name: 'Option 1 name.', plan1Price: 'Price or investment, e.g. "$1.2M".', plan1Note: 'Short note under the price.', plan1Items: 'Included items.',
      plan2Name: 'Option 2 name.', plan2Price: 'Option 2 price.', plan2Note: 'Option 2 note.', plan2Items: 'Option 2 items.',
      plan3Name: 'Optional option 3 name.', plan3Price: 'Option 3 price.', plan3Note: 'Option 3 note.', plan3Items: 'Option 3 items.',
      highlight: 'Recommended option number ("1"-"3") or "".', badge: 'Badge on the recommended option, e.g. "Recommended".',
    },
  },
  closing: {
    group: 'structure',
    use: 'Final slide: the ask or next step. Always the last slide.',
    fields: { message: 'Closing message or call to action.', submessage: 'One or two sentences on next steps.', contact: 'Team / contact line.' },
  },
};

const GENERATION_LAYOUTS = Object.keys(CATALOG);

function catalogEntry(name) {
  return CATALOG[name] || null;
}

module.exports = { CATALOG, GENERATION_LAYOUTS, catalogEntry };
