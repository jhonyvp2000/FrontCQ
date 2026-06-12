"use server";

import { db } from "@/db";
import { usersTable, staffProfiles, professions } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export async function getMedicalStaffByProfession(professionName: string | string[]) {
    let professionFilter;
    if (Array.isArray(professionName)) {
        professionFilter = professionName.map(p => eq(professions.name, p));
    } else {
        professionFilter = [eq(professions.name, professionName)];
    }

    return await db.select({
        id: usersTable.id,
        name: usersTable.name,
        lastname: usersTable.lastname,
        dni: usersTable.dni,
        tuitionCode: staffProfiles.tuitionCode,
        professionName: professions.name,
    })
        .from(usersTable)
        .innerJoin(staffProfiles, eq(usersTable.id, staffProfiles.userId))
        .innerJoin(professions, eq(staffProfiles.professionId, professions.id))
        .where(or(...professionFilter));
}

export async function getAsistencialProfessions() {
    return await db.select()
        .from(professions)
        .where(eq(professions.staffCategory, 'ASISTENCIAL'));
}

export async function getAllMedicalStaff() {
    return await db.select({
        id: usersTable.id,
        name: usersTable.name,
        lastname: usersTable.lastname,
        dni: usersTable.dni,
        email: usersTable.email,
        tuitionCode: staffProfiles.tuitionCode,
        professionName: professions.name,
        createdAt: usersTable.createdAt,
    })
        .from(usersTable)
        .innerJoin(staffProfiles, eq(usersTable.id, staffProfiles.userId))
        .innerJoin(professions, eq(staffProfiles.professionId, professions.id))
        .where(eq(professions.staffCategory, 'ASISTENCIAL'))
        .orderBy(usersTable.createdAt);
}

import bcrypt from 'bcrypt';
import { revalidatePath } from "next/cache";

export async function createMedicalStaff(formData: FormData) {
    const dni = formData.get("dni")?.toString()?.trim();
    const name = formData.get("name")?.toString()?.trim();
    const lastname = formData.get("lastname")?.toString()?.trim();
    const email = formData.get("email")?.toString()?.trim() || null;
    const professionId = formData.get("professionId")?.toString()?.trim();
    const tuitionCode = formData.get("tuitionCode")?.toString()?.trim() || null;

    if (!dni || !name || !lastname || !professionId) {
        return { error: "Faltan campos obligatorios" };
    }

    try {
        const existing = await db.select().from(usersTable).where(eq(usersTable.dni, dni)).limit(1);
        if (existing.length > 0) {
            return { error: "Un usuario con este DNI ya existe en el sistema." };
        }

        const passwordHash = await bcrypt.hash(dni, 10); // Default password es el mismo DNI temporal

        const [newUser] = await db.insert(usersTable).values({
            dni,
            name,
            lastname,
            email,
            passwordHash,
            isActive: true
        }).returning({ id: usersTable.id });

        await db.insert(staffProfiles).values({
            userId: newUser.id,
            professionId,
            tuitionCode,
        });

        revalidatePath("/dashboard/personal");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505' && e?.constraint === 'users_email_unique') {
            return { error: "El email provisto ya está en uso." };
        }
        return { error: e.message || "Error creando el personal asistencial." };
    }
}

export async function updateMedicalStaff(id: string, formData: FormData) {
    const dni = formData.get("dni")?.toString()?.trim();
    const name = formData.get("name")?.toString()?.trim();
    const lastname = formData.get("lastname")?.toString()?.trim();
    const email = formData.get("email")?.toString()?.trim() || null;
    const professionId = formData.get("professionId")?.toString()?.trim();
    const tuitionCode = formData.get("tuitionCode")?.toString()?.trim() || null;

    if (!id || !dni || !name || !lastname || !professionId) {
        return { error: "Faltan campos obligatorios" };
    }

    try {
        const existing = await db.select().from(usersTable).where(eq(usersTable.dni, dni)).limit(1);
        if (existing.length > 0 && existing[0].id !== id) {
            return { error: "Un usuario con este DNI ya existe en el sistema." };
        }

        await db.update(usersTable)
            .set({ dni, name, lastname, email, updatedAt: new Date() })
            .where(eq(usersTable.id, id));

        await db.update(staffProfiles)
            .set({ professionId, tuitionCode })
            .where(eq(staffProfiles.userId, id));

        revalidatePath("/dashboard/personal");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23505' && e?.constraint === 'users_email_unique') {
            return { error: "El email provisto ya está en uso." };
        }
        return { error: e.message || "Error al actualizar el personal." };
    }
}

export async function deleteMedicalStaff(id: string) {
    if (!id) return { error: "ID no válido." };

    try {
        await db.delete(usersTable).where(eq(usersTable.id, id));
        revalidatePath("/dashboard/personal");
        return { success: true };
    } catch (e: any) {
        if (e?.code === '23503') {
            return { error: "Imposible eliminar a este profesional porque ya está vinculado operativamente a cirugías del historial. Inhabilítalo en su lugar." };
        }
        return { error: e.message || "Error eliminando." };
    }
}
