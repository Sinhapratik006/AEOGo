import ipaddr from "ipaddr.js";

export { isBlockedHostname } from "./hostnames";

/**
 * True only for globally routable unicast addresses. Loopback, private, link-local
 * (incl. cloud metadata 169.254.169.254), CGNAT, multicast, reserved, NAT64/6to4
 * and IPv4-mapped private addresses are all rejected.
 */
export function isPublicIp(address: string): boolean {
  const cleaned = address.replace(/^\[|\]$/g, "");
  if (!ipaddr.isValid(cleaned)) return false;
  let parsed = ipaddr.parse(cleaned);
  if (parsed.kind() === "ipv6") {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
  }
  return parsed.range() === "unicast";
}
