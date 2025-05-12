import { err, ok, type Result } from "neverthrow";
import { type PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";

/**
 * 秘密鍵を環境変数または引数から取得し、PrivateKeyAccountを返却
 * @param customPrivateKey コマンドライン引数などから渡された秘密鍵（オプション）
 * @returns PrivateKeyAccountを含むResult
 */
export function getAccount(
  customPrivateKey?: string,
): Result<PrivateKeyAccount, Error> {
  try {
    // 秘密鍵を取得
    let privateKey: `0x${string}`;

    if (customPrivateKey) {
      // 0xプレフィックスがない場合は追加
      privateKey = customPrivateKey.startsWith("0x")
        ? customPrivateKey as `0x${string}`
        : `0x${customPrivateKey}` as `0x${string}`;
    } else {
      // 環境変数から秘密鍵を取得
      const envPrivateKey = Deno.env.get("PRIVATE_KEY");

      if (!envPrivateKey) {
        return err(
          new Error(
            "Private key must be provided either as an argument or as PRIVATE_KEY environment variable",
          ),
        );
      }

      // 0xプレフィックスがない場合は追加
      privateKey = envPrivateKey.startsWith("0x")
        ? envPrivateKey as `0x${string}`
        : `0x${envPrivateKey}` as `0x${string}`;
    }

    // 秘密鍵からアカウントを作成
    const account = privateKeyToAccount(privateKey);
    return ok(account);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(new Error(`Failed to create account: ${errorMessage}`));
  }
}
