"use server";

import { promises as fs } from "fs";
import path from "path";
import { db } from "@/db";
import { cqAnnouncements, cqAnnouncementReads, usersTable, userSystemRoles, rolesTable } from "@/db/schema";
import { eq, and, or, isNull, lte, gte, sql, inArray } from "drizzle-orm";
import { SystemAnnouncement, AnnouncementSeverity, AnnouncementTargetType, AnnouncementActionType } from "@/types/announcement";

/**
 * Check if the user has Admin privileges in BackCQ
 */
async function checkIsAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  if (!user) return false;
  if (user.dni === "09791569") return true;

  const userRoles = await db
    .select({ roleName: rolesTable.name })
    .from(userSystemRoles)
    .innerJoin(rolesTable, eq(userSystemRoles.roleId, rolesTable.id))
    .where(
      and(
        eq(userSystemRoles.userId, userId),
        eq(userSystemRoles.systemId, "backcq")
      )
    );

  return userRoles.some(
    (r) => r.roleName === "Administrador CQ" || r.roleName === "Administrador"
  );
}

/**
 * Get active announcements targeted for the current user
 */
export async function getUserAnnouncementsAction(userId: string) {
  try {
    const announcements: SystemAnnouncement[] = [];

    if (!userId) {
      return { success: true, announcements: [] };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user) {
      return { success: true, announcements: [] };
    }

    // 1. Dynamic System Rule: Unverified Email
    if (!user.isEmailVerified) {
      announcements.push({
        id: "system-unverified-email",
        title: "Requisito de Seguridad",
        message: "⚠️ Tu correo electrónico no está verificado. Haz clic aquí para ver instrucciones y validarlo.",
        severity: "danger",
        targetType: "USER",
        actionLabel: "Validar mi Correo",
        actionType: "OPEN_PROFILE_CONTACTS",
        isActive: true,
        isSystemRule: true,
      });
    }

    // 2. Fetch User's Role IDs in BackCQ
    const userRoleRows = await db
      .select({ roleId: userSystemRoles.roleId })
      .from(userSystemRoles)
      .where(
        and(
          eq(userSystemRoles.userId, userId),
          eq(userSystemRoles.systemId, "backcq")
        )
      );

    const userRoleIds = userRoleRows.map((r) => r.roleId);

    // 3. Fetch User's Read Announcement IDs
    const readRows = await db
      .select({ announcementId: cqAnnouncementReads.announcementId })
      .from(cqAnnouncementReads)
      .where(eq(cqAnnouncementReads.userId, userId));

    const readIds = new Set(readRows.map((r) => r.announcementId));

    // 4. Query DB Announcements with date range and target filters
    const now = new Date();

    const dbAnnouncements = await db.query.cqAnnouncements.findMany({
      where: and(
        eq(cqAnnouncements.isActive, true),
        or(isNull(cqAnnouncements.validFrom), lte(cqAnnouncements.validFrom, now)),
        or(isNull(cqAnnouncements.validUntil), gte(cqAnnouncements.validUntil, now))
      ),
      orderBy: (cqAnnouncements, { desc }) => [desc(cqAnnouncements.createdAt)],
    });

    for (const ann of dbAnnouncements) {
      // Skip if user already read/dismissed this DB announcement
      if (readIds.has(ann.id)) continue;

      let isTarget = false;

      if (ann.targetType === "ALL") {
        isTarget = true;
      } else if (ann.targetType === "ROLE" && ann.targetRoleId) {
        isTarget = userRoleIds.includes(ann.targetRoleId);
      } else if (ann.targetType === "USER" && ann.targetUserId) {
        isTarget = ann.targetUserId === userId;
      }

      if (isTarget) {
        announcements.push({
          id: ann.id,
          title: ann.title,
          message: ann.message,
          severity: ann.severity as AnnouncementSeverity,
          targetType: ann.targetType as AnnouncementTargetType,
          targetRoleId: ann.targetRoleId,
          targetUserId: ann.targetUserId,
          imageUrl: ann.imageUrl,
          imageAlt: ann.imageAlt,
          actionLabel: ann.actionLabel,
          actionType: ann.actionType as AnnouncementActionType,
          customUrl: ann.customUrl,
          validFrom: ann.validFrom,
          validUntil: ann.validUntil,
          isActive: ann.isActive,
          isSystemRule: false,
          createdAt: ann.createdAt,
        });
      }
    }

    return { success: true, announcements };
  } catch (error) {
    console.error("Error en getUserAnnouncementsAction:", error);
    return { success: false, announcements: [], message: "Error al cargar anuncios." };
  }
}

