import { existsSync } from "jsr:@std/fs@^1.0.15";
import { join } from "jsr:@std/path@^1.0.8";
import { getFileSink } from "@logtape/file";
import type { FormattedValues, Logger, LogRecord } from "@logtape/logtape";
import {
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
  getLogger,
  withFilter,
} from "@logtape/logtape";

/**
 * ロガーインスタンスを取得し、必要に応じて初期設定を行う関数
 * @param scriptName スクリプト名（カテゴリとして使用）
 * @param logLevel ログレベル
 * @param logDir ログディレクトリのパス（必須）
 * @returns ロガーインスタンス
 */
export async function createLogger(
  scriptName: string,
  logLevel: "debug" | "info" | "warn" | "error",
  logDir: string,
): Promise<Logger> { // Logger 型を指定し、Promise を返すように変更
  // LogTapeのログレベルに変換
  const logtapeLevel = logLevel === "warn" ? "warning" : logLevel;

  // ログディレクトリの決定
  const LOG_DIR: string = join(logDir, scriptName);

  if (!existsSync(LOG_DIR)) {
    try {
      Deno.mkdirSync(LOG_DIR, { recursive: true });
    } catch (e) {
      // mkdir に失敗した場合、エラーをより詳細に表示
      console.error(`Failed to create log directory: ${LOG_DIR}`, e);
      throw e; // エラーを再スロー
    }
  }

  // ログファイル名の生成
  const LOG_FILE_NAME = `${scriptName}-${
    new Date().toISOString().replace(/[:.]/g, "-")
  }.log`;
  const LOG_FILE_PATH = join(LOG_DIR, LOG_FILE_NAME);

  // ANSIカラーフォーマッタの作成（カテゴリ非表示）
  const colorFormatter = getAnsiColorFormatter({
    timestamp: "time",
    timestampStyle: "dim",
    timestampColor: "cyan",
    level: "ABBR",
    levelStyle: "bold",
    levelColors: {
      debug: "blue",
      info: "green",
      warning: "yellow",
      error: "red",
      fatal: "magenta",
    },
    // カテゴリを表示しないようにカスタムフォーマット関数を定義
    format: (values: FormattedValues) => {
      // カテゴリを無視して、タイムスタンプ、レベル、メッセージのみを表示
      return `${values.timestamp} ${values.level}: ${values.message}`;
    },
  });

  // JSONフォーマッタの作成（ファイル出力用）
  const jsonFormatter = (record: LogRecord) => `${JSON.stringify(record)}\n`;

  await configure({
    sinks: {
      // コンソール出力用Sink
      console: getConsoleSink({
        formatter: colorFormatter,
      }),
      // ファイル出力用Sink（INFO以上のみ）
      file: withFilter(
        getFileSink(LOG_FILE_PATH, {
          formatter: jsonFormatter,
        }),
        "debug", // debug以上のログだけを通すフィルターを適用
      ),
    },
    loggers: [
      // コマンド用ロガー（コンソールはlogLevelに従い、ファイルはinfo以上）
      {
        category: scriptName,
        lowestLevel: logtapeLevel,
        sinks: ["console", "file"],
      },
      // メタロガーの設定を変更して警告レベル以上のみ表示
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console"],
      },
    ],
  });

  // ログファイルパスを返す代わりにロガーインスタンスを返す
  return getLogger(scriptName);
}
