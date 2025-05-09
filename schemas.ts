import { z } from "zod@next";

/**
 * 基本引数スキーマ
 * ログレベルやヘルプなど、多くのスクリプトで共通する基本的な引数を定義します。
 */
export const BaseArgsSchema = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info").describe("ログの出力レベル").meta({ alias: "l" }),
});

/**
 * ネットワーク指定に関する引数スキーマ
 * 接続するブロックチェーンネットワークを指定します。
 */
export const NetworkArgsSchema = z.object({
  network: z.enum(["sepolia", "kaia"]) // TODO: 利用可能なネットワークを動的に設定できるようにする
    .default("sepolia")
    .describe("接続するネットワーク (例: sepolia, kaia)")
    .meta({ alias: "n" }),
});

/**
 * 秘密鍵に関する引数スキーマ
 * トランザクション署名などに使用する秘密鍵を指定します。
 */
export const PrivateKeyArgsSchema = z.object({
  privateKey: z.string().optional().describe("秘密鍵（環境変数からの読み込みを推奨）").meta({ alias: "k" }),
});

/**
 * RPC URLに関する引数スキーマ
 * ブロックチェーンネットワークへの接続に使用するRPC URLを指定します。
 */
export const RpcUrlArgsSchema = z.object({
  rpcUrl: z.string().optional().describe("RPC URL（指定がない場合はデフォルト値を使用）").meta({ alias: "r" }),
});
