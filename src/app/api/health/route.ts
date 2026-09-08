import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Sonde de disponibilite. Ne revele aucune information de configuration. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.1.0",
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    time: new Date().toISOString(),
  });
}
