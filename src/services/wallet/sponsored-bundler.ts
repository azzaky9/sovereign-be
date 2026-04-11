import { createPublicClient, http } from "viem";
import {
  createBundlerClient,
  createPaymasterClient,
  toCoinbaseSmartAccount,
} from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

export type NetworkKey = "base" | "base_sepolia";

/** Default public RPC fallbacks per network (no API key needed) */
const PUBLIC_RPC: Record<NetworkKey, string> = {
  base: "https://mainnet.base.org",
  base_sepolia: "https://sepolia.base.org",
};

/**
 * Build a sponsored BundlerClient for a Coinbase Smart Account.
 * Gas is paid by the CDP paymaster so the user needs zero ETH.
 *
 * Env vars required:
 *   CDP_PAYMASTER_ENDPOINT  – full URL of the CDP / Pimlico bundler+paymaster RPC
 */
export async function getSponsoredBundlerClient(
  privateKey: `0x${string}`,
  networkKey: NetworkKey,
) {
  const paymasterEndpoint = process.env.CDP_PAYMASTER_ENDPOINT;
  console.log("paymasterEndpoint", paymasterEndpoint);
  if (!paymasterEndpoint) {
    throw new Error(
      "CDP_PAYMASTER_ENDPOINT is not set. " +
        "Add it to your .env file (e.g. https://api.developer.coinbase.com/rpc/v1/base/<key>)",
    );
  }

  const chain = networkKey === "base_sepolia" ? baseSepolia : base;

  // publicClient uses a standard RPC so reads (nonce, gas estimates) work reliably
  // const publicRpc = process.env.BASE_RPC_URL ?? PUBLIC_RPC[networkKey];
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const owner = privateKeyToAccount(privateKey);

  const smartAccount = await toCoinbaseSmartAccount({
    owners: [owner],
    client: publicClient,
    version: "1",
  });

  // paymasterClient and bundlerClient both point at the CDP paymaster endpoint
  const paymasterClient = createPaymasterClient({
    transport: http(paymasterEndpoint),
  });

  const bundlerClient = createBundlerClient({
    account: smartAccount,
    client: publicClient,
    transport: http(paymasterEndpoint),
    paymaster: paymasterClient,
  });

  return { bundlerClient, smartAccount, publicClient };
}
