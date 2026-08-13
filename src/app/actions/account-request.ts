"use server";

import { db } from "@/db";
import { usersTable, staffProfiles, userSystemRoles, rolesTable, cqAccountRequests, professions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendAccountRequestApprovalEmail } from "@/lib/email-service";
import { getClientIpFromHeaders, isInternalHospitalIp } from "@/lib/ip-utils";

export async function checkIsInternalNetworkAction() {
  try {
    const { ip, host } = await getClientIpFromHeaders();
    const isInternal = isInternalHospitalIp(ip, host);
    return { isInternal, clientIp: ip };
  } catch (error) {
    return { isInternal: false, clientIp: 'desconocida' };
  }
}

export interface ValidateStaffIdentityInput {
  dni: string;
  tuitionCode: string;
}

export async function validateStaffIdentityAction(data: ValidateStaffIdentityInput) {
  try {
    // Security Enforcement: Restrict Account Activation to Internal Hospital Network Only
    const { ip, host } = await getClientIpFromHeaders();
    if (!isInternalHospitalIp(ip, host)) {
      return {
        success: false,
        isNetworkRestricted: true,
        message: "🔒 Acceso Denegado: La habilitación de cuentas asistenciales solo está permitida desde computadoras conectadas a la Red Interna del Hospital II-2 Tarapoto.",
      };
    }

    const cleanDni = data.dni.trim();
    const cleanTuitionCode = data.tuitionCode.trim().toUpperCase();

    if (!cleanDni || cleanDni.length !== 8) {
      return { success: false, message: "El número de DNI debe contener exactamente 8 dígitos." };
    }

    if (!cleanTuitionCode) {
      return { success: false, message: "Por favor ingresa tu código de colegiatura oficial (CMP, CEP, etc.)." };
    }

    // 1. Check if user exists in database
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.dni, cleanDni),
    });

    if (!user) {
      return {
        success: false,
        message: "No se encontró ningún registro del personal asistencial con este DNI. Por favor comuníquese con la Administración o Jefatura de Centro Quirúrgico.",
      };
    }

    // 2. Check if tuition code matches staff_profiles record
    const staffProfile = await db.query.staffProfiles.findFirst({
      where: eq(staffProfiles.userId, user.id),
      with: {
        // Option to include profession if needed
      }
    });

    if (!staffProfile || !staffProfile.tuitionCode) {
      return {
        success: false,
        message: "El usuario existe pero no cuenta con un código de colegiatura registrado en la base de datos de personal.",
      };
    }

    // Normalize tuition code for comparison (ignore non-alphanumeric chars for flexible matching)
    const normalizedInputCode = cleanTuitionCode.replace(/[^A-Z0-9]/g, '');
    const normalizedDbCode = staffProfile.tuitionCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (normalizedInputCode !== normalizedDbCode) {
      return {
        success: false,
        message: `El código de colegiatura ingresado no coincide con los registros del personal para ${user.name} ${user.lastname}. Verifique sus datos.`,
      };
    }

    // 3. Check if user already has an active backcq role
    const existingRoles = await db.select()
      .from(userSystemRoles)
      .where(
        and(
          eq(userSystemRoles.userId, user.id),
          eq(userSystemRoles.systemId, 'backcq')
        )
      );

    if (existingRoles.length > 0) {
      return {
        success: false,
        isAlreadyActive: true,
        message: `Hola ${user.name}, tu cuenta ya se encuentra activa en el sistema BackCQ/FrontCQ. Puedes iniciar sesión directamente desde la pantalla principal.`,
      };
    }

    // 4. Check if there is already a pending request for this user
    const pendingRequest = await db.query.cqAccountRequests.findFirst({
      where: and(
        eq(cqAccountRequests.userId, user.id),
        eq(cqAccountRequests.status, 'PENDING')
      )
    });

    if (pendingRequest) {
      return {
        success: false,
        isPending: true,
        message: `Ya existe una solicitud de activación pendiente para el Dr(a). ${user.name} ${user.lastname}. La Jefatura de CQ debe aprobar el acceso.`,
      };
    }

    // 5. Query profession details if available
    let professionName = "PERSONAL ASISTENCIAL";
    if (staffProfile.professionId) {
      const prof = await db.query.professions.findFirst({
        where: eq(professions.id, staffProfile.professionId)
      });
      if (prof) {
        professionName = prof.name;
      }
    }

    return {
      success: true,
      user: {
        id: user.id,
        dni: user.dni,
        name: user.name,
        lastname: user.lastname,
        fullName: `${user.name} ${user.lastname}`,
        email: user.email || '',
        tuitionCode: staffProfile.tuitionCode,
        professionName,
      }
    };
  } catch (error) {
    console.error("Error en validateStaffIdentityAction:", error);
    return { success: false, message: "Ocurrió un error inesperado al consultar la base de datos." };
  }
}

export interface SubmitAccountActivationInput {
  userId: string;
  dni: string;
  tuitionCode: string;
  email: string;
  phone?: string;
  password: string;
  baseUrl: string;
}

