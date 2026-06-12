import { pgTable, text, timestamp, boolean, date, uuid, varchar, primaryKey, integer } from "drizzle-orm/pg-core";

// Base shared tables (Hetzner Ecosystem, created by BackAdmin)
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  dni: text("dni").notNull().unique(),
  name: text("name").notNull(),
  lastname: text("lastname").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  tokenVersion: integer("token_version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rolesTable = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  systemId: text("system_id").notNull(),
  name: text("name").notNull(), // e.g. 'Administrador CQ', 'Médico Cirujano'
  description: text("description"),
});

export const permissionsTable = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  systemId: text("system_id").notNull(),
  resource: text("resource").notNull(),
  action: text("action").notNull(), // e.g. 'crear:operaciones'
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => rolesTable.id, { onDelete: 'cascade' }),
  permissionId: uuid("permission_id").notNull().references(() => permissionsTable.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.roleId, t.permissionId] })
]);

export const userSystemRoles = pgTable("user_system_roles", {
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  systemId: text("system_id").notNull(), // 'backadmin', 'backrrhh', 'backepi', 'backcq'
  roleId: uuid("role_id").notNull().references(() => rolesTable.id, { onDelete: 'restrict' }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.systemId, t.roleId] })
]);

export const professions = pgTable("professions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(), // Ej: MEDICO CIRUJANO, ENFERMERO, ANESTESIÓLOGO
  staffCategory: varchar("staff_category", { length: 50 }).notNull(), // ASISTENCIAL, ADMINISTRATIVO
});

export const staffProfiles = pgTable("staff_profiles", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: 'cascade' }),
  professionId: uuid("profession_id").notNull().references(() => professions.id, { onDelete: 'restrict' }),
  tuitionCode: varchar("tuition_code", { length: 50 }), // CMP, CEP, etc.
});

// Domain-specific BackCQ Tables (Prefix cq_)
export const cqOperatingRooms = pgTable("cq_operating_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(), // e.g. 'Sala 1', 'Sala 2'
  status: varchar("status", { length: 50 }).notNull().default('available'), // available, occupied, maintenance
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cqPatients = pgTable("cq_patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  fechaNacimiento: timestamp("fecha_nacimiento", { withTimezone: true }),
  sexo: varchar("sexo", { length: 20 }), // 'Masculino', 'Femenino', etc.
  ubigeo: varchar("ubigeo", { length: 6 }), // 6-digit INEI code (MINSA Standard)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cqPatientPii = pgTable("cq_patient_pii", {
  patientId: uuid("patient_id").primaryKey().references(() => cqPatients.id, { onDelete: 'cascade' }),
  dni: varchar("dni", { length: 20 }).unique(),
  carnetExtranjeria: varchar("carnet_extranjeria", { length: 20 }).unique(),
  pasaporte: varchar("pasaporte", { length: 20 }).unique(),
  nombres: text("nombres").notNull(),
  apellidos: text("apellidos").notNull(),
  historiaClinica: varchar("historia_clinica", { length: 50 }).unique(),
  direccion: text("direccion"),
  bloodGroupRh: varchar("blood_group_rh", { length: 10 }),
});

export const cqSpecialties = pgTable("cq_specialties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cqSurgeries = pgTable("cq_surgeries", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => cqPatients.id, { onDelete: 'restrict' }),
  operatingRoomId: uuid("operating_room_id").references(() => cqOperatingRooms.id, { onDelete: 'set null' }),
  specialtyId: uuid("specialty_id").references(() => cqSpecialties.id, { onDelete: 'set null' }),
  requestDate: date("request_date").notNull().defaultNow(),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  isTimeDefined: boolean("is_time_defined").default(true).notNull(),
  status: varchar("status", { length: 50 }).notNull().default('scheduled'), // scheduled, in_progress, anesthesia_start, pre_incision, surgery_end, patient_exit, urpa_exit, completed, cancelled
  urgencyType: varchar("urgency_type", { length: 50 }).notNull().default('ELECTIVO'), // 'EMERGENCIA', 'ELECTIVO'
  estimatedDuration: varchar("estimated_duration", { length: 50 }), // e.g. "1 hora", "2 horas"
  diagnosis: text("diagnosis"), // custom text
  postDiagnosis: text("post_diagnosis"), // custom text
  surgeryType: varchar("surgery_type", { length: 50 }), // 'Cirugía Menor', 'Cirugía Mayor'
  insuranceType: varchar("insurance_type", { length: 50 }), // 'SIS', 'SOAT', 'PARTICULAR', 'SISPOL'
  anesthesiaType: varchar("anesthesia_type", { length: 50 }), // 'RAQ', 'EPI', 'AGB', 'AGE', 'AGI', 'BLOQ', 'LOCL'
  origin: varchar("origin", { length: 255 }), // Procedencia: Cama, Ambulatorio, etc.
  bedNumber: varchar("bed_number", { length: 50 }),
  internalCode: varchar("internal_code", { length: 100 }),
  actualStartTime: timestamp("actual_start_time", { withTimezone: true }), // when in_progress
  anesthesiaStartTime: timestamp("anesthesia_start_time", { withTimezone: true }),
  preIncisionTime: timestamp("pre_incision_time", { withTimezone: true }),
  surgeryEndTime: timestamp("surgery_end_time", { withTimezone: true }),
  patientExitTime: timestamp("patient_exit_time", { withTimezone: true }),
  urpaExitTime: timestamp("urpa_exit_time", { withTimezone: true }),
  completedTime: timestamp("completed_time", { withTimezone: true }),
  isDeathByEmergency: boolean("is_death_by_emergency").default(false).notNull(),
  isFromCopri: boolean("is_from_copri").default(false).notNull(),
  isRescheduled: boolean("is_rescheduled").default(false).notNull(),
  isReintervention: boolean("is_reintervention").default(false).notNull(),
  hasHypoxicEncephalopathy: boolean("has_hypoxic_encephalopathy").default(false).notNull(),
  hasUrpaComplication: boolean("has_urpa_complication").default(false).notNull(),
  diedInSurgery: boolean("died_in_surgery").default(false).notNull(),
  diedInUrpa: boolean("died_in_urpa").default(false).notNull(),
  cancellationReason: text("cancellation_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cqSurgeryTeam = pgTable("cq_surgery_team", {
  id: uuid("id").primaryKey().defaultRandom(),
  surgeryId: uuid("surgery_id").notNull().references(() => cqSurgeries.id, { onDelete: 'cascade' }),
  staffUserId: uuid("staff_user_id").notNull().references(() => usersTable.id, { onDelete: 'restrict' }),
  roleInSurgery: varchar("role_in_surgery", { length: 50 }).notNull(), // CIRUJANO, ANESTESIOLOGO, ENFERMERO
});

