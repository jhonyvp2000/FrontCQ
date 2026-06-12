import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { redirect } from "next/navigation";

export async function checkSession() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session as any).error === "SessionExpired") {
        redirect("/login?error=SessionExpired");
    }
    return session;
}
