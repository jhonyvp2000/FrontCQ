# 📄 DOCUMENTO DE TRASPASO TÉCNICO E INTEGRACIÓN (FrontCQ / BackCQ)

> **Fecha de Actualización:** 13 de Agosto de 2026  
> **Sistema:** FrontCQ / BackCQ (Gestión Quirúrgica Hospital II-2 Tarapoto)  
> **Destinatario:** Agente de Desarrollo / Equipo BackCQ  

---

## 📑 1. RESUMEN EJECUTIVO DE CAMBIOS IMPLEMENTADOS

Hoy se ha completado la refactorización integral del **Módulo de Activación y Habilitación de Cuentas Asistenciales** en FrontCQ, asegurando consistencia en la base de datos PostgreSQL (`ogess`), reglas de negocio estrictas, validaciones antisuplantación y un flujo de **Activación Directa Automática** en 3 pasos.

---

## 🛠️ 2. CAMBIOS EN LA BASE DE DATOS POSTGRESQL (HETZNER / LOCAL)

### A. Campo `users.is_active` y Cuentas de Administración
- Se ejecutó la migración del estado `is_active` en la tabla `users`.
- Se configuraron explícitamente **4 cuentas administradoras activas iniciales**:
  1. **Jhony Vela Paredes** (`DNI: 09791569`) — `jhonyvp2000@gmail.com`
  2. **Alicia Carbonel Silva** (`DNI: 01161204`)
  3. **Maria de los Angeles Gonzales Fasanando** (`DNI: 44723170`)
  4. **Glendy Montoya Gutierrez** (`DNI: 44351526`)
- *Nota de Negocio:* El usuario `01121193` (*Glendy Saavedra Armas*) fue configurado intencionalmente como `is_active = FALSE`.
- Las 1,353 cuentas asistenciales restantes permanecen en `is_active = FALSE` para su auto-activación mediante el flujo web.

### B. Tabla `cq_account_requests`
- Almacena las solicitudes de activación de cuenta.
- Campos clave:
  - `status`: Cambia a `'APPROVED'` automáticamente al completar el registro directo.
  - `phone`: `varchar(20)`, almacena celulares opcionales de 9 dígitos.
  - `requested_email`: Almacena el correo validado del usuario.
  - `token`: `uuid` único por solicitud.

### C. Restricción de Unicidad de Celular en PostgreSQL
- Se creó un índice único parcial en PostgreSQL para prevenir números de celular duplicados entre usuarios, permitiendo múltiples registros nulos/vacíos:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS cq_account_requests_phone_unique_idx 
ON cq_account_requests (phone) 
WHERE phone IS NOT NULL AND phone != '';
```

### D. Asignación Segura de Roles en `user_system_roles`
- Para evitar errores de sintaxis en PostgreSQL derivados de `ON CONFLICT DO NOTHING` en llaves compuestas `(user_id, system_id, role_id)`, el backend consulta primero la existencia del rol antes de insertar:
```typescript
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
```

---

## 🚀 3. NUEVO FLUJO DE ACTIVACIÓN DE CUENTAS EN 3 PASOS

El flujo de habilitación para personal asistencial (`/register-request`) funciona así:

```
[Paso 1: Identidad] ──> [Paso 2: Desafío Quirúrgico] ──> [Paso 3: Contacto y Contraseña] ──> [ACTIVACIÓN DIRECTA]
  (DNI/CE + CMP)          (Paciente Real + Fecha)           (Correo + Celular + Clave)           (is_active = TRUE)
```

1. **Paso 1 (Identidad)**:
   - Ingreso de DNI o Carnet de Extranjería (soporta de 6 a 12 caracteres alfanuméricos).
   - Código de Colegiatura Oficial (CMP, CEP, etc., máx 12 caracteres).
   - Restricción de Perímetro de Red: Solo se puede iniciar desde la Red Interna del Hospital (`192.168.X.X`).
2. **Paso 2 (Desafío de Actividad Quirúrgica Real - Antisuplantación)**:
   - El sistema consulta en BackCQ (`cq_surgeries`, `cq_surgery_team`, `cq_patient_pii`) si el profesional registra cirugías pasadas.
   - Si registra cirugías, exige ingresar el DNI/CE de un paciente operado por él/ella y la fecha exacta de la intervención.
   - Cuenta con sistema de bloqueo por DNI (`cq_account_request_blocks`): 15 minutos tras 3 intentos fallidos y bloqueo permanente tras agotar reintentos.
3. **Paso 3 (Contacto, Seguridad y Activación Inmediata)**:
   - Validación de Correo con formato RFC (`usuario@dominio.com`) y chequeo de unicidad en `users.email`.
   - Validación de Celular: Sólo dígitos numéricos, exactamente 9 caracteres (opcional) y chequeo de unicidad.
   - Creación de Contraseña (mínimo 6 caracteres, hash con bcrypt cost 10).
   - **Activación Inmediata**: Al hacer clic en `[Finalizar y Activar Cuenta]`, el backend activa automáticamente la cuenta (`is_active = TRUE`, `status = 'APPROVED'`) sin requerir tiempos de espera.

---

## 🔒 4. CÓDIGO PRESERVADO PARA FUNCIONALIDADES FUTURAS

- Se conservó limpia e intacta la Server Action `processAccountApprovalAction` y el servicio de envío de correos dual (`sendAccountRequestApprovalEmail`) en `src/lib/email-service.ts`.
- **Enlaces de Red Dual** (Preservados en `src/lib/email-service.ts`):
  - **Red Externa (Internet)**: `http://177.67.250.138:8087`
  - **Red Interna (Hospital)**: `http://192.168.41.25:3008`
- Esta infraestructura servirá si en el futuro se implementan módulos de aprobación manual o auditoría administrativa por parte de la Jefatura de Centro Quirúrgico.

---

## ⚠️ 5. DIRECTIVAS DE SEGURIDAD PARA EL AGENTE DE BACKCQ (EVITAR COLISIONES)

Para garantizar la coexistencia sin errores entre `FrontCQ` y `BackCQ`, se deben respetar las siguientes pautas:

1. **No alterar el campo `users.is_active` globalmente**:
   - No ejecutar scripts `UPDATE users SET is_active = true` masivos sin filtrar los 4 administradores mencionados.
2. **Respetar la tabla `cq_account_requests`**:
   - `FrontCQ` consulta esta tabla para validar duplicados de celular (`phone`) y correo (`requested_email`).
3. **Estructura de la tabla `users`**:
   - `users.email` posee un constraint `UNIQUE` en PostgreSQL. Cualquier `UPDATE users SET email = ...` con un correo existente lanzará una excepción.
4. **Despliegue a Producción**:
   - Los cambios de código deben sincronizarse desde `F:\JVP\ANTIGRAVITY\FrontCQ` hacia la carpeta de producción `C:\sistemas_ogess\FrontCQ`.
   - Para recargar el servicio en producción sin reiniciar la máquina, ejecutar:
     ```powershell
     curl.exe -s http://192.168.41.25:3008/api/force-restart
     ```
