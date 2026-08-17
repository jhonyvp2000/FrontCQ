import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect } from "next/navigation";

export async function checkSession() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || (session as any).error === "SessionExpired") {
            redirect("/login?error=SessionExpired");
        }
        return session;
    } catch (err: any) {
        if (err?.digest?.startsWith("NEXT_REDIRECT")) {
            throw err;
        }
        console.error("Session check caught unhandled error, redirecting to login:", err?.message || err);
        redirect("/login?error=SessionExpired");
    }
}
