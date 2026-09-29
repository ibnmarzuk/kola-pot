import { Cl, cvToJSON, fetchCallReadOnlyFunction, Pc, type ClarityValue, type PostCondition } from "@stacks/transactions";
import { CONTRACT_ID, DEPLOYMENT } from "@/lib/deployment";

export type Pot = {
  id: number;
  creator: string;
  title: string;
  story: string;
  goal: bigint;
  raised: bigint;
  claimed: boolean;
  backers: number;
  opened: number;
};

type JsonCv = { type: string; value: unknown };

const ZERO = "ST000000000000000000002AMW42H";

function jsonCv(cv: ClarityValue): JsonCv {
  return cvToJSON(cv) as JsonCv;
}

function asUint(node: JsonCv | undefined): bigint {
  if (!node) return 0n;
  return BigInt(String(node.value));
}

function read(functionName: string, functionArgs: ClarityValue[], senderAddress: string = DEPLOYMENT.address) {
  return fetchCallReadOnlyFunction({
    contractAddress: DEPLOYMENT.address,
    contractName: DEPLOYMENT.name,
    functionName,
    functionArgs,
    senderAddress: senderAddress || ZERO,
    network: DEPLOYMENT.network,
  });
}

function parsePot(id: number, cv: ClarityValue): Pot | null {
  const outer = jsonCv(cv);
  if (outer.value == null) return null;
  const tuple = outer.value as JsonCv;
  const fields = tuple.value as Record<string, JsonCv>;
  return {
    id,
    creator: String(fields.creator?.value ?? ""),
    title: String(fields.title?.value ?? ""),
    story: String(fields.story?.value ?? ""),
    goal: asUint(fields.goal),
    raised: asUint(fields.raised),
    claimed: Boolean(fields.claimed?.value),
    backers: Number(asUint(fields.backers)),
    opened: Number(asUint(fields.opened)),
  };
}

export async function fetchPots(): Promise<Pot[]> {
  const countCv = await read("get-next-id", []);
  const count = Number(asUint(jsonCv(countCv)));
  if (!Number.isFinite(count) || count <= 0) return [];
  const start = Math.max(1, count - 39);
  const ids = Array.from({ length: count - start + 1 }, (_, i) => start + i);
  const rows = await Promise.all(
    ids.map(async (id) => {
      const cv = await read("get-pot", [Cl.uint(id)]);
      return parsePot(id, cv);
    }),
  );
  return rows.filter((row): row is Pot => row !== null).reverse();
}

export async function fetchContribution(id: number, who: string): Promise<bigint> {
  const cv = await read("get-contribution", [Cl.uint(id), Cl.principal(who)], who);
  return asUint(jsonCv(cv));
}

function stxAddressFrom(entries: Array<{ address: string; symbol?: string }> | undefined) {
  if (!entries?.length) return null;
  return (
    entries.find((entry) => entry.symbol === "STX")?.address ??
    entries.find((entry) => entry.address.startsWith("S"))?.address ??
    entries[0]?.address ??
    null
  );
}

export async function readSessionAddress(): Promise<string | null> {
  const { getLocalStorage, isConnected } = await import("@stacks/connect");
  if (!isConnected()) return null;
  const stored = getLocalStorage();
  return stxAddressFrom(stored?.addresses?.stx);
}

export async function connectWallet(): Promise<string | null> {
  const { connect } = await import("@stacks/connect");
  const response = await connect();
  return stxAddressFrom(response.addresses);
}

export async function disconnectWallet(): Promise<void> {
  const { disconnect } = await import("@stacks/connect");
  disconnect();
}

async function callContract(
  functionName: string,
  functionArgs: ClarityValue[],
  postConditions: PostCondition[],
) {
  const { request } = await import("@stacks/connect");
  const result = await request("stx_callContract", {
    contract: CONTRACT_ID,
    functionName,
    functionArgs,
    postConditions,
    postConditionMode: postConditions.length ? "deny" : "deny",
    network: DEPLOYMENT.network,
  });
  return result.txid ?? "";
}

export function openPot(title: string, story: string, goalMicro: bigint) {
  return callContract("open-pot", [Cl.stringUtf8(title), Cl.stringUtf8(story), Cl.uint(goalMicro)], []);
}

export function chipIn(id: number, amount: bigint, sender: string) {
  return callContract(
    "chip-in",
    [Cl.uint(id), Cl.uint(amount)],
    [Pc.principal(sender).willSendEq(amount).ustx()],
  );
}

export function claimPot(id: number, raised: bigint) {
  return callContract(
    "claim",
    [Cl.uint(id)],
    [Pc.principal(CONTRACT_ID).willSendEq(raised).ustx()],
  );
}

export function pullOut(id: number, amount: bigint) {
  return callContract(
    "pull-out",
    [Cl.uint(id)],
    [Pc.principal(CONTRACT_ID).willSendEq(amount).ustx()],
  );
}
