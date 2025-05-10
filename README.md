# deno-cli

このモジュールは、Deno環境でのCLIスクリプト開発における共通ユーティリティを提供します。主に引数スキーマの定義・検証とログ初期化・ロガー取得機能を含みます。

---

## 特徴

- 型安全な引数解析: Zodを利用したスキーマ定義と検証。 `processArgs`
  関数により、Zodスキーマからコマンドラインオプションの解析、ヘルプメッセージの自動生成までを一貫して行います。
- 簡単なロギング設定: コンソールとファイルへの構造化ログ出力を数行で設定可能。
  [LogTape](https://github.com/logtape/logtape) を内部で使用しています。
- 再利用可能なスキーマ:
  一般的なCLI引数（ログレベル、ネットワーク、Ethereum関連など）のスキーマを提供。

---

## モジュール構成

- `args.ts`: 引数解析関連のコアロジック (`processArgs` 関数など)
- `schemas.ts`: 各種引数スキーマ定義 (`BaseArgsSchema`, `NetworkArgsSchema`,
  `EthArgsSchema` など)
- `logger.ts`: ロギング関連 (`logConfigure`, `createLogger`)
- `mod.ts`:
  モジュールのエントリーポイント。上記モジュールの主要な機能をエクスポートします。

---

## インストール (deno.json)

```json
{
  "imports": {
    "deno-cli/": "jsr:@hayattiq/deno-cli@^0.1.0" // JSRのバージョンは適宜最新のものに置き換えてください
  }
}
```

または、直接URLを指定することも可能です。

---

## CLIスクリプトの基本的な作り方 (deno-cli を使用)

このセクションでは、`deno-cli`
を使用してCLIスクリプトを作成する基本的な手順とベストプラクティスを説明します。

### 1. 引数の定義と解析

`deno-cli` は Zod を利用してコマンドライン引数を型安全に解析します。
`processArgs` 関数と、事前に定義されたスキーマ (`BaseArgsSchema`,
`EthArgsSchema` など) を利用できます。

#### 基本的なスクリプトの例

```typescript
// my_script.ts
import { BaseArgsSchema, processArgs } from "jsr:@hayattiq/deno-cli/mod.ts";
import { z } from "npm:zod"; // プロジェクトのdeno.jsonでzodをimportしている想定

// BaseArgsSchema を拡張して、このスクリプト特有の引数を追加
const MyScriptArgsSchema = BaseArgsSchema.extend({
  targetFile: z.string().describe("処理対象のファイルパス").meta({
    alias: "f",
  }),
  force: z.boolean().optional().default(false).describe("強制実行フラグ").meta({
    alias: "F",
  }),
});

try {
  // Deno.args を直接渡す
  const args = processArgs(Deno.args, {
    zodSchema: MyScriptArgsSchema,
    commandName: "my_script",
    commandDescription: "指定されたファイルを処理するスクリプトです。",
    // parseArgsOptions や helpSections は zodSchema から自動生成されます。
    // カスタムのヘルプセクションが必要な場合は helpSections を指定できます。
  });

  // args.logLevel, args.targetFile, args.force が型安全に利用可能
  console.log("検証済み引数:", args);

  // この後、args.logLevel を使ってロガーを設定し、メイン処理に進みます。
  // (ロギング設定の例は次のセクションを参照)
} catch (error) {
  // processArgs 内でエラーメッセージが出力され Deno.exit(1) が呼ばれるため、
  // 通常、ここでの追加のエラーハンドリングは不要です。
  // processArgs がエラーを再スローするような設計の場合は、ここでキャッチします。
  console.error("スクリプトの初期化中に予期せぬエラーが発生しました:", error);
}
```

#### Ethereum関連スクリプトの例

```typescript
// my_eth_script.ts
import { EthArgsSchema, processArgs } from "jsr:@hayattiq/deno-cli/mod.ts";
import { z } from "npm:zod";

// EthArgsSchema をベースに、このスクリプト特有の引数を追加
const MyEthScriptArgsSchema = EthArgsSchema.extend({
  amount: z.string()
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val > 0, "金額は正の数である必要があります")
    .describe("送金するETHの量")
    .meta({ alias: "a" }),
  toAddress: z.string().regex(
    /^0x[0-9a-fA-F]{40}$/,
    "有効なEthereumアドレスではありません",
  ).describe("送金先アドレス").meta({ alias: "t" }),
});

try {
  const args = processArgs(Deno.args, {
    zodSchema: MyEthScriptArgsSchema,
    commandName: "my_eth_script",
    commandDescription: "指定された量とアドレスにETHを送金するスクリプトです。",
  });

  // args.logLevel, args.network, args.privateKey, args.rpcUrl, args.amount, args.toAddress が型安全に利用可能
  console.log("検証済み引数:", args);

  // メイン処理へ
} catch (error) {
  // エラー処理は processArgs が担当
}
```

`processArgs` は `--help` または `-h` が指定された場合に、スキーマの `describe`
や `meta({ alias: "..." })`
からヘルプメッセージを自動生成して表示し、スクリプトを終了します。

### 2. ロギングの設定と利用

`deno-cli` を使うと、コンソールとファイルへのログ出力を簡単に設定できます。

```typescript
// my_script.ts (引数解析の後)
import { createLogger, logConfigure, type LogLevel } from "jsr:@hayattiq/deno-cli/mod.ts";
import { basename, join } from "jsr:@std/path/mod.ts"; // join もインポート

// スクリプト名を取得 (ログファイル名などに使用)
const scriptName = basename(new URL(import.meta.url).pathname).replace(
  /\.(ts|js)$/,
  "",
);

async function run() {
  // ... 引数解析 (args が取得済みとする) ...
  // const args = processArgs(...); // 上記の例を参照
  // const MyScriptArgsSchema = BaseArgsSchema.extend({ /* ... */ }); // argsの型定義のため
  // const args = processArgs(Deno.args, { zodSchema: MyScriptArgsSchema, commandName: scriptName });


  // ログ設定 (コンソールとファイルに出力)
  // ログ出力ディレクトリを指定します。この例ではカレントディレクトリ下の 'script_logs' を使用します。
  const logDirectory = join(Deno.cwd(), "script_logs");
  const logFilePath = await logConfigure(scriptName, args.logLevel as LogLevel, logDirectory);
  console.log(`ログファイル: ${logFilePath}`); // ユーザーにログファイルの場所を通知 (任意)

  const logger = createLogger(scriptName); // LogTapeのロガーインスタンスを取得

  logger.info("処理を開始しました。対象ファイル: {targetFile}", {
    targetFile: args.targetFile,
  }); // argsから取得した値を使用

  try {
    // ... メイン処理 ...
    if (args.force) {
      logger.warn("強制実行モードで処理を実行しました。");
    }
    logger.info("処理が正常に完了しました。");
  } catch (error) {
    logger.error("処理中にエラーが発生しました: {errorMessage}", {
      errorMessage: error.message,
      error, // エラーオブジェクト全体を構造化データとして記録
      stack: error.stack,
    });
    Deno.exit(1); // エラー発生時は明示的に終了
  }
}

// スクリプトが直接実行された場合にrun関数を呼び出す
if (import.meta.main) {
  // 引数解析をrun関数の外で行い、結果を渡すか、run関数内で行う
  // ここでは例として、run関数内でargsを取得する想定で進めます。
  // 実際には、上記の引数解析のtry-catchブロック内でrunを呼び出す方が適切かもしれません。
  const args = processArgs(Deno.args, {
    /* ... スキーマ設定 ... */ zodSchema: MyScriptArgsSchema,
    commandName: "my_script",
  }); // MyScriptArgsSchemaは適切に定義されていること

  run(args).catch((err) => { // run関数がargsを受け取るように変更
    // 予期せぬエラーのキャッチ (ロガー初期化前など)
    // この段階ではloggerが未初期化の可能性があるのでconsole.errorを使用
    console.error(
      "[FATAL] スクリプト実行中に未処理のエラーが発生しました:",
      err,
    );
    Deno.exit(1);
  });
}
```

### 3. 構造化ロギングとプレースホルダー

LogTape ( `deno-cli` が内部で使用)
は、メッセージ内のプレースホルダーと構造化データによるロギングをサポートします。

- メッセージ:
  `logger.info("ユーザー {userId} がアイテム {itemId} を購入しました", { userId: "user123", itemId: "itemABC", price: 1000 });`
- コンソール出力例 (LogTapeのデフォルトフォーマットに依存):
  `INFO [scriptName] ユーザー user123 がアイテム itemABC を購入しました`
- ファイル出力 (JSONL形式):
  `{"level":"info","logger":"scriptName","message":"ユーザー {userId} がアイテム {itemId} を購入しました","payload":{"userId":"user123","itemId":"itemABC","price":1000},"timestamp":"..."}`

#### エラーログのガイドライン

エラー発生時には、可能な限り詳細な情報を構造化データとして記録します。

```typescript
logger.error(
  "APIリクエストに失敗しました。エンドポイント: {endpoint}, ステータスコード: {statusCode}",
  {
    endpoint: "/api/data",
    statusCode: 500,
    errorMessage: error.message, // エラーメッセージ
    error, // エラーオブジェクト全体
    stack: error.stack, // スタックトレース
    // その他関連するコンテキスト情報 (リクエストID、ユーザーIDなど)
  },
);
```

### 4. ログレベル

`deno-cli` は以下のログレベルをサポートします (`BaseArgsSchema` の `logLevel`
で定義)。

- `debug`: 開発用の詳細ログ。デバッグ時に役立つ情報を記録します。
- `info`:
  通常の処理の開始・終了、重要な状態変化など、運用上把握しておきたい情報を記録します。
- `warn`:
  注意すべき状態や、推奨されない処理が行われた場合など、潜在的な問題を示唆する情報を記録します。
- `error`:
  処理が失敗した場合や、回復不能なエラーが発生した場合など、明確な問題が発生したことを記録します。

---

## APIリファレンス (主要機能)

### `processArgs<S extends z.ZodObject<any, any>>(rawDenoArgs: string[], options: ProcessArgsOptions<S>): z.infer<S>`

- コマンドライン引数を解析、検証し、ヘルプ表示機能を提供します。
- `rawDenoArgs`: `Deno.args` から取得した生の引数配列。
- `options`:
  - `zodSchema`: 検証に使用するZodスキーマ。
  - `commandName`: ヘルプメッセージに表示するコマンド名。
  - `commandDescription` (optional): コマンドの説明。
  - `parseArgsOptions` (optional): `jsr:@std/cli/parse-args`
    に渡すオプション。指定しない場合は `zodSchema` から自動生成されます。
  - `helpSections` (optional):
    ヘルプメッセージのカスタムセクション。指定しない場合は `zodSchema`
    から自動生成されます。
  - `customHelpGeneration` (optional):
    ヘルプメッセージを完全にカスタム生成するための関数。
- 戻り値: 検証済みの引数オブジェクト (Zodスキーマによって型付けされます)。
- 例外: 検証失敗時やヘルプ表示時には、メッセージを出力して `Deno.exit()`
  を呼び出します。

### スキーマ定義 (`schemas.ts` より)

- **`BaseArgsSchema`**:
  - `logLevel`: `z.enum(["debug", "info", "warn", "error"])` (エイリアス: `-l`)
- **`NetworkArgsSchema`**:
  - `network`: `z.enum(["sepolia", "kaia", ...])` (エイリアス: `-n`)
- **`PrivateKeyArgsSchema`**:
  - `privateKey`: `z.string().optional()` (エイリアス: `-k`)
- **`RpcUrlArgsSchema`**:
  - `rpcUrl`: `z.string().optional()` (エイリアス: `-r`)
- **`EthArgsSchema`**:
  - 上記 `BaseArgsSchema`, `NetworkArgsSchema`, `PrivateKeyArgsSchema`,
    `RpcUrlArgsSchema`
    をマージしたスキーマ。Ethereum関連スクリプトのベースとして利用できます。

各スキーマフィールドには `describe()` で説明が、`meta({ alias: "..." })`
で短いエイリアスが設定されており、これらは `processArgs`
によるヘルプメッセージ自動生成に利用されます。

### `logConfigure(scriptName: string, consoleLogLevel: LogLevel, logDir: string): Promise<string>`

- ログ出力を設定します。コンソールとファイルの両方に出力します。
- `scriptName`: ログファイル名やロガー名に使用されます。
- `consoleLogLevel`: コンソールに出力するログの最低レベル。
- `logDir` (必須): ログファイルを保存する親ディレクトリのパス。このディレクトリ直下に `{scriptName}` というサブディレクトリが作成され、その中にログファイルが生成されます。例えば `logDir` に `/var/logs/my_app_logs` を指定し `scriptName` が `my_script` の場合、ログは `/var/logs/my_app_logs/my_script/my_script_timestamp.log` のように保存されます。
- 戻り値: 生成されたログファイルのフルパス (Promise)。

### `createLogger(name: string): Logger`

- LogTapeのロガーインスタンスを取得します。`logConfigure`
  で設定が完了している必要があります。
- `name`: ロガー名。通常は `scriptName` と同じものを指定します。
- 戻り値: LogTapeの `Logger` インスタンス。

---

## 拡張

- **引数スキーマ**: Zodの機能を使って自由に既存スキーマを拡張 (`.extend()`)
  したり、新しいスキーマを定義したりできます。定義したスキーマを `processArgs`
  に渡すことで、型安全な引数解析とヘルプ生成の恩恵を受けられます。
- **ロギング**: `logConfigure`
  のオプションを調整するほか、LogTapeのより高度な機能（カスタムフォーマッタ、複数のログ出力先など）を直接利用することも可能です。

## CLIスクリプト開発のベストプラクティス（参考）

以下の内容は `deno-cli`
の直接的な機能ではありませんが、DenoでCLIスクリプトを開発する際の一般的なベストプラクティスとして参考にしてください。

### 推奨ディレクトリ構成

プロジェクトが大きくなるにつれて、一貫したディレクトリ構成はメンテナンス性を高めます。以下は一例です。

```
project-root/
├── scripts/         # CLIスクリプトのエントリーポイントやメインロジック
│   ├── commands/    # サブコマンドごとの処理を記述するファイル群
│   ├── components/  # 複数のスクリプトで再利用可能なビジネスロジック
│   ├── schemas/     # Zodスキーマ定義（deno-cliのスキーマとは別に、アプリ固有のものを置く場合）
│   └── utils/       # プロジェクト固有のユーティリティ関数（CSV処理、APIクライアントなど）
├── tests/           # Deno testランナーで実行するテストファイル
├── data/            # スクリプトが使用する固定データファイル (例: 設定JSON、マッピングCSV)
│   ├── input/       # 処理対象の入力ファイル置き場 (例: バッチ処理用CSV)
│   └── output/      # スクリプトの出力結果を保存する場所
├── logs/            # スクリプトのログファイルが出力される場所 (deno-cliのlogConfigureのデフォルト出力先)
├── .env             # 環境変数ファイル (deno-dotenvなどで読み込む)
├── deno.jsonc       # Denoプロジェクトの設定ファイル
└── README.md
```

- **`scripts/`**:
  メインとなるスクリプトや、それらを構成するモジュールを配置します。
  - **`commands/`**:
    CLIがサブコマンドを持つ場合、各サブコマンドの実装をここに配置すると見通しが良くなります。
  - **`components/`**:
    特定のビジネスドメインに特化した再利用可能な関数やクラス群。
  - **`schemas/`**:
    アプリケーション固有のデータ構造をZodで定義する場合。`deno-cli`が提供する引数スキーマとは別に管理します。
  - **`utils/`**:
    より汎用的なヘルパー関数。例えば、特定のAPIクライアントのラッパーや、特殊なファイル形式のパーサーなど。
- **`data/`**: スクリプトが読み書きするデータファイルを配置します。
  - **`input/`**: スクリプトへの入力となるファイル（例: CSV、JSON）。
  - **`output/`**: スクリプトが生成したファイル（例: 結果CSV、レポート）。
- **`logs/`**: `deno-cli` の `logConfigure` 関数は、デフォルトで
  `logs/{scriptName}/` ディレクトリにログファイルを作成します。

### CSVファイルの取り扱い

バッチ処理などでCSVファイルを入出力として扱う場合の一般的な指針です。

#### 基本ルール

- **入出力形式**: CSVを標準とします。文字コードはUTF-8が推奨されます。
- **ユーティリティ**: CSVの読み書きには `jsr:@std/csv`
  などの標準ライブラリや、信頼できるサードパーティモジュールを利用します。自前でパーサーを実装するのは避けましょう。
- **チャンク処理**:
  大容量のCSVファイルを処理する場合、メモリ効率を考慮し、ストリーム処理やチャンク単位での処理を検討します。
- **バリデーション**:
  CSVから読み込んだデータは、Zodなどを用いて行ごと・セルごとにバリデーションを行うことが推奨されます。エラーがあった行はスキップするか、エラーレポートとして別途出力するなどの対応を検討します。
- **ヘッダー**:
  CSVファイルには原則としてヘッダー行を含め、各列が何を表すかを明確にします。

#### CSVユーティリティの例 (utils/csvUtils.ts などに配置)

```typescript
import { parse as parseCsv, stringify as stringifyCsv } from "jsr:@std/csv";
import { z } from "npm:zod"; // Zodをインポート

// CSVの行データを表す型 (Zodスキーマから推論可能)
// const MyDataRowSchema = z.object({ id: z.string(), value: z.number() });
// type MyDataRow = z.infer<typeof MyDataRowSchema>;

/**
 * CSVファイルを読み込み、指定されたZodスキーマでバリデーションする非同期ジェネレータ
 * @param filePath 読み込むCSVファイルのパス
 * @param schema 各行をバリデーションするためのZodスキーマ
 */
export async function* readAndValidateCsv<T extends z.ZodTypeAny>(
  filePath: string,
  schema: T,
): AsyncGenerator<z.infer<T>, void, undefined> {
  const file = await Deno.open(filePath, { read: true });
  const readableStream = file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new CsvParseStream({ skipFirstRow: true })); // ヘッダー行をスキップ

  let rowIndex = 1; // ヘッダーの次からなので1からスタート
  for await (const rowArray of readableStream) {
    // CSVの行配列をオブジェクトに変換 (ヘッダーに基づいて)
    // ここでは簡易的に、ヘッダーがスキーマのキーと一致すると仮定
    // 実際にはヘッダー行を読み込んでマッピングする必要がある
    const rowObject = Object.fromEntries(
      Object.keys(schema.shape).map((key, index) => [key, rowArray[index]]),
    );

    const validationResult = schema.safeParse(rowObject);
    if (validationResult.success) {
      yield validationResult.data;
    } else {
      console.warn(
        `CSVバリデーションエラー (行 ${rowIndex}):`,
        validationResult.error.flatten(),
      );
      // エラー処理: スキップ、エラー行を収集するなど
    }
    rowIndex++;
  }
}

/**
 * データをCSV形式でファイルに追記する
 * @param filePath 書き込むCSVファイルのパス
 * @param data 書き込むデータの配列 (オブジェクトの配列)
 * @param headers CSVのヘッダー行 (指定しない場合はdataの最初の要素のキーを使用)
 */
export async function appendToCsv(
  filePath: string,
  data: Record<string, unknown>[],
  headers?: string[],
): Promise<void> {
  if (data.length === 0) return;
  const firstRowKeys = Object.keys(data[0]);
  const csvHeaders = headers || firstRowKeys;

  let fileContent = "";
  try {
    // ファイルが存在し、中身があるか確認
    const stat = await Deno.stat(filePath);
    if (stat.size === 0) {
      fileContent += stringifyCsv([csvHeaders]); // ヘッダーのみ書き込み
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      fileContent += stringifyCsv([csvHeaders]); // 新規作成なのでヘッダー書き込み
    } else {
      throw error;
    }
  }

  const rows = data.map((row) => csvHeaders.map((header) => row[header]));
  fileContent += stringifyCsv(rows);

  await Deno.writeTextFile(filePath, fileContent, { append: stat.size > 0 }); // 追記モード
}
```

_(上記はあくまで概念的な例であり、`jsr:@std/csv` の `CsvParseStream`
の正確な使い方やエラーハンドリングは適宜調整が必要です)_

#### エラー処理

- CSV処理中にエラーが発生した場合（バリデーションエラー、ファイルIOエラーなど）、エラー内容をログに出力し、可能であれば処理を継続するか、安全に中断します。
- バリデーションエラーのあった行番号やエラー内容を記録しておくと、後の修正に役立ちます。
