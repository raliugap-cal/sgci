// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS SERVICE — Email + SMS + WhatsApp (feature flags)
// MVP: nodemailer (SMTP/SendGrid) — sin dependencias externas de tipos
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

type NotifTemplate =
  | 'cita_confirmacion'
  | 'cita_recordatorio_24h'
  | 'cita_recordatorio_2h'
  | 'cita_cancelacion'
  | 'cita_telemedicina'
  | 'resultado_listo'
  | 'resultado_critico'
  | 'receta_disponible'
  | 'cfdi_emitido'
  | 'lista_espera_disponible'
  | 'portal_bienvenida';

interface SendOptions {
  to: string;
  template: NotifTemplate;
  vars: Record<string, string>;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly ZONA_HORARIA_MX = 'America/Mexico_City';

  private get whatsappEnabled(): boolean {
    return this.config.get<string>('WHATSAPP_ENABLED', 'false') === 'true';
  }

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const sgKey = this.config.get<string>('SENDGRID_API_KEY');
    if (sgKey) {
      this.logger.log('✅ SendGrid configurado');
    } else {
      this.logger.warn('⚠️ SendGrid no configurado — modo dev (logs en consola)');
    }
  }

  // ─── Envío de email ───────────────────────────────────────
  async sendEmail(options: SendOptions): Promise<void> {
    const { subject, html, text } = this.buildEmailContent(options.template, options.vars);
    const sgKey = this.config.get<string>('SENDGRID_API_KEY');

    if (!sgKey) {
      this.logger.log(`[EMAIL DEV] To: ${options.to} | Template: ${options.template} | Subject: ${subject}`);
      this.logger.debug(text);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: { user: 'apikey', pass: sgKey },
    });

    await transporter.sendMail({
      from: `${this.config.get('EMAIL_FROM_NAME', 'SGCI')} <${this.config.get('EMAIL_FROM', 'noreply@sgci.mx')}>`,
      to: options.to,
      subject,
      html,
      text,
    });
  }

  // ─── Notificación WebSocket (in-app para médicos) ─────────
  async notifyMedico(medicoId: string, payload: Record<string, any>): Promise<void> {
    this.logger.debug(`[WS] Notificación para médico ${medicoId}: ${JSON.stringify(payload)}`);
  }

  // ─── Templates por dominio ────────────────────────────────
  async sendAppointmentConfirmation(cita: any): Promise<void> {
    const fechaMx = toZonedTime(cita.fechaInicio, this.ZONA_HORARIA_MX);
    const vars = {
      medico: `Dr(a). ${cita.medico.usuario.nombre} ${cita.medico.usuario.apellidoPaterno}`,
      fecha:  format(fechaMx, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
      hora:   format(fechaMx, 'HH:mm'),
      sede:   cita.sede?.nombre ?? '',
      tipo:   cita.tipoCita,
      url_sala: cita.dailyRoomUrl ?? '',
    };
    const email = this.decryptIfExists(cita.paciente?.emailCifrado);
    if (email) await this.sendEmail({ to: email, template: 'cita_confirmacion', vars });
  }

  async sendAppointmentReminder(cita: any, tipo: '24h' | '2h'): Promise<void> {
    const fechaMx = toZonedTime(cita.fechaInicio, this.ZONA_HORARIA_MX);
    const vars = {
      medico:   `Dr(a). ${cita.medico.usuario.nombre} ${cita.medico.usuario.apellidoPaterno}`,
      hora:     format(fechaMx, 'HH:mm'),
      sede:     cita.sede?.nombre ?? '',
      url_sala: cita.dailyRoomUrl ?? '',
    };
    const email = this.decryptIfExists(cita.paciente?.emailCifrado);
    const template = tipo === '24h' ? 'cita_recordatorio_24h' : 'cita_recordatorio_2h';
    if (email) await this.sendEmail({ to: email, template, vars });
  }

  async sendAppointmentCancellation(cita: any, motivo: string): Promise<void> {
    const email = this.decryptIfExists(cita.paciente?.emailCifrado);
    if (!email) return;
    const fechaMx = toZonedTime(cita.fechaInicio, this.ZONA_HORARIA_MX);
    await this.sendEmail({
      to: email,
      template: 'cita_cancelacion',
      vars: {
        medico: `Dr(a). ${cita.medico?.usuario?.nombre ?? ''}`,
        fecha:  format(fechaMx, "d 'de' MMMM", { locale: es }),
        motivo,
      },
    });
  }

  async sendLabResultReady(orden: any, paciente: any, esCritico: boolean): Promise<void> {
    const email = this.decryptIfExists(paciente?.emailCifrado);
    if (!email) return;
    await this.sendEmail({
      to: email,
      template: esCritico ? 'resultado_critico' : 'resultado_listo',
      vars: {
        nombre:  `${paciente.nombre} ${paciente.apellidoPaterno}`,
        estudio: orden.items?.[0]?.estudio?.nombre ?? 'laboratorio',
      },
    });
  }

  async sendInvoiceEmail(factura: any, xmlUrl: string, pdfUrl: string): Promise<void> {
    const email = this.decryptIfExists(factura.paciente?.emailCifrado);
    if (!email) return;
    await this.sendEmail({
      to: email,
      template: 'cfdi_emitido',
      vars: {
        total:  `$${Number(factura.total).toFixed(2)} MXN`,
        uuid:   factura.cfdiUuid ?? '',
        folio:  factura.numeroFacturaInterno,
      },
    });
  }

  async sendWaitlistAvailable(item: any, fecha: Date): Promise<void> {
    const email = this.decryptIfExists(item.paciente?.emailCifrado);
    if (!email) return;
    const fechaMx = toZonedTime(fecha, this.ZONA_HORARIA_MX);
    await this.sendEmail({
      to: email,
      template: 'lista_espera_disponible',
      vars: { fecha: format(fechaMx, "d 'de' MMMM 'a las' HH:mm", { locale: es }) },
    });
  }

  // ─── Builder de contenido email ───────────────────────────
  private buildEmailContent(template: NotifTemplate, vars: Record<string, string>) {
    const templates: Record<NotifTemplate, { subject: string; text: string }> = {
      cita_confirmacion:      { subject: '✅ Cita confirmada con {{medico}}', text: 'Su cita con {{medico}} está confirmada para el {{fecha}} a las {{hora}} en {{sede}}.' },
      cita_recordatorio_24h:  { subject: '📅 Recordatorio: su cita es mañana a las {{hora}}', text: 'Le recordamos que mañana tiene cita con {{medico}} a las {{hora}} en {{sede}}.' },
      cita_recordatorio_2h:   { subject: '⏰ Su cita es en 2 horas — {{hora}}', text: 'Su cita con {{medico}} comienza en 2 horas a las {{hora}} en {{sede}}.' },
      cita_cancelacion:       { subject: '❌ Cita cancelada — {{fecha}}', text: 'Su cita del {{fecha}} con {{medico}} fue cancelada. Motivo: {{motivo}}.' },
      cita_telemedicina:      { subject: '🎥 Su videoconsulta inicia pronto', text: 'Su videoconsulta con {{medico}} inicia en 15 minutos. Acceda aquí: {{url_sala}}' },
      resultado_listo:        { subject: '🔬 Sus resultados de {{estudio}} están listos', text: 'Sus resultados de {{estudio}} ya están disponibles en su portal de paciente.' },
      resultado_critico:      { subject: '⚠️ IMPORTANTE: Sus resultados requieren atención médica', text: 'Sus resultados de laboratorio contienen valores que requieren atención médica.' },
      receta_disponible:      { subject: '💊 Su receta está lista', text: 'Su receta médica está disponible en su portal.' },
      cfdi_emitido:           { subject: '🧾 Su comprobante fiscal — {{folio}}', text: 'Su CFDI por ${{total}} MXN ha sido emitido. UUID: {{uuid}}.' },
      lista_espera_disponible: { subject: '📢 ¡Se liberó un espacio en agenda!', text: 'Se liberó un espacio disponible para el {{fecha}}. Ingrese a su portal para tomarlo.' },
      portal_bienvenida:      { subject: '🏥 Bienvenido a su portal de paciente', text: 'Su portal ha sido activado. Contraseña temporal: {{tempPassword}}. Cámbiela en su primer ingreso.' },
    };

    const tpl = templates[template] ?? { subject: 'Notificación', text: '{{message}}' };
    const replace = (str: string) =>
      Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), str);

    const subject = replace(tpl.subject);
    const text    = replace(tpl.text);
    const html    = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#1e40af">Clínica SGCI</h2>
      <p style="font-size:16px;line-height:1.6">${text.replaceAll('\n', '<br>')}</p>
      <hr style="border-color:#e2e8f0;margin:20px 0">
      <p style="font-size:12px;color:#64748b">Este es un mensaje automático.</p>
    </div>`;

    return { subject, html, text };
  }

  private decryptIfExists(encrypted: Buffer | null): string | null {
    if (!encrypted) return null;
    return encrypted.toString('utf8');
  }
}
