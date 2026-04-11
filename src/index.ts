import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { upgradeWebSocket, websocket } from "hono/bun";
import { db } from "./db";
import { userBalances } from "./db/schema";
import {
  confirmPayment,
  createExchange,
  getExchangeStatus,
} from "./services/exchange/exchange-service";
import {
  isNetworkActiveForToken,
  listActiveNetworksByToken,
} from "./services/network/network-catalog-service";
import { calculateQuote } from "./services/rates/calculate-quote";
import {
  SUPPORTED_TOKENS,
  type ConfirmPaymentPayload,
  type ParsedCreateExchangePayload,
  type SupportedToken,
} from "./services/shared/types";
import { getOrCreateStaticWallet } from "./services/wallet/get-or-create-static-wallet";
import { withdrawFromSmartWallet } from "./services/wallet/withdraw-smart-wallet";
import "dotenv/config";

const app = new Hono();

function subscribeTopic(ws: { raw?: unknown }, topic: string) {
  const raw = ws.raw as { subscribe?: (topic: string) => void } | undefined;
  raw?.subscribe?.(topic);
}

function unsubscribeTopic(ws: { raw?: unknown }, topic: string) {
  const raw = ws.raw as { unsubscribe?: (topic: string) => void } | undefined;
  raw?.unsubscribe?.(topic);
}

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const authorization = c.req.header("authorization");
    const userId =
      c.req.header("user") ??
      c.req.header("x-user-id") ??
      c.req.query("userId") ??
      undefined;
    const exchangeId = c.req.query("exchangeId") ?? undefined;

    return {
      onOpen(_evt, ws) {
        // if (!authorization) {
        //   ws.close(1008, 'Missing authorization header')
        //   return
        // }

        // const authScheme = authorization.split(" ")[0] || "unknown";
        // console.log("WebSocket connection established", {
        //   userId: userId ?? "anonymous",
        //   exchangeId: exchangeId ?? null,
        //   authScheme,
        // });

        if (userId) {
          subscribeTopic(ws, `user:${userId}`);
        }

        if (exchangeId) {
          subscribeTopic(ws, `exchange:${exchangeId}`);
        }

        ws.send(
          JSON.stringify({
            event: "connected",
            userId: userId ?? null,
            exchangeId: exchangeId ?? null,
            subscriptions: [
              ...(userId ? [`user:${userId}`] : []),
              ...(exchangeId ? [`exchange:${exchangeId}`] : []),
            ],
          }),
        );
      },
      onMessage(event, ws) {
        try {
          const payload = JSON.parse(String(event.data)) as {
            action?: string;
            exchangeId?: string;
            userId?: string;
          };

          if (payload.action === "subscribe" && payload.exchangeId) {
            subscribeTopic(ws, `exchange:${payload.exchangeId}`);
            ws.send(
              JSON.stringify({
                event: "subscribed",
                topic: `exchange:${payload.exchangeId}`,
              }),
            );
            return;
          }

          if (payload.action === "subscribe" && payload.userId) {
            subscribeTopic(ws, `user:${payload.userId}`);
            ws.send(
              JSON.stringify({
                event: "subscribed",
                topic: `user:${payload.userId}`,
              }),
            );
            return;
          }

          if (payload.action === "unsubscribe" && payload.exchangeId) {
            unsubscribeTopic(ws, `exchange:${payload.exchangeId}`);
            ws.send(
              JSON.stringify({
                event: "unsubscribed",
                topic: `exchange:${payload.exchangeId}`,
              }),
            );
            return;
          }

          if (payload.action === "unsubscribe" && payload.userId) {
            unsubscribeTopic(ws, `user:${payload.userId}`);
            ws.send(
              JSON.stringify({
                event: "unsubscribed",
                topic: `user:${payload.userId}`,
              }),
            );
            return;
          }

          ws.send(
            JSON.stringify({
              event: "error",
              message:
                "Unsupported action. Use subscribe/unsubscribe with exchangeId or userId",
            }),
          );
        } catch {
          ws.send(
            JSON.stringify({
              event: "error",
              message: "Invalid JSON payload",
            }),
          );
        }
      },
      onClose: () => {
        console.log("Connection closed", {
          userId: userId ?? "anonymous",
          exchangeId: exchangeId ?? null,
        });
      },
    };
  }),
);

