"use server";

import { db } from "@/db";
import { cqDiagnoses } from "@/db/schema";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAllDiagnoses() {
    return await db.select()
        .from(cqDiagnoses)
        .orderBy(desc(cqDiagnoses.createdAt));
}

export async function getPaginatedDiagnoses(query: string = "", page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    
    let searchCondition = eq(cqDiagnoses.isActive, true);
    
    if (query.trim()) {
        const terms = query.trim().split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
            const termConditions = terms.map(term => 
                or(
                    ilike(cqDiagnoses.code, `%${term}%`),
                    ilike(cqDiagnoses.name, `%${term}%`)
                )
            );
            searchCondition = and(
                eq(cqDiagnoses.isActive, true),
                ...termConditions
            ) as any;
        }
    }

    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(cqDiagnoses)
        .where(searchCondition);
        
    const totalCount = countResult?.count || 0;

    const data = await db
        .select()
        .from(cqDiagnoses)
        .where(searchCondition)
        .orderBy(desc(cqDiagnoses.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        data,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
    };
}

export async function createDiagnosis(formData: FormData) {
    const code = formData.get("code")?.toString()?.trim() || null;
    const name = formData.get("name")?.toString()?.trim();
    const isVerifiedMinsa = formData.get("isVerifiedMinsa") === "true";

    if (!name) return { error: "El nombre descriptivo es obligatorio." };

    try {
        await db.insert(cqDiagnoses).values({
            code,
            name,
            isVerifiedMinsa,
            isActive: true
        });

        revalidatePath("/dashboard/diagnosticos");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505') {
            return { error: "El código CIE-10 propuesto ya está registrado." };
        }
        return { error: e.message || "Error al crear diagnóstico." };
    }
}

export async function updateDiagnosis(id: string, formData: FormData) {
    const code = formData.get("code")?.toString()?.trim() || null;
    const name = formData.get("name")?.toString()?.trim();
    const isVerifiedMinsa = formData.get("isVerifiedMinsa") === "true";

    if (!id || !name) return { error: "Campos críticos faltantes." };

    try {
        await db.update(cqDiagnoses)
            .set({ code, name, isVerifiedMinsa })
            .where(eq(cqDiagnoses.id, id));

        revalidatePath("/dashboard/diagnosticos");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505') {
            return { error: "Conflicto: El código CIE-10 pertenece a otro diagnóstico." };
        }
        return { error: e.message || "Error al actualizar." };
    }
}

export async function deleteDiagnosis(id: string) {
    if (!id) return { error: "ID faltante." };

    try {
        await db.delete(cqDiagnoses).where(eq(cqDiagnoses.id, id));
        revalidatePath("/dashboard/diagnosticos");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23503') {
            return { error: "Imposible eliminar. Este diagnóstico ya fue utilizado en el historial clínico de cirugías." };
        }
        return { error: e.message || "Fallo estructural." };
    }
}

export async function importDiagnosesFromApi(payload: { id: string, name: string, code: string }[]) {
    if (!payload || payload.length === 0) return { error: "No hay elementos para inyectar." };

    try {
        let count = 0;
        for (const item of payload) {
            if (item.id.startsWith("__api_dx__")) {
                await db.insert(cqDiagnoses).values({
                    code: item.code || null,
                    name: item.name,
                    isVerifiedMinsa: true,
                    isActive: true
                }).onConflictDoNothing();
                count++;
            }
        }
        
        revalidatePath("/dashboard/diagnosticos");
        return { success: true, count };
    } catch (e: any) {
        return { error: e.message || "Hubo un error al inyectar lógicamente." };
    }
}
