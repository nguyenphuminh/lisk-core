/*
 * Copyright © 2020 Lisk Foundation
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
 */

import {
	cryptography,
	transactions,
	codec,
	TokenTransferAsset,
	KeysRegisterAsset,
	DPoSVoteAsset,
} from 'lisk-sdk';
import { Schema } from '../../src/base_ipc';

const account = {
	passphrase: 'endless focus guilt bronze hold economy bulk parent soon tower cement venue',
	privateKey:
		'a30c9e2b10599702b985d18fee55721b56691877cd2c70bbdc1911818dabc9b9508a965871253595b36e2f8dc27bff6e67b39bdd466531be9c6f8c401253979c',
	publicKey: '508a965871253595b36e2f8dc27bff6e67b39bdd466531be9c6f8c401253979c',
	address: '9cabee3d27426676b852ce6b804cb2fdff7cd0b5',
};

const tokenTransferAsset = new TokenTransferAsset(BigInt(500000));

export const tokenTransferAssetSchema = tokenTransferAsset.schema;
export const keysRegisterAssetSchema = new KeysRegisterAsset().schema;
export const dposVoteAssetSchema = new DPoSVoteAsset().schema;

export const genesisBlockID = Buffer.from(
	'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
	'hex',
);
export const communityIdentifier = 'Lisk';

export const networkIdentifier = cryptography.getNetworkIdentifier(
	genesisBlockID,
	communityIdentifier,
);

export const networkIdentifierStr = networkIdentifier.toString('hex');

export const createTransferTransaction = ({
	amount,
	fee,
	recipientAddress,
	nonce,
}: {
	amount: string;
	fee: string;
	recipientAddress: string;
	nonce: number;
}): Record<string, unknown> => {
	const transaction = transactions.signTransaction(
		tokenTransferAsset.schema,
		{
			moduleID: 2,
			assetID: 0,
			nonce: BigInt(nonce),
			fee: BigInt(transactions.convertLSKToBeddows(fee)),
			senderPublicKey: Buffer.from(account.publicKey, 'hex'),
			asset: {
				amount: BigInt(transactions.convertLSKToBeddows(amount)),
				recipientAddress: Buffer.from(recipientAddress, 'hex'),
				data: '',
			},
		},
		networkIdentifier,
		account.passphrase,
	) as any;

	return {
		...transaction,
		id: transaction.id.toString('hex'),
		senderPublicKey: transaction.senderPublicKey.toString('hex'),
		signatures: transaction.signatures.map(s => (s as Buffer).toString('hex')),
		asset: {
			...transaction.asset,
			amount: transaction.asset.amount.toString(),
			recipientAddress: transaction.asset.recipientAddress.toString('hex'),
		},
		nonce: transaction.nonce.toString(),
		fee: transaction.fee.toString(),
	};
};

export const encodeTransactionFromJSON = (
	transaction: Record<string, unknown>,
	baseSchema: Schema,
	assetsSchemas: { moduleID: number; assetID: number; schema: Schema }[],
): string => {
	const transactionTypeAssetSchema = assetsSchemas.find(
		as => as.moduleID === transaction.moduleID && as.assetID === transaction.assetID,
	);

	if (!transactionTypeAssetSchema) {
		throw new Error('Transaction type not found.');
	}

	const transactionAssetBuffer = codec.encode(
		transactionTypeAssetSchema.schema,
		codec.fromJSON(transactionTypeAssetSchema.schema, transaction.asset as object),
	);

	const transactionBuffer = codec.encode(
		baseSchema,
		codec.fromJSON(baseSchema, {
			...transaction,
			asset: transactionAssetBuffer,
		}),
	);

	return transactionBuffer.toString('hex');
};
