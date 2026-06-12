"use server";

import { db } from "@/db";
import { cqProcedures } from "@/db/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAllProcedures() {
    return await db.select()
        .from(cqProcedures)
        .orderBy(desc(cqProcedures.createdAt));
}

export async function getPaginatedProcedures(query: string = "", page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    
    let searchCondition = eq(cqProcedures.isActive, true);
    
    if (query.trim()) {
        const terms = query.trim().split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
            const termConditions = terms.map(term => 
                or(
                    ilike(cqProcedures.code, `%${term}%`),
                    ilike(cqProcedures.name, `%${term}%`)
                )
            );
            searchCondition = and(
                eq(cqProcedures.isActive, true),
                ...termConditions
            ) as any;
        }
    }

    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cqProcedures)
        .where(searchCondition);
        
    const totalCount = countResult?.count || 0;

    const data = await db
        .select()
        .from(cqProcedures)
        .where(searchCondition)
        .orderBy(desc(cqProcedures.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        data,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
    };
}

export async function createProcedure(formData: FormData) {
    const code = formData.get("code")?.toString()?.trim() || null;
    const name = formData.get("name")?.toString()?.trim();
    const isVerifiedMinsa = formData.get("isVerifiedMinsa") === "true";

    if (!name) return { error: "La descripción del procedimiento es obligatoria." };

    try {
        await db.insert(cqProcedures).values({
            code,
            name,
            isVerifiedMinsa,
            isActive: true
        });

        revalidatePath("/dashboard/procedimientos");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505') {
            return { error: "El código CPT/SIGPS propuesto ya está registrado." };
        }
        return { error: e.message || "Error al registrar el procedimiento." };
    }
}

export async function updateProcedure(id: string, formData: FormData) {
    const code = formData.get("code")?.toString()?.trim() || null;
    const name = formData.get("name")?.toString()?.trim();
    const isVerifiedMinsa = formData.get("isVerifiedMinsa") === "true";

    if (!id || !name) return { error: "Faltan campos críticos para la reclasificación." };

    try {
        await db.update(cqProcedures)
            .set({ code, name, isVerifiedMinsa })
            .where(eq(cqProcedures.id, id));

        revalidatePath("/dashboard/procedimientos");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505') {
            return { error: "Conflicto: El código pertenece a otro procedimiento existente." };
        }
        return { error: e.message || "Error al actualizar." };
    }
}

export async function deleteProcedure(id: string) {
    if (!id) return { error: "ID faltante." };

    try {
        await db.delete(cqProcedures).where(eq(cqProcedures.id, id));
        revalidatePath("/dashboard/procedimientos");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23503') {
            return { error: "Imposible eliminar. Este procedimiento ya fue utilizado operativamente en intervenciones del historial clínico." };
        }
        return { error: e.message || "Fallo estructural." };
    }
}

export async function importProceduresFromApi(payload: { id: string, name: string, code: string }[]) {
    if (!payload || payload.length === 0) return { error: "No hay elementos para inyectar." };

    try {
        let count = 0;
        for (const item of payload) {
            if (item.id.startsWith("__api_proc__")) {
                await db.insert(cqProcedures).values({
                    code: item.code || null,
                    name: item.name,
                    isVerifiedMinsa: true,
                    isActive: true
                }).onConflictDoNothing();
                count++;
            }
        }
        
        revalidatePath("/dashboard/procedimientos");
        return { success: true, count };
    } catch (e: any) {
        return { error: e.message || "Hubo un error al inyectar lógicamente." };
    }
}
