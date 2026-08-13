import { headers } from "next/headers";

function is172Private(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length >= 2) {
    const secondOctet = parseInt(parts[1], 10);
    return secondOctet >= 16 && secondOctet <= 31;
  }
  return false;
}

export function isInternalHospitalIp(ip: string | null | undefined, hostHeader?: string | null): boolean {
  // 1. Host Inspection: If request arrived via a public domain or public WAN IP
  if (hostHeader) {
    const cleanHost = hostHeader.split(":")[0].toLowerCase().trim();
    const isHostLocal =
      cleanHost === "localhost" ||
      cleanHost === "127.0.0.1" ||
      cleanHost.startsWith("192.168.") ||
      cleanHost.startsWith("10.") ||
      (cleanHost.startsWith("172.") && is172Private(cleanHost));

    if (!isHostLocal) {
      return false; // Accessed via public domain or public WAN IP
    }
  }

  if (!ip) return false;

  // Clean IP (strip IPv6 prefix if mapped IPv4, e.g. ::ffff:192.168.41.25)
  let cleanIp = ip.trim();
  if (cleanIp.startsWith("::ffff:")) {
    cleanIp = cleanIp.substring(7);
  }

  // Localhost & Loopback
  if (cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost") {
    return true;
  }

  // IPv4 Private Ranges
  // 1. 192.168.0.0 - 192.168.255.255 (Hospital Subnet, e.g. 192.168.41.x)
  if (cleanIp.startsWith("192.168.")) {
    return true;
  }

  // 2. 10.0.0.0 - 10.255.255.255
  if (cleanIp.startsWith("10.")) {
    return true;
  }

  // 3. 172.16.0.0 - 172.31.255.255
  if (cleanIp.startsWith("172.") && is172Private(cleanIp)) {
    return true;
  }

  return false;
}

export async function getClientIpFromHeaders(): Promise<{ ip: string; host: string }> {
  let host = "";
  try {
    const headerList = await headers();
    host = headerList.get("host") || headerList.get("x-forwarded-host") || "";

    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      const ips = forwardedFor.split(",");
      if (ips.length > 0 && ips[0].trim()) {
        return { ip: ips[0].trim(), host };
      }
    }

    const realIp = headerList.get("x-real-ip");
    if (realIp) {
      return { ip: realIp.trim(), host };
    }

    const cfIp = headerList.get("cf-connecting-ip");
    if (cfIp) {
      return { ip: cfIp.trim(), host };
    }

    const clientIpHeader = headerList.get("x-client-ip");
    if (clientIpHeader) {
      return { ip: clientIpHeader.trim(), host };
    }
  } catch (error) {
    console.error("Error reading headers for client IP:", error);
  }

  return { ip: "127.0.0.1", host };
}
