import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, HandCoins, Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  claimPot,
  chipIn,
  connectWallet,
  disconnectWallet,
  fetchContribution,
  fetchPots,
  openPot,
  pullOut,
  readSessionAddress,
  type Pot,
} from "@/lib/kola";
import { CONTRACT_ID, DEPLOYMENT, explorerAddress, explorerContract, explorerTx } from "@/lib/deployment";
import { formatStx, parseStx, progressPercent, shortPrincipal, utf8Bytes } from "@/lib/stx";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-line bg-card px-3 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay";

export function KolaApp() {
  const [ready, setReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [mine, setMine] = useState<Record<number, bigint>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [goal, setGoal] = useState("2");
  const [chips, setChips] = useState<Record<number, string>>({});

  const load = useCallback(async (who: string | null) => {
    setLoading(true);
    setLoadError("");
    try {
      const next = await fetchPots();
      setPots(next);
      if (who && next.length) {
        const entries = await Promise.all(
          next.map(async (pot) => [pot.id, await fetchContribution(pot.id, who)] as const),
        );
        setMine(Object.fromEntries(entries));
      } else {
        setMine({});
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not read the contract.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const who = await readSessionAddress().catch(() => null);
      if (cancelled) return;
      setAddress(who);
      setReady(true);
      await load(who);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onConnect() {
    setBusy("wallet");
    try {
      const who = await connectWallet();
      setAddress(who);
      toast.success(who ? "Wallet connected" : "No Stacks address returned");
      await load(who);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wallet connection failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect() {
    await disconnectWallet();
    setAddress(null);
    setMine({});
  }

  async function afterTx(txid: string, message: string) {
    toast.success(message, {
      action: txid
        ? { label: "View", onClick: () => window.open(explorerTx(txid), "_blank", "noopener") }
        : undefined,
    });
    window.setTimeout(() => void load(address), 4000);
  }

  async function onOpen(event: React.FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanStory = story.trim();
    const goalMicro = parseStx(goal);
    if (!cleanTitle || utf8Bytes(cleanTitle) > 64) {
      toast.error("Give the pot a title, up to 64 characters.");
      return;
    }
    if (!cleanStory || utf8Bytes(cleanStory) > 180) {
      toast.error("Add a short story, up to 180 characters.");
      return;
    }
    if (!goalMicro) {
      toast.error("Enter a goal greater than 0 STX, with at most 6 decimals.");
      return;
    }
    if (!address) {
      toast.error("Connect Leather or Xverse on Stacks testnet first.");
      return;
    }
    setBusy("open");
    try {
      const txid = await openPot(cleanTitle, cleanStory, goalMicro);
      setTitle("");
      setStory("");
      await afterTx(txid, "Pot opened. It shows up after the next block.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the pot");
    } finally {
      setBusy(null);
    }
  }

  async function onChip(pot: Pot) {
    if (!address) {
      toast.error("Connect a testnet wallet to chip in.");
      return;
    }
    const amount = parseStx(chips[pot.id] ?? "");
    if (!amount) {
      toast.error("Enter how much STX to chip in.");
      return;
    }
    setBusy(`chip-${pot.id}`);
    try {
      const txid = await chipIn(pot.id, amount, address);
      await afterTx(txid, "Chip sent. The pot updates when the block lands.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chip-in failed");
    } finally {
      setBusy(null);
    }
  }

  async function onClaim(pot: Pot) {
    setBusy(`claim-${pot.id}`);
    try {
      const txid = await claimPot(pot.id, pot.raised);
      await afterTx(txid, "Claim submitted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPull(pot: Pot) {
    const amount = mine[pot.id] ?? 0n;
    setBusy(`pull-${pot.id}`);
    try {
      const txid = await pullOut(pot.id, amount);
      await afterTx(txid, "Pull-out submitted. Your STX returns after confirmation.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pull-out failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDrip() {
    setBusy("drip");
    try {
      const response = await fetch(
        `https://api.testnet.hiro.so/extended/v1/faucets/stx?address=${DEPLOYMENT.address}`,
        { method: "POST" },
      );
      const body = await response.text();
      if (!response.ok) throw new Error(body.slice(0, 180) || `Faucet returned ${response.status}`);
      toast.success("Faucet accepted the request. Testnet STX lands after the next block.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Faucet request failed");
    } finally {
      setBusy(null);
    }
  }

  const pooled = pots.reduce((sum, pot) => sum + (pot.claimed ? 0n : pot.raised), 0n);
  const undeployed = loadError.includes("NoSuchContract");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <a href="#board" className="font-display text-xl font-semibold tracking-tight">
            Kola Pot
          </a>
          <span className="rounded-full bg-leaf-soft px-3 py-1 text-sm font-medium text-leaf">
            Stacks testnet
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load(address)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </button>
            {ready && address ? (
              <>
                <a
                  href={explorerAddress(address)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper"
                >
                  {shortPrincipal(address)}
                </a>
                <button type="button" onClick={() => void onDisconnect()} className="min-h-11 px-2 text-sm text-muted">
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void onConnect()}
                disabled={!ready || busy === "wallet"}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-clay px-4 text-sm font-medium text-paper disabled:opacity-60"
              >
                {busy === "wallet" ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                Connect wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)] lg:items-start">
        <section>
          <p className="text-sm font-medium uppercase tracking-widest text-clay">Ilorin · community pots</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl font-medium italic leading-none text-ink sm:text-6xl">
            Pass the kola. Fund the thing.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            Open a goal in testnet STX. Friends chip in. When the pot is full, you claim it.
            Until then, anyone can take their own chips back.
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Pots" value={loading ? "—" : String(pots.length)} />
            <Stat label="Still in pots" value={loading ? "—" : formatStx(pooled)} unit="STX" />
            <Stat label="Network" value="Testnet" />
          </dl>

          <div id="board" className="mt-8 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-3xl font-medium">The board</h2>
              <a
                href={explorerContract()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-leaf"
              >
                Contract <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>

            {loadError ? (
              <div className="rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed">
                {undeployed ? (
                  <>
                    <p className="font-medium text-ink">The contract is not on testnet yet.</p>
                    <p className="mt-2 text-muted">
                      kola-pot is written and tested. Deploying it needs testnet STX at{" "}
                      <span className="break-all text-ink">{DEPLOYMENT.address}</span>. The public faucet
                      blocks some networks. From a normal browser you can request the drip yourself.
                    </p>
                    <button
                      type="button"
                      onClick={() => void onDrip()}
                      disabled={busy !== null}
                      className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-clay px-4 text-sm font-medium text-paper disabled:opacity-60"
                    >
                      {busy === "drip" ? "Requesting…" : "Request testnet STX"}
                    </button>
                  </>
                ) : (
                  <p>
                    Couldn’t read <span className="font-medium">{CONTRACT_ID}</span>. {loadError}
                  </p>
                )}
              </div>
            ) : null}

            {loading && pots.length === 0 ? (
              <div className="space-y-3" aria-busy="true">
                <div className="h-36 animate-pulse rounded-2xl bg-sand" />
                <div className="h-36 animate-pulse rounded-2xl bg-sand" />
              </div>
            ) : null}

            {!loading && pots.length === 0 && !loadError ? (
              <p className="rounded-2xl border border-dashed border-line bg-card p-6 text-muted">
                No pots yet. Open the first one and pass the kola.
              </p>
            ) : null}

            {pots.map((pot) => {
              const pct = progressPercent(pot.raised, pot.goal);
              const mineAmount = mine[pot.id] ?? 0n;
              const funded = pot.raised >= pot.goal;
              return (
                <article key={pot.id} className="rounded-2xl border border-line bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted">Pot {pot.id}</p>
                      <h3 className="font-display text-2xl font-medium leading-tight">{pot.title}</h3>
                    </div>
                    {pot.claimed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-leaf-soft px-3 py-1 text-sm font-medium text-leaf">
                        <BadgeCheck className="size-4" aria-hidden="true" />
                        Claimed
                      </span>
                    ) : funded ? (
                      <span className="rounded-full bg-sand px-3 py-1 text-sm font-medium text-ink">Ready to claim</span>
                    ) : (
                      <span className="rounded-full bg-sand px-3 py-1 text-sm font-medium text-ink">Open</span>
                    )}
                  </div>
                  <p className="mt-2 text-base leading-relaxed text-ink">{pot.story}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand">
                    <div className={pot.claimed ? "h-full bg-leaf" : "h-full bg-clay"} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {formatStx(pot.raised)} of {formatStx(pot.goal)} STX · {pot.backers}{" "}
                    {pot.backers === 1 ? "backer" : "backers"} ·{" "}
                    <a className="text-leaf" href={explorerAddress(pot.creator)} target="_blank" rel="noreferrer">
                      {shortPrincipal(pot.creator)}
                    </a>
                  </p>
                  {address && mineAmount > 0n ? (
                    <p className="mt-1 text-sm text-ink">You chipped in {formatStx(mineAmount)} STX.</p>
                  ) : null}

                  {!pot.claimed ? (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <label className="sr-only" htmlFor={`chip-${pot.id}`}>
                        Amount to chip into {pot.title}
                      </label>
                      <input
                        id={`chip-${pot.id}`}
                        inputMode="decimal"
                        placeholder="1.5"
                        value={chips[pot.id] ?? ""}
                        onChange={(event) => setChips((prev) => ({ ...prev, [pot.id]: event.target.value }))}
                        className={fieldClass}
                      />
                      <button
                        type="button"
                        onClick={() => void onChip(pot)}
                        disabled={busy !== null}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:opacity-60"
                      >
                        {busy === `chip-${pot.id}` ? <Loader2 className="size-4 animate-spin" /> : <HandCoins className="size-4" />}
                        Chip in
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {address === pot.creator && !pot.claimed && funded ? (
                      <button
                        type="button"
                        onClick={() => void onClaim(pot)}
                        disabled={busy !== null}
                        className="inline-flex min-h-11 items-center rounded-xl bg-clay px-4 text-sm font-medium text-paper disabled:opacity-60"
                      >
                        {busy === `claim-${pot.id}` ? "Claiming…" : "Claim pot"}
                      </button>
                    ) : null}
                    {address && mineAmount > 0n && !pot.claimed ? (
                      <button
                        type="button"
                        onClick={() => void onPull(pot)}
                        disabled={busy !== null}
                        className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-60"
                      >
                        {busy === `pull-${pot.id}` ? "Pulling…" : "Pull my chips out"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="lg:sticky lg:top-24">
          <form onSubmit={(event) => void onOpen(event)} className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-display text-3xl font-medium">Open a pot</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Testnet STX only. Connect Leather or Xverse and switch the wallet to Stacks testnet before you sign.
            </p>
            <label className="mt-4 block text-sm font-medium" htmlFor="pot-title">
              Title
            </label>
            <input
              id="pot-title"
              value={title}
              maxLength={64}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Brass lamp for the reading room"
              className={`${fieldClass} mt-1`}
            />
            <label className="mt-3 block text-sm font-medium" htmlFor="pot-story">
              Story
            </label>
            <textarea
              id="pot-story"
              value={story}
              maxLength={180}
              rows={4}
              onChange={(event) => setStory(event.target.value)}
              placeholder="What the chips are for, in a sentence or two."
              className={`${fieldClass} mt-1 resize-y py-3`}
            />
            <p className="mt-1 text-right text-sm text-muted">{utf8Bytes(story)}/180</p>
            <label className="mt-2 block text-sm font-medium" htmlFor="pot-goal">
              Goal in STX
            </label>
            <input
              id="pot-goal"
              inputMode="decimal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className={`${fieldClass} mt-1`}
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-clay text-sm font-medium text-paper disabled:opacity-60"
            >
              {busy === "open" ? "Waiting for wallet…" : "Open pot"}
            </button>
          </form>
          <ol className="mt-4 space-y-3 rounded-2xl border border-line bg-card p-5 text-sm leading-relaxed">
            <li><span className="font-medium text-ink">1. Open.</span> <span className="text-muted">Name the goal and how much STX it takes.</span></li>
            <li><span className="font-medium text-ink">2. Chip in.</span> <span className="text-muted">STX moves into the contract. You can pull yours back.</span></li>
            <li><span className="font-medium text-ink">3. Claim.</span> <span className="text-muted">Only the opener, and only once the goal is met.</span></li>
          </ol>
        </aside>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Kola Pot on Stacks, settled to Bitcoin. Built with Scaffold Stacks.</p>
          <a href={explorerContract()} target="_blank" rel="noreferrer" className="break-all text-leaf">
            {CONTRACT_ID}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-medium leading-none">
        {value}
        {unit ? <span className="ml-1 font-sans text-sm font-medium text-muted">{unit}</span> : null}
      </dd>
    </div>
  );
}
