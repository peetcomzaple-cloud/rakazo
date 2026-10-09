#!/usr/bin/env bash
# Only the bridge belonging to this computer is matched. No global policy changes.
set -Eeuo pipefail
test "$(id -u)" = 0 || { echo 'Run with sudo' >&2; exit 1; }
iptables -w -S DOCKER-USER >/dev/null
for chain in RAKAZO_CMP_OUT RAKAZO_CMP_IN RAKAZO_CMP_HOST; do
  iptables -w -N "$chain" 2>/dev/null || true
done
umask 077
rules_file="$(mktemp /opt/rakazo-computer/.firewall-XXXXXX)"
trap 'rm -f -- "$rules_file"' EXIT
{
printf '%s\n' '*filter' '-F RAKAZO_CMP_OUT' '-F RAKAZO_CMP_IN' '-F RAKAZO_CMP_HOST'
printf '%s\n' '-A RAKAZO_CMP_OUT -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN'
for destination in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4; do
  printf '%s\n' "-A RAKAZO_CMP_OUT -d $destination -j DROP"
done
if test -f /opt/rakazo-computer/.host-blocked-ips; then
  while IFS= read -r destination; do
    test -z "$destination" || printf '%s\n' "-A RAKAZO_CMP_OUT -d $destination -j DROP"
  done < /opt/rakazo-computer/.host-blocked-ips
fi
printf '%s\n' '-A RAKAZO_CMP_OUT -j RETURN' '-A RAKAZO_CMP_IN -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN' '-A RAKAZO_CMP_IN -j DROP' '-A RAKAZO_CMP_HOST -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT' '-A RAKAZO_CMP_HOST -j DROP'
for spec in 'DOCKER-USER -i br-rakazo-cmp -j RAKAZO_CMP_OUT' 'DOCKER-USER -o br-rakazo-cmp -j RAKAZO_CMP_IN' 'INPUT -i br-rakazo-cmp -j RAKAZO_CMP_HOST'; do
  read -ra rule <<< "$spec"
  iptables -w -C "${rule[@]}" 2>/dev/null || printf '%s\n' "-I $spec"
done
printf '%s\n' COMMIT
} > "$rules_file"
# Apply the dedicated chains in one transaction, without a temporarily open gap
# or flushing any rules owned by another project.
iptables-restore --test --noflush < "$rules_file"
iptables-restore --wait --noflush < "$rules_file"
