import { useMemo } from 'react';
import {
    useCurrentAccount,
    useCurrentWallet,
    useSignAndExecuteTransaction,
    useSignTransaction,
} from '@mysten/dapp-kit';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { getFullnodeUrl } from '@mysten/sui/client';
import { walrus } from '@mysten/walrus';
import {
    isZkLoginWallet,
    executeZkLoginTransaction,
    signPersonalMessageWithChain,
} from '../services/zkLoginService';

// 創建 Sui client
const suiClient = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
}).$extend(
    walrus({
        wasmUrl: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
    }),
);

/**
 * 自定義 Hook：統一處理交易執行
 * 
 * 自動檢測 zkLogin 錢包並使用對應的執行方式
 * 
 * @returns 交易執行相關的函數和狀態
 */
export function useTransactionExecution() {
    const currentAccount = useCurrentAccount();
    const { currentWallet } = useCurrentWallet();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const { mutateAsync: signTransaction } = useSignTransaction();

    // 檢查是否使用 zkLogin
    const isUsingZkLogin = useMemo(() => {
        return isZkLoginWallet(currentWallet);
    }, [currentWallet]);

    /**
     * 執行交易（自動判斷 zkLogin）
     * 
     * @param tx - 交易對象
     * @returns 交易執行結果
     */
    const executeTransaction = async (tx: any) => {
        if (!currentAccount) {
            throw new Error('Account not connected');
        }

        if (isUsingZkLogin) {
            // 使用 zkLogin sponsored transaction
            return await executeZkLoginTransaction(
                tx,
                currentAccount,
                suiClient,
                signTransaction
            );
        } else {
            // 使用標準錢包執行
            console.log('✅ Using standard wallet - executing transaction');
            return await signAndExecuteTransaction({
                transaction: tx as any,
            });
        }
    };

    /**
     * 簽署個人訊息
     * 
     * @param message - 要簽署的訊息
     * @returns 簽名
     */
    const signPersonalMessage = async (message: Uint8Array): Promise<string> => {
        if (!currentWallet || !currentAccount) {
            throw new Error('Wallet not connected');
        }

        // 使用 service 的方法（已包含 chain identifier）
        return await signPersonalMessageWithChain(message, currentWallet, currentAccount);
    };

    return {
        executeTransaction,
        signPersonalMessage,
        isUsingZkLogin,
        currentAccount,
        currentWallet,
        suiClient,
    };
}