export async function submitAccountActivationRequestAction(data: SubmitAccountActivationInput) {
  try {
    // Security Enforcement: Restrict Account Activation to Internal Hospital Network Only
    const { ip, host } = await getClientIpFromHeaders();
    if (!isInternalHospitalIp(ip, host)) {
      return {
        success: false,
        isNetworkRestricted: true,
        message: "🔒 Acceso Denegado: La habilitación de cuentas asistenciales solo está permitida desde computadoras conectadas a la Red Interna del Hospital II-2 Tarapoto.",
      };
    }

    const { userId, dni, tuitionCode, email, phone, password, baseUrl } = data;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: "Por favor ingrese un correo electrónico válido." };
    }

    if (!password || password.length < 6) {
      return { success: false, message: "La contraseña debe tener al menos 6 caracteres." };
    }

    // Hash password with bcrypt cost 10
    const passwordHash = await bcrypt.hash(password, 10);
    const token = crypto.randomUUID();

    // Verify user exists
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId)
    });

    if (!user) {
      return { success: false, message: "Usuario no encontrado." };
    }

    // Save request in database
    await db.insert(cqAccountRequests).values({
      userId: user.id,
      dni,
      tuitionCode,
      requestedEmail: cleanEmail,
      requestedPhone: phone?.trim() || null,
      newPasswordHash: passwordHash,
      status: 'PENDING',
      token,
    });

    // Send 1-Click approval email to Jefatura CQ
    const doctorName = `${user.name} ${user.lastname}`;
    await sendAccountRequestApprovalEmail({
      requestToken: token,
      doctorName,
      doctorDni: dni,
      tuitionCode,
      requestedEmail: cleanEmail,
      phone,
      baseUrl: baseUrl || 'http://192.168.41.25:3108',
    });

    return {
      success: true,
      message: `Solicitud registrada exitosamente para el Dr(a). ${doctorName}. Se ha enviado una notificación de aprobación en 1-Clic a la Jefatura de Centro Quirúrgico.`,
      token,
    };
  } catch (error) {
    console.error("Error en submitAccountActivationRequestAction:", error);
    return { success: false, message: "Ocurrió un error al guardar la solicitud." };
  }
}

export async function getAccountRequestByTokenAction(token: string) {
  try {
    if (!token) return { success: false, message: "Token no proporcionado." };

    const request = await db.query.cqAccountRequests.findFirst({
      where: eq(cqAccountRequests.token, token),
      with: {
        // Optional
      }
    });

    if (!request) {
      return { success: false, message: "Solicitud de activación no encontrada o el enlace ha caducado." };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, request.userId)
    });

    return {
      success: true,
      request: {
        id: request.id,
        userId: request.userId,
        dni: request.dni,
        tuitionCode: request.tuitionCode,
        requestedEmail: request.requestedEmail,
        phone: request.requestedPhone,
        status: request.status,
        createdAt: request.createdAt,
        doctorName: user ? `${user.name} ${user.lastname}` : request.dni,
      }
    };
  } catch (error) {
    console.error("Error en getAccountRequestByTokenAction:", error);
    return { success: false, message: "Error al consultar la solicitud." };
  }
}

export async function processAccountApprovalAction(token: string, action: 'approve' | 'reject') {
  try {
    if (!token) return { success: false, message: "Token inválido." };

    const request = await db.query.cqAccountRequests.findFirst({
      where: eq(cqAccountRequests.token, token)
    });

    if (!request) {
      return { success: false, message: "Solicitud no encontrada." };
    }

    if (request.status !== 'PENDING') {
      return {
        success: false,
        message: `Esta solicitud ya fue procesada anteriormente con estado: ${request.status === 'APPROVED' ? 'APROBADA' : 'RECHAZADA'}.`,
      };
    }

    if (action === 'reject') {
      await db.update(cqAccountRequests)
        .set({ status: 'REJECTED', updatedAt: new Date() })
        .where(eq(cqAccountRequests.id, request.id));

      return { success: true, status: 'REJECTED', message: "La solicitud de acceso ha sido rechazada." };
    }

    // Action === 'approve'
    // 1. Find or pick appropriate role for backcq
    let role = await db.query.rolesTable.findFirst({
      where: and(
        eq(rolesTable.systemId, 'backcq'),
        eq(rolesTable.name, 'Médico Cirujano')
      )
    });

    if (!role) {
      // Fallback: search any backcq role
      role = await db.query.rolesTable.findFirst({
        where: eq(rolesTable.systemId, 'backcq')
      });
    }

    if (!role) {
      // Create default role if missing
      const newRole = await db.insert(rolesTable).values({
        systemId: 'backcq',
        name: 'Personal Asistencial',
        description: 'Rol para cirujanos, anestesiólogos y personal del Centro Quirúrgico',
      }).returning();
      role = newRole[0];
    }

    // 2. Assign system role in user_system_roles
    await db.insert(userSystemRoles).values({
      userId: request.userId,
      systemId: 'backcq',
      roleId: role.id,
    }).onConflictDoNothing();

    // 3. Update user's email, passwordHash, and updatedAt
    await db.update(usersTable)
      .set({
        email: request.requestedEmail,
        passwordHash: request.newPasswordHash,
        tokenVersion: 1,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, request.userId));

    // 4. Update request status to APPROVED
    await db.update(cqAccountRequests)
      .set({
        status: 'APPROVED',
        updatedAt: new Date(),
      })
      .where(eq(cqAccountRequests.id, request.id));

    return {
      success: true,
      status: 'APPROVED',
      message: "¡Acceso aprobado exitosamente! La cuenta ha sido activada y el profesional ya puede ingresar a FrontCQ y BackCQ con su correo o DNI.",
    };
  } catch (error) {
    console.error("Error en processAccountApprovalAction:", error);
    return { success: false, message: "Ocurrió un error al procesar la aprobación." };
  }
}