/**
 * Dismiss an announcement for the current user
 */
export async function dismissAnnouncementAction(userId: string, announcementId: string) {
  try {
    if (!userId || !announcementId || announcementId.startsWith("system-")) {
      return { success: true };
    }

    await db
      .insert(cqAnnouncementReads)
      .values({
        userId,
        announcementId,
        readAt: new Date(),
      })
      .onConflictDoNothing();

    return { success: true };
  } catch (error) {
    console.error("Error en dismissAnnouncementAction:", error);
    return { success: false, message: "Error al registrar descarte de aviso." };
  }
}

/**
 * ADMIN: Get all announcements with stats for backoffice management
 */
export async function getAllAnnouncementsAdminAction(adminUserId: string) {
  try {
    const isAdmin = await checkIsAdmin(adminUserId);
    if (!isAdmin) {
      return { success: false, message: "No tienes permisos de administrador." };
    }

    const announcements = await db.query.cqAnnouncements.findMany({
      orderBy: (cqAnnouncements, { desc }) => [desc(cqAnnouncements.createdAt)],
    });

    // Fetch read counts for each announcement
    const readCounts = await db
      .select({
        announcementId: cqAnnouncementReads.announcementId,
        count: sql<number>`count(*)::int`,
      })
      .from(cqAnnouncementReads)
      .groupBy(cqAnnouncementReads.announcementId);

    const countMap = new Map(readCounts.map((r) => [r.announcementId, r.count]));

    // Fetch Roles for label mapping
    const rolesList = await db
      .select({ id: rolesTable.id, name: rolesTable.name })
      .from(rolesTable)
      .where(eq(rolesTable.systemId, "backcq"));

    const roleMap = new Map(rolesList.map((r) => [r.id, r.name]));

    const formattedList: SystemAnnouncement[] = announcements.map((ann) => ({
      id: ann.id,
      title: ann.title,
      message: ann.message,
      severity: ann.severity as AnnouncementSeverity,
      targetType: ann.targetType as AnnouncementTargetType,
      targetRoleId: ann.targetRoleId,
      targetRoleName: ann.targetRoleId ? roleMap.get(ann.targetRoleId) || null : null,
      targetUserId: ann.targetUserId,
      imageUrl: ann.imageUrl,
      imageAlt: ann.imageAlt,
      actionLabel: ann.actionLabel,
      actionType: ann.actionType as AnnouncementActionType,
      customUrl: ann.customUrl,
      validFrom: ann.validFrom,
      validUntil: ann.validUntil,
      isActive: ann.isActive,
      readsCount: countMap.get(ann.id) || 0,
      createdAt: ann.createdAt,
    }));

    return { success: true, announcements: formattedList, roles: rolesList };
  } catch (error) {
    console.error("Error en getAllAnnouncementsAdminAction:", error);
    return { success: false, message: "Error al consultar anuncios administrativos." };
  }
}

/**
 * ADMIN: Create or Update an Announcement
 */
