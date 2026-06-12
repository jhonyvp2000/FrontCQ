"use server";

import { db } from "@/db";
import { cqOperatingRooms } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getOperatingRooms() {
    return await db.select().from(cqOperatingRooms).orderBy(asc(cqOperatingRooms.name));
}

export async function createOperatingRoom(formData: FormData) {
    const name = formData.get("name") as string;
    const status = formData.get("status") as string || "available";

    if (!name) throw new Error("Name is required");

    await db.insert(cqOperatingRooms).values({
        name,
        status,
    });

    revalidatePath("/dashboard/salas");
}

export async function updateOperatingRoom(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const status = formData.get("status") as string;

    if (!id || !name) throw new Error("Missing required fields");

    await db.update(cqOperatingRooms).set({
        name,
        status,
        updatedAt: new Date(),
    }).where(eq(cqOperatingRooms.id, id));

    revalidatePath("/dashboard/salas");
}

export async function deleteOperatingRoom(formData: FormData) {
    const id = formData.get("id") as string;

    if (!id) return { error: "ID de sala obligatorio para eliminar" };

    try {
        const { cqSurgeries } = await import("@/db/schema");
        const associated = await db.select().from(cqSurgeries).where(eq(cqSurgeries.operatingRoomId, id)).limit(1);

        if (associated.length > 0) {
            return { error: "No se puede eliminar la Sala: Se encuentra protegida porque tiene Historial de Cirugías registradas en este sistema." };
        }

        await db.delete(cqOperatingRooms).where(eq(cqOperatingRooms.id, id));
        revalidatePath("/dashboard/salas");
    } catch (error: any) {
        return { error: "Ocurrió un error inesperado al intentar borrar el registro." };
    }
}
