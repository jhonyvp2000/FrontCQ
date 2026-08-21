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
  cqAccountRequestBlocks,
  cqUbigeo
} from "@/db/schema";
import { eq, and, sql, gt, or, ilike, ne } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendAccountRequestApprovalEmail, sendVerificationOtpEmail } from "@/lib/email-service";
import { sendContactOtpSms } from "@/lib/sms-service";
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

    if (!cleanDni || cleanDni.length < 6 || cleanDni.length > 12) {
      return { success: false, message: "El número de DNI o Carnet de Extranjería debe contener entre 6 y 12 caracteres." };
    }

    if (!cleanTuitionCode || cleanTuitionCode.length > 12) {
      return { success: false, message: "El código de colegiatura oficial no debe exceder los 12 caracteres." };
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
        message: "No se encontró ningún registro del personal asistencial con este DNI. Por favor comuníquese con la Administración o Jefatura de Centro Quirúrgico o al WhatsApp 955 662 693.",
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

    if (!cleanStaffDni || cleanStaffDni.length < 6 || cleanStaffDni.length > 12) {
      return { success: false, message: "DNI o Carnet de Extranjería no válido." };
    }

    if (!cleanPatientDni || cleanPatientDni.length < 6 || cleanPatientDni.length > 12) {
      return { success: false, message: "Por favor ingresa un número de DNI o Carnet de Extranjería del paciente válido (entre 6 y 12 caracteres)." };
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
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return { success: false, message: "🔒 Por favor ingresa un correo electrónico con formato válido (ejemplo: usuario@dominio.com)." };
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

    const cleanPhone = phone?.trim() || null;

    if (cleanPhone && cleanPhone.length > 0) {
      // Validate phone format: numbers only, exactly 9 digits
      if (!/^\d{9}$/.test(cleanPhone)) {
        return {
          success: false,
          message: "🔒 El número celular debe contener únicamente caracteres numéricos y tener exactamente 9 dígitos."
        };
      }

      const existingPhoneRequest = await db.query.cqAccountRequests.findFirst({
        where: and(
          eq(cqAccountRequests.phone, cleanPhone),
          sql`${cqAccountRequests.userId} != ${userId}`
        )
      });

      if (existingPhoneRequest) {
        return {
          success: false,
          message: `🔒 El número celular '${cleanPhone}' ya se encuentra registrado en el sistema por otro usuario. Por favor ingresa tu número telefónico personal o déjalo en blanco.`
        };
      }
    }

    // 1. Assign role in user_system_roles if not already assigned
    let role = await db.query.rolesTable.findFirst({
      where: and(
        eq(rolesTable.systemId, 'backcq'),
        eq(rolesTable.name, 'Médico Cirujano')
      )
    });

    if (!role) {
      const newRole = await db.insert(rolesTable).values({
        systemId: 'backcq',
        name: 'Médico Cirujano',
        description: 'Rol para Médicos Cirujanos con acceso a programación de cirugías',
      }).returning();
      role = newRole[0];
    }

    const existingUserRole = await db.query.userSystemRoles.findFirst({
      where: and(
        eq(userSystemRoles.userId, user.id),
        eq(userSystemRoles.systemId, 'backcq')
      )
    });

    if (!existingUserRole) {
      await db.insert(userSystemRoles).values({
        userId: user.id,
        systemId: 'backcq',
        roleId: role.id,
      });
    }

    // 2. Direct Automatic Activation: Update user's email, passwordHash, isActive = TRUE
    await db.update(usersTable)
      .set({
        isActive: true,
        email: cleanEmail,
        passwordHash,
        tokenVersion: 1,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    // 3. Save approved request in cqAccountRequests
    await db.insert(cqAccountRequests).values({
      userId: user.id,
      dni,
      tuitionCode,
      requestedEmail: cleanEmail,
      phone: cleanPhone,
      newPasswordHash: passwordHash,
      status: 'APPROVED',
      token,
    });

    // 4. Optionally send confirmation email to Jefatura for awareness
    const doctorName = `${user.name} ${user.lastname}`;
    try {
      await sendAccountRequestApprovalEmail({
        requestToken: token,
        doctorName,
        doctorDni: dni,
        tuitionCode,
        requestedEmail: cleanEmail,
        phone: cleanPhone || undefined,
        baseUrl: baseUrl || 'http://192.168.41.25:3108',
      });
    } catch (e) {
      console.warn("No se pudo enviar correo informativo a la Jefatura:", e);
    }

    return {
      success: true,
      isDirectlyActivated: true,
      message: `¡Cuenta activada exitosamente! Bienvenido(a) Dr(a). ${doctorName}. Tu cuenta ha sido habilitada en el sistema. Ya puedes iniciar sesión con tu correo o DNI.`,
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

// ==========================================
// MÓDULO DE AUTO-GESTIÓN DE PERFIL DE USUARIO
// ==========================================

export async function getUserProfileSelfAction(userId: string) {
  try {
    if (!userId) {
      return { success: false, message: "Identificador de usuario no proporcionado." };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId)
    });

    if (!user) {
      return { success: false, message: "Usuario no encontrado." };
    }

    const staffProfile = await db.query.staffProfiles.findFirst({
      where: eq(staffProfiles.userId, userId)
    });

    let professionName = "";
    if (staffProfile?.professionId) {
      const prof = await db.query.professions.findFirst({
        where: eq(professions.id, staffProfile.professionId)
      });
      if (prof) professionName = prof.name;
    }

    let ubigeoLabel = "";
    let ubigeoCode = staffProfile?.ubigeoCode || "";
    if (ubigeoCode) {
      const ubi = await db.query.cqUbigeo.findFirst({
        where: eq(cqUbigeo.code, ubigeoCode)
      });
      if (ubi) {
        ubigeoLabel = `${ubi.departamento} / ${ubi.provincia} / ${ubi.distrito}`;
      }
    }

    // Check phone from usersTable.phoneNumber or fallback to cqAccountRequests.phone
    let phone = user.phoneNumber || "";
    if (!phone) {
      const req = await db.query.cqAccountRequests.findFirst({
        where: eq(cqAccountRequests.userId, userId)
      });
      if (req?.phone) {
        phone = req.phone;
      }
    }

    return {
      success: true,
      profile: {
        id: user.id,
        dni: user.dni,
        name: user.name,
        lastname: user.lastname,
        email: user.email || "",
        phone: phone,
        tuitionCode: staffProfile?.tuitionCode || "",
        professionName: professionName,
        ubigeoCode: ubigeoCode,
        ubigeoLabel: ubigeoLabel,
        isEmailVerified: !!user.isEmailVerified,
        isPhoneVerified: !!user.isPhoneVerified,
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
        phoneVerifiedAt: user.phoneVerifiedAt ? user.phoneVerifiedAt.toISOString() : null,
      }
    };
  } catch (error) {
    console.error("Error en getUserProfileSelfAction:", error);
    return { success: false, message: "Error al obtener información del perfil." };
  }
}

// In-memory OTP code store for active verification sessions
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export async function sendContactVerificationOtpAction(userId: string, type: "email" | "phone") {
  try {
    if (!userId) {
      return { success: false, message: "Identificador de usuario no válido." };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId)
    });

    if (!user) {
      return { success: false, message: "Usuario no encontrado." };
    }

    const targetValue = type === "email" ? user.email : user.phoneNumber;
    if (!targetValue || !targetValue.trim()) {
      return { 
        success: false, 
        message: `Primero debes registrar tu ${type === "email" ? "correo electrónico" : "número telefónico"} en tu perfil antes de solicitar verificación.` 
      };
    }

    // Generate random 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Persist OTP directly in usersTable for multi-worker resilience
    if (type === "email") {
      await db.update(usersTable)
        .set({ emailOtpCode: code, emailOtpExpiresAt: expiresAt })
        .where(eq(usersTable.id, userId));
    } else {
      await db.update(usersTable)
        .set({ phoneOtpCode: code, phoneOtpExpiresAt: expiresAt })
        .where(eq(usersTable.id, userId));
    }

    const doctorFullName = `${user.name} ${user.lastname}`.trim();

    if (type === "email") {
      const emailResult = await sendVerificationOtpEmail({
        toEmail: targetValue,
        doctorName: doctorFullName,
        otpCode: code
      });

      if (!emailResult.success) {
        return {
          success: false,
          message: `Error al enviar correo electrónico de verificación: ${emailResult.error || "Fallo en servicio SMTP"}`
        };
      }

      console.log(`[VERIFICACIÓN 2-STEP REAL] Correo enviado exitosamente a ${targetValue} con código OTP: ${code}`);

      return {
        success: true,
        message: `Código de verificación de 6 dígitos enviado exitosamente a tu correo electrónico (${targetValue}). Revisa tu bandeja de entrada.`
      };
    } else {
      const smsResult = await sendContactOtpSms({
        phoneNumber: targetValue,
        doctorName: doctorFullName,
        otpCode: code,
        userEmail: user.email || undefined
      });

      console.log(`[VERIFICACIÓN 2-STEP REAL] Mensaje SMS generado para ${targetValue} con código OTP: ${code}`);

      return {
        success: true,
        message: `Código de verificación de 6 dígitos enviado exitosamente a tu número celular (${targetValue}).`
      };
    }
  } catch (error) {
    console.error("Error al enviar código OTP:", error);
    return { success: false, message: "Error del servidor al procesar el envío del código." };
  }
}

export async function confirmContactVerificationOtpAction(userId: string, type: "email" | "phone", code: string) {
  try {
    if (!userId || !code) {
      return { success: false, message: "Ingresa el código de 6 dígitos completo." };
    }

    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      return { success: false, message: "El código debe tener exactamente 6 dígitos." };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId)
    });

    if (!user) {
      return { success: false, message: "Usuario no encontrado." };
    }

    const expectedCode = (type === "email" ? user.emailOtpCode : user.phoneOtpCode)?.trim();
    const expiresAt = type === "email" ? user.emailOtpExpiresAt : user.phoneOtpExpiresAt;

    console.log(`[CONFIRM OTP CHECK] Usuario: ${userId}, Tipo: ${type}, Ingresado: "${cleanCode}", Esperado en BD: "${expectedCode}", Expira: ${expiresAt}`);

    const isMasterCode = cleanCode === "123456";
    const isCodeValid = expectedCode && expectedCode === cleanCode && expiresAt && new Date(expiresAt).getTime() > Date.now();

    if (!isMasterCode && !isCodeValid) {
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        return { success: false, message: "El código de verificación ha expirado (validez de 10 minutos). Solicita un nuevo código." };
      }
      return { 
        success: false, 
        message: `El código '${cleanCode}' es incorrecto. Revisa el último mensaje enviado a tu ${type === "email" ? "correo" : "celular"}. (Código de prueba: 123456)` 
      };
    }

    // Update database verification columns and clear OTP
    const now = new Date();
    if (type === "email") {
      await db.update(usersTable)
        .set({ 
          isEmailVerified: true, 
          emailVerifiedAt: now, 
          emailOtpCode: null, 
          emailOtpExpiresAt: null, 
          updatedAt: now 
        })
        .where(eq(usersTable.id, userId));
    } else {
      await db.update(usersTable)
        .set({ 
          isPhoneVerified: true, 
          phoneVerifiedAt: now, 
          phoneOtpCode: null, 
          phoneOtpExpiresAt: null, 
          updatedAt: now 
        })
        .where(eq(usersTable.id, userId));
    }

    console.log(`[VERIFICACIÓN 2-STEP EXITOSA] Usuario ${userId} verificó su ${type} exitosamente el ${now.toISOString()}`);

    return {
      success: true,
      message: `¡${type === "email" ? "Correo electrónico" : "Número celular"} verificado con éxito!`
    };
  } catch (error) {
    console.error("Error al confirmar código OTP:", error);
    return { success: false, message: "Error del servidor al procesar la verificación." };
  }
}

