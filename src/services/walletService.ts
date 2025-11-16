import {
    useCurrentAccount,
    useSuiClient,
    useConnectWallet,
    useDisconnectWallet,
    useSignAndExecuteTransaction,
    useWallets
  } from "@mysten/dapp-kit";
import { useCallback } from "react";

export function useSuiWallet() {
    const client = useSuiClient();
    const currentAccount = useCurrentAccount();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
      execute: async ({ bytes, signature }) =>
        await client.executeTransactionBlock({
          transactionBlock: bytes,
          signature,
          options: {
            showRawEffects: true,
            showEffects: true,
          },
        }),
    });
  
    const { mutate: connect } = useConnectWallet();
    const { mutate: disconnect } = useDisconnectWallet();
    const wallets = useWallets();
  
    const isConnected = Boolean(currentAccount);
    const walletAddress = currentAccount?.address;
  
    const handleConnect = useCallback(() => {
      if (!isConnected) {
        connect({ wallet: wallets[0] });
      }
    }, [connect, isConnected]);
  
    const handleDisconnect = useCallback(() => {
      if (isConnected) {
        disconnect();
      }
    }, [disconnect, isConnected]);
  
    return {
      client,
      currentAccount,
      signAndExecuteTransaction,
      isConnected,
      walletAddress,
      connect: handleConnect,
      disconnect: handleDisconnect,
    };
  }