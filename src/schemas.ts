import { z } from "zod@next";
import type { HelpSection } from "./args.ts"; // HelpSection をインポート

/**
 * 基本引数スキーマ
 * ログレベルやヘルプなど、多くのスクリプトで共通する基本的な引数を定義します。
 */
export const BaseArgsSchema: z.ZodObject<{
  logLevel: z.ZodDefault<
    z.ZodEnum<{
      error: "error";
      debug: "debug";
      info: "info";
      warn: "warn";
    }>
  >;
}> = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info").meta({
    description: "ログの出力レベル",
    alias: "l",
  }),
});

/**
 * ネットワーク指定に関する引数スキーマ
 * 接続するブロックチェーンネットワークを指定します。
 */
const NetworkArgsSchema = z.object({
  network: z.enum(["sepolia", "kaia"]) // TODO: 利用可能なネットワークを動的に設定できるようにする
    .default("sepolia")
    .meta({
      description: "接続するネットワーク (例: sepolia, kaia)",
      alias: "n",
    }),
});

/**
 * 秘密鍵に関する引数スキーマ
 * トランザクション署名などに使用する秘密鍵を指定します。
 */
const PrivateKeyArgsSchema = z.object({
  privateKey: z.string().optional().meta({
    description: "秘密鍵（環境変数からの読み込みを推奨）",
    alias: "k",
  }),
});

/**
 * RPC URLに関する引数スキーマ
 * ブロックチェーンネットワークへの接続に使用するRPC URLを指定します。
 */
const RpcUrlArgsSchema = z.object({
  rpcUrl: z.string().optional().meta({
    description: "RPC URL（指定がない場合はデフォルト値を使用）",
    alias: "r",
  }),
});

export const baseArgsHelpInfo: HelpSection = {
  title: "基本オプション",
  options: {
    "--log-level, -l <debug|info|warn|error>":
      "ログの出力レベル (デフォルト: info)",
  },
};

/**
 * Ethereum関連の操作に必要な引数をまとめたスキーマ
 * BaseArgsSchema, NetworkArgsSchema, PrivateKeyArgsSchema, RpcUrlArgsSchema を結合します。
 */
export const EthArgsSchema: typeof BaseArgsSchema = BaseArgsSchema
  .merge(NetworkArgsSchema)
  .merge(PrivateKeyArgsSchema)
  .merge(RpcUrlArgsSchema)
  .describe("Ethereumネットワーク操作に関連する引数");

export const ethArgsHelpInfo: HelpSection = {
  title: "Ethereum関連オプション",
  options: {
    "--network, -n <sepolia|kaia>": "接続するネットワーク (デフォルト: sepolia)",
    "--private-key, -k <string>": "秘密鍵（環境変数 PRIVATE_KEY も利用可能）",
    "--rpc-url, -r <string>": "RPC URL（オプション）",
  },
};
