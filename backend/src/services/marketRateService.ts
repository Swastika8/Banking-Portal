import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export class MarketRateService {
  /**
   * Updates an asset's market rate manually.
   */
  public static async updateManualRate(asset: string, rate: number, updatedBy: string) {
    const assetUpper = asset.toUpperCase();
    const original = await prisma.marketRate.findUnique({
      where: { asset: assetUpper },
    });

    // Record history
    await prisma.marketRateHistory.create({
      data: {
        asset: assetUpper,
        rate,
      },
    });

    // Calculate changes
    const { dailyChange, weeklyChange } = await this.calculateChanges(assetUpper, rate);

    const updated = await prisma.marketRate.upsert({
      where: { asset: assetUpper },
      update: {
        rate,
        source: 'MANUAL',
        dailyChange,
        weeklyChange,
        updated_by: updatedBy,
      },
      create: {
        asset: assetUpper,
        rate,
        source: 'MANUAL',
        dailyChange,
        weeklyChange,
        created_by: updatedBy,
      },
    });

    return updated;
  }

  /**
   * Fetches rates from API, falling back to latest DB rate if it fails.
   */
  public static async syncRateFromApi(asset: string, updatedBy: string) {
    const assetUpper = asset.toUpperCase();
    const config = await prisma.marketRate.findUnique({
      where: { asset: assetUpper },
    });

    let rate = config?.rate || 0;

    console.log(`[MarketRate] Syncing ${assetUpper} | apiEndpoint: ${config?.apiEndpoint}`);
    console.log(`[MarketRate] GOLDAPI_KEY present: ${!!process.env.GOLDAPI_KEY}`);

    if (config?.apiEndpoint) {
      try {
        const response = await axios.get(config.apiEndpoint, {
          headers: {
            'x-access-token': process.env.GOLDAPI_KEY, // ✅ FIXED: was 'x=access-token'
            'Content-Type': 'application/json',
          },
        });

        console.log(`[MarketRate] GoldAPI raw response for ${assetUpper}:`, JSON.stringify(response.data));

        const gramRate = response.data?.price_gram_24k;

        console.log(`[MarketRate] Parsed price_gram_24k: ${gramRate}`);

        if (gramRate && typeof gramRate === 'number') {
          rate = gramRate;
          console.log(`[MarketRate] ✅ Using live rate for ${assetUpper}: ₹${rate}/g`);
        } else {
          console.warn(`[MarketRate] ⚠️ Could not parse gram rate for ${assetUpper}. Using cached: ₹${rate}`);
        }
      } catch (error) {
        console.error(`[MarketRate] ❌ API Sync failed for ${assetUpper}:`, error instanceof Error ? error.message : error);
        console.log(`[MarketRate] Falling back to cached rate: ₹${rate}`);
      }
    } else {
      console.warn(`[MarketRate] No apiEndpoint configured for ${assetUpper}. Skipping sync.`);
    }

    // Save to history
    await prisma.marketRateHistory.create({
      data: {
        asset: assetUpper,
        rate,
      },
    });

    const { dailyChange, weeklyChange } = await this.calculateChanges(assetUpper, rate);

    return await prisma.marketRate.upsert({
      where: { asset: assetUpper },
      update: {
        rate,
        source: 'API',
        dailyChange,
        weeklyChange,
        updated_by: updatedBy,
      },
      create: {
        asset: assetUpper,
        rate,
        source: 'API',
        dailyChange,
        weeklyChange,
        created_by: updatedBy,
      },
    });
  }

  /**
   * Syncs all assets currently configured in the market rates table.
   */
  public static async syncAll(updatedBy: string) {
    const assets = await prisma.marketRate.findMany({
      where: { is_deleted: false },
    });

    const results = [];
    for (const record of assets) {
      if (record.source === 'API') {
        const u = await this.syncRateFromApi(record.asset, updatedBy);
        results.push(u);
      } else {
        const { dailyChange, weeklyChange } = await this.calculateChanges(record.asset, record.rate);
        const u = await prisma.marketRate.update({
          where: { id: record.id },
          data: {
            dailyChange,
            weeklyChange,
            updated_by: updatedBy,
          },
        });
        results.push(u);
      }
    }
    return results;
  }

  /**
   * Helper to calculate daily & weekly change percentages based on history log files.
   */
  private static async calculateChanges(asset: string, currentRate: number) {
    const now = new Date();

    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const past24hLog = await prisma.marketRateHistory.findFirst({
      where: {
        asset,
        recordedAt: { lte: oneDayAgo },
      },
      orderBy: { recordedAt: 'desc' },
    });

    const past7dLog = await prisma.marketRateHistory.findFirst({
      where: {
        asset,
        recordedAt: { lte: oneWeekAgo },
      },
      orderBy: { recordedAt: 'desc' },
    });

    let dailyChange = 0;
    if (past24hLog && past24hLog.rate > 0) {
      dailyChange = ((currentRate - past24hLog.rate) / past24hLog.rate) * 100;
    }

    let weeklyChange = 0;
    if (past7dLog && past7dLog.rate > 0) {
      weeklyChange = ((currentRate - past7dLog.rate) / past7dLog.rate) * 100;
    }

    return {
      dailyChange: Math.round(dailyChange * 100) / 100,
      weeklyChange: Math.round(weeklyChange * 100) / 100,
    };
  }

  /**
   * Generates realistic market history for demo/seeded environments.
   * Uses layered sine + cosine waves to simulate commodity market movement.
   * NO Math.random() — fully deterministic and reproducible.
   * Only runs for assets with source = 'MANUAL'.
   *
   * Pattern: base rate + slow trend + medium wave + micro correction
   */
  public static async generateRealisticHistory(
    asset: string,
    days: number = 60,
    updatedBy: string = 'SYSTEM'
  ): Promise<{ generated: number; asset: string }> {
    const assetUpper = asset.toUpperCase();

    const marketRate = await prisma.marketRate.findUnique({
      where: { asset: assetUpper },
    });

    if (!marketRate) {
      throw new Error(`Market rate record not found for asset: ${assetUpper}`);
    }

    if (marketRate.source !== 'MANUAL') {
      throw new Error(
        `Asset ${assetUpper} is configured with source "${marketRate.source}". ` +
        `Realistic history generation only applies to MANUAL source assets — live API data is preserved.`
      );
    }

    const baseRate = marketRate.rate;
    const now = new Date();

    // Delete existing history for this asset (regenerating from scratch)
    await prisma.marketRateHistory.deleteMany({ where: { asset: assetUpper } });

    const historyPoints = [];

    for (let i = days; i >= 0; i--) {
      const recordedAt = new Date(now);
      recordedAt.setDate(recordedAt.getDate() - i);
      recordedAt.setHours(9, 30, 0, 0); // 9:30 AM market open time

      // Deterministic "noise" using layered sine/cosine functions
      // These parameters create visually realistic commodity fluctuations
      const t = days - i; // time index (0 = oldest, days = now)

      // Layer 1: Slow trend (long-period sine) — 60-day cycle, ±1.5% of base
      const slowTrend = Math.sin((t / days) * 2 * Math.PI) * baseRate * 0.015;

      // Layer 2: Medium wave (20-day period) — ±0.8% of base
      const mediumWave = Math.cos((t / 20) * 2 * Math.PI) * baseRate * 0.008;

      // Layer 3: Short micro-correction (7-day period) — ±0.3% of base
      const microCorrection = Math.sin((t / 7) * 2 * Math.PI + 0.5) * baseRate * 0.003;

      // Layer 4: Intraday-style noise (3-day period, half-amplitude) — ±0.15% of base
      const intradayNoise = Math.cos((t / 3) * 2 * Math.PI + 1.2) * baseRate * 0.0015;

      const rate = Math.round((baseRate + slowTrend + mediumWave + microCorrection + intradayNoise) * 100) / 100;

      historyPoints.push({ asset: assetUpper, rate, recordedAt });
    }

    // Batch insert all history points
    await prisma.marketRateHistory.createMany({ data: historyPoints });

    // Recalculate change percentages based on new history
    const { dailyChange, weeklyChange } = await this.calculateChanges(assetUpper, baseRate);
    await prisma.marketRate.update({
      where: { asset: assetUpper },
      data: { dailyChange, weeklyChange, updated_by: updatedBy },
    });

    return { generated: historyPoints.length, asset: assetUpper };
  }
}