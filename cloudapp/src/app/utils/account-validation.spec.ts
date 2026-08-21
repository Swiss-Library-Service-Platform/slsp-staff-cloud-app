import {
	classifyStaffAccount,
	isPersonalStaffAccount,
	isValidStaffId,
} from './account-validation';

describe('staff account validation', () => {
	it('classifies normal email addresses as personal', () => {
		expect(classifyStaffAccount('john.doe@ethz.ch')).toBe('personal');
		expect(isPersonalStaffAccount('john.doe@ethz.ch')).toBeTrue();
	});

	it('classifies valid NP_ identifiers as institutional', () => {
		for (const primaryId of [
			'NP_SERVICE_DESK_1',
			'NP_02-ae-desk.bib',
			'NP_hph_bjn_Secrétariat',
		]) {
			expect(classifyStaffAccount(primaryId)).toBe('institutional');
			expect(isValidStaffId(primaryId)).toBeTrue();
		}
	});

	it('rejects malformed identifiers using the reserved NP_ prefix', () => {
		for (const primaryId of [
			'NP_02-ae-desk.bib@epfl.ch',
			'np_02-ae-desk.bib',
			'np_02-ae-desk.bib@epfl.ch',
			'Np_02-ae-desk.bib',
			'NP_',
		]) {
			expect(classifyStaffAccount(primaryId)).toBe('invalid');
			expect(isPersonalStaffAccount(primaryId)).toBeFalse();
			expect(isValidStaffId(primaryId)).toBeFalse();
		}
	});

	it('rejects malformed and missing identifiers', () => {
		for (const primaryId of ['not-an-email', '', null, undefined]) {
			expect(classifyStaffAccount(primaryId)).toBe('invalid');
			expect(isValidStaffId(primaryId)).toBeFalse();
		}
	});
});
