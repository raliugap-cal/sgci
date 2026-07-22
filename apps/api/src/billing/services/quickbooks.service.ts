import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QuickBooksService {
  private readonly logger = new Logger(QuickBooksService.name);
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    this.enabled = config.get('QB_SYNC_ENABLED', 'false') === 'true';
  }

  async enqueueSync(facturaId: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`QB sync desactivado — factura ${facturaId} marcada como pendiente`);
      return;
    }
    this.logger.log(`Encolando sync QB para factura ${facturaId}`);
  }

  async syncInvoice(facturaId: string): Promise<void> {
    if (!this.enabled) return;
    this.logger.log(`Sync QB factura ${facturaId}`);
  }
}
