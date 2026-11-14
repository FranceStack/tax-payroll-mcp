<p align="center">
  <img src="https://tax.francestack.fr/icon.svg" width="72" height="72" alt="FranceStack">
</p>

<h1 align="center">FranceStack Tax &amp; Payroll</h1>

<p align="center">
  <strong>Exact French tax and payroll calculations for AI agents — as an MCP server and a pay-per-call HTTP API.</strong><br>
  Income tax · Micro-entrepreneur (URSSAF) contributions · Gross-to-net salary &amp; employer cost
</p>

<p align="center">
  <a href="https://tax.francestack.fr">Website</a> ·
  <a href="https://tax.francestack.fr/llms.txt">llms.txt</a> ·
  <a href="https://tax.francestack.fr/api/calculs">Catalogue</a> ·
  <a href="https://tax.francestack.fr/openapi.json">OpenAPI</a> ·
  <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=fr.francestack">MCP Registry</a>
</p>

---

LLMs are bad at tax arithmetic: brackets, family quotient caps, *décote*, URSSAF rates that change every January. **FranceStack does the calculation deterministically, with the official rules, and shows its work** — so your agent can answer French users with numbers it can trust, for a fraction of a cent.

- **Exact, not generated** — no LLM at runtime, exact decimal arithmetic, every result validated before it is sent.
- **Verified against official sources** — DGFiP tax tables (7,095 values, to the euro), URSSAF's official engine (`modele-social`), and cases checked on the official government simulators.
- **Errors are free** — missing or unsupported inputs return, *before any payment*, the exact questions to ask the user.
- **Pay only on success** — $0.005 per calculation in USDC via [x402](https://x402.org). No account, no API key, no subscription.
- **Verifiable** — every answer includes a step-by-step breakdown, assumptions, the scale version and sources, and a link to the official simulator.

> **Status:** live in **test mode** — payments use test USDC on Base Sepolia. Mainnet (Base) is coming soon.

## Tools

| MCP tool | What it computes | Price |
|---|---|---|
| `france_income_tax` | French personal income tax (*impôt sur le revenu*): tax shares (*parts*), family quotient and its cap, *décote*, net tax, average and marginal rate (TMI). Income years 2024 and 2025. | $0.005 |
| `france_micro_entrepreneur_contributions` | URSSAF social contributions of a micro-entrepreneur (*auto-entrepreneur*): contributions with or without ACRE, vocational training (CFP), chamber tax, optional *versement libératoire*, net income. 2025 and 2026. | $0.005 |
| `france_gross_to_net_salary` | Gross-to-net salary (*salaire brut → net*) for a private-sector CDI: employee and employer contributions, net before and after income tax, general employer relief (RGDU), total employer cost. 2026. | $0.005 |
| `list_france_calculators` | Catalogue: every tool with its input schema, a real example, the output schema and unsupported cases. | **free** |

Unsupported situations (non-residents, part-time, mixed activities…) are listed in each tool description and refused **for free** — the service never guesses.

## Connect via MCP

Streamable HTTP endpoint (stateless): **`https://tax.francestack.fr/mcp`**

```json
{
  "mcpServers": {
    "francestack-tax": {
      "type": "http",
      "url": "https://tax.francestack.fr/mcp"
    }
  }
}
```

Paid tools use the **x402 payment protocol over MCP**: the first call returns the payment requirements (`isError` result whose `structuredContent` holds `x402Version` and `accepts`); the client calls the tool again with the signed payment in `_meta["x402/payment"]`. Clients built with [`@x402/mcp`](https://www.npmjs.com/package/@x402/mcp) do this automatically — see [`examples/mcp-client.ts`](examples/mcp-client.ts).

## Call over HTTP

```bash
curl -i -X POST https://tax.francestack.fr/api/calcul/impot-revenu \
  -H "Content-Type: application/json" \
  -d @examples/requests/france_income_tax.json
# → HTTP 402 with the x402 payment requirements (PAYMENT-REQUIRED header).
#   Pay with any x402 client and resend with the PAYMENT-SIGNATURE header.
```

Endpoints: `POST /api/calcul/impot-revenu`, `POST /api/calcul/micro-entrepreneur`, `POST /api/calcul/brut-net`. Full schemas in [`/openapi.json`](https://tax.francestack.fr/openapi.json). Example with `@x402/fetch`: [`examples/http-client.ts`](examples/http-client.ts).

## What you get back

A married couple with two children and €54,000 of net taxable income (example from the official 2026 DGFiP brochure):

```json
{
  "calculateur": "impot-revenu",
  "resultat": {
    "annee_revenus": 2025,
    "revenu_net_imposable": "54000.00",
    "nombre_parts": "3",
    "quotient_familial": "18000.00",
    "impot_brut": "2112.00",
    "decote": "527.00",
    "impot_net": "1585.00",
    "impot_a_payer": "1585.00",
    "taux_moyen_pourcent": "2.94",
    "tranche_marginale_pourcent": "11.00"
  },
  "detail": [
    { "etape": "Nombre de parts", "montant": "3", "explication": "2 parts (couple) ; +1 pour 2 enfant(s) (½ part pour chacun des 2 premiers, 1 part à partir du 3e)." },
    "… every step of the calculation …"
  ],
  "hypotheses": ["Barème des revenus 2025 (Loi de finances pour 2026), déclaration 2026.", "…"],
  "bareme": { "version": "IR-revenus-2025-v1", "date_effet": "2025-01-01", "sources": ["https://www.impots.gouv.fr/…", "…"] },
  "estimation_indicative": true,
  "lien_verification": "https://simulateur-ir-ifi.impots.gouv.fr/calcul_impot/2026/simplifie/index.htm"
}
```

*(abridged — the real response also contains every intermediate amount and all sources)*

## Missing information? Free, with the questions to ask

```json
{
  "erreur": {
    "code": "champs_manquants",
    "message": "Des informations sont nécessaires pour effectuer le calcul. Posez ces questions à l’utilisateur puis renvoyez la requête complète.",
    "champs_manquants": [
      {
        "champ": "enfants_a_charge",
        "question": "Combien d'enfants avez-vous à votre charge exclusive ou principale (enfants mineurs, ou majeurs rattachés à votre foyer fiscal) ? Ne comptez pas les enfants en résidence alternée.",
        "type": "entier"
      }
    ]
  }
}
```

Questions are in French, ready to be asked to the end user as-is.

## How reliability is ensured

| Tool | Verification |
|---|---|
| Income tax | Matches all **7,095 values** of the official DGFiP tax tables (brochure pratique 2025 and 2026) to the euro, plus 15 cases checked on the official impots.gouv.fr simulator. |
| Micro-entrepreneur | Cross-checked on **2,000 cases** against URSSAF's official engine (`modele-social`) and 15 cases from the official URSSAF simulator. |
| Gross-to-net | Uses URSSAF's official payroll engine (`modele-social`); official 2026 rates re-applied by hand in tests, official RGDU formula and example, 15 cases checked on the official URSSAF simulator. |

The service self-tests at startup and refuses to start if a published example does not match its own calculation. A payment is settled only after the result has passed its consistency checks.

## Machine-readable discovery

- MCP Registry: [`fr.francestack/tax-payroll`](https://registry.modelcontextprotocol.io/v0.1/servers?search=fr.francestack) — see [`server.json`](server.json)
- [`/llms.txt`](https://tax.francestack.fr/llms.txt) · [`/openapi.json`](https://tax.francestack.fr/openapi.json) (with `x-payment-info`) · [`/.well-known/x402`](https://tax.francestack.fr/.well-known/x402) · [`/api/calculs`](https://tax.francestack.fr/api/calculs)

## En français

FranceStack calcule de façon exacte et déterministe **l'impôt sur le revenu**, les **cotisations URSSAF des micro-entrepreneurs** et le **salaire net à partir du brut** (avec le coût employeur), pour les agents IA. Barèmes officiels, sources citées, détail étape par étape, lien vers le simulateur officiel. Une information manquante ou un cas non géré est signalé **gratuitement**, avec les questions à poser ; un calcul n'est payé (0,005 $ en USDC via x402) que s'il aboutit. Hébergé à Paris.

## Disclaimer

Results are indicative estimates, not legally binding: check with the official simulator or service (the link is included in every answer). — *Estimation indicative non contractuelle. Vérifier avec le simulateur ou le service officiel.*

## License

Documentation and examples in this repository: [MIT](LICENSE). The calculation service itself is operated by FranceStack and is not open source.
