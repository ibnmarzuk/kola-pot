export const DEPLOYMENT = {
  address: "STNYRC17AZ0PZ74AZJA0Z0YG140FDKP7MKGA9MM2",
  name: "kola-pot",
  network: "testnet",
} as const;

export const CONTRACT_ID = `${DEPLOYMENT.address}.${DEPLOYMENT.name}` as const;

export const EXPLORER = "https://explorer.hiro.so";

export function explorerTx(txid: string) {
  const id = txid.startsWith("0x") ? txid.slice(2) : txid;
  return `${EXPLORER}/txid/${id}?chain=testnet`;
}

export function explorerAddress(address: string) {
  return `${EXPLORER}/address/${address}?chain=testnet`;
}

export function explorerContract() {
  return `${EXPLORER}/contract/${CONTRACT_ID}?chain=testnet`;
}
