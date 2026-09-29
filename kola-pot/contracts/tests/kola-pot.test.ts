import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const GOAL = 1_000_000n;

function openPot(who: string, title = "Brass lamp", story = "For the reading room", goal = GOAL) {
  return simnet.callPublicFn(
    "kola-pot",
    "open-pot",
    [Cl.stringUtf8(title), Cl.stringUtf8(story), Cl.uint(goal)],
    who,
  );
}

describe("kola-pot", () => {
  it("opens a pot and returns the first id", () => {
    const { result } = openPot(deployer);
    expect(result).toBeOk(Cl.uint(1));
    const count = simnet.callReadOnlyFn("kola-pot", "get-next-id", [], deployer);
    expect(count.result).toBeUint(1);
  });

  it("rejects an empty title and a zero goal", () => {
    const empty = openPot(deployer, "", "a story");
    expect(empty.result).toBeErr(Cl.uint(101));
    const zero = openPot(deployer, "Title", "a story", 0n);
    expect(zero.result).toBeErr(Cl.uint(103));
  });

  it("lets a friend chip in and tracks their contribution", () => {
    openPot(deployer);
    const { result } = simnet.callPublicFn(
      "kola-pot",
      "chip-in",
      [Cl.uint(1), Cl.uint(400_000)],
      wallet1,
    );
    expect(result).toBeOk(Cl.uint(400_000));

    const again = simnet.callPublicFn(
      "kola-pot",
      "chip-in",
      [Cl.uint(1), Cl.uint(100_000)],
      wallet1,
    );
    expect(again.result).toBeOk(Cl.uint(500_000));

    const mine = simnet.callReadOnlyFn(
      "kola-pot",
      "get-contribution",
      [Cl.uint(1), Cl.principal(wallet1)],
      wallet1,
    );
    expect(mine.result).toBeUint(500_000);

    const pot = simnet.callReadOnlyFn("kola-pot", "get-pot", [Cl.uint(1)], deployer);
    expect(pot.result).toBeSome(
      Cl.tuple({
        creator: Cl.principal(deployer),
        title: Cl.stringUtf8("Brass lamp"),
        story: Cl.stringUtf8("For the reading room"),
        goal: Cl.uint(GOAL),
        raised: Cl.uint(500_000),
        claimed: Cl.bool(false),
        backers: Cl.uint(1),
        opened: Cl.uint(3),
      }),
    );
  });

  it("pays the creator only when the goal is met", () => {
    openPot(wallet1, "Visitors", "Kola for guests", GOAL);
    simnet.callPublicFn("kola-pot", "chip-in", [Cl.uint(1), Cl.uint(GOAL)], wallet2);

    const stranger = simnet.callPublicFn("kola-pot", "claim", [Cl.uint(1)], wallet2);
    expect(stranger.result).toBeErr(Cl.uint(105));

    const paid = simnet.callPublicFn("kola-pot", "claim", [Cl.uint(1)], wallet1);
    expect(paid.result).toBeOk(Cl.uint(GOAL));

    const twice = simnet.callPublicFn("kola-pot", "claim", [Cl.uint(1)], wallet1);
    expect(twice.result).toBeErr(Cl.uint(104));
  });

  it("refuses a claim before the goal", () => {
    openPot(deployer);
    simnet.callPublicFn("kola-pot", "chip-in", [Cl.uint(1), Cl.uint(1)], wallet1);
    const { result } = simnet.callPublicFn("kola-pot", "claim", [Cl.uint(1)], deployer);
    expect(result).toBeErr(Cl.uint(106));
  });

  it("lets a backer pull out before the claim", () => {
    openPot(deployer);
    simnet.callPublicFn("kola-pot", "chip-in", [Cl.uint(1), Cl.uint(250_000)], wallet1);
    const { result } = simnet.callPublicFn("kola-pot", "pull-out", [Cl.uint(1)], wallet1);
    expect(result).toBeOk(Cl.uint(250_000));

    const mine = simnet.callReadOnlyFn(
      "kola-pot",
      "get-contribution",
      [Cl.uint(1), Cl.principal(wallet1)],
      wallet1,
    );
    expect(mine.result).toBeUint(0);

    const again = simnet.callPublicFn("kola-pot", "pull-out", [Cl.uint(1)], wallet1);
    expect(again.result).toBeErr(Cl.uint(107));
  });

  it("blocks pull-out after the pot is claimed", () => {
    openPot(deployer, "Done", "Already gathered", 100n);
    simnet.callPublicFn("kola-pot", "chip-in", [Cl.uint(1), Cl.uint(100)], wallet1);
    simnet.callPublicFn("kola-pot", "claim", [Cl.uint(1)], deployer);
    const { result } = simnet.callPublicFn("kola-pot", "pull-out", [Cl.uint(1)], wallet1);
    expect(result).toBeErr(Cl.uint(104));
  });
});
