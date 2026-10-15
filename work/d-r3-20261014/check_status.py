import subprocess
import json

sql = """
SELECT count(*), coalesce(sum("costUsd"), 0) as total_usd, count(*) filter (where "costUsd" is null) as unknown_count 
FROM usage_records WHERE "createdAt" >= '2026-10-13T17:00:00Z';

SELECT id, "botId", status, "createdAt" 
FROM runs WHERE status IN ('queued', 'running', 'leased', 'waiting_input', 'waiting_takeover');
"""

p = subprocess.run(
    ["docker", "exec", "-i", "rakazo-postgres-1", "psql", "-U", "rakazo", "-d", "rakazo"],
    input=sql, text=True, capture_output=True
)
print("STDOUT:\n" + p.stdout)
if p.stderr:
    print("STDERR:\n" + p.stderr)
