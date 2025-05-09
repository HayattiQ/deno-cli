import { existsSync } from "jsr:@std/fs"; // フルURLに変更
import { dirname, join } from "jsr:@std/path"; 
import { getFileSink } from "@logtape/file";
import type { FormattedValues, LogRecord } from "@logtape/logtape";
import {
	configure,
	getAnsiColorFormatter,
	getConsoleSink,
	getLogger,
	withFilter,
} from "@logtape/logtape";

/**
 * LogTapeロガーの初期設定を行う関数
 * @param scriptName スクリプト名（カテゴリとして使用）
 * @param logLevel ログレベル
 * @returns ログファイルパス
 */
export async function logConfigure(
	scriptName: string,
	logLevel: "debug" | "info" | "warn" | "error",
) {

	// LogTapeのログレベルに変換
	const logtapeLevel = logLevel === "warn" ? "warning" : logLevel;

	// ログディレクトリの作成
	const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
	const LOG_DIR = join(SCRIPT_DIR, "./logs", scriptName);

	if (!existsSync(LOG_DIR)) {
		Deno.mkdirSync(LOG_DIR, { recursive: true });
	}

	// ログファイル名の生成
	const LOG_FILE_NAME = `${scriptName}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
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

	// ログファイルパスを返す（デバッグ用）
	return LOG_FILE_PATH;
}

/**
 * ロガーインスタンスを取得する関数
 * @param scriptName スクリプト名（カテゴリ）
 * @returns ロガーインスタンス
 */
export function createLogger(scriptName: string) {
	return getLogger(scriptName);
}
