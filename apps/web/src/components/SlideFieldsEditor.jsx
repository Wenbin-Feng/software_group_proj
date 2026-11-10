import { Minus, Plus } from "lucide-react";

// Edits any SlideMaker layout from the shape of its saved fields, so every
// layout the renderer offers is editable without a form per layout.
const label = (key) =>
  String(key)
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
const blank = (value) =>
  Array.isArray(value)
    ? []
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blank(v)]))
      : typeof value === "number"
        ? 0
        : "";
const isText = (items) => items.every((item) => typeof item === "string");
const isNumbers = (items) =>
  items.length > 0 && items.every((item) => typeof item === "number");
const isRows = (items) =>
  items.length > 0 && items.every((item) => Array.isArray(item));

function Field({ name, value, onChange }) {
  if (typeof value === "number")
    return (
      <label>
        {label(name)}
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    );
  if (typeof value === "string")
    return (
      <label>
        {label(name)}
        {value.length > 70 ? (
          <textarea
            rows={3}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input value={value} onChange={(event) => onChange(event.target.value)} />
        )}
      </label>
    );
  if (Array.isArray(value)) {
    if (isNumbers(value))
      return (
        <label>
          {label(name)} <small>Numbers separated by commas</small>
          <input
            value={value.join(", ")}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split(",")
                  .map((item) => Number(item.trim()))
                  .filter((item) => Number.isFinite(item)),
              )
            }
          />
        </label>
      );
    if (isRows(value))
      return (
        <label>
          {label(name)} <small>One row per line, separate cells with |</small>
          <textarea
            rows={Math.min(8, value.length + 1)}
            value={value.map((row) => row.join(" | ")).join("\n")}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split("\n")
                  .map((row) => row.split("|").map((cell) => cell.trim())),
              )
            }
          />
        </label>
      );
    if (isText(value))
      return (
        <label>
          {label(name)} <small>One item per line</small>
          <textarea
            rows={Math.min(7, value.length + 1)}
            value={value.join("\n")}
            onChange={(event) => onChange(event.target.value.split("\n"))}
          />
        </label>
      );
    return (
      <fieldset className="slide-fields-group">
        <legend>
          {label(name)} <span>{value.length}</span>
        </legend>
        {value.map((item, index) => (
          <div className="slide-fields-item" key={index}>
            <div className="slide-fields-item-head">
              <span>{index + 1}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${label(name).toLowerCase()} ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Minus size={14} />
              </button>
            </div>
            {Object.entries(item || {}).map(([key, inner]) => (
              <Field
                key={key}
                name={key}
                value={inner}
                onChange={(next) =>
                  onChange(
                    value.map((entry, i) =>
                      i === index ? { ...entry, [key]: next } : entry,
                    ),
                  )
                }
              />
            ))}
          </div>
        ))}
        {value.length > 0 && value.length < 8 && (
          <button
            type="button"
            className="btn btn-outline slide-fields-add"
            onClick={() => onChange([...value, blank(value.at(-1))])}
          >
            <Plus size={14} /> Add {label(name).toLowerCase().replace(/s$/, "")}
          </button>
        )}
      </fieldset>
    );
  }
  return null;
}

export default function SlideFieldsEditor({ fields, onChange }) {
  return (
    <div className="slide-fields">
      {Object.entries(fields || {}).map(([key, value]) => (
        <Field
          key={key}
          name={key}
          value={value}
          onChange={(next) => onChange({ ...fields, [key]: next })}
        />
      ))}
    </div>
  );
}
