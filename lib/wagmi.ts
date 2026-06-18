import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'Cube Master',
      preference: 'all', // Prompts the user with Smart Wallet and normal Wallet
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});
