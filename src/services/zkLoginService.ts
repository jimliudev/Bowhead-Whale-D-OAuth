import { EnokiClient } from '@mysten/enoki';
import { toB64 } from '@mysten/sui/utils';

/**
 * zkLogin Service
 * 
 * 提供 zkLogin (Enoki) 錢包相關的工具函數
 * 可在多個組件中重用
 */

const ENOKI_API_KEY = import.meta.env.VITE_ENOKI_PUBLIC_KEY;
const NETWORK = 'testnet';
const CHAIN_IDENTIFIER = `sui:${NETWORK}` as const;

/**
 * 檢查錢包是否為 zkLogin (Enoki) 錢包
 * 
 * @param wallet - 當前連接的錢包
 * @returns 是否為 zkLogin 錢包
 */
export function isZkLoginWallet(wallet: any): boolean {
    if (!wallet) return false;

    // Enoki zkLogin 錢包名稱包含 "Sign in with"
    const isEnokiWallet = wallet.name.includes('Sign in with');

    console.log('🔐 Wallet check:', {
        walletName: wallet.name,
        isZkLogin: isEnokiWallet
    });

    return isEnokiWallet;
}

/**
 * 使用 zkLogin 執行 sponsored transaction
 * 
 * @param tx - 交易對象
 * @param account - 當前帳戶
 * @param suiClient - Sui client
 * @param signTransaction - 簽署交易的函數
 * @returns 交易執行結果
 */
export async function executeZkLoginTransaction(
    tx: any,
    account: any,
    suiClient: any,
    signTransaction: (params: { transaction: string; chain: `${string}:${string}` }) => Promise<{ signature: string }>
) {
    console.log('✅ Using zkLogin wallet - executing sponsored transaction');

    // 創建 Enoki client
    const enokiClient = new EnokiClient({
        apiKey: ENOKI_API_KEY,
    });

    // 建立交易（只包含 transaction kind）
    const txBytes = await tx.build({
        client: suiClient,
        onlyTransactionKind: true, // 只建立 transaction kind
    });

    console.log('📤 Requesting Enoki sponsored transaction...');

    // 呼叫 Enoki API 創建 sponsored transaction
    const sponsoredResponse = await enokiClient.createSponsoredTransaction({
        network: NETWORK,
        transactionKindBytes: toB64(txBytes),
        sender: account.address,
    });

    console.log('✅ Sponsored transaction created');

    // 簽署交易
    const { signature } = await signTransaction({
        transaction: sponsoredResponse.bytes,
        chain: CHAIN_IDENTIFIER,
    });

    if (!signature) {
        throw new Error('Signature failed');
    }

    // 執行 sponsored transaction
    const executeResponse = await enokiClient.executeSponsoredTransaction({
        digest: sponsoredResponse.digest,
        signature,
    });

    console.log('✅ Sponsored transaction executed');

    return executeResponse;
}

/**
 * 簽署個人訊息（帶 chain identifier）
 * 
 * @param message - 要簽署的訊息
 * @param wallet - 當前錢包
 * @param account - 當前帳戶
 * @returns 簽名
 */
export async function signPersonalMessageWithChain(
    message: Uint8Array,
    wallet: any,
    account: any
): Promise<string> {
    if (!wallet || !account) {
        throw new Error('Wallet not connected');
    }

    try {
        // 使用錢包的 signPersonalMessage 功能
        const signPersonalMessageFeature = wallet.features['sui:signPersonalMessage'];

        if (signPersonalMessageFeature) {
            const result = await signPersonalMessageFeature.signPersonalMessage({
                message,
                account,
                chain: CHAIN_IDENTIFIER, // 提供 chain identifier
            });

            return result.signature;
        }

        throw new Error('Wallet does not support signPersonalMessage');
    } catch (err: any) {
        console.error('Sign personal message error:', err);
        throw new Error(`Failed to sign message: ${err?.message || 'Unknown error'}`);
    }
}

/**
 * 獲取當前網路的 chain identifier
 */
export function getChainIdentifier(): string {
    return CHAIN_IDENTIFIER;
}

/**
 * 獲取當前網路名稱
 */
export function getNetwork(): string {
    return NETWORK;
}
