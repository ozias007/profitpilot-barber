// Turns the text of a CSV file into rows of fields.
// Handles: a byte-order mark, \r\n or \n line endings, comma or semicolon separators,
// quoted fields containing separators, line breaks or doubled quotes (""), and blank lines.

/** Pick the separator from the header line: whichever of ";" and "," appears more often outside quotes. Ties go to ",". */
export function detectDelimiter(headerLine) {
  let commas = 0, semicolons = 0, quoted = false;
  for (const ch of headerLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ",") commas++;
    else if (!quoted && ch === ";") semicolons++;
  }
  return semicolons > commas ? ";" : ",";
}

/**
 * Parse CSV text.
 * @returns {{ delimiter: string, rows: { line: number, fields: string[] }[] }}
 *   `line` is the 1-based line in the file where the row starts, so messages can say "row 14".
 *   Fields are trimmed; rows where every field is empty are left out.
 */
export function parseCsv(text) {
  const src = String(text ?? "").replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstLine);

  const rows = [];
  let fields = [], field = "", quoted = false, line = 1, rowStart = 1;

  const endField = () => { fields.push(field.trim()); field = ""; };
  const endRow = () => {
    endField();
    if (fields.some((f) => f !== "")) rows.push({ line: rowStart, fields });
    fields = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; } // "" inside quotes is one quote
      else if (ch === '"') quoted = false;
      else { if (ch === "\n") line++; field += ch; }
    } else if (ch === '"' && field.trim() === "") {
      quoted = true;
      field = "";
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
      line++;
      rowStart = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || fields.length) endRow();
  return { delimiter, rows };
}