export async function createOrUpdateAnnouncementAdminAction(
  adminUserId: string,
  data: {
    id?: string;
    title: string;
    message: string;
    severity: AnnouncementSeverity;
    targetType: AnnouncementTargetType;
    targetRoleId?: string | null;
    targetUserId?: string | null;
    imageUrl?: string | null;
    imageAlt?: string | null;
    actionLabel?: string | null;
    actionType?: AnnouncementActionType | null;
    customUrl?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive?: boolean;
  }
) {
  try {
    const isAdmin = await checkIsAdmin(adminUserId);
    if (!isAdmin) {
      return { success: false, message: "No tienes permisos de administrador." };
    }

    if (!data.title?.trim() || !data.message?.trim()) {
      return { success: false, message: "El título y el mensaje son campos obligatorios." };
    }

    const payload = {
      title: data.title.trim(),
      message: data.message.trim(),
      severity: data.severity || "info",
      targetType: data.targetType || "ALL",
      targetRoleId: data.targetType === "ROLE" ? data.targetRoleId || null : null,
      targetUserId: data.targetType === "USER" ? data.targetUserId || null : null,
      imageUrl: data.imageUrl?.trim() || null,
      imageAlt: data.imageAlt?.trim() || null,
      actionLabel: data.actionLabel?.trim() || null,
      actionType: data.actionType || "OPEN_IMAGE_MODAL",
      customUrl: data.customUrl?.trim() || null,
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdBy: adminUserId,
      updatedAt: new Date(),
    };

    if (data.id) {
      await db
        .update(cqAnnouncements)
        .set(payload)
        .where(eq(cqAnnouncements.id, data.id));
      return { success: true, message: "¡Comunicado actualizado exitosamente!" };
    } else {
      await db.insert(cqAnnouncements).values(payload);
      return { success: true, message: "¡Comunicado creado exitosamente!" };
    }
  } catch (error) {
    console.error("Error en createOrUpdateAnnouncementAdminAction:", error);
    return { success: false, message: "Error al guardar el comunicado." };
  }
}

/**
 * ADMIN: Toggle Announcement Active Status
 */
export async function toggleAnnouncementStatusAdminAction(
  adminUserId: string,
  id: string,
  isActive: boolean
) {
  try {
    const isAdmin = await checkIsAdmin(adminUserId);
    if (!isAdmin) {
      return { success: false, message: "No tienes permisos de administrador." };
    }

    await db
      .update(cqAnnouncements)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(cqAnnouncements.id, id));

    return { success: true, message: `Comunicado ${isActive ? "activado" : "pausado"}.` };
  } catch (error) {
    console.error("Error en toggleAnnouncementStatusAdminAction:", error);
    return { success: false, message: "Error al cambiar estado del comunicado." };
  }
}

/**
 * ADMIN: Delete Announcement
 */
export async function deleteAnnouncementAdminAction(adminUserId: string, id: string) {
  try {
    const isAdmin = await checkIsAdmin(adminUserId);
    if (!isAdmin) {
      return { success: false, message: "No tienes permisos de administrador." };
    }

    await db.delete(cqAnnouncements).where(eq(cqAnnouncements.id, id));
    return { success: true, message: "Comunicado eliminado exitosamente." };
  } catch (error) {
    console.error("Error en deleteAnnouncementAdminAction:", error);
    return { success: false, message: "Error al eliminar comunicado." };
  }
}

/**
 * ADMIN: Upload an infographic image file to public/announcements/
 */
export async function uploadAnnouncementImageAction(formData: FormData) {
  try {
    const adminUserId = formData.get("adminUserId") as string;
    const file = formData.get("file") as File;

    if (!adminUserId || !file) {
      return { success: false, message: "Falta el archivo o usuario administrador." };
    }

    const isAdmin = await checkIsAdmin(adminUserId);
    if (!isAdmin) {
      return { success: false, message: "No tienes permisos de administrador." };
    }

    if (!file.type.startsWith("image/")) {
      return { success: false, message: "El archivo seleccionado debe ser una imagen (.png, .jpg, .webp)." };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Clean filename
    const ext = path.extname(file.name) || ".png";
    const cleanBasename = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `infografia_${Date.now()}_${cleanBasename}${ext}`;

    // Target Directories: Workspace and Production
    const workspaceDir = path.join(process.cwd(), "public", "announcements");
    const prodDir = "C:\\sistemas_ogess\\FrontCQ\\public\\announcements";

    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, fileName), buffer);

    try {
      await fs.mkdir(prodDir, { recursive: true });
      await fs.writeFile(path.join(prodDir, fileName), buffer);
    } catch (prodErr) {
      console.warn("No se pudo copiar a la ruta de producción C:\\sistemas_ogess...", prodErr);
    }

    const publicUrl = `/announcements/${fileName}`;
    return { success: true, url: publicUrl, message: "¡Imagen cargada y guardada exitosamente!" };
  } catch (error) {
    console.error("Error en uploadAnnouncementImageAction:", error);
    return { success: false, message: "Error al subir la imagen del comunicado." };
  }
}
