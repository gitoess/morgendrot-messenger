'use client'

import {
  BossWalletGasFundingPanel,
  type BossWalletGasFundingPanelProps,
} from '@/frontend/components/onboarding/boss-wallet-gas-funding-panel'

type TestnetPanelProps = Omit<BossWalletGasFundingPanelProps, 'network'>

export function BossWizardTestnetGasPanel(props: TestnetPanelProps) {
  return <BossWalletGasFundingPanel {...props} network="testnet" />
}

export { BossWalletGasFundingPanel }
