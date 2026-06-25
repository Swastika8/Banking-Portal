import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MarketRateService } from '../services/marketRateService';
import { AuditService } from '../services/auditService';

const prisma = new PrismaClient();

export class MarketRateController {
  /**
   * Retrieves all asset rates.
   */
  public static async list(req: Request, res: Response) {
    try {
      const rates = await prisma.marketRate.findMany({
        where: { is_deleted: false },
        orderBy: { asset: 'asc' },
      });
      return res.json(rates);
    } catch (error) {
      console.error('List Market Rates Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Updates rate manually.
   */
  public static async updateManual(req: Request, res: Response) {
    try {
      const { asset, rate } = req.body;
      if (!asset || rate === undefined || rate <= 0) {
        return res.status(400).json({ message: 'Asset name and a positive rate value are required.' });
      }

      const userEmail = req.user?.email || 'SYSTEM';
      const updated = await MarketRateService.updateManualRate(asset, parseFloat(rate), userEmail);

      // Audit Log
      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        module: 'MASTER',
        newValue: { asset, rate, source: 'MANUAL' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({ message: 'Market rate updated manually.', data: updated });
    } catch (error) {
      console.error('Update Manual Rate Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Syncs rates from configured API (or falls back to database rate).
   */
  public static async triggerSync(req: Request, res: Response) {
    try {
      const { asset } = req.body;
      const userEmail = req.user?.email || 'SYSTEM';

      if (asset) {
        const updated = await MarketRateService.syncRateFromApi(asset, userEmail);
        return res.json({ message: `API Sync complete for ${asset}.`, data: updated });
      } else {
        const updatedList = await MarketRateService.syncAll(userEmail);
        return res.json({ message: 'API Sync complete for all assets.', data: updatedList });
      }
    } catch (error) {
      console.error('Trigger Market Rate Sync Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Fetches historical logs for trend line charts.
   */
  public static async getHistory(req: Request, res: Response) {
    try {
      const { asset } = req.params;
      if (!asset) return res.status(400).json({ message: 'Asset is required.' });

      const history = await prisma.marketRateHistory.findMany({
        where: { asset: asset.toUpperCase() },
        orderBy: { recordedAt: 'asc' },
        take: 90, // Expanded to 90 days for richer chart visualization
      });

      return res.json(history);
    } catch (error) {
      console.error('Get Market Rate History Error:', error);
      return res.status(500).json({ message: 'Internal server error.' });
    }
  }

  /**
   * Generates realistic demo market history for MANUAL source assets.
   * Uses deterministic sine/cosine math — no random values.
   * Live API assets are left completely untouched.
   */
  public static async generateHistory(req: Request, res: Response) {
    try {
      const { asset, days } = req.body;

      if (!asset) {
        return res.status(400).json({ message: 'Asset name is required.' });
      }

      const daysCount = days ? Math.min(parseInt(days), 180) : 60;
      const userEmail = req.user?.email || 'SYSTEM';

      const result = await MarketRateService.generateRealisticHistory(asset, daysCount, userEmail);

      await AuditService.logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        module: 'MASTER',
        newValue: { asset, daysGenerated: result.generated, action: 'GENERATE_HISTORY' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.json({
        message: `Generated ${result.generated} realistic history points for ${result.asset}.`,
        ...result,
      });
    } catch (error: any) {
      console.error('Generate History Error:', error);
      return res.status(400).json({ message: error.message || 'Internal server error.' });
    }
  }
}