function isSupportedToken(value: string): value is SupportedToken {
  return SUPPORTED_TOKENS.includes(value as SupportedToken);
}

app.get("/", (c) => {
  return c.text("sovereign-be running");
});

app.get("/api/quote", async (c) => {
  const tokenParam = c.req.query("token")?.toUpperCase();
  const amountParam = Number(c.req.query("amount") ?? "0");

  if (!tokenParam || !isSupportedToken(tokenParam)) {
    return c.json(
      {
        error: "Unsupported token. Allowed: USDC, USDT",
      },
      400,
    );
  }

  if (!Number.isFinite(amountParam) || amountParam <= 0) {
    return c.json(
      {
        error: "amount must be a positive number",
      },
      400,
    );
  }

  const quote = await calculateQuote(tokenParam, amountParam);
  return c.json({
    token: tokenParam,
    amount: amountParam,
    ...quote,
  });
});

app.get("/api/networks", async (c) => {
  const token = c.req.query("token")?.toUpperCase();

  if (!token || !isSupportedToken(token)) {
    return c.json({ error: "token must be USDC or USDT" }, 400);
  }

  const networks = await listActiveNetworksByToken(token);

  return c.json({
    token,
    networks,
  });
});

app.post("/api/wallet/static-address", async (c) => {
  const body = (await c.req.json()) as {
    userId?: string;
    token?: string;
    network?: string;
  };

  const userId = body.userId?.trim();
  const token = body.token?.toUpperCase();
  const network = body.network?.trim();

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  if (!token || !isSupportedToken(token)) {
    return c.json({ error: "token must be USDC or USDT" }, 400);
  }

  if (!network) {
    return c.json({ error: "network is required" }, 400);
  }

  const isActive = await isNetworkActiveForToken(token, network);

  if (!isActive) {
    return c.json(
      { error: `network ${network} is not active for token ${token}` },
      400,
    );
  }

  const wallet = await getOrCreateStaticWallet(userId, network);

  return c.json({
    wallet,
    qrValue: wallet.address,
  });
});

/**
 * POST /api/wallet/withdraw
 *
 * Withdraw USDC (or another ERC-20) from a user's Coinbase Smart Wallet.
 * Gas is sponsored by Pimlico paymaster – no ETH required.
 *
 * Body:
 *   userId     – platform user id
 *   networkId  – network db-id (must be "base" or "base_sepolia")
 *   token      – token symbol, e.g. "USDC"
 *   amount     – human-readable amount, e.g. 10.5
 *   to         – recipient 0x address
 */
app.post("/api/wallet/withdraw", async (c) => {
  const body = (await c.req.json()) as {
    userId?: string;
    networkId?: string;
    token?: string;
    amount?: number;
    to?: string;
  };

  const userId = body.userId?.trim();
  const networkId = body.networkId?.trim();
  const token = body.token?.toUpperCase();
  const amount = Number(body.amount);
  const to = body.to?.trim() as `0x${string}` | undefined;

  if (!userId) return c.json({ error: "userId is required" }, 400);
  if (!networkId) return c.json({ error: "networkId is required" }, 400);
  if (!token || !isSupportedToken(token))
    return c.json({ error: "token must be USDC or USDT" }, 400);
  if (!Number.isFinite(amount) || amount <= 0)
    return c.json({ error: "amount must be a positive number" }, 400);
  if (!to || !/^0x[0-9a-fA-F]{40}$/.test(to))
    return c.json({ error: "to must be a valid 0x address" }, 400);

  const result = await withdrawFromSmartWallet({
    userId,
    networkId,
    token,
    amount,
    to,
  });

  if (!result.ok) {
    return c.json({ error: result.reason }, 400);
  }

  return c.json({
    ok: true,
    userOpHash: result.userOpHash,
    txHash: result.txHash,
  });
});

