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
  parseArgsOptions?: ParseOptions;
  helpSections?: HelpSection[];
  commandName: string;
  commandDescription?: string;
  customHelpGeneration?: (
    schema: S,
    commandName: string,
    commandDescription?: string,
  ) => string;
  // aliases?: Record<string, string>; // エイリアスマッピングは不要に戻す
}

// キャメルケースをケバブケースに変換するヘルパー関数
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

// ケバブケースをキャメルケースに変換するヘルパー関数
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
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
  // customAliases?: Record<string, string>, // カスタムエイリアスは不要に戻す
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
    const fieldSchema = schema.shape[key] as z.ZodTypeAny;
    const kebabKey = camelToKebab(key);
    let optionName = `--${kebabKey}`;
    let typeHint = "";

    // description と meta を取得 (Zod公式ドキュメント準拠)
    const meta: { alias?: string; description?: string } | undefined =
      fieldSchema.meta?.();
    const descriptionFromMeta = meta?.description;
    const descriptionFromSchemaProperty: string | undefined =
      fieldSchema.description;

    // meta.description を優先し、なければ fieldSchema.description をフォールバックとして使用
    const finalDescription = descriptionFromMeta ||
      descriptionFromSchemaProperty || "";
    const finalMeta = meta;

    // エイリアス処理
    let aliasString = "";
    if (finalMeta?.alias) {
      aliasString = finalMeta.alias;
      optionName += `, -${aliasString}`;
      generatedParseOptions.alias[aliasString] = kebabKey;
    }

    // 型ヒントと型定義の収集
    let unwrappedSchema: z.ZodTypeAny = fieldSchema;
    // deno-lint-ignore no-explicit-any
    let unwrappedDef = unwrappedSchema._def as any;
    let unwrappedTypeName = unwrappedDef.typeName as string;

    // ZodDefault, ZodOptional, ZodEffects などのラッパーを剥がす
    while (
      unwrappedTypeName === "ZodDefault" ||
      unwrappedTypeName === "ZodOptional" ||
      unwrappedTypeName === "ZodNullable" ||
      unwrappedTypeName === "ZodEffects"
    ) {
      if (unwrappedTypeName === "ZodDefault") {
        generatedParseOptions.default[kebabKey] = unwrappedDef.defaultValue();
      }
      unwrappedSchema = unwrappedDef.innerType;
      // deno-lint-ignore no-explicit-any
      unwrappedDef = unwrappedSchema._def as any;
      unwrappedTypeName = unwrappedDef.typeName;
    }

    // 剥がした後の型で判定
    if (unwrappedTypeName === "ZodString") {
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString); // エイリアスも型リストに追加
      typeHint = "<string>";
    } else if (unwrappedTypeName === "ZodBoolean") {
      generatedParseOptions.boolean.push(kebabKey);
      if (aliasString) generatedParseOptions.boolean.push(aliasString); // エイリアスも型リストに追加
    } else if (unwrappedTypeName === "ZodNumber") {
      generatedParseOptions.string.push(kebabKey); // 数値も一度文字列として受け取る
      if (aliasString) generatedParseOptions.string.push(aliasString); // エイリアスも型リストに追加
      typeHint = "<number>";
    } else if (unwrappedTypeName === "ZodEnum") {
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString); // エイリアスも型リストに追加
      const enumValues = unwrappedDef.values as string[];
      typeHint = `<${enumValues.join("|")}>`;
    } else {
      // その他の型はstringとして扱うか、エラーにするか
      generatedParseOptions.string.push(kebabKey);
      if (aliasString) generatedParseOptions.string.push(aliasString); // エイリアスも型リストに追加
    }

    let helpText = finalDescription;
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

  // console.log("DEBUG: generatedParseOptions.alias in generateOptionsFromSchema:", JSON.stringify(generatedParseOptions.alias, null, 2)); // デバッグ完了のためコメントアウト
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
  const { zodSchema, commandName, commandDescription, customHelpGeneration } = // aliases は不要に戻す
    options;

  let finalParseOptions = options.parseArgsOptions;
  let finalHelpSections = options.helpSections;

  if (!finalParseOptions || !finalHelpSections) {
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

  const rawArgs = parseArgs(rawDenoArgs, ensuredParseOptions);

  // エイリアスを元のキー名に変換し、さらにキーをキャメルケースに変換する処理
  const camelCasedArgs: Record<string, unknown> = {};
  const tempAliasedArgs = { ...rawArgs }; // parseArgsの結果を一時的に保持

  // 1. エイリアスをケバブケースのフルネームキーに展開
  if (ensuredParseOptions.alias) {
    for (
      const [alias, originalKeyOrKeys] of Object.entries(
        ensuredParseOptions.alias,
      )
    ) {
      if (typeof originalKeyOrKeys === "string") {
        const originalKebabKey = originalKeyOrKeys; // ここではケバブケースのキー
        if (alias in tempAliasedArgs && !(originalKebabKey in tempAliasedArgs)) {
          tempAliasedArgs[originalKebabKey] = tempAliasedArgs[alias];
          // delete tempAliasedArgs[alias]; // 元のエイリアスキーは不要なら削除しても良いが、Zodは未知のキーを無視するので必須ではない
        }
      } else if (Array.isArray(originalKeyOrKeys)) {
        // 配列の場合、最初のものを主要なキーとして扱うか、適切な処理が必要
        // 今回のスキーマ生成ロジックでは単一文字列を想定しているため、基本的にはここは通らないはず
        const originalKebabKey = originalKeyOrKeys[0];
         if (alias in tempAliasedArgs && !(originalKebabKey in tempAliasedArgs)) {
          tempAliasedArgs[originalKebabKey] = tempAliasedArgs[alias];
        }
      }
    }
  }

  // 2. 全てのキーをケバブケースからキャメルケースに変換
  for (const key in tempAliasedArgs) {
    if (Object.prototype.hasOwnProperty.call(tempAliasedArgs, key)) {
      // "_" (アンダースコア) は parseArgs が未定義の引数に使われるため、そのまま保持
      if (key === "_") {
        camelCasedArgs[key] = tempAliasedArgs[key];
      } else {
        camelCasedArgs[kebabToCamel(key)] = tempAliasedArgs[key];
      }
    }
  }


  if (camelCasedArgs.help) { // helpもキャメルケースでチェック
    if (customHelpGeneration) {
      const helpMsg = customHelpGeneration(
        zodSchema,
        commandName,
        commandDescription,
      );
      console.info(helpMsg);
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
    }
    Deno.exit(0);
  }

  try {
    const validatedArgs = zodSchema.parse(camelCasedArgs) as z.infer<S>;
    return validatedArgs;
  } catch (error) {
    console.error("引数の検証に失敗しました。", { errorObject: error });
    if (error instanceof z.ZodError) {
      console.info("エラーは ZodError のインスタンスです。");
      if (Array.isArray(error.issues)) {
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
