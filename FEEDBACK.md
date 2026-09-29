# Scaffold Stacks feedback

Builder: Abdurrahman Suleiman Bature. Project: Kola Pot, a community STX pot (not the stock counter).

## What worked

- `stacksdapp new kola-pot --no-git` produced a clear monorepo: Clarinet project, Next.js debug UI, agent skill, and a mnemonic pre-commit hook. The recommended testnet path (no Docker) is the right default.
- `stacksdapp check` and `stacksdapp test` are a tight loop. Clarinet 3.24.1 plus the Vitest simnet ran seven contract tests in about two seconds, with no devnet.
- `stacksdapp generate` wrote typed bindings and a debug panel for `kola-pot` without extra wiring.
- Replacing the counter was straightforward: edit `Clarinet.toml`, add the `.clar` file and a test, delete the sample. The contract name stayed the product name.
- Clarity errors from `stacksdapp check` pointed at the exact line.

## What didn’t

- The published Linux binary (`stacksdapp 0.2.2`, glibc 2.39) does not start on Debian 12 (glibc 2.36): `GLIBC_2.39 not found`. A musl build, or a glibc 2.35 build, would have saved a from-source compile. Compiling the CLI also pulls `openssl-sys` via reqwest’s default native-tls, even though the workspace dependency already lists `rustls-tls`. `default-features = false` was required before it would build on a machine without `pkg-config` and `libssl-dev`.
- The scaffold defaults to Clarity 6, but the quickstart counter never moves STX, so it hides the Clarity 4 break. `as-contract` is an unresolved function on epoch 4.0. The replacement is `current-contract` plus `as-contract?` with an explicit `with-stx` allowance, and the body of `as-contract?` cannot itself be a `response`. That cost a real detour and should be a one-pager in the contracts guide, with a copy-paste STX escrow snippet.
- `stacksdapp test` also launches the Next.js Vitest suite. In a repo where a parent `vite.config.ts` exists, Vitest walks upward and fails trying to boot an unrelated app. A local `vite.config.ts` in `frontend/` stops the walk. `--passWithNoTests` is not enough.
- Hiro’s testnet faucet (`POST /extended/v1/faucets/stx`) returns Cloudflare 1015 / “Access denied” from this network, while ordinary GETs and read-only contract calls succeed. The documented curl is correct. There is no second public faucet: LearnWeb3’s is suspended, and the Hiro Platform faucet now requires an account. A GitHub Action is included to retry the drip and `stacksdapp deploy` from a different network.
- The Next template is a debug panel, which is genuinely useful, but the bounty also wants a Vercel app someone can understand. The product UI lives outside that template and talks to the same contract with `@stacks/connect` v8.

## How long

About half a day of clock time for a first Stacks contract that holds STX, most of it the glibc/OpenSSL build, the Clarity 6 `as-contract` migration, and the faucet block. The contract, tests, and generate step themselves were well under an hour once the CLI ran.
