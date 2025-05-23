import { z } from "zod@next";
import {
  BaseArgsSchema,
  createLogger,
  processArgs,
  type HelpSection, // mod.ts から HelpSection をインポート
  baseArgsHelpInfo, // mod.ts から baseArgsHelpInfo をインポート
} from "../mod.ts";
import { dirname, join } from "jsr:@std/path@^1.0.8";

const SCRIPT_NAME = "simple_cli_example";

async function main() {
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const logDirectoryPath = join(scriptDir, "cli_logs"); // 変数名を変更
  const logger = await createLogger(SCRIPT_NAME, "debug", logDirectoryPath);

  // サンプル用スキーマ定義
  // BaseArgsSchema を拡張し、name と verbose オプションを追加
  const ExampleSchema = BaseArgsSchema.extend({
    name: z.string().meta({
      description: "あなたの名前",
      alias: "N",
    }),
    verbose: z.boolean().optional().meta({
      description: "詳細ログ出力",
      alias: "v",
    }),
  });

  const exampleSchemaHelpInfo: HelpSection = {
    title: "追加オプション",
    options: {
      "--name, -N <string>": "あなたの名前 (必須)",
      "--verbose, -v": "詳細ログ出力",
    },
  };

  // 固定のヘルプオプションも定義
  const commonHelpInfo: HelpSection = {
    title: "共通オプション",
    options: {
      "--help, -h": "ヘルプを表示",
    },
  };

  try {
    const args = processArgs(Deno.args, {
      zodSchema: ExampleSchema,
      commandName: SCRIPT_NAME,
      commandDescription: "deno-cliの機能を使ったシンプルなCLIサンプルです。",
      helpSections: [baseArgsHelpInfo, exampleSchemaHelpInfo, commonHelpInfo], // 配列で渡す
    });

    if (args.verbose) {
      // 実際には、logConfigureを再度呼び出すか、logtapeのAPIでレベルを変更する必要があるかもしれません。
      // ここでは簡略化のため、メッセージで示すのみとします。
      logger.info(
        "詳細モードが指定されました。(実際のログレベル変更処理は省略)",
      );
    }

    logger.info(`こんにちは、${args.name}さん！`);
    logger.debug("これはデバッグメッセージです。", { args }); // logLevelがdebug以上なら表示される
  } catch (e) {
    // processArgs内でエラー処理とDeno.exitが行われるので、通常ここには到達しません。
    // 万が一到達した場合のフォールバックです。
    logger.error(
      `予期せぬエラーがmain関数で発生しました: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

if (import.meta.main) {
  main();
}
