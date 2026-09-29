# Kola Pot

Community pots on Stacks testnet. Someone opens a goal, friends chip in STX, and the opener claims the pot once the goal is met. Until then, each backer can pull their own chips out.

Named for the kola nut, the gift that opens a gathering.

## What’s in this repo

- `kola-pot/` — Scaffold Stacks project (`stacksdapp` 0.2.2). Clarity 6 contract, Clarinet tests, generated TypeScript bindings, Next.js debug UI.
- `src/` — the app people actually use. It reads `kola-pot` on testnet and sends `open-pot`, `chip-in`, `claim`, and `pull-out` through Leather or Xverse.

## Contract

`kola-pot/contracts/contracts/kola-pot.clar`

| Function | What it does |
| --- | --- |
| `open-pot` | Open a pot with a title, a story, and a STX goal |
| `chip-in` | Send STX into a pot |
| `claim` | Opener withdraws the pot after the goal is met |
| `pull-out` | A backer takes their own STX back before a claim |
| `get-pot`, `get-next-id`, `get-contribution` | Read the board |

Clarity 6 (epoch 4.0). Transfers into the contract use `current-contract`. Transfers out use `as-contract?` with a `with-stx` allowance. The old `as-contract` form does not exist in Clarity 4+.

Deployer address (testnet): `STNYRC17AZ0PZ74AZJA0Z0YG140FDKP7MKGA9MM2`

The mnemonic is not in git. Copy `kola-pot/contracts/settings/Testnet.example.toml` to `Testnet.toml` and fill it in locally.

## Develop

```bash
# contracts
cd kola-pot
stacksdapp check && stacksdapp test && stacksdapp generate
stacksdapp deploy --network testnet --yes --wait-confirm

# app
cd ..
npm run dev
```

Wallet: Leather or Xverse, network set to Stacks testnet.

Faucet: [Hiro testnet faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet)

```bash
curl -X POST "https://api.testnet.hiro.so/extended/v1/faucets/stx?address=STNYRC17AZ0PZ74AZJA0Z0YG140FDKP7MKGA9MM2"
```

## Tests

`kola-pot/contracts/tests/kola-pot.test.ts` covers open, validation, chip-in, claim permissions, and pull-out. Run with `stacksdapp test` from `kola-pot/` (contract tests). The nested Next app has no UI tests.
