/*
 * Copyright © 2019 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */
import BigNum from '@liskhq/bignum';
import { cryptography, transactions } from 'lisk-sdk';
import {
	TRANSACTION_DAPP_TYPE,
	IN_TRANSFER_FEE,
} from './constants';

const {
	convertToAssetError,
	TransactionError,
	utils: {
		convertBeddowsToLSK,
		verifyAmountBalance,
		validator,
	},
	constants,
} = transactions;

export interface InTransferAsset {
	readonly inTransfer: {
		readonly dappId: string;
	};
}

export const inTransferAssetFormatSchema = {
	type: 'object',
	required: ['inTransfer'],
	properties: {
		inTransfer: {
			type: 'object',
			required: ['dappId'],
			properties: {
				dappId: {
					type: 'string',
					format: 'id',
				},
			},
		},
	},
};

export class InTransferTransaction extends transactions.BaseTransaction {
	public readonly asset: InTransferAsset;
	public static TYPE = 6;
	public static FEE = IN_TRANSFER_FEE.toString();
	public amount: BigNum;

	public constructor(rawTransaction: unknown) {
		super(rawTransaction);
		const tx = (typeof rawTransaction === 'object' && rawTransaction !== null
			? rawTransaction
			: {}) as Partial<transactions.TransactionJSON>;
		
		// TransactionJSON no longer has amount, so need to access this way
		this.amount = new BigNum(tx['amount'] || '0');

		this.asset = (tx.asset || { inTransfer: {} }) as InTransferAsset;
	}

	// Function getBasicBytes is overriden to maintain the bytes order
	// TODO: remove after hardfork implementation
	protected getBasicBytes(): Buffer {
		const transactionType = cryptography.intToBuffer(this.type, constants.BYTESIZES.TYPE);
		const transactionTimestamp = cryptography.intToBuffer(
			this.timestamp,
			constants.BYTESIZES.TIMESTAMP,
			'little',
		);

		const transactionSenderPublicKey = cryptography.hexToBuffer(this.senderPublicKey);

		const transactionRecipientID = Buffer.alloc(constants.BYTESIZES.RECIPIENT_ID);

		const transactionAmount = cryptography.bigNumberToBuffer(
			this.amount.toString(),
			constants.BYTESIZES.AMOUNT,
			'little',
		);

		return Buffer.concat([
			transactionType,
			transactionTimestamp,
			transactionSenderPublicKey,
			transactionRecipientID,
			transactionAmount,
			Buffer.from(this.asset.inTransfer.dappId, 'utf8'),
		]);
	}

	public async prepare(store: transactions.StateStorePrepare): Promise<void> {
		await store.account.cache([{ address: this.senderId }]);

		const transactions = await store.transaction.cache([
			{
				id: this.asset.inTransfer.dappId,
			},
		]);

		const dappTransaction =
			transactions && transactions.length > 0
				? transactions.find(
						tx =>
							tx.type === TRANSACTION_DAPP_TYPE &&
							tx.id === this.asset.inTransfer.dappId
				  )
				: undefined;

		if (dappTransaction) {
			await store.account.cache([
				{ address: cryptography.getAddressFromPublicKey(dappTransaction.senderPublicKey) },
			]);
		}
	}

	public assetToJSON(): object {
		return this.asset;
	}

	// tslint:disable-next-line prefer-function-over-method
	protected verifyAgainstTransactions(
		_: ReadonlyArray<transactions.TransactionJSON>
	): ReadonlyArray<transactions.TransactionError> {
		return [];
	}

	protected validateAsset(): ReadonlyArray<transactions.TransactionError> {
		validator.validate(inTransferAssetFormatSchema, this.asset);
		const errors = convertToAssetError(
			this.id,
			validator.errors
		) as transactions.TransactionError[];

		if (this.amount.lte(0)) {
			errors.push(
				new TransactionError(
					'Amount must be greater than 0',
					this.id,
					'.amount',
					this.amount.toString(),
					'0'
				)
			);
		}

		return errors;
	}

	protected applyAsset(store: transactions.StateStore): ReadonlyArray<transactions.TransactionError> {
		const errors: transactions.TransactionError[] = [];
		const idExists = store.transaction.find(
			(transaction: transactions.TransactionJSON) =>
				transaction.type === TRANSACTION_DAPP_TYPE &&
				transaction.id === this.asset.inTransfer.dappId
		);

		if (!idExists) {
			errors.push(
				new TransactionError(
					`Application not found: ${this.asset.inTransfer.dappId}`,
					this.id,
					this.asset.inTransfer.dappId
				)
			);
		}
		const sender = store.account.get(this.senderId);

		const balanceError = verifyAmountBalance(
			this.id,
			sender,
			this.amount,
			this.fee
		);
		if (balanceError) {
			errors.push(balanceError);
		}

		const updatedBalance = new BigNum(sender.balance).sub(this.amount);

		const updatedSender = { ...sender, balance: updatedBalance.toString() };

		store.account.set(updatedSender.address, updatedSender);

		const dappTransaction = store.transaction.get(this.asset.inTransfer.dappId);

		const recipient = store.account.get(cryptography.getAddressFromPublicKey(dappTransaction.senderPublicKey));

		const updatedRecipientBalance = new BigNum(recipient.balance).add(
			this.amount
		);
		const updatedRecipient = {
			...recipient,
			balance: updatedRecipientBalance.toString(),
		};

		store.account.set(updatedRecipient.address, updatedRecipient);

		return errors;
	}

	protected undoAsset(store: transactions.StateStore): ReadonlyArray<transactions.TransactionError> {
		const errors: transactions.TransactionError[] = [];
		const sender = store.account.get(this.senderId);
		const updatedBalance = new BigNum(sender.balance).add(this.amount);
		const updatedSender = { ...sender, balance: updatedBalance.toString() };

		store.account.set(updatedSender.address, updatedSender);

		const dappTransaction = store.transaction.get(this.asset.inTransfer.dappId);

		const recipient = store.account.get(cryptography.getAddressFromPublicKey(dappTransaction.senderPublicKey));

		const updatedRecipientBalance = new BigNum(recipient.balance).sub(
			this.amount
		);

		if (updatedRecipientBalance.lt(0)) {
			errors.push(
				new TransactionError(
					`Account does not have enough LSK: ${
						recipient.address
					}, balance: ${convertBeddowsToLSK(recipient.balance)}.`,
					this.id
				)
			);
		}
		const updatedRecipient = {
			...recipient,
			balance: updatedRecipientBalance.toString(),
		};

		store.account.set(updatedRecipient.address, updatedRecipient);

		return errors;
	}

	// tslint:disable:next-line: prefer-function-over-method no-any
	protected assetFromSync(raw: any): object | undefined {
		if (!raw.in_dappId) {
			return undefined;
		}
		const inTransfer = {
			dappId: raw.in_dappId,
		};
	
		return { inTransfer };
	}
}
