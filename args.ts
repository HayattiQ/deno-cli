import { type ParseOptions, parseArgs } from "jsr:@std/cli/parse-args";
import { z } from "zod@next";

/**
 * 基本引数スキーマ
 * ログレベルやヘルプなど、多くのスクリプトで共通する基本的な引数を定義します。
 */
export const BaseArgsSchema = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info").describe("ログの出力レベル"),
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

/**
 * ヘルプメッセージのセクションを定義するインターフェース
 */
export interface HelpSection {
  title: string;
  options: { [optionAndAlias: string]: string }; // 例: { "--network, -n": "接続するネットワーク" }
}

/**
 * processArgs関数に渡すオプションを定義するインターフェース
 */
// biome-ignore lint/suspicious/noExplicitAny: S uses any for ZodObject's complex internal types
export interface ProcessArgsOptions<S extends z.ZodObject<any, any>> { // 型引数を2つに変更
  zodSchema: S;
  parseArgsOptions?: ParseOptions; // オプショナルに変更
  helpSections?: HelpSection[];   // オプショナルに変更
  commandName: string;
  commandDescription?: string;
  customHelpGeneration?: (schema: S, commandName: string, commandDescription?: string) => string; // カスタムヘルプ生成用
}

// キャメルケースをケバブケースに変換するヘルパー関数
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * ZodスキーマからparseArgsのオプションとヘルプセクションを自動生成する内部関数
 */

interface InternalGeneratedParseOptions extends Omit<ParseOptions, 'string' | 'boolean' | 'alias' | 'default'> {
  string: string[];
  boolean: string[];
  alias: Record<string, string>;
  default: Record<string, unknown>;
}

// biome-ignore lint/suspicious/noExplicitAny: S uses any for ZodObject's complex internal types
function generateOptionsFromSchema<S extends z.ZodObject<any, any, any>>( 
  schema: S,
): { generatedParseOptions: InternalGeneratedParseOptions; generatedHelpSections: HelpSection[] } {
  const generatedParseOptions: InternalGeneratedParseOptions = {
    string: [],
    boolean: [],
    alias: {},
    default: {},
  };
  const helpOptions: { [optionAndAlias: string]: string } = {};

  for (const key in schema.shape) {
    const fieldSchema = schema.shape[key] as z.ZodTypeAny; // biome-ignore lint/suspicious/noExplicitAny: Accessing Zod internals
    const description = fieldSchema.description || "";
    const kebabKey = camelToKebab(key);
    let optionName = `--${kebabKey}`;
    let typeHint = "";

    // エイリアス処理 (meta情報から取得)
    // biome-ignore lint/suspicious/noExplicitAny: Accessing Zod internals (_def.meta)
    const meta = (fieldSchema._def as any).meta as { alias?: string } | undefined;
    let aliasString = "";
    if (meta?.alias) {
      optionName += `, -${meta.alias}`;
      aliasString = meta.alias;
      generatedParseOptions.alias[meta.alias] = kebabKey;
    }

    // 型に応じた処理
    // biome-ignore lint/suspicious/noExplicitAny: Accessing Zod internals (_def)
    let fieldDef = fieldSchema._def as any; 
    let fieldType = fieldDef.typeName;

    if (fieldType === "ZodOptional" || fieldType === "ZodNullable") {
      fieldDef = fieldDef.innerType._def;
      fieldType = fieldDef.typeName;
    }
    if (fieldType === "ZodDefault") {
      generatedParseOptions.default[kebabKey] = fieldDef.defaultValue;
      fieldDef = fieldDef.innerType._def;
      fieldType = fieldDef.typeName;
    }


    if (fieldType === "ZodString") {
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString);
      typeHint = "<string>";
    } else if (fieldType === "ZodBoolean") {
      generatedParseOptions.boolean.push(kebabKey);
      if (aliasString) generatedParseOptions.boolean.push(aliasString);
    } else if (fieldType === "ZodNumber") {
      generatedParseOptions.string.push(kebabKey); // 数値も一度文字列として受け取る
      if (aliasString) generatedParseOptions.string.push(aliasString);
      typeHint = "<number>";
    } else if (fieldType === "ZodEnum") {
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString);
      const enumValues = fieldDef.values as string[];
      typeHint = `<${enumValues.join("|")}>`;
    } else {
      // その他の型はstringとして扱うか、エラーにするか
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString);
    }

    let helpText = description;
    if (typeHint) helpText += ` (${typeHint})`;
    if (generatedParseOptions.default[kebabKey] !== undefined) {
      helpText += ` (デフォルト: ${generatedParseOptions.default[kebabKey]})`;
    }
    // isOptional() は ZodDefault の場合に true を返すことがあるため、defaultValue の存在も確認
    // biome-ignore lint/suspicious/noExplicitAny: Accessing Zod internals (_def.typeName)
    const hasDefaultValue = (fieldSchema._def as any).typeName === "ZodDefault"; 
    const isOptional = fieldSchema.isOptional() || hasDefaultValue;
    if (!isOptional) {
         helpText += " (必須)";
    }
    helpOptions[optionName] = helpText;
  }

  // --help オプションを自動追加
  generatedParseOptions.alias["h"] = "help";
  generatedParseOptions.boolean.push("help");
  helpOptions["--help, -h"] = "ヘルプを表示";


  const generatedHelpSections: HelpSection[] = [
    {
      title: "オプション",
      options: helpOptions,
    },
  ];

  return { generatedParseOptions, generatedHelpSections };
}


