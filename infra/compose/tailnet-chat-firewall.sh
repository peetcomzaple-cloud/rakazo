#!/usr/bin/env bash
# Restrict the chat publication without changing any other website rules.
set -Eeuo pipefail
web_ip="${1:?Pass the fixed private IP of the Rakazo web container}"
python3 - "$web_ip" <<'PY'
import ipaddress, sys
address = ipaddress.ip_address(sys.argv[1])
if address.version != 4 or not address.is_private or address.is_loopback:
    raise SystemExit('Expected a private Docker IPv4 address')
PY

iptables -N RAKAZO_CHAT_TAILNET 2>/dev/null || true
for interface in tailscale0 lo; do
  iptables -C RAKAZO_CHAT_TAILNET -i "$interface" -j RETURN 2>/dev/null ||
    iptables -A RAKAZO_CHAT_TAILNET -i "$interface" -j RETURN
done
iptables -C RAKAZO_CHAT_TAILNET -j DROP 2>/dev/null ||
  iptables -A RAKAZO_CHAT_TAILNET -j DROP
iptables -C DOCKER-USER -d "$web_ip" -p tcp --dport 5173 -j RAKAZO_CHAT_TAILNET 2>/dev/null ||
  iptables -I DOCKER-USER 1 -d "$web_ip" -p tcp --dport 5173 -j RAKAZO_CHAT_TAILNET
echo 'Rakazo chat accepts only Tailscale and loopback ingress.'