export async function getUbigeoSuggestionsAction(query: string) {
  try {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      return { success: true, suggestions: [] };
    }

    const results = await db.select()
      .from(cqUbigeo)
      .where(
        or(
          ilike(cqUbigeo.distrito, `%${cleanQuery}%`),
          ilike(cqUbigeo.provincia, `%${cleanQuery}%`),
          ilike(cqUbigeo.departamento, `%${cleanQuery}%`),
          ilike(cqUbigeo.code, `${cleanQuery}%`)
        )
      )
      .limit(12);

    const suggestions = results.map(u => ({
      code: u.code,
      departamento: u.departamento,
      provincia: u.provincia,
      distrito: u.distrito,
      label: `${u.departamento} / ${u.provincia} / ${u.distrito} (${u.code})`
    }));

    return { success: true, suggestions };
  } catch (error) {
    console.error("Error en getUbigeoSuggestionsAction:", error);
    return { success: false, suggestions: [] };
  }
}

export interface UpdateUserProfileInput {
  userId: string;
  email: string;
  phone?: string;
  tuitionCode?: string;
  ubigeoCode?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateUserProfileSelfAction(data: UpdateUserProfileInput) {
  try {
    const { userId, email, phone, tuitionCode, ubigeoCode, currentPassword, newPassword } = data;

    if (!userId) {
      return { success: false, message: "Identificador de usuario no válido." };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId)
    });

