"use server";

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

export async function changePassword(state: any, formData: FormData) {
    const currentPassword = formData.get("currentPassword")?.toString()?.trim();
    const newPassword = formData.get("newPassword")?.toString()?.trim();
    const confirmPassword = formData.get("confirmPassword")?.toString()?.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
        return { error: "Todos los campos son obligatorios." };
    }

    if (newPassword.length < 8) {
        return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
    }

    if (newPassword !== confirmPassword) {
        return { error: "La nueva contraseña y la confirmación no coinciden." };
    }

    try {
        // 1. Obtener la sesión del usuario
        const session = await getServerSession(authOptions);
        if (!session || !session.user || !(session.user as any).id) {
            return { error: "No autorizado. Inicia sesión de nuevo." };
        }

        const userId = (session.user as any).id;
        const userDni = (session.user as any).dni;

        // 2. No permitir que la nueva contraseña sea igual al DNI (contraseña por defecto)
        if (newPassword === userDni) {
            return { error: "La nueva contraseña no puede ser igual a tu número de DNI." };
        }

        // 3. Obtener el hash de la base de datos
        const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        const user = users[0];

        if (!user) {
            return { error: "Usuario no encontrado." };
        }

        // 4. Verificar clave actual contra hash
        const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isCurrentValid) {
            return { error: "La contraseña actual es incorrecta." };
        }

        // 5. Generar hash de la nueva clave
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // 6. Actualizar base de datos
        await db.update(usersTable)
            .set({
                passwordHash,
                tokenVersion: user.tokenVersion + 1,
                updatedAt: new Date()
            })
            .where(eq(usersTable.id, userId));

        return { success: true };
    } catch (error: any) {
        console.error("Error al cambiar contraseña:", error);
        return { error: "Error del servidor. Inténtalo de nuevo." };
    }
}
