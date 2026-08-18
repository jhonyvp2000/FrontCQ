"use server";

import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { sendPasswordResetOtpEmail } from "@/lib/email-service";

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

export async function requestPasswordResetOtpAction(identifier: string) {
    const term = identifier?.trim();
    if (!term) {
        return { success: false, message: "Por favor ingrese su DNI o correo electrónico registrado." };
    }

    try {
        // Buscar usuario por DNI o por Email
        const users = await db
            .select()
            .from(usersTable)
            .where(or(eq(usersTable.dni, term), eq(usersTable.email, term.toLowerCase())))
            .limit(1);

        const user = users[0];
        if (!user) {
            return { success: false, message: "No se encontró ninguna cuenta registrada con el DNI o correo ingresado." };
        }

        if (!user.isActive) {
            return { success: false, message: "Su cuenta se encuentra inactiva. Por favor contacte a la Jefatura de Centro Quirúrgico." };
        }

        // VALIDACIÓN OBLIGATORIA REQUERIDA: isEmailVerified === true
        if (!user.email || !user.isEmailVerified) {
            return { 
                success: false, 
                message: "Su correo electrónico no se encuentra verificado en el sistema. Para restablecer su contraseña de forma automática por este medio, el correo debió ser validado previamente en su perfil. Por favor contacte al Administrador del sistema o Jefatura CQ." 
            };
        }

        // Generar código OTP de 6 dígitos aleatorio
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // Válido 10 min

        // Guardar OTP en la base de datos
        await db.update(usersTable)
            .set({
                emailOtpCode: otpCode,
                emailOtpExpiresAt: expiresAt,
                updatedAt: new Date()
            })
            .where(eq(usersTable.id, user.id));

        // Enviar correo OTP
        const emailRes = await sendPasswordResetOtpEmail({
            toEmail: user.email,
            doctorName: `${user.name} ${user.lastname}`.trim(),
            otpCode
        });

        if (!emailRes.success) {
            return { success: false, message: "No se pudo enviar el correo de verificación. Inténtelo más tarde o contacte al Administrador." };
        }

        // Enmascarar correo para privacidad visual (ej: d***s@gmail.com)
        const [localPart, domainPart] = user.email.split("@");
        const maskedLocal = localPart.length > 2 
            ? `${localPart[0]}***${localPart[localPart.length - 1]}`
            : `${localPart[0]}***`;
        const maskedEmail = `${maskedLocal}@${domainPart}`;

        return {
            success: true,
            message: `Se ha enviado un código de verificación OTP de 6 dígitos al correo verificado ${maskedEmail}.`,
            userId: user.id,
            dni: user.dni,
            maskedEmail
        };
    } catch (error: any) {
        console.error("Error al solicitar OTP de restablecimiento:", error);
        return { success: false, message: "Ocurrió un error inesperado en el servidor." };
    }
}

export async function confirmPasswordResetOtpAction(
    identifier: string, 
    otpCode: string, 
    newPassword: string, 
    confirmPassword: string
) {
    const term = identifier?.trim();
    const code = otpCode?.trim();

    if (!term || !code || !newPassword || !confirmPassword) {
        return { success: false, message: "Todos los campos son obligatorios." };
    }

    if (newPassword.length < 8) {
        return { success: false, message: "La nueva contraseña debe tener al menos 8 caracteres." };
    }

    if (newPassword !== confirmPassword) {
        return { success: false, message: "La nueva contraseña y la confirmación no coinciden." };
    }

    try {
        const users = await db
            .select()
            .from(usersTable)
            .where(or(eq(usersTable.dni, term), eq(usersTable.email, term.toLowerCase())))
            .limit(1);

        const user = users[0];
        if (!user) {
            return { success: false, message: "Usuario no encontrado." };
        }

        if (newPassword === user.dni) {
            return { success: false, message: "La nueva contraseña no puede ser igual a tu número de DNI." };
        }

        // Validar código OTP
        if (!user.emailOtpCode || user.emailOtpCode.trim() !== code) {
            return { success: false, message: "El código OTP ingresado es incorrecto." };
        }

        if (!user.emailOtpExpiresAt || new Date(user.emailOtpExpiresAt) < new Date()) {
            return { success: false, message: "El código OTP ha expirado (límite 10 minutos). Solicita uno nuevo." };
        }

        // Generar hash de la nueva clave
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Actualizar contraseña y limpiar OTP
        await db.update(usersTable)
            .set({
                passwordHash,
                emailOtpCode: null,
                emailOtpExpiresAt: null,
                tokenVersion: user.tokenVersion + 1,
                updatedAt: new Date()
            })
            .where(eq(usersTable.id, user.id));

        return { 
            success: true, 
            message: "Contraseña restablecida con éxito.",
            dni: user.dni
        };
    } catch (error: any) {
        console.error("Error al restablecer la contraseña:", error);
        return { success: false, message: "Ocurrió un error inesperado al actualizar la contraseña." };
    }
}
