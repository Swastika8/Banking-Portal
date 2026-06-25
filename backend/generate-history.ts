import { PrismaClient } from '@prisma/client';
import { MarketRateService } from './src/services/marketRateService';

const prisma = new PrismaClient();

async function run() {
  // Get all market rate assets
  const assets = await prisma.marketRate.findMany({ where: { is_deleted: false } });

  for (const asset of assets) {
    if (asset.source === 'MANUAL') {
      const result = await MarketRateService.generateRealisticHistory(asset.asset, 60, 'SYSTEM');
      console.log(`✅ Generated ${result.generated} history points for ${result.asset}`);
    } else {
      // For API-sourced assets, generate history but using current rate as base
      // We temporarily allow this by directly creating history
      const baseRate = asset.rate;
      const now = new Date();
      const days = 60;
      
      await prisma.marketRateHistory.deleteMany({ where: { asset: asset.asset } });
      
      const historyPoints = [];
      for (let i = days; i >= 0; i--) {
        const recordedAt = new Date(now);
        recordedAt.setDate(recordedAt.getDate() - i);
        recordedAt.setHours(9, 30, 0, 0);

        const t = days - i;
        const slowTrend = Math.sin((t / days) * 2 * Math.PI) * baseRate * 0.015;
        const mediumWave = Math.cos((t / 20) * 2 * Math.PI) * baseRate * 0.008;
        const microCorrection = Math.sin((t / 7) * 2 * Math.PI + 0.5) * baseRate * 0.003;
        const intradayNoise = Math.cos((t / 3) * 2 * Math.PI + 1.2) * baseRate * 0.0015;
        const rate = Math.round((baseRate + slowTrend + mediumWave + microCorrection + intradayNoise) * 100) / 100;

        historyPoints.push({ asset: asset.asset, rate, recordedAt });
      }

      await prisma.marketRateHistory.createMany({ data: historyPoints });
      console.log(`✅ Generated ${historyPoints.length} demo history points for API asset ${asset.asset}`);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