app.post("/api/exchange", async (c) => {
  const body = (await c.req.json()) as {
    userId?: string;
    token?: string;
    network?: string;
    amount?: number;
    referenceId?: string;
  };

  const userId = body.userId?.trim();
  const token = body.token?.toUpperCase();
  const network = body.network?.trim();
  const amount = Number(body.amount);

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  if (!token || !isSupportedToken(token)) {
    return c.json({ error: "token must be USDC or USDT" }, 400);
  }

  if (!network) {
    return c.json({ error: "network is required" }, 400);
  }

  const isActive = await isNetworkActiveForToken(token, network);

  if (!isActive) {
    return c.json(
      { error: `network ${network} is not active for token ${token}` },
      400,
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return c.json({ error: "amount must be a positive number" }, 400);
  }

  const payload: ParsedCreateExchangePayload = {
    userId,
    token,
    network,
    amount,
    referenceId: body.referenceId?.trim() || undefined,
  };

  const exchange = await createExchange(payload);
  return c.json(exchange, 201);
});

app.get("/api/exchange/:exchangeId", async (c) => {
  const exchangeId = c.req.param("exchangeId");
  const exchange = await getExchangeStatus(exchangeId);

  if (!exchange) {
    return c.json({ error: "Exchange not found" }, 404);
  }

  return c.json(exchange);
});

app.post("/api/webhooks/confirmed-payment", async (c) => {
  const body = (await c.req.json()) as ConfirmPaymentPayload;

  const exchangeId = body.exchangeId?.trim();
  const txHash = body.txHash?.trim();
  const tokenValue = body.token?.toUpperCase();
  const amount =
    body.amount === undefined || body.amount === null
      ? undefined
      : Number(body.amount);

  if (!exchangeId) {
    return c.json({ error: "exchangeId is required" }, 400);
  }

  if (!txHash) {
    return c.json({ error: "txHash is required" }, 400);
  }

  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return c.json(
      { error: "amount must be a positive number when provided" },
      400,
    );
  }

  if (tokenValue && !isSupportedToken(tokenValue)) {
    return c.json({ error: "token must be USDC or USDT" }, 400);
  }

  const token = tokenValue as SupportedToken | undefined;

  const result = await confirmPayment({
    exchangeId,
    txHash,
    token,
    amount,
  });

  if (!result.ok) {
    return c.json(
      {
        error: "reason" in result ? result.reason : "EXCHANGE_NOT_FOUND",
      },
      404,
    );
  }

  return c.json(result);
});

app.get("/api/users/:userId/balance", async (c) => {
  const userId = c.req.param("userId");

  if (!userId?.trim()) {
    return c.json({ error: "userId is required" }, 400);
  }

  const [balance] = await db
    .select({
      userId: userBalances.userId,
      balanceIdr: userBalances.balanceIdr,
      updatedAt: userBalances.updatedAt,
    })
    .from(userBalances)
    .where(eq(userBalances.userId, userId))
    .limit(1);

  return c.json({
    userId,
    balanceIdr: balance ? Number(balance.balanceIdr) : 0,
    updatedAt: balance?.updatedAt ?? null,
  });
});

import { getRedisConnection } from "./services/shared/queue";

const port = Number(process.env.PORT) || 3000;

const subscriber = getRedisConnection();

const server = Bun.serve({
  port,
  fetch: app.fetch,
  websocket,
});

void subscriber.psubscribe("ws:*");
subscriber.on("pmessage", (_pattern, channel, message) => {
  const topic = channel.replace("ws:", "");
  server.publish(topic, message);
});

subscriber.on("error", (error) => {
  console.error("Redis subscriber error:", error);
});

console.log(`API server on http://localhost:${port}`);
console.log(
  `WS endpoint on ws://localhost:${port} or ws://localhost:${port}/ws`,
);

export default app;
