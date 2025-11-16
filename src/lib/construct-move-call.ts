import { fromHex } from "@mysten/sui/utils";
import { Transaction } from "@mysten/sui/transactions";

// Update this with your published package ID
const PACKAGE_ID = "0x0"; // Replace with actual package ID after publishing
const GAS_BUDGET = 10000000;

// ===== Storage Module =====

/**
 * Create a new storage container
 */
export function createStorageMoveCallTx(
  args: { name: string; blobId: string },
  gasBudget = GAS_BUDGET
) {
  const { name, blobId } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::storage::create_storage_entry`,
    arguments: [
      tx.pure.string(name),
      tx.pure.string(blobId),
      tx.object("0x6"), // Clock object
    ],
  });
  tx.setGasBudget(gasBudget);
  return tx;
}

/**
 * Update storage container blob reference
 */
export function updateStorageMoveCallTx(
  args: { capId: string; containerId: string; newBlobId: string },
  gasBudget = GAS_BUDGET
) {
  const { capId, containerId, newBlobId } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::storage::update_storage_entry`,
    arguments: [
      tx.object(capId),
      tx.object(containerId),
      tx.pure.string(newBlobId),
      tx.object("0x6"), // Clock object
    ],
  });
  tx.setGasBudget(gasBudget);
  return tx;
}

/**
 * Delete a storage container
 */
export function deleteStorageMoveCallTx(
  args: { capId: string; containerId: string; namespaceId: string },
  gasBudget = GAS_BUDGET
) {
  const { capId, containerId, namespaceId } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::storage::delete_storage_entry`,
    arguments: [tx.object(capId), tx.object(containerId), tx.object(namespaceId)],
  });
  tx.setGasBudget(gasBudget);
  return tx;
}

/**
 * Build seal_approve transaction bytes for storage container
 * This is used for Seal decryption, NOT executed on-chain
 */
export function storageSealApproveMoveCallTx(args: {
  sealId: string; // Hex string of Seal ID
  containerId: string;
  namespaceId: string;
}) {
  const { sealId, containerId, namespaceId } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::storage::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(sealId))),
      tx.object(containerId),
      tx.object(namespaceId),
    ],
  });
  return tx;
}

// ===== Share Module =====

/**
 * Create a share for a storage container
 */
export function createShareMoveCallTx(
  args: {
    containerId: string;
    namespaceId: string;
    recipients: string[];
    ttl: number; // Time to live in milliseconds
  },
  gasBudget = GAS_BUDGET
) {
  const { containerId, namespaceId, recipients, ttl } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::share::create_share_entry`,
    arguments: [
      tx.object(containerId),
      tx.object(namespaceId),
      tx.pure.vector("address", recipients),
      tx.pure.u64(ttl),
      tx.object("0x6"), // Clock object
    ],
  });
  tx.setGasBudget(gasBudget);
  return tx;
}

/**
 * Update a share
 */
export function updateShareMoveCallTx(
  args: {
    capId: string;
    shareId: string;
    recipients: string[];
    ttl: number;
  },
  gasBudget = GAS_BUDGET
) {
  const { capId, shareId, recipients, ttl } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::share::update_share_entry`,
    arguments: [
      tx.object(capId),
      tx.object(shareId),
      tx.pure.vector("address", recipients),
      tx.pure.u64(ttl),
    ],
  });
  tx.setGasBudget(gasBudget);
  return tx;
}

/**
 * Delete a share
 */
export function deleteShareMoveCallTx(
  args: { capId: string; shareId: string },
  gasBudget = GAS_BUDGET
) {
  const { capId, shareId } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::share::delete_share_entry`,
    arguments: [tx.object(capId), tx.object(shareId)],
  });
  tx.setGasBudget(gasBudget);
  return tx;
}

/**
 * Build seal_approve transaction bytes for share
 * This is used for Seal decryption of shared data, NOT executed on-chain
 */
export function shareSealApproveMoveCallTx(args: {
  sealId: string; // Hex string of Seal ID
  shareId: string;
}) {
  const { sealId, shareId } = args;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::share::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(sealId))),
      tx.object(shareId),
      tx.object("0x6"), // Clock object
    ],
  });
  return tx;
}

