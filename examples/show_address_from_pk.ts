import { z } from "zod@next";
import {
  baseArgsHelpInfo,
  createLogger,
  ethArgsHelpInfo, // ethArgsHelpInfo をインポート
  EthArgsSchema,
  getAccount,
  type HelpSection,
  processArgs,
} from "../mod.ts";
import { dirname, join } from "jsr:@std/path@^1.0.8";

const SCRIPT_NAME = "show_address_from_pk";

async function main() {
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const logDirectoryPath = join(scriptDir, "cli_logs");
  const logger = await createLogger(SCRIPT_NAME, "info", logDirectoryPath);

  const commonHelpInfo: HelpSection = {
    title: "共通オプション",
    options: {
      "--help, -h": "ヘルプを表示",
    },
  };

  try {
    const args = processArgs(Deno.args, {
      zodSchema: EthArgsSchema,
      commandName: SCRIPT_NAME,
      commandDescription:
        "秘密鍵からEthereumアドレスを表示するスクリプトです。",
      helpSections: [baseArgsHelpInfo, ethArgsHelpInfo, commonHelpInfo],
    });

    logger.info("引数の解析が完了しました。", args);

    // 秘密鍵からアカウント情報を取得
    const accountResult = getAccount(args.privateKey as string | undefined);

    if (accountResult.isOk()) {
      const account = accountResult.value;
      console.log(`アドレス: ${account.address}`);
      logger.info(`秘密鍵からアドレスの取得に成功しました: ${account.address}`);
    } else {
      logger.error("アカウントの取得に失敗しました:", {
        error: accountResult.error.message,
      });
      console.error(`エラー: ${accountResult.error.message}`);
      Deno.exit(1);
    }
  } catch (e) {
    // processArgs内でエラー処理とDeno.exitが行われるので、通常ここには到達しません。
    logger.error(
      `予期せぬエラーがmain関数で発生しました: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
