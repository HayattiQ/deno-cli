import { parseArgs, type ParseOptions } from "jsr:@std/cli@^1.0.15/parse-args";
import { z } from "zod@next";

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
// Reason: ZodObject's generic type parameters are complex.
// deno-lint-ignore no-explicit-any
export interface ProcessArgsOptions<S extends z.ZodObject<any, any>> {
  zodSchema: S;
  parseArgsOptions?: ParseOptions; // オプショナルに変更
  helpSections?: HelpSection[]; // オプショナルに変更
  commandName: string;
  commandDescription?: string;
  customHelpGeneration?: (
    schema: S,
    commandName: string,
    commandDescription?: string,
  ) => string; // カスタムヘルプ生成用
}

// キャメルケースをケバブケースに変換するヘルパー関数
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * ZodスキーマからparseArgsのオプションとヘルプセクションを自動生成する内部関数
 */

interface InternalGeneratedParseOptions
  extends Omit<ParseOptions, "string" | "boolean" | "alias" | "default"> {
  string: string[];
  boolean: string[];
  alias: Record<string, string>;
  default: Record<string, unknown>;
}

// Reason: ZodObject's generic type parameters are complex.
// deno-lint-ignore no-explicit-any
function generateOptionsFromSchema<S extends z.ZodObject<any, any>>(
  schema: S,
): {
  generatedParseOptions: InternalGeneratedParseOptions;
  generatedHelpSections: HelpSection[];
} {
  const generatedParseOptions: InternalGeneratedParseOptions = {
    string: [],
    boolean: [],
    alias: {},
    default: {},
  };
  const helpOptions: { [optionAndAlias: string]: string } = {};

  for (const key in schema.shape) {
    const fieldSchema = schema.shape[key] as z.ZodTypeAny; // biome-ignore lint/suspicious/noExplicitAny: Accessing Zod internals
    const kebabKey = camelToKebab(key);
    let optionName = `--${kebabKey}`;
    let typeHint = "";

    let unwrappedSchema: z.ZodTypeAny = fieldSchema;
    let descriptionFromSchema = unwrappedSchema.description; // 初期値
    // Reason: Accessing Zod's internal _def.
    // deno-lint-ignore no-explicit-any
    let metaFromSchema = (unwrappedSchema._def as any).meta; // 初期値

    // ZodEffects の場合、内側のスキーマを見る
    // Reason: Accessing Zod's internal _def.
    // deno-lint-ignore no-explicit-any
    if ((unwrappedSchema._def as any).typeName === "ZodEffects") {
        // Reason: Accessing Zod's internal _def.
        // deno-lint-ignore no-explicit-any
        const effectDef = unwrappedSchema._def as any;
        descriptionFromSchema = effectDef.description || descriptionFromSchema;
        metaFromSchema = effectDef.meta || metaFromSchema;
        unwrappedSchema = effectDef.schema; // 内側のスキーマで unwrappedSchema を更新
    }

    // currentSchemaForProps と def は (場合によっては ZodEffects を剥がした後の) unwrappedSchema から初期化
    let currentSchemaForProps: z.ZodTypeAny = unwrappedSchema;
    // Reason: Accessing Zod's internal '_def' and its properties.
    // deno-lint-ignore no-explicit-any
    let def = unwrappedSchema._def as any;
    let typeName = def.typeName as string;

    // Optional/Default の内側を見る処理
    if (typeName === "ZodOptional" || typeName === "ZodNullable") {
      currentSchemaForProps = def.innerType; // currentSchemaForProps を内側の型に更新
      def = def.innerType._def;
      typeName = def.typeName;
      // Optional/Nullable を剥がした後、再度 description/meta を取得し直す
      // Reason: Accessing Zod's internal _def.
      // deno-lint-ignore no-explicit-any
      descriptionFromSchema = (currentSchemaForProps._def as any).description || descriptionFromSchema;
      // Reason: Accessing Zod's internal _def.
      // deno-lint-ignore no-explicit-any
      metaFromSchema = (currentSchemaForProps._def as any).meta || metaFromSchema;
    }
    if (typeName === "ZodDefault") {
      generatedParseOptions.default[kebabKey] = def.defaultValue();
      currentSchemaForProps = def.innerType; // currentSchemaForProps を内側の型に更新
      def = def.innerType._def; 
      typeName = def.typeName;
      // Default を剥がした後、再度 description/meta を取得し直す
      // Reason: Accessing Zod's internal _def.
      // deno-lint-ignore no-explicit-any
      descriptionFromSchema = (currentSchemaForProps._def as any).description || descriptionFromSchema;
      // Reason: Accessing Zod's internal _def.
      // deno-lint-ignore no-explicit-any
      metaFromSchema = (currentSchemaForProps._def as any).meta || metaFromSchema;
    }
    
    const finalDescription = descriptionFromSchema || "";
    const finalMeta = metaFromSchema;

    // エイリアス処理
    let aliasString = "";
    if (finalMeta?.alias) {
      optionName += `, -${finalMeta.alias}`;
      aliasString = finalMeta.alias;
      generatedParseOptions.alias[finalMeta.alias] = kebabKey;
    }

    if (typeName === "ZodString") {
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString);
      typeHint = "<string>";
    } else if (typeName === "ZodBoolean") {
      generatedParseOptions.boolean.push(kebabKey);
      if (aliasString) generatedParseOptions.boolean.push(aliasString);
    } else if (typeName === "ZodNumber") {
      generatedParseOptions.string.push(kebabKey); // 数値も一度文字列として受け取る
      if (aliasString) generatedParseOptions.string.push(aliasString);
      typeHint = "<number>";
    } else if (typeName === "ZodEnum") {
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString);
      const enumValues = def.values as string[]; // Ensure 'def' here refers to the ZodEnumDef
      typeHint = `<${enumValues.join("|")}>`;
    } else {
      // その他の型はstringとして扱うか、エラーにするか
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString);
    }

    let helpText = finalDescription; // Use the final determined description
    if (typeHint) helpText += ` (${typeHint})`;
    if (generatedParseOptions.default[kebabKey] !== undefined) {
      helpText += ` (デフォルト: ${generatedParseOptions.default[kebabKey]})`;
    }
    const isOptional = fieldSchema.isOptional(); // isOptionalは元のfieldSchemaで判定（Optional/Defaultラッパーの有無）
    if (!isOptional) {
      helpText += " (必須)";
    }
    // console.log(`[DEBUG args.ts] key: ${key}, kebabKey: ${kebabKey}, optionName: ${optionName}, description: "${finalDescription}", typeHint: "${typeHint}", defaultVal: ${generatedParseOptions.default[kebabKey]}, isOptional: ${isOptional}, finalHelpText: "${helpText}"`);
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
// Reason: ZodObject's generic type parameters are complex.
// deno-lint-ignore no-explicit-any
export function processArgs<S extends z.ZodObject<any, any>>(
  rawDenoArgs: string[],
  options: ProcessArgsOptions<S>,
): z.infer<S> {
  const { zodSchema, commandName, commandDescription, customHelpGeneration } =
    options;

  let finalParseOptions = options.parseArgsOptions;
  let finalHelpSections = options.helpSections;

  // logger.debug("clear") // logger を console に置き換えたので、この行はそのまま logger.debug を使う
  // console.debug("[deno-lib/args] processArgs: entry");
  if (!finalParseOptions || !finalHelpSections) {
    // console.debug(
    //   "[deno-lib/args] Generating parseOptions or helpSections from schema...",
    // );
    const { generatedParseOptions, generatedHelpSections } =
      generateOptionsFromSchema(
        zodSchema,
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
    boolean: [
      ...(Array.isArray(finalParseOptions?.boolean)
        ? finalParseOptions.boolean
        : []),
      "help",
    ],
    alias: { ...(finalParseOptions?.alias || {}), h: "help" },
  };

  // console.debug("[deno-lib/args] Ensured parseOptions:", ensuredParseOptions);
  const rawArgs = parseArgs(rawDenoArgs, ensuredParseOptions);
  // console.debug("[deno-lib/args] Raw parsed args:", rawArgs);
  // console.log("clear") // デバッグ用 console.log は削除またはコメントアウト

  if (rawArgs.help) {
    // console.log(rawArgs) // デバッグ用 console.log は削除またはコメントアウト
    // console.debug(
    //   "--help オプションが検出されました。ヘルプメッセージを生成・表示します。",
    // );
    if (customHelpGeneration) {
      const helpMsg = customHelpGeneration(
        zodSchema,
        commandName,
        commandDescription,
      );
      console.info(helpMsg);
      // console.debug("カスタムヘルプメッセージを表示しました。");
    } else {
      let helpMessage = `使用方法: ${commandName} [options]\n`;
      if (commandDescription) {
        helpMessage += `\n${commandDescription}\n`;
      }

      if (!finalHelpSections || finalHelpSections.length === 0) {
        console.warn(
          "ヘルプセクションが空または未定義です。スキーマからの自動生成に問題がある可能性があります。",
        );
      }

      for (const section of finalHelpSections || []) {
        helpMessage += `\n${section.title}:\n`;
        for (const [opt, desc] of Object.entries(section.options)) {
          helpMessage += `  ${opt.padEnd(40)}${desc}\n`; // padEndを調整
        }
      }
      console.info(helpMessage);
      // console.debug("自動生成されたヘルプメッセージを表示しました。");
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
        // console.debug("error.issues は配列です。詳細:", {
        //   issues: error.issues,
        // });
        for (const issue of error.issues) {
          const path = Array.isArray(issue.path)
            ? issue.path.join(".")
            : String(issue.path);
          console.error(
            `  - (issue) ${path} (${issue.code}): ${issue.message}`,
          );
        }
      } else {
        console.error("error.issues が配列ではありません。", {
          issues: error.issues,
        });
      }
    } else {
      console.error("エラーは ZodError のインスタンスではありません。", {
        errorDetails: String(error),
      });
    }
    console.info(`詳細は ${commandName} --help を確認してください。`);
    Deno.exit(1);
  }
}
