'use strict';

const fs = require('fs');
const path = require('path');

// Folio keeps the style packages next to the runtime.
const DEFAULT_TEMPLATES_ROOT = path.resolve(__dirname, '../styles');

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Load a trusted local template package. Paths never depend on the process cwd. */
function loadTemplate(templateId = 'default', { templatesRoot = DEFAULT_TEMPLATES_ROOT } = {}) {
  if (typeof templateId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(templateId)) {
    throw new Error(`Invalid PPT template ID: ${String(templateId)}`);
  }

  const root = path.resolve(templatesRoot);
  const directory = path.join(root, templateId);
  const entry = path.join(directory, 'template.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`PPT template not found: ${templateId} (${entry})`);
  }
  // Resolve symlinks as well as ".." before executing the package entry.
  const realRoot = fs.realpathSync(root);
  if (!isWithin(realRoot, fs.realpathSync(directory)) ||
      !isWithin(realRoot, fs.realpathSync(entry))) {
    throw new Error(`PPT template is outside templatesRoot: ${templateId}`);
  }

  let template;
  try {
    template = require(entry);
  } catch (cause) {
    throw new Error(`Could not load PPT template ${templateId}: ${cause.message}`, { cause });
  }
  if (!template || template.id !== templateId ||
      !template.colors || typeof template.colors !== 'object' ||
      typeof template.resolveFont !== 'function' ||
      typeof template.createLayout !== 'function') {
    throw new Error(`Invalid PPT template entry: ${entry}; expected matching id, colors, resolveFont and createLayout`);
  }
  return template;
}

module.exports = { DEFAULT_TEMPLATES_ROOT, loadTemplate };
