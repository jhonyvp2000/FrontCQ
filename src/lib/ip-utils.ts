import { headers } from "next/headers";

export function isInternalHospitalIp(ip: string | null | undefined): boolean {
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
  if (cleanIp.startsWith("172.")) {
    const parts = cleanIp.split(".");
    if (parts.length === 4) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }

  return false;
}

export async function getClientIpFromHeaders(): Promise<string> {
  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for");
    if (forwardedFor) {
      const ips = forwardedFor.split(",");
      if (ips.length > 0 && ips[0].trim()) {
        return ips[0].trim();
      }
    }

    const realIp = headerList.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }

    const cfIp = headerList.get("cf-connecting-ip");
    if (cfIp) {
      return cfIp.trim();
    }
  } catch (error) {
    console.error("Error reading headers for client IP:", error);
  }

  return "127.0.0.1";
}
