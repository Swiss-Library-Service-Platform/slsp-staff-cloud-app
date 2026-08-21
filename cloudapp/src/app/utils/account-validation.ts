/**
 * Frontend-side account validation — mirrors backend regex patterns exactly.
 * Security note: backend always re-validates. This is UX-only.
 *
 * Backend source: StaffAccountIdentifier.java
 */

/** Personal staff: email with at least one letter in local part */
const PERSONAL_STAFF_PATTERN =
	/^[a-zA-Z0-9._-]*[a-zA-Z][a-zA-Z0-9._-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
/** Institutional staff: uppercase NP_ prefix, Unicode letters, and no email suffix. */
const INSTITUTIONAL_STAFF_PATTERN = /^NP_[\p{L}0-9._-]+$/u;
/** NP_ is reserved case-insensitively and cannot fall through to personal. */
const RESERVED_NP_PREFIX_PATTERN = /^NP_/i;
/** edu-ID: digits@eduid.ch or digits@test.eduid.ch */
const EDUID_PATTERN = /^[0-9]+@(test\.)?eduid\.ch$/;

export type StaffAccountType = 'personal' | 'institutional' | 'invalid';

/**
 * Classify a staff primary ID into exactly one account type.
 */
export function classifyStaffAccount(
	primaryId: string | null | undefined,
): StaffAccountType {
	if (!primaryId) {
		return 'invalid';
	}

	if (RESERVED_NP_PREFIX_PATTERN.test(primaryId)) {
		return INSTITUTIONAL_STAFF_PATTERN.test(primaryId)
			? 'institutional'
			: 'invalid';
	}

	return PERSONAL_STAFF_PATTERN.test(primaryId) ? 'personal' : 'invalid';
}

/**
 * Check if a primary ID is a valid staff account (personal or institutional).
 */
export function isValidStaffId(primaryId: string | null | undefined): boolean {
	return classifyStaffAccount(primaryId) !== 'invalid';
}

/**
 * Check if a personal ID is a valid edu-ID account.
 */
export function isValidEduIdId(personalId: string): boolean {
	return EDUID_PATTERN.test(personalId);
}

/**
 * Check if a primary ID matches the personal staff pattern (email format).
 * Replaces the looser regex previously in link-accounts.component.ts.
 */
export function isPersonalStaffAccount(
	primaryId: string | null | undefined,
): boolean {
	return classifyStaffAccount(primaryId) === 'personal';
}