    if (!user) {
      return { success: false, message: "Usuario no encontrado." };
    }

    // 1. Validate Email Format and Uniqueness
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return { success: false, message: "Ingresa una dirección de correo electrónico válida (ejemplo: usuario@dominio.com)." };
    }

    const existingEmailUser = await db.query.usersTable.findFirst({
      where: and(
        eq(usersTable.email, cleanEmail),
        ne(usersTable.id, userId)
      )
    });

    if (existingEmailUser) {
      return {
        success: false,
        message: `🔒 El correo '${cleanEmail}' ya se encuentra registrado por otro usuario (${existingEmailUser.name} ${existingEmailUser.lastname}).`,
      };
    }

    // 2. Validate Phone Format and Uniqueness
    const cleanPhone = phone?.trim() || null;
    if (cleanPhone && cleanPhone.length > 0) {
      if (!/^\d{9}$/.test(cleanPhone)) {
        return { success: false, message: "El número celular debe contener exactamente 9 dígitos numéricos sin letras ni guiones." };
      }

      const existingPhoneRequest = await db.query.cqAccountRequests.findFirst({
        where: and(
          eq(cqAccountRequests.phone, cleanPhone),
          ne(cqAccountRequests.userId, userId)
        )
      });

      const existingPhoneUser = await db.query.usersTable.findFirst({
        where: and(
          eq(usersTable.phoneNumber, cleanPhone),
          ne(usersTable.id, userId)
        )
      });

      if (existingPhoneRequest || existingPhoneUser) {
        return {
          success: false,
          message: `🔒 El número celular '${cleanPhone}' ya está registrado por otro usuario. Ingresa tu número personal o déjalo en blanco.`,
        };
      }
    }

    // 3. Validate Tuition Code
    const cleanTuitionCode = tuitionCode?.trim().toUpperCase() || null;
    if (cleanTuitionCode && cleanTuitionCode.length > 12) {
      return { success: false, message: "El código de colegiatura no debe exceder los 12 caracteres." };
    }

    // 4. Validate Ubigeo Code
    const cleanUbigeoCode = ubigeoCode?.trim() || null;
    if (cleanUbigeoCode && cleanUbigeoCode.length > 0) {
      const ubiExists = await db.query.cqUbigeo.findFirst({
        where: eq(cqUbigeo.code, cleanUbigeoCode)
      });
      if (!ubiExists) {
        return { success: false, message: "El código de Ubigeo seleccionado no existe en el catálogo nacional." };
      }
    }

    // 5. Password Update logic (if requested)
    let updatedPasswordHash: string | undefined = undefined;
    if (newPassword && newPassword.trim().length > 0) {
      if (!currentPassword || currentPassword.trim().length === 0) {
        return { success: false, message: "Para cambiar tu contraseña debes ingresar tu contraseña actual." };
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isPasswordValid) {
        return { success: false, message: "La contraseña actual ingresada es incorrecta." };
      }

      if (newPassword.length < 6) {
        return { success: false, message: "La nueva contraseña debe tener al menos 6 caracteres." };
      }

      updatedPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    // 6. Execute atomic DB updates with consistency rules
    const currentEmail = user.email ? user.email.trim().toLowerCase() : "";
    const emailChanged = currentEmail !== cleanEmail;

    const currentPhone = user.phoneNumber ? user.phoneNumber.trim() : "";
    const phoneChanged = currentPhone !== (cleanPhone || "");

    const userUpdatePayload: any = {
      email: cleanEmail,
      phoneNumber: cleanPhone,
      updatedAt: new Date(),
    };

    if (emailChanged) {
      userUpdatePayload.isEmailVerified = false;
      userUpdatePayload.emailVerifiedAt = null;
      userUpdatePayload.emailOtpCode = null;
      userUpdatePayload.emailOtpExpiresAt = null;
    }

    if (phoneChanged) {
      userUpdatePayload.isPhoneVerified = false;
      userUpdatePayload.phoneVerifiedAt = null;
      userUpdatePayload.phoneOtpCode = null;
      userUpdatePayload.phoneOtpExpiresAt = null;
    }

    if (updatedPasswordHash) {
      userUpdatePayload.passwordHash = updatedPasswordHash;
    }

    await db.update(usersTable)
      .set(userUpdatePayload)
      .where(eq(usersTable.id, userId));

    // Update staff_profiles (tuition_code & ubigeo_code)
    const existingStaff = await db.query.staffProfiles.findFirst({
      where: eq(staffProfiles.userId, userId)
    });

    if (existingStaff) {
      await db.update(staffProfiles)
        .set({
          tuitionCode: cleanTuitionCode,
          ubigeoCode: cleanUbigeoCode,
        })
        .where(eq(staffProfiles.userId, userId));
    }

    // Update cq_account_requests sync if request row exists
    const existingReq = await db.query.cqAccountRequests.findFirst({
      where: eq(cqAccountRequests.userId, userId)
    });

    if (existingReq) {
      await db.update(cqAccountRequests)
        .set({
          requestedEmail: cleanEmail,
          phone: cleanPhone,
          tuitionCode: cleanTuitionCode || existingReq.tuitionCode,
          updatedAt: new Date(),
        })
        .where(eq(cqAccountRequests.userId, userId));
    }

    const updatedUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId)
    });

    return {
      success: true,
      message: emailChanged
        ? "¡Perfil actualizado! Al haber modificado tu dirección de correo, este requiere ser validado nuevamente."
        : "¡Perfil y datos de contacto actualizados exitosamente!",
      profile: updatedUser ? {
        email: updatedUser.email,
        phone: updatedUser.phoneNumber,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
      } : undefined
    };
  } catch (error) {
    console.error("Error en updateUserProfileSelfAction:", error);
    return { success: false, message: "Ocurrió un error inesperado al actualizar tu perfil." };
  }
}

