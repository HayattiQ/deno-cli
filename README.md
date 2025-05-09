# deno-lib

このモジュールは、Deno環境でのCLIスクリプト開発における共通ユーティリティを提供します。主に引数スキーマの定義・検証とログ初期化・ロガー取得機能を含みます。

---

## 構成

- `args.ts`  
  - 基本引数スキーマ (`BaseArgsSchema`)  
  - Ethereum関連引数スキーマ (`EthArgsSchema`)  
  - 引数検証関数 (`validateArgs`)  
  - [Zod](https://github.com/colinhacks/zod) を用いた型安全な引数検証を提供します。

- `logger.ts`  
  - ログ初期化関数 (`logConfigure`)  
  - ロガー取得関数 (`createLogger`)  
  - [LogTape](https://github.com/logtape/logtape) を用いたコンソールおよびファイルへの構造化ログ出力を提供します。

- `mod.ts`  
  - 上記モジュールのエクスポートをまとめています。

---

## 使い方

### 引数検証

```typescript
import { parseArgs } from "jsr:@std/cli/parse-args";
import { validateArgs, EthArgsSchema } from "deno-lib/mod.ts";

const rawArgs = parseArgs(Deno.args, { /* parseArgsオプション */ });
const args = validateArgs(rawArgs, EthArgsSchema);
// argsは型安全に検証済みの引数オブジェクト
```

### ログ初期化とロガー取得

```typescript
import { logConfigure, createLogger } from "deno-lib/mod.ts";

await logConfigure("scriptName", "info");
const logger = createLogger("scriptName");

logger.info("処理を開始しました");
logger.error("エラーが発生しました", { error });
```

---

## 拡張

- 引数スキーマはZodスキーマとして自由に拡張可能です。  
- ログ設定は`logConfigure`関数をカスタマイズして調整できます。

---

## ライセンス

MIT License
