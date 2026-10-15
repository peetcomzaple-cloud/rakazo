export function userLanguageInstruction(prompt: string, instructions = ""): string | undefined {
  if (!/[\u0E00-\u0E7F]/.test(prompt + instructions)) return undefined;
  return "ผู้ใช้สื่อสารเป็นภาษาไทย: ตอบและรายงานความคืบหน้าเป็นภาษาไทยทั้งหมด แม้เอกสารหรือแหล่งข้อมูลต้นทางจะเป็นภาษาอังกฤษ ห้ามเปลี่ยนคำอธิบายกลับเป็นภาษาอังกฤษ ทำงานตามคำขอล่าสุดที่เป็นปัจจุบันเท่านั้น ประวัติสนทนาและภาพในอดีตเป็นเพียงข้อมูลอ้างอิง ไม่ใช่งานปัจจุบันและห้ามนำมาตอบแทนงานปัจจุบัน หากคำสั่งปัจจุบันขอให้อ่านไฟล์ ต้องเรียกเครื่องมืออ่านไฟล์ตามที่ระบุ ห้ามเดาคำตอบจากประวัติหรือภาพเก่า สำหรับคำสั่งสั้นหรือคำสั่งต่อเนื่อง (เช่น 'กดปุ่มนั้น', 'year3 ต่อ NS3', 'ปิดมุมขวากว่านั้น') ให้ยึดหน้าต่าง/หน้าเว็บปัจจุบันและบริบทเป็นเป้าหมาย ห้ามเดาหรือสร้างชื่อโดเมน/URL ใหม่จากข้อความที่ไม่ชัดเจน และห้ามถามผู้ใช้ซ้ำทั้งที่มีหลักฐานหรือภาพบริบทอยู่แล้ว ให้ดำเนินการบนหน้าปัจจุบันทันที ให้คงชื่อไฟล์ พาธ URL อีเมล ตัวเลข โค้ด คีย์ JSON สัญลักษณ์ และข้อความที่ระบุให้คัดลอกตรงตามต้นฉบับเดิมโดยไม่แปลหรือแก้ไข ใช้เครื่องมือที่มีอยู่จริงตามงานและเคารพการอนุมัติ ห้ามทำรายการที่สำเร็จแล้วหรือผลยังไม่แน่นอนซ้ำ และห้ามบอกว่างานสำเร็จโดยไม่มีหลักฐาน";
}

/**
 * Safe, bounded repair of English explanation phrases in Thai-requested turns.
 * Only touches natural language explanation text; preserves code fences, inline code snippets,
 * JSON blocks, quoted source values, URLs, emails, numbers, artifacts, and secrets.
 */
