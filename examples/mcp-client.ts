/**
 * Call FranceStack over MCP and pay automatically with x402 (@x402/mcp).
 *
 *   npm install @modelcontextprotocol/sdk @x402/mcp @x402/core @x402/evm viem
 *   PRIVATE_KEY=0x... npx tsx examples/mcp-client.ts
 *
 * PRIVATE_KEY: an EVM wallet holding USDC on the network shown by the server
 * (Base mainnet, real USDC: each call costs $0.005). Never commit it.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { wrapMCPClientWithPayment } from '@x402/mcp';
import { privateKeyToAccount } from 'viem/accounts';

const MAX_PRICE_UNITS = 10_000n; // safety cap: never pay more than 0.01 USDC per call

const mcp = new Client({ name: 'my-agent', version: '1.0.0' });
await mcp.connect(new StreamableHTTPClientTransport(new URL('https://tax.francestack.fr/mcp')));

// Free: discover the tools.
const { tools } = await mcp.listTools();
console.log(tools.map((t) => t.name));

// Pay per call with x402.
const payments = new x402Client((_version, requirements) => {
  const ok = requirements.find((r) => BigInt(r.amount) <= MAX_PRICE_UNITS);
  if (!ok) throw new Error('Price above the safety cap');
  return ok;
});
registerExactEvmScheme(payments, { signer: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`) });
const agent = wrapMCPClientWithPayment(mcp, payments, { autoPayment: true });

const result = await agent.callTool('france_income_tax', {
  annee_revenus: 2025,
  situation_familiale: 'marie_pacse',
  enfants_a_charge: 2,
  revenu_net_imposable: 54000,
  cas_particuliers: [],
});

const body = JSON.parse((result.content[0] as { text: string }).text);
if (result.isError) {
  // Free: missing fields come back with the questions to ask the user.
  console.log(body.erreur);
} else {
  console.log(body.resultat.impot_a_payer, '€ — paid:', result.paymentMade, result.paymentResponse?.transaction);
}
await mcp.close();
