import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isInternalHospitalIp, getClientIpFromHeaders } from "@/lib/ip-utils";

export async function GET() {
  const headerList = await headers();
  const headerObj: Record<string, string> = {};

  headerList.forEach((value, key) => {
    headerObj[key] = value;
  });

  const { ip, host } = await getClientIpFromHeaders();
  const isInternal = isInternalHospitalIp(ip, host);

  return NextResponse.json({
    detectedIp: ip,
    detectedHost: host,
    isInternalNetwork: isInternal,
    headers: headerObj,
  });
}
