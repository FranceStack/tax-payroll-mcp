/**
 * Call the FranceStack HTTP API and pay automatically with x402 (@x402/fetch).
 *
 *   npm install @x402/fetch @x402/evm viem
 *   PRIVATE_KEY=0x... npx tsx examples/http-client.ts
 *
 * PRIVATE_KEY: an EVM wallet holding USDC on the network shown by the server
 * (currently Base Sepolia test USDC: https://faucet.circle.com). Never commit it.
 */
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';

const MAX_PRICE_UNITS = 10_000n; // safety cap: never pay more than 0.01 USDC per call

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: 'eip155:84532', client: new ExactEvmScheme(privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)) }],
  paymentRequirementsSelector: (_version: number, requirements: { amount: string }[]) => {
    const ok = requirements.find((r) => BigInt(r.amount) <= MAX_PRICE_UNITS);
    if (!ok) throw new Error('Price above the safety cap');
    return ok;
  },
} as never);

const response = await fetchWithPayment('https://tax.francestack.fr/api/calcul/brut-net', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    salaire_brut: 3000,
    periode: 'mois',
    annee: 2026,
    mois: 3,
    type_contrat: 'CDI',
    statut_cadre: false,
    effectif: 'de_20_a_49',
    mutuelle_part_salariale: 30,
    mutuelle_part_patronale: 30,
    taux_versement_mobilite_pourcent: 1.75,
    cas_particuliers: [],
  }),
});

const body = await response.json();
// 200: result (paid) — 422: free error with the questions to ask the user.
console.log(response.status, response.status === 200 ? body.resultat : body.erreur);
