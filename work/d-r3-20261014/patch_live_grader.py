import sys
from pathlib import Path

live_py_path = Path("/home/opc/rakazo/work/round3-acceptance/run-round3-live.py")
grader_path = Path("/home/opc/rakazo/work/d-r3-20261014/test_grader_invariants.py")

live_content = live_py_path.read_text(encoding="utf-8")
grader_content = grader_path.read_text(encoding="utf-8")

# Extract full evaluate_case from test_grader_invariants.py
start_func = grader_content.find("def evaluate_case(case, record):")
end_func = grader_content.find("def record(")
if start_func == -1 or end_func == -1:
    print(f"Failed to find evaluate_case boundaries in test_grader_invariants.py: start={start_func}, end={end_func}")
    sys.exit(1)

new_eval_case = grader_content[start_func:end_func].strip()

# Find boundaries in run-round3-live.py
start_marker = "def evaluate_case(case, record):"
end_marker = "def regrade_evidence():"

start_idx = live_content.find(start_marker)
end_idx = live_content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Failed to find markers in run-round3-live.py: start={start_idx}, end={end_idx}")
    sys.exit(1)

patched_content = live_content[:start_idx] + new_eval_case + "\n\n" + live_content[end_idx:]

if "art['contentBase64'] = art_data[0]['contentBase64']" not in patched_content:
    patched_content = patched_content.replace(
        "raw_bytes = base64.b64decode(art_data[0]['contentBase64'])",
        "art['contentBase64'] = art_data[0]['contentBase64']\n                    raw_bytes = base64.b64decode(art_data[0]['contentBase64'])"
    )

live_py_path.write_text(patched_content, encoding="utf-8")
print(f"Successfully and cleanly replaced evaluate_case ({len(new_eval_case)} bytes) in {live_py_path}")
