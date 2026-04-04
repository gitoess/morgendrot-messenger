import { logger } from './logger';
import { CFG } from './config';

async function main() {
  logger.info('╔════════════════════════════╗');
  logger.info('║     MORGENDROT v0.1        ║');
  logger.info(`║     Rolle: ${CFG.ROLE.padEnd(14)}║`);
  logger.info('╚════════════════════════════╝');

  logger.info(`RPC → ${CFG.RPC_URL}`);
  logger.info('System bereit. Fehler sollten jetzt weg sein.');
}

main().catch(err => {
  logger.error('Start fehlgeschlagen:', err);
  process.exit(1);
});