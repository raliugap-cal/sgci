// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS SERVICE — Email → SMS → WhatsApp (feature flag)
// MVP: Email (SendGrid) + SMS (AWS SNS)
// Fase 1.5: WhatsApp Business API (Meta)
// ═══════════════════════════════════════════════════════════
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';
import { Server } from 'socket.io';
import { InjectSocketServer } from '@nestjs/websockets';
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

  // Feature flags — controlados por ConfigService
  private get whatsappEnabled(): boolean {
    return this.config.get<string>('WHATSAPP_ENABLED', 'false') === 'true';
  }
  private get smsEnabled(): boolean {
    return !!this.config.get<string>('AWS_SNS_ACCESS_KEY');
  }

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    // Inicializar SendGrid
    const sgKey = this.config.get<string>('SENDGRID_API_KEY');
    if (sgKey) {
      sgMail.setApiKey(sgKey);
      this.logger.log('✅ SendGrid configurado');
    } else {
      this.logger.warn('⚠️ SendGrid no configurado — modo dev (logs en consola)');
    }
  }

  // ─── Resolver canal óptimo por orden de prioridad ─────────
  private resolveChannels(paciente: any): ('whatsapp' | 'sms' | 'email')[] {
    const channels: ('whatsapp' | 'sms' | 'email')[] = [];

    if (this.whatsappEnabled && paciente?.whatsapp) channels.push('whatsapp');
    if (this.smsEnabled && paciente?.telefono)      channels.push('sms');
    if (paciente?.email)                            channels.push('email');

    return channels;
  }

  // ─── Método principal de envío ────────────────────────────
  async send(options: SendOptions): Promise<void> {
    const notif = await this.prisma.notificacion.create({
      data: {
        canal: 'email', // Se actualiza con el canal real
        plantilla: options.template,
        destinatario: options.to,
        contenido: { vars: options.vars },
        estado: 'pending',
      },
    });

    try {
      await this.sendEmail(options);
      await this.prisma.notificacion.update({
        where: { id: notif.id },
        data: { estado: 'sent', enviadaAt: new Date(), canal: 'email' },
      });
    } catch (e) {
      this.logger.error(`Error enviando notificación ${notif.id}: ${e.message}`);
      await this.prisma.notificacion.update({
        where: { id: notif.id },
        data: { estado: 'failed', error: e.message, intentos: { increment: 1 }, ultimoIntento: new Date() },
      });
    }
  }

  // ─── Email con SendGrid ───────────────────────────────────
  async sendEmail(options: SendOptions): Promise<void> {
    const { subject, html, text } = this.buildEmailContent(options.template, options.vars);
    const sgKey = this.config.get<string>('SENDGRID_API_KEY');

    if (!sgKey) {
      // Modo desarrollo: log en consola
      this.logger.log(`[EMAIL DEV] To: ${options.to} | Template: ${options.template} | Subject: ${subject}`);
      this.logger.debug(text);
      return;
    }

    const msg: any = {
      to: options.to,
      from: {
        email: this.config.get<string>('EMAIL_FROM', 'noreply@clinica.mx'),
        name: this.config.get<string>('EMAIL_FROM_NAME', 'Clínica SGCI'),
      },
      subject,
      text,
      html,
    };

    if (options.attachments?.length) {
      msg.attachments = options.attachments.map(a => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        type: a.contentType,
        disposition: 'attachment',
      }));
    }

    await sgMail.send(msg);
  }

  // ─── WhatsApp Business API (en standby hasta activación) ──
  private async sendWhatsApp(phoneNumber: string, template: NotifTemplate, vars: Record<string, string>): Promise<void> {
    if (!this.whatsappEnabled) {
      this.logger.debug(`[WA STANDBY] No activo. Plantilla: ${template}`);
      return;
    }

    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');

    const body = this.buildWhatsAppBody(template, vars);

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber.startsWith('52') ? phoneNumber : `52${phoneNumber}`,
          ...body,
        }),
      },
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(err)}`);
    }

    const result = await response.json();
    return result.messages?.[0]?.id;
  }

  // ─── SMS con AWS SNS ──────────────────────────────────────
  private async sendSms(phoneNumber: string, message: string): Promise<void> {
    if (!this.smsEnabled) return;
    // En producción: usar @aws-sdk/client-sns
    this.logger.log(`[SMS] To: +52${phoneNumber} | ${message.substring(0, 50)}...`);
  }

  // ─── Notificación WebSocket (in-app para médicos) ─────────
  async notifyMedico(medicoId: string, payload: Record<string, any>): Promise<void> {
    // El servidor WebSocket está inyectado en el gateway
    // Esta implementación usa un event emitter o Redis pub/sub
    this.logger.debug(`[WS] Notificación para médico ${medicoId}: ${JSON.stringify(payload)}`);
  }

  // ─── Templates específicos por dominio ───────────────────
  async sendAppointmentConfirmation(cita: any): Promise<void> {
    const fechaMx = toZonedTime(cita.fechaInicio, this.ZONA_HORARIA_MX);
    const vars = {
      medico: `Dr(a). ${cita.medico.usuario.nombre} ${cita.medico.usuario.apellidoPaterno}`,
      fecha: format(fechaMx, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
      hora: format(fechaMx, 'HH:mm'),
      sede: cita.sede.nombre,
      tipo: cita.tipoCita,
      url_sala: cita.dailyRoomUrl ?? '',
    };

    const email = this.decryptIfExists(cita.paciente?.emailCifrado);
    if (email) await this.sendEmail({ to: email, template: 'cita_confirmacion', vars });
  }

  async sendAppointmentReminder(cita: any, tipo: '24h' | '2h'): Promise<void> {
    const fechaMx = toZonedTime(cita.fechaInicio, this.ZONA_HORARIA_MX);
    const vars = {
      medico: `Dr(a). ${cita.medico.usuario.nombre} ${cita.medico.usuario.apellidoPaterno}`,
      hora: format(fechaMx, 'HH:mm'),
      sede: cita.sede.nombre,
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
        fecha: format(fechaMx, "d 'de' MMMM", { locale: es }),
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
        nombre: `${paciente.nombre} ${paciente.apellidoPaterno}`,
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
        total: `$${Number(factura.total).toFixed(2)} MXN`,
        uuid: factura.cfdiUuid ?? '',
        folio: factura.numeroFacturaInterno,
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
      vars: {
        fecha: format(fechaMx, "d 'de' MMMM 'a las' HH:mm", { locale: es }),
      },
    });
  }

  // ─── Builder de contenido email ───────────────────────────
  private buildEmailContent(template: NotifTemplate, vars: Record<string, string>): {
    subject: string; html: string; text: string;
  } {
    const templates: Record<NotifTemplate, { subject: string; text: string }> = {
      cita_confirmacion: {
        subject: '✅ Cita confirmada con {{medico}}',
        text: 'Su cita con {{medico}} está confirmada para el {{fecha}} a las {{hora}} en {{sede}}.',
      },
      cita_recordatorio_24h: {
        subject: '📅 Recordatorio: su cita es mañana a las {{hora}}',
        text: 'Le recordamos que mañana tiene cita con {{medico}} a las {{hora}} en {{sede}}.',
      },
      cita_recordatorio_2h: {
        subject: '⏰ Su cita es en 2 horas — {{hora}}',
        text: 'Su cita con {{medico}} comienza en 2 horas a las {{hora}} en {{sede}}.',
      },
      cita_cancelacion: {
        subject: '❌ Cita cancelada — {{fecha}}',
        text: 'Su cita del {{fecha}} con {{medico}} fue cancelada. Motivo: {{motivo}}.',
      },
      cita_telemedicina: {
        subject: '🎥 Su videoconsulta inicia pronto',
        text: 'Su videoconsulta con {{medico}} inicia en 15 minutos. Acceda aquí: {{url_sala}}',
      },
      resultado_listo: {
        subject: '🔬 Sus resultados de {{estudio}} están listos',
        text: 'Sus resultados de {{estudio}} ya están disponibles en su portal de paciente.',
      },
      resultado_critico: {
        subject: '⚠️ IMPORTANTE: Sus resultados requieren atención médica',
        text: 'Sus resultados de laboratorio contienen valores que requieren atención médica. Por favor contacte a su médico a la brevedad.',
      },
      receta_disponible: {
        subject: '💊 Su receta está lista',
        text: 'Su receta médica del {{fecha}} está disponible. Descárguela en: {{url}}',
      },
      cfdi_emitido: {
        subject: '🧾 Su comprobante fiscal — {{folio}}',
        text: 'Su CFDI por ${{total}} MXN ha sido emitido. UUID: {{uuid}}. Adjuntamos el PDF y XML para su registro.',
      },
      lista_espera_disponible: {
        subject: '📢 ¡Se liberó un espacio en agenda!',
        text: 'Se liberó un espacio disponible para el {{fecha}}. Ingrese a su portal para tomarlo.',
      },
      portal_bienvenida: {
        subject: '🏥 Bienvenido a su portal de paciente',
        text: 'Su portal de paciente ha sido activado. Contraseña temporal: {{tempPassword}}. Cámbiela en su primer ingreso.',
      },
    };

    const tpl = templates[template] ?? { subject: 'Notificación', text: '{{message}}' };

    // Reemplazar variables
    const replace = (str: string) =>
      Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), str);

    const subject = replace(tpl.subject);
    const text = replace(tpl.text);
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#1e40af">Clínica SGCI</h2>
      <p style="font-size:16px;line-height:1.6">${text.replaceAll('\n', '<br>')}</p>
      <hr style="border-color:#e2e8f0;margin:20px 0">
      <p style="font-size:12px;color:#64748b">Este es un mensaje automático. Si tiene dudas, contáctenos directamente en la clínica.</p>
    </div>`;

    return { subject, html, text };
  }

  // ─── Builder de body para WhatsApp ───────────────────────
  private buildWhatsAppBody(template: NotifTemplate, vars: Record<string, string>) {
    const waTemplates: Partial<Record<NotifTemplate, any>> = {
      cita_confirmacion: {
        type: 'template',
        template: {
          name: 'cita_confirmacion',
          language: { code: 'es_MX' },
          components: [
            { type: 'body', parameters: [
              { type: 'text', text: vars.medico },
              { type: 'text', text: vars.fecha },
              { type: 'text', text: vars.hora },
              { type: 'text', text: vars.sede },
            ]},
          ],
        },
      },
    };
    return waTemplates[template] ?? { type: 'text', text: { body: 'Tiene una notificación de su clínica.' } };
  }

  private decryptIfExists(encrypted: Buffer | null): string | null {
    if (!encrypted) return null;
    // En producción: EncryptionService.decrypt(encrypted)
    return encrypted.toString('utf8');
  }
}