export const cqSurgicalReports = pgTable("cq_surgical_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  surgeryId: uuid("surgery_id").notNull().references(() => cqSurgeries.id, { onDelete: 'cascade' }),
  surgeonId: uuid("surgeon_id").notNull().references(() => usersTable.id),
  preOpDiagnosis: text("pre_op_diagnosis"),
  postOpDiagnosis: text("post_op_diagnosis"),
  surgicalProcedure: text("surgical_procedure"),
  findings: text("findings"),
  bloodLoss: varchar("blood_loss", { length: 50 }),
  complications: text("complications"),
  documentUrl: text("document_url"), // URL holding the Supabase PDF attachment
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// New CIE-10 (or generic) Diagnoses Dictionary
export const cqDiagnoses = pgTable("cq_diagnoses", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).unique(), // e.g. 'K35', 'C34.9'
  name: text("name").notNull(), // e.g. 'Apendicitis aguda', 'Tumor maligno de los bronquios'
  isActive: boolean("is_active").default(true).notNull(),
  isVerifiedMinsa: boolean("is_verified_minsa").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Junction table: multiple diagnoses per surgery
export const cqSurgeryDiagnoses = pgTable("cq_surgery_diagnoses", {
  surgeryId: uuid("surgery_id").notNull().references(() => cqSurgeries.id, { onDelete: 'cascade' }),
  diagnosisId: uuid("diagnosis_id").notNull().references(() => cqDiagnoses.id, { onDelete: 'restrict' }),
}, (t) => [
  primaryKey({ columns: [t.surgeryId, t.diagnosisId] })
]);

export const cqSurgeryPostDiagnoses = pgTable("cq_surgery_post_diagnoses", {
  surgeryId: uuid("surgery_id").notNull().references(() => cqSurgeries.id, { onDelete: 'cascade' }),
  diagnosisId: uuid("diagnosis_id").notNull().references(() => cqDiagnoses.id, { onDelete: 'restrict' }),
}, (t) => [
  primaryKey({ columns: [t.surgeryId, t.diagnosisId] })
]);

// New CPT (or generic) Procedures Dictionary for MINSA
export const cqProcedures = pgTable("cq_procedures", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).unique(), // e.g. '47562', '44970'
  name: text("name").notNull(), // e.g. 'Colecistectomía laparoscópica'
  isActive: boolean("is_active").default(true).notNull(),
  isVerifiedMinsa: boolean("is_verified_minsa").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Junction table: multiple procedures per surgery
export const cqSurgeryProcedures = pgTable("cq_surgery_procedures", {
  surgeryId: uuid("surgery_id").notNull().references(() => cqSurgeries.id, { onDelete: 'cascade' }),
  procedureId: uuid("procedure_id").notNull().references(() => cqProcedures.id, { onDelete: 'restrict' }),
}, (t) => [
  primaryKey({ columns: [t.surgeryId, t.procedureId] })
]);

// Dictionary for "Tipo de intervención"
export const cqInterventionTypes = pgTable("cq_intervention_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).unique(), // Will be injected via CSV seeded sequence
  name: text("name").notNull().unique(), // e.g. 'ADENECTOMIA PROSTATICA TRANSVESICAL'
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Junction table: multiple intervention types per surgery
export const cqSurgeryInterventions = pgTable("cq_surgery_interventions", {
  surgeryId: uuid("surgery_id").notNull().references(() => cqSurgeries.id, { onDelete: 'cascade' }),
  interventionId: uuid("intervention_id").notNull().references(() => cqInterventionTypes.id, { onDelete: 'restrict' }),
}, (t) => [
  primaryKey({ columns: [t.surgeryId, t.interventionId] })
]);

// Catálogo Maestro de UBIGEO (INEI/MINSA)
export const cqUbigeo = pgTable("cq_ubigeo", {
  code: varchar("code", { length: 6 }).primaryKey(), // e.g. '150101'
  departamento: varchar("departamento", { length: 100 }).notNull(),
  provincia: varchar("provincia", { length: 100 }).notNull(),
  distrito: varchar("distrito", { length: 100 }).notNull(),
  superficie: varchar("superficie", { length: 50 }),
  altitud: varchar("altitud", { length: 50 }),
  latitud: varchar("latitud", { length: 50 }),
  longitud: varchar("longitud", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
