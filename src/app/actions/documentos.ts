"use server";

import { db } from "@/db";
import { 
  cqSurgeries, usersTable, 
  cqPatients, cqPatientPii, cqSurgeryTeam, cqSurgeryDiagnoses, cqDiagnoses
} from "@/db/schema";
import { eq, and, gte, lte, inArray, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export async function generarNotaSiga(params: {
    numero_correlativo: string;
    anio_curso: string;
    fecha_documento: string;
    bien_compra: string;
    doc_referencia: string;
    descripcion_compra: string;
    numero_pedido_siga: string;
    num_seguimiento_gstramite: string;
}) {
    const templatePath = path.join(process.cwd(), "public", "templates", "Pedidos_SIGA_compra_bienes_servicios.docx");
    
    if (!fs.existsSync(templatePath)) {
        throw new Error("La plantilla base 'Pedidos_SIGA_compra_bienes_servicios.docx' no existe en el directorio public/templates. Por favor colóquela allí.");
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    doc.render(params);

    const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    const safeSubject = params.bien_compra.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
    return {
        base64: buf.toString("base64"),
        filename: `Nota_${params.numero_correlativo}_${safeSubject}.docx`
    };
}

export async function generarConformidadServicio(params: {
    numero_correlativo: string;
    anio_curso: string;
    fecha_documento: string;
    personal_locador: string;
    cargo_locador: string;
    numero_orden_servicio: string;
    numero_entregable: string;
    num_seguimiento: string;
}) {
    const templatePath = path.join(process.cwd(), "public", "templates", "conformidad_servicio_locador.docx");
    
    if (!fs.existsSync(templatePath)) {
        throw new Error("La plantilla base 'conformidad_servicio_locador.docx' no existe en el directorio public/templates.");
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    doc.render(params);

    const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    const safeName = params.personal_locador.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    return {
        base64: buf.toString("base64"),
        filename: `Conformidad_${params.numero_correlativo}_${safeName}.docx`
    };
}

export async function generarNotaGenerica(params: {
    numero_correlativo: string;
    anio_curso: string;
    fecha_documento: string;
    destinatario_nombre: string;
    destinatario_cargo: string;
    asunto: string;
    referencia: string;
    cuerpo_documento: string;
    num_seguimiento: string;
}) {
    const templatePath = path.join(process.cwd(), "public", "templates", "nota_generica.docx");
    
    if (!fs.existsSync(templatePath)) {
        throw new Error("La plantilla base 'nota_generica.docx' no existe en el directorio public/templates.");
    }

    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    doc.render(params);

    const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    const safeAsunto = params.asunto.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
    return {
        base64: buf.toString("base64"),
        filename: `Nota_${params.numero_correlativo}_${safeAsunto}.docx`
    };
}
