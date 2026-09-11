/**
 * Builds the widget.json document that Widget Construction Set (WCS) downloads.
 *
 * ⚠️ SCHEMA STATUS: PARTIALLY VERIFIED.
 * The official reference lives at https://wd.gt/widget_layout.html, which is not
 * reachable from the environment this file was written in. What is confirmed:
 *
 *   - the canvas is a 12 x 12 grid
 *   - `layers` are drawn in order; the first one is furthest back
 *   - a layer holds `rows`, whose `height` values add up to 12
 *   - a row holds `cells`, whose `width` values add up to 12
 *   - a cell may carry `padding` and `background_color_style`
 *   - a text object carries either `string` or `data_ref`, plus `size` (default 18)
 *
 * Everything else below is a best guess and is expected to need one correction
 * pass against the real reference. Keep the guessing inside this file: the
 * worker, the tests and the grid invariants do not depend on it.
 */

/** Width and height of the WCS canvas. Every layer must fill it exactly. */
export const GRID = 12;

/** Taken from the HTML terminal widget so both look like the same thing. */
export const COLORS = {
  background: "#0d1117",
  terminal: "#1e1e1e",
  accent: "#0ea5e9",
  accentEnd: "#06b6d4",
  text: "#c9d1d9",
  muted: "#8b949e",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n) => String(n).padStart(2, "0");

/**
 * The live part: what the fake terminal session prints.
 * Everything here changes over time, which is the whole point of serving this
 * from a worker instead of a static file.
 */
export function terminalLines(now) {
  const date = `${WEEKDAYS[now.getUTCDay()]} ${pad(now.getUTCDate())} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;

  return [
    { prompt: "$", command: "date" },
    { output: `${date} · ${time}` },
    { prompt: "$", command: "status" },
    { output: "online · refreshed just now" },
  ];
}

/** Flattens the session into the `data` object that text cells reference. */
function toData(lines, now) {
  const data = { updated: now.toISOString() };

  lines.forEach((line, i) => {
    data[`line_${i + 1}`] = line.command
      ? `${line.prompt} ${line.command}`
      : line.output;
  });

  return data;
}

function textRow(height, ref, size, color) {
  return {
    height,
    cells: [
      {
        width: GRID,
        padding: 1,
        text: { data_ref: ref, size, color, font: "monospace" },
      },
    ],
  };
}

export function buildWidget(now = new Date()) {
  const lines = terminalLines(now);
  const data = toData(lines, now);

  return {
    name: "Terminal",
    updated: data.updated,
    data,
    layers: [
      // Back layer: the terminal window itself, filling the whole canvas.
      {
        rows: [
          {
            height: GRID,
            cells: [{ width: GRID, background_color_style: COLORS.terminal }],
          },
        ],
      },
      // Front layer: the header bar and the session output.
      {
        rows: [
          {
            height: 2,
            cells: [
              {
                width: GRID,
                padding: 1,
                background_color_style: "background_gradient",
                text: { string: "Terminal", size: 16, color: "#ffffff" },
              },
            ],
          },
          textRow(2, "line_1", 14, COLORS.accent),
          textRow(3, "line_2", 14, COLORS.text),
          textRow(2, "line_3", 14, COLORS.accent),
          textRow(3, "line_4", 14, COLORS.text),
        ],
      },
    ],
    background_gradient: {
      from: COLORS.accent,
      to: COLORS.accentEnd,
      direction: "horizontal",
    },
  };
}
