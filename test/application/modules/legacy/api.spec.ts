/*
 * Copyright © 2022 Lisk Foundation
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

import { BaseAPI } from 'lisk-sdk';

import { LegacyAPI } from '../../../../src/application/modules/legacy/api';
import { MODULE_ID_LEGACY } from '../../../../src/application/modules/legacy/constants';

describe('LegacyAPI', () => {
	let legacyAPI: LegacyAPI;

	beforeAll(() => {
		legacyAPI = new LegacyAPI(MODULE_ID_LEGACY);
	});

	it('should inherit from BaseAPI', () => {
		expect(LegacyAPI.prototype).toBeInstanceOf(BaseAPI);
	});

	describe('constructor', () => {
		it('should be of the correct type', () => {
			expect(legacyAPI).toBeInstanceOf(LegacyAPI);
		});
	});
});
