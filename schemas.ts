import { z } from "zod@next";
import type { HelpSection } from "./args.ts"; // HelpSection をインポート

/**
 * 基本引数スキーマ
 * ログレベルやヘルプなど、多くのスクリプトで共通する基本的な引数を定義します。
 */
// Reason: Zod's inferred object shapes can be complex.
// deno-lint-ignore no-explicit-any
export const BaseArgsSchema: z.ZodObject<any> = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info").describe("ログの出力レベル").meta({ alias: "l" }),
});

/**
 * ネットワーク指定に関する引数スキーマ
 * 接続するブロックチェーンネットワークを指定します。
 */
// Reason: Zod's inferred object shapes can be complex.
// deno-lint-ignore no-explicit-any
export const NetworkArgsSchema: z.ZodObject<any> = z.object({
  network: z.enum(["sepolia", "kaia"]) // TODO: 利用可能なネットワークを動的に設定できるようにする
    .default("sepolia")
    .describe("接続するネットワーク (例: sepolia, kaia)")
    .meta({ alias: "n" }),
});

/**
 * 秘密鍵に関する引数スキーマ
 * トランザクション署名などに使用する秘密鍵を指定します。
 */
// Reason: Zod's inferred object shapes can be complex.
// deno-lint-ignore no-explicit-any
export const PrivateKeyArgsSchema: z.ZodObject<any> = z.object({
  privateKey: z.string().optional().describe("秘密鍵（環境変数からの読み込みを推奨）").meta({ alias: "k" }),
});

/**
 * RPC URLに関する引数スキーマ
 * ブロックチェーンネットワークへの接続に使用するRPC URLを指定します。
 */
// Reason: Zod's inferred object shapes can be complex.
// deno-lint-ignore no-explicit-any
export const RpcUrlArgsSchema: z.ZodObject<any> = z.object({
  rpcUrl: z.string().optional().describe("RPC URL（指定がない場合はデフォルト値を使用）").meta({ alias: "r" }),
});

export const baseArgsHelpInfo: HelpSection = {
  title: "基本オプション",
  options: {
    "--log-level, -l <debug|info|warn|error>": "ログの出力レベル (デフォルト: info)",
  }
};

/**
 * Ethereum関連の操作に必要な引数をまとめたスキーマ
 * BaseArgsSchema, NetworkArgsSchema, PrivateKeyArgsSchema, RpcUrlArgsSchema を結合します。
 */
export const EthArgsSchema = BaseArgsSchema
  .merge(NetworkArgsSchema)
  .merge(PrivateKeyArgsSchema)
  .merge(RpcUrlArgsSchema)
  .describe("Ethereumネットワーク操作に関連する引数");
