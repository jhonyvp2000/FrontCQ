"use server";

import { db } from "@/db";
import { cqInterventionTypes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function fetchInterventionTypes() {
    return await db.select()
        .from(cqInterventionTypes)
        .orderBy(desc(cqInterventionTypes.createdAt));
}

export async function createInterventionType(formData: FormData) {
    const code = formData.get("code")?.toString()?.trim() || null;
    const name = formData.get("name")?.toString()?.trim();
    const isActive = formData.get("isActive") === "true";

    if (!name) return { error: "El nombre del tipo de intervención es obligatorio." };

    try {
        await db.insert(cqInterventionTypes).values({
            code,
            name,
            isActive
        });

        revalidatePath("/dashboard/tipos-intervencion");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505') {
            return { error: "Ya existe un tipo de intervención con este código o nombre." };
        }
        return { error: e.message || "Error al registrar el tipo de intervención." };
    }
}

export async function updateInterventionType(id: string, formData: FormData) {
    const code = formData.get("code")?.toString()?.trim() || null;
    const name = formData.get("name")?.toString()?.trim();
    const isActive = formData.get("isActive") === "true";

    if (!id || !name) return { error: "El nombre es obligatorio para actualizar." };

    try {
        await db.update(cqInterventionTypes)
            .set({ code, name, isActive })
            .where(eq(cqInterventionTypes.id, id));

        revalidatePath("/dashboard/tipos-intervencion");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505') {
            return { error: "Conflicto: Ya existe otro registro con el mismo código o nombre reservado." };
        }
        return { error: e.message || "Error al actualizar." };
    }
}

export async function deleteInterventionType(id: string) {
    if (!id) return { error: "ID faltante." };

    try {
        await db.delete(cqInterventionTypes).where(eq(cqInterventionTypes.id, id));
        revalidatePath("/dashboard/tipos-intervencion");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23503') {
            return { error: "Integridad protejida: No se puede eliminar este Tipo de Intervención porque ya ha sido registrado formalmente en una o más cirugías." };
        }
        return { error: e.message || "Fallo estructural en la eliminación." };
    }
}
