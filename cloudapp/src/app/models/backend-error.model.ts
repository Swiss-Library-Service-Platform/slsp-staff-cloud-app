/**
 * Standard error response from backend.
 * Shape: { code, params?, errorId? }
 */
export interface BackendErrorResponse {
	code: string;
	params?: Record<string, string>;
	errorId?: string;
}

/**
 * A single field validation violation.
 */
export interface ValidationViolation {
	field: string;
	constraint: string;
}

/**
 * Parsed backend error — discriminated union covering all response shapes.
 *
 * - coded:      Standard error with code + optional params
 * - validation:  VALIDATION_FAILED with field violations
 * - internal:   INTERNAL_ERROR with support reference errorId
 * - auth:       401/403 with no body
 * - unknown:    Unparseable response
 */
export type BackendError =
	| { kind: 'coded'; code: string; params: Record<string, string> }
	| { kind: 'validation'; violations: ValidationViolation[] }
	| { kind: 'internal'; code: 'INTERNAL_ERROR'; errorId: string }
	| { kind: 'auth'; status: 401 | 403 }
	| { kind: 'unknown' };
