// Dependency-free presentation styles shared by the HTML renderer and browser
// preview. This file alone is safe to import in the web app; server modules are not.
export const deckLayoutCss = `
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #e8edf5;
  font-family: Arial, 'Noto Sans CJK SC', sans-serif;
  color: #202d44;
}
section {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 56.25vw;
  height: auto;
  aspect-ratio: auto;
  padding: clamp(24px, 5vw, 64px) clamp(20px, 6vw, 76px);
  background: #fff;
  margin-bottom: 18px;
  overflow: visible;
  overflow-wrap: anywhere;
}
section::before {
  content: '';
  display: block;
  flex-shrink: 0;
  width: 52px;
  height: 5px;
  background: #3156d3;
  margin-bottom: clamp(16px, 2vw, 22px);
}
h1 {
  font-size: clamp(22px, 3vw, 42px);
  line-height: 1.25;
  margin: 0 0 clamp(18px, 4vw, 52px);
  overflow-wrap: anywhere;
}
ul {
  font-size: clamp(16px, 2vw, 26px);
  line-height: 1.55;
  padding-left: 1.1em;
  margin: 0;
}
li { margin: .5em 0; }
.columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(20px, 7vw, 70px);
}
.columns > * { min-width: 0; }
.process {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
  gap: 18px;
  padding: 0;
  margin: 0;
  list-style: none;
  font-size: clamp(16px, 1.7vw, 22px);
  line-height: 1.55;
}
.process li {
  min-width: 0;
  margin: 0;
  background: #edf1fc;
  padding: 18px;
  border-radius: 8px;
  font-size: inherit;
}
table {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: clamp(14px, 1.7vw, 23px);
  line-height: 1.5;
}
td {
  min-width: 0;
  padding: clamp(8px, 1.2vw, 14px);
  border: 1px solid #dce2ed;
  overflow-wrap: anywhere;
  vertical-align: top;
}
tr:first-child { background: #3156d3; color: white; }
footer {
  position: static;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: clamp(24px, 4vw, 48px);
  font-size: 11px;
  line-height: 1.5;
  color: #758098;
}
footer > span:first-child { min-width: 0; overflow-wrap: anywhere; }
footer > span:last-child { flex-shrink: 0; white-space: nowrap; }
@media (max-width: 600px) {
  .columns { grid-template-columns: minmax(0, 1fr); gap: 18px; }
}
`;

export const deckLayoutStyle = `<style data-folio-courseware-layout>${deckLayoutCss}</style>`;
