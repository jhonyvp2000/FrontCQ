"use server";

import { db } from "@/db";
import {
  usersTable,
  staffProfiles,
  userSystemRoles,
  rolesTable,
  cqAccountRequests,
  professions,
  cqSurgeries,
  cqSurgeryTeam,
  cqPatientPii,
  cqAccountRequestBlocks
} from "@/db/schema";
import { eq, and, sql, gt } from "drizzle-orm";
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

    // 0. Check Block Status for DNI
    const blockRecord = await db.query.cqAccountRequestBlocks.findFirst({
      where: eq(cqAccountRequestBlocks.dni, cleanDni),
    });

    if (blockRecord) {
      if (blockRecord.isPermanentlyBlocked) {
        return {
          success: false,
          isPermanentlyBlocked: true,
          message: "🔒 Cuenta Bloqueada Permanentemente: Tu DNI ha sido bloqueado tras superar el número máximo de reintentos permitidos. Debes solicitar tu activación directamente para revisión manual por la Jefatura de Centro Quirúrgico.",
        };
      }

      if (blockRecord.blockedUntil && new Date(blockRecord.blockedUntil) > new Date()) {
        const remainingMinutes = Math.ceil((new Date(blockRecord.blockedUntil).getTime() - Date.now()) / 60000);
        return {
          success: false,
          isTemporarilyBlocked: true,
          message: `🔒 Bloqueo Temporal: Has excedido el límite de intentos fallidos. Por favor inténtalo nuevamente en ${remainingMinutes} minuto(s).`,
        };
      }
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

    // 3. Check if user is already active in users table (users.is_active === true)
    if (user.isActive === true) {
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

    // 6. Count surgery participations in cq_surgery_team
    const surgeryCountRes = await db.select({ count: sql<number>`count(*)` })
      .from(cqSurgeryTeam)
      .where(eq(cqSurgeryTeam.staffUserId, user.id));

    const staffSurgeriesCount = Number(surgeryCountRes[0]?.count || 0);

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
        hasSurgeryHistory: staffSurgeriesCount > 0,
        staffSurgeriesCount,
      }
    };
  } catch (error) {
    console.error("Error en validateStaffIdentityAction:", error);
    return { success: false, message: "Ocurrió un error inesperado al consultar la base de datos." };
  }
}

export interface VerifySurgicalChallengeInput {
  staffDni: string;
  staffUserId: string;
  patientDni: string;
  surgeryDate: string; // YYYY-MM-DD
}