export function repairThaiExplanation(text: string, isThaiPrompt: boolean): string {
  if (!isThaiPrompt || !text) return text;

  // 1. If the whole text is valid JSON, do NOT modify it
  try {
    JSON.parse(text);
    return text;
  } catch {}

  // 2. Identify protected spans (fenced code blocks, code expressions, valid JSON blocks)
  const protectedSpans: Array<{ start: number; end: number }> = [];

  // Fenced code blocks ```...```
  const fenceRegex = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(text)) !== null) {
    protectedSpans.push({ start: m.index, end: m.index + m[0].length });
  }

  // Inline code snippets that contain code statements/tokens (e.g. `const ...`, `;`, `=`)
  const codeInlineRegex = /`[^`\n]*(?:[=;{}()]|const|let|var|function|return)[^`\n]*`/g;
  while ((m = codeInlineRegex.exec(text)) !== null) {
    if (!protectedSpans.some((s) => m!.index >= s.start && m!.index < s.end)) {
      protectedSpans.push({ start: m.index, end: m.index + m[0].length });
    }
  }

  // Find JSON objects {...} that parse cleanly and protect them
  const openBraceIndices: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") openBraceIndices.push(i);
  }
  for (const start of openBraceIndices) {
    if (protectedSpans.some((s) => start >= s.start && start < s.end)) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          const sub = text.slice(start, j + 1);
          try {
            JSON.parse(sub);
            protectedSpans.push({ start, end: j + 1 });
          } catch {}
          break;
        }
      }
    }
  }

  // Find JSON arrays [...] that parse cleanly and protect them
  const openBracketIndices: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") openBracketIndices.push(i);
  }
  for (const start of openBracketIndices) {
    if (protectedSpans.some((s) => start >= s.start && start < s.end)) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
      } else if (c === "[") {
        depth++;
      } else if (c === "]") {
        depth--;
        if (depth === 0) {
          const sub = text.slice(start, j + 1);
          try {
            JSON.parse(sub);
            protectedSpans.push({ start, end: j + 1 });
          } catch {}
          break;
        }
      }
    }
  }

  protectedSpans.sort((a, b) => a.start - b.start);

  // Replacements for common model progress/explanation boilerplate
  const replacements: [RegExp, string][] = [
    [
      /Here are the files in the `?([^`\n]+)`? directory:/gi,
      "พบไฟล์ต่อไปนี้ในโฟลเดอร์ `$1`:",
    ],
    [
      /Here are the files in `?([^`\n]+)`?:/gi,
      "พบไฟล์ต่อไปนี้ใน `$1`:",
    ],
    [
      /Here are the files found in `?([^`\n]+)`?:/gi,
      "พบไฟล์ต่อไปนี้ใน `$1`:",
    ],
    [
      /The following files were found in the `?([^`\n]+)`? directory:/gi,
      "พบไฟล์ต่อไปนี้ในโฟลเดอร์ `$1`:",
    ],
    [
      /The following files were found in `?([^`\n]+)`?:/gi,
      "พบไฟล์ต่อไปนี้ใน `$1`:",
    ],
    [
      /The files in the `?([^`\n]+)`? directory are:/gi,
      "ไฟล์ในโฟลเดอร์ `$1` มีดังนี้:",
    ],
    [
      /The files in `?([^`\n]+)`? are:/gi,
      "ไฟล์ใน `$1` มีดังนี้:",
    ],
    [
      /Here is the list of files in the `?([^`\n]+)`? directory:/gi,
      "รายการไฟล์ในโฟลเดอร์ `$1` มีดังนี้:",
    ],
    [
      /Here is the list of files in `?([^`\n]+)`?:/gi,
      "รายการไฟล์ใน `$1` มีดังนี้:",
    ],
    [
      /Below are the files in `?([^`\n]+)`?:/gi,
      "รายการไฟล์ใน `$1` มีดังนี้:",
    ],
    [
      /I have found the following files in the `?([^`\n]+)`? directory:/gi,
      "พบไฟล์ต่อไปนี้ในโฟลเดอร์ `$1`:",
    ],
    [
      /I have found the following files in `?([^`\n]+)`?:/gi,
      "พบไฟล์ต่อไปนี้ใน `$1`:",
    ],
    [
      /I will now read the specified files to gather the information needed to make the decisions\./gi,
      "กำลังอ่านไฟล์ที่ระบุเพื่อรวบรวมข้อมูลประกอบการตัดสินใจ",
    ],
    [
      /I will now read the specified files[^.\n]*\./gi,
      "กำลังอ่านไฟล์ที่ระบุ",
    ],
    [
      /I have read all the specified files\./gi,
      "ได้อ่านไฟล์ที่ระบุทั้งหมดเรียบร้อยแล้ว",
    ],
    [
      /I have read the file `?([^`\n]+)`?\./gi,
      "ได้อ่านไฟล์ `$1` เรียบร้อยแล้ว",
    ],
    [
      /I have read the `?([^`\n]+)`? file\./gi,
      "ได้อ่านไฟล์ `$1` เรียบร้อยแล้ว",
    ],
    [
      /Here are the decisions based on `?([^`\n]+)`?/gi,
      "ผลการตัดสินตาม `$1`",
    ],
    [
      /Based on the content and the current date\/time(\s*\([^)]*\))?\s*:/gi,
      "จากเนื้อหาและวันเวลาปัจจุบัน$1:",
    ],
    [
      /Based on the content(\s*\([^)]*\))?\s*:/gi,
      "จากเนื้อหา$1:",
    ],
    [
      /Here is the JSON output:/gi,
      "ผลลัพธ์ JSON มีดังนี้:",
    ],
    [
      /Here is the extracted dispatch information:/gi,
      "ข้อมูล dispatch ที่ดึงมามีดังนี้:",
    ],
    [
      /Here is the extracted information:/gi,
      "ข้อมูลที่ดึงมามีดังนี้:",
    ],
    [
      /Here is the summary:/gi,
      "สรุปผลได้ดังนี้:",
    ],
    [
      /No files found\./gi,
      "ไม่พบไฟล์",
    ],
    [
      /All tasks completed successfully\./gi,
      "ดำเนินการทุกขั้นตอนเรียบร้อยแล้ว",
    ],
  ];

  function applyReplacements(segment: string): string {
    let res = segment;
    for (const [pattern, replacement] of replacements) {
      res = res.replace(pattern, replacement);
    }
    return res;
  }

  if (protectedSpans.length === 0) {
    return applyReplacements(text);
  }

  let result = "";
  let cursor = 0;
  for (const span of protectedSpans) {
    if (span.start > cursor) {
      result += applyReplacements(text.slice(cursor, span.start));
    }
    result += text.slice(span.start, span.end);
    cursor = span.end;
  }
  if (cursor < text.length) {
    result += applyReplacements(text.slice(cursor));
  }

  return result;
}