/**
 * コマンドライン引数を解析、検証し、ヘルプ表示機能を提供する汎用関数
 * @param rawDenoArgs Deno.argsから取得した生の引数配列
 * @param options ProcessArgsOptions型の設定オブジェクト
 * @returns 検証済みの引数オブジェクト (Zodスキーマによって型付けされる)
 * @throws ZodError 検証失敗時にログを出力し、プロセスを終了する
 */
export function processArgs<S extends z.ZodObject<any, any>>( // 型引数を2つに変更
  rawDenoArgs: string[],
  options: ProcessArgsOptions<S>,
): z.infer<S> {
  const { zodSchema, commandName, commandDescription, customHelpGeneration } = options;

  let finalParseOptions = options.parseArgsOptions;
  let finalHelpSections = options.helpSections;

  // logger.debug("clear") // logger を console に置き換えたので、この行はそのまま logger.debug を使う
  console.debug("[deno-lib/args] processArgs: entry");
  if (!finalParseOptions || !finalHelpSections) {
    console.debug("[deno-lib/args] Generating parseOptions or helpSections from schema...");
    const { generatedParseOptions, generatedHelpSections } = generateOptionsFromSchema(
      zodSchema,
      commandName,
      commandDescription,
    );
    if (!finalParseOptions) {
      finalParseOptions = generatedParseOptions;
    }
    if (!finalHelpSections) {
      finalHelpSections = generatedHelpSections;
    }
  }
  // console.log("clear") // デバッグ用 console.log は削除またはコメントアウト
  
  // parseArgsOptionsに help エイリアスを自動的に追加する (generateOptionsFromSchemaで処理済みなら不要だが念のため)
  const ensuredParseOptions: ParseOptions = {
    ...finalParseOptions,
    boolean: [...(Array.isArray(finalParseOptions?.boolean) ? finalParseOptions.boolean : []), "help"],
    alias: { ...(finalParseOptions?.alias || {}), h: "help" },
  };

  console.debug("[deno-lib/args] Ensured parseOptions:", ensuredParseOptions);
  const rawArgs = parseArgs(rawDenoArgs, ensuredParseOptions);
  console.debug("[deno-lib/args] Raw parsed args:", rawArgs);
  // console.log("clear") // デバッグ用 console.log は削除またはコメントアウト


  if (rawArgs.help) {
    // console.log(rawArgs) // デバッグ用 console.log は削除またはコメントアウト
    console.debug("--help オプションが検出されました。ヘルプメッセージを生成・表示します。");
    if (customHelpGeneration) {
        const helpMsg = customHelpGeneration(zodSchema, commandName, commandDescription);
        console.info(helpMsg);
        console.debug("カスタムヘルプメッセージを表示しました。");
    } else {
        let helpMessage = `使用方法: ${commandName} [options]\n`;
        if (commandDescription) {
          helpMessage += `\n${commandDescription}\n`;
        }

        if (!finalHelpSections || finalHelpSections.length === 0) {
            console.warn("ヘルプセクションが空または未定義です。スキーマからの自動生成に問題がある可能性があります。");
        }

        for (const section of finalHelpSections || []) {
          helpMessage += `\n${section.title}:\n`;
          for (const [opt, desc] of Object.entries(section.options)) {
            helpMessage += `  ${opt.padEnd(40)}${desc}\n`; // padEndを調整
          }
        }
        console.info(helpMessage);
        console.debug("自動生成されたヘルプメッセージを表示しました。");
    }
    Deno.exit(0);
  }

  try {
    return zodSchema.parse(rawArgs) as z.infer<S>;
  } catch (error) {
    console.error("引数の検証に失敗しました。", { errorObject: error }); 
    if (error instanceof z.ZodError) {
      console.info("エラーは ZodError のインスタンスです。");
      // Zod v4では error.issues を使用
      if (Array.isArray(error.issues)) {
        console.debug("error.issues は配列です。詳細:", { issues: error.issues });
        for (const issue of error.issues) {
          const path = Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path);
          console.error(`  - (issue) ${path} (${issue.code}): ${issue.message}`);
        }
      } else {
        console.error("error.issues が配列ではありません。", { issues: error.issues });
      }
    } else {
      console.error("エラーは ZodError のインスタンスではありません。", { errorDetails: String(error) });
    }
    console.info(`詳細は ${commandName} --help を確認してください。`);
    Deno.exit(1);
  }
}
