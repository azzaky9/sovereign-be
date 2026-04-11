import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import type { SupportedNetwork } from "../shared/types";
import { toCoinbaseSmartAccount } from "viem/account-abstraction";
import { createPublicClient, createWalletClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { db } from "../../db";
import { networks } from "../../db/schema";
import { eq } from "drizzle-orm";

export type WalletResult = {
  address: `0x${string}`;
  smartWallet?: `0x${string}` | null;
  privateKey: `0x${string}`;
  network: SupportedNetwork;
};

export async function createWalletForUser(
  userId: string,
  network: SupportedNetwork,
): Promise<WalletResult> {
  const networkData = await db
    .select({
      networkKey: networks.networkKey,
    })
    .from(networks)
    .where(eq(networks.id, network));

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  let smartWallet: `0x${string}` | null = null;

  const networkKey = networkData[0]?.networkKey;
  if (networkKey === "base" || networkKey === "base_sepolia") {
    const chain = networkKey === "base_sepolia" ? baseSepolia : base;
    const client = createPublicClient({
      chain,
      transport: http(),
    });
    const cb = await toCoinbaseSmartAccount({
      owners: [account],
      client,
      version: "1",
    });
    smartWallet = cb.address;
  }

  return {
    address: account.address,
    smartWallet,
    privateKey,
    network,
  };
}
