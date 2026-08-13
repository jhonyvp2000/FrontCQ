import { NextResponse } from "next/server";

export async function GET() {
  setTimeout(() => {
    console.log("Forcing production Node process exit to trigger NSSM service restart...");
    process.exit(1);
  }, 100);

  return NextResponse.json({ message: "Restarting production service via NSSM..." });
}
