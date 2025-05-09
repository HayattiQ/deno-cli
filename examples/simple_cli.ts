import { z } from "zod@next";
import {
  BaseArgsSchema,
  createLogger,
  logConfigure,
  processArgs,
} from "../mod.ts";

const SCRIPT_NAME = "simple_cli_example";

async function main() {

  await logConfigure(SCRIPT_NAME, "debug"); 
  const logger = createLogger(SCRIPT_NAME);


  // サンプル用スキーマ定義
  // BaseArgsSchema を拡張し、name と verbose オプションを追加
  const ExampleSchema = BaseArgsSchema.extend({
    name: z.string().describe("あなたの名前").meta({ alias: "N" }),
    verbose: z.boolean().optional().describe("詳細ログ出力").meta({ alias: "v" }),
  });

  try {
    const args = processArgs(Deno.args, {
      zodSchema: ExampleSchema,
      commandName: SCRIPT_NAME,
      commandDescription: "deno-libの機能を使ったシンプルなCLIサンプルです。",
    });

    console.log("example3")


    if (args.verbose) {
      // 実際には、logConfigureを再度呼び出すか、logtapeのAPIでレベルを変更する必要があるかもしれません。
      // ここでは簡略化のため、メッセージで示すのみとします。
      logger.info("詳細モードが指定されました。(実際のログレベル変更処理は省略)");
    }
    console.log("example2")

    logger.info(`こんにちは、${args.name}さん！`);
    logger.debug("これはデバッグメッセージです。", { args }); // logLevelがdebug以上なら表示される

  } catch (e) {
    // processArgs内でエラー処理とDeno.exitが行われるので、通常ここには到達しません。
    // 万が一到達した場合のフォールバックです。
    logger.error(`予期せぬエラーがmain関数で発生しました: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (import.meta.main) {
  main();
}
