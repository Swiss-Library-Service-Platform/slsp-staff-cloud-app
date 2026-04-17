/**
 * Frontend-side account validation — mirrors backend regex patterns exactly.
 * Security note: backend always re-validates. This is UX-only.
 *
 * Backend source: AlmaUserValidationService.java
 */

/** Personal staff: email with at least one letter in local part */
const PERSONAL_STAFF_PATTERN =
	/^[a-zA-Z0-9._]*[a-zA-Z][a-zA-Z0-9._]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
/** Institutional staff: NP_ prefix */
const INSTITUTIONAL_STAFF_PATTERN = /^NP_[A-Za-z0-9_]+$/;
/** edu-ID: digits@eduid.ch or digits@test.eduid.ch */
const EDUID_PATTERN = /^[0-9]+@(test\.)?eduid\.ch$/;

/**
 * Check if a primary ID is a valid staff account (personal or institutional).
 */
export function isValidStaffId(primaryId: string): boolean {
	return (
		PERSONAL_STAFF_PATTERN.test(primaryId) ||
		INSTITUTIONAL_STAFF_PATTERN.test(primaryId)
	);
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
export function isPersonalStaffAccount(primaryId: string): boolean {
	return PERSONAL_STAFF_PATTERN.test(primaryId);
}