export async function verifySurgicalChallengeAction(data: VerifySurgicalChallengeInput) {
  try {
    const { ip, host } = await getClientIpFromHeaders();
    if (!isInternalHospitalIp(ip, host)) {
      return {
        success: false,
        isNetworkRestricted: true,
        message: "🔒 Acceso Denegado: La habilitación de cuentas asistenciales solo está permitida desde computadoras conectadas a la Red Interna del Hospital.",
      };
    }

    const cleanStaffDni = data.staffDni.trim();
    const cleanPatientDni = data.patientDni.trim();
    const inputSurgeryDate = data.surgeryDate.trim(); // YYYY-MM-DD

    if (!cleanStaffDni || cleanStaffDni.length !== 8) {
      return { success: false, message: "DNI de usuario no válido." };
    }

    if (!cleanPatientDni || cleanPatientDni.length < 8) {
      return { success: false, message: "Por favor ingresa un número de DNI de paciente válido (8 dígitos)." };
    }

    if (!inputSurgeryDate) {
      return { success: false, message: "Por favor selecciona la fecha de la intervención quirúrgica." };
    }

    // 1. Check current Block Status for Staff DNI
    const blockRecord = await db.query.cqAccountRequestBlocks.findFirst({
      where: eq(cqAccountRequestBlocks.dni, cleanStaffDni),
    });

    if (blockRecord) {
      if (blockRecord.isPermanentlyBlocked) {
        return {
          success: false,
          isPermanentlyBlocked: true,
          message: "🔒 Cuenta Bloqueada Permanentemente: Has superado el número máximo de reintentos permitidos. Debes solicitar tu activación directamente para revisión manual por la Jefatura de Centro Quirúrgico.",
        };
      }

      if (blockRecord.blockedUntil && new Date(blockRecord.blockedUntil) > new Date()) {
        const remainingMinutes = Math.ceil((new Date(blockRecord.blockedUntil).getTime() - Date.now()) / 60000);
        return {
          success: false,
          isTemporarilyBlocked: true,
          message: `🔒 Bloqueo Temporal: Has excedido el límite de 3 intentos fallidos. Inténtalo nuevamente en ${remainingMinutes} minuto(s).`,
        };
      }
    }

    // 2. Query Database for Surgical Participation Coincidence
    // Query: cqSurgeryTeam INNER JOIN cqSurgeries INNER JOIN cqPatientPii
    const matchingSurgeries = await db.select({
      surgeryId: cqSurgeries.id,
      scheduledDate: cqSurgeries.scheduledDate,
    })
    .from(cqSurgeryTeam)
    .innerJoin(cqSurgeries, eq(cqSurgeryTeam.surgeryId, cqSurgeries.id))
    .innerJoin(cqPatientPii, eq(cqSurgeries.patientId, cqPatientPii.patientId))
    .where(
      and(
        eq(cqSurgeryTeam.staffUserId, data.staffUserId),
        eq(cqPatientPii.dni, cleanPatientDni),
        sql`DATE(${cqSurgeries.scheduledDate} AT TIME ZONE 'UTC') = ${inputSurgeryDate}::date OR DATE(${cqSurgeries.scheduledDate}) = ${inputSurgeryDate}::date OR DATE(${cqSurgeries.requestDate}) = ${inputSurgeryDate}::date`
      )
    );

    if (matchingSurgeries.length > 0) {
      // SUCCESS: Reset failed attempts in current block record if any
      if (blockRecord) {
        await db.update(cqAccountRequestBlocks)
          .set({ failedAttempts: 0, updatedAt: new Date() })
          .where(eq(cqAccountRequestBlocks.id, blockRecord.id));
      }

      return {
        success: true,
        message: "Verificación de actividad quirúrgica comprobada exitosamente en la base de datos de BackCQ."
      };
    }

    // FAILED ATTEMPT HANDLING: Record attempt & apply block rules
    let currentFailedAttempts = 1;
    let currentCycleCount = 0;
    let newBlockedUntil: Date | null = null;
    let isPermBlock = false;

    if (!blockRecord) {
      await db.insert(cqAccountRequestBlocks).values({
        dni: cleanStaffDni,
        failedAttempts: 1,
        cycleCount: 0,
        isPermanentlyBlocked: false,
      });
    } else {
      currentFailedAttempts = blockRecord.failedAttempts + 1;
      currentCycleCount = blockRecord.cycleCount;

      if (currentFailedAttempts >= 3) {
        currentCycleCount += 1;
        currentFailedAttempts = 0; // Reset attempts counter for next cycle

        if (currentCycleCount >= 3) { // 3 cycles of 3 failed attempts = Permanent Block
          isPermBlock = true;
        } else { // 15-minute temporary pause
          newBlockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }
      }

      await db.update(cqAccountRequestBlocks)
        .set({
          failedAttempts: currentFailedAttempts,
          cycleCount: currentCycleCount,
          isPermanentlyBlocked: isPermBlock,
          blockedUntil: newBlockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(cqAccountRequestBlocks.id, blockRecord.id));
    }

    if (isPermBlock) {
      return {
        success: false,
        isPermanentlyBlocked: true,
        message: "🔒 Cuenta Bloqueada Permanentemente: Has excedido el límite máximo de reintentos permitidos (3 ciclos de pausas). Tu DNI ha sido bloqueado en la base de datos del sistema. Debes solicitar tu activación directamente para revisión manual por la Jefatura de Centro Quirúrgico.",
      };
    }

    if (newBlockedUntil) {
      return {
        success: false,
        isTemporarilyBlocked: true,
        message: `🔒 Bloqueo Temporal de 15 Minutos: Has excedido el límite de 3 intentos fallidos (Pausa ${currentCycleCount} de 2). Por favor inténtalo nuevamente en 15 minutos.`,
      };
    }

    const attemptsRemaining = 3 - currentFailedAttempts;
    return {
      success: false,
      message: `🔒 Error de Validación: Los datos quirúrgicos ingresados no coinciden con ninguna intervención registrada en BackCQ. Verifique el DNI del paciente y la fecha exacta. (Quedan ${attemptsRemaining} intento(s) en este ciclo).`,
    };
  } catch (error) {
    console.error("Error en verifySurgicalChallengeAction:", error);
    return { success: false, message: "Ocurrió un error inesperado al verificar la actividad quirúrgica." };
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

    // Check if requested email is already used by another user in usersTable
    const existingEmailUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, cleanEmail)
    });

    if (existingEmailUser && existingEmailUser.id !== userId) {
      return {
        success: false,
        message: `🔒 El correo '${cleanEmail}' ya se encuentra registrado en el sistema por otro usuario (${existingEmailUser.name} ${existingEmailUser.lastname}). Por favor ingresa tu correo personal o institucional.`
      };
    }

    // Save request in database
    await db.insert(cqAccountRequests).values({
      userId: user.id,
      dni,
      tuitionCode,
      requestedEmail: cleanEmail,
      phone: phone?.trim() || null,
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
        phone: request.phone,
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

    // 2. Assign system role in user_system_roles if not already assigned
    const existingUserRole = await db.query.userSystemRoles.findFirst({
      where: and(
        eq(userSystemRoles.userId, request.userId),
        eq(userSystemRoles.systemId, 'backcq')
      )
    });

    if (!existingUserRole) {
      await db.insert(userSystemRoles).values({
        userId: request.userId,
        systemId: 'backcq',
        roleId: role.id,
      });
    }

    // 3. Update user's email, passwordHash, isActive status, and updatedAt
    const existingEmailUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, request.requestedEmail)
    });

    if (existingEmailUser && existingEmailUser.id !== request.userId) {
      return {
        success: false,
        message: `🔒 No se pudo completar la aprobación: El correo '${request.requestedEmail}' ya pertenece a otro usuario registrado en la base de datos (${existingEmailUser.name} ${existingEmailUser.lastname}).`,
      };
    }

    await db.update(usersTable)
      .set({
        isActive: true,
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
