import { describe, expect, it } from "vitest";
import { repairThaiExplanation, userLanguageInstruction } from "./run-language.js";

describe("run-language", () => {
  it("detects Thai prompts and returns focused instruction without old task baggage", () => {
    const instruction = userLanguageInstruction("list files ใน qa-real-20261013-a เท่านั้น");
    expect(instruction).toBeDefined();
    expect(instruction).toContain("ผู้ใช้สื่อสารเป็นภาษาไทย");
    // Should NOT contain task-specific baggage from old incidents or tools
    expect(instruction).not.toContain("attempt 1, 2, 3, 4");
    expect(instruction).not.toContain("browser_navigate");
    expect(instruction).not.toContain("DNS resolution");
    expect(instruction).toContain("ให้คงชื่อไฟล์ พาธ URL อีเมล ตัวเลข โค้ด คีย์ JSON");
  });

  it("leaves English prompts undefined", () => {
    expect(userLanguageInstruction("list files in workspace")).toBeUndefined();
  });

  it("repairs 'Here are the files in the `...` directory:' into Thai", () => {
    const input =
      "Here are the files in the `qa-real-20261013-a` directory:\n- `qa-real-20261013-a/base-policy.md`\n- `qa-real-20261013-a/brief.md`";
    const output = repairThaiExplanation(input, true);
    expect(output).not.toContain("Here are the files");
    expect(output).toContain("พบไฟล์ต่อไปนี้ในโฟลเดอร์ `qa-real-20261013-a`:");
    // Preserves paths and inline code
    expect(output).toContain("- `qa-real-20261013-a/base-policy.md`");
    expect(output).toContain("- `qa-real-20261013-a/brief.md`");
  });

  it("repairs various list file English preambles into Thai", () => {
    const v1 = "Here is the list of files in `qa-real-20261013-a`:\n- `test.txt`";
    expect(repairThaiExplanation(v1, true)).toContain("รายการไฟล์ใน `qa-real-20261013-a` มีดังนี้:");

    const v2 = "The files in `qa-real-20261013-a` are:\n- `test.txt`";
    expect(repairThaiExplanation(v2, true)).toContain("ไฟล์ใน `qa-real-20261013-a` มีดังนี้:");
  });

  it("repairs English boilerplate progress phrases into Thai", () => {
    const input =
      "I have found the following files in the `qa-other-20261012` directory:\n- `brief.md`\nI will now read the specified files to gather the information needed to make the decisions.";
    const output = repairThaiExplanation(input, true);
    expect(output).not.toContain("I have found");
    expect(output).not.toContain("I will now read");
    expect(output).toContain("พบไฟล์ต่อไปนี้ในโฟลเดอร์ `qa-other-20261012`:");
    expect(output).toContain("กำลังอ่านไฟล์ที่ระบุเพื่อรวบรวมข้อมูลประกอบการตัดสินใจ");
  });

  it("preserves inline code, code fences, and verbatim strings untouched", () => {
    const input =
      'คืนโค้ด JavaScript ด้านล่างตรงต้นฉบับ:\n```js\nconst note = "I have read all the specified files.";\n```\nและตัวแปร `note_id`';
    const output = repairThaiExplanation(input, true);
    expect(output).toContain('const note = "I have read all the specified files.";');
    expect(output).toContain("`note_id`");
  });

  it("preserves JSON array and object blocks untouched", () => {
    const arrayInput =
      'ผลลัพธ์:\n[\n  {"person": "Mali", "decision": "DENY", "note": "Here are the files"}\n]';
    const output = repairThaiExplanation(arrayInput, true);
    expect(output).toContain('"Here are the files"');

    const objInput =
      'ผลลัพธ์:\n{\n  "status": "ready",\n  "message": "Here are the files"\n}';
    const objOutput = repairThaiExplanation(objInput, true);
    expect(objOutput).toContain('"Here are the files"');
  });

  it("leaves non-Thai turns untouched", () => {
    const input = "Here are the files in the `test` directory:";
    expect(repairThaiExplanation(input, false)).toBe(input);
  });
});
