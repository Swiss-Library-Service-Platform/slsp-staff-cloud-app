import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';

import {
	BackendError,
	BackendErrorResponse,
	ValidationViolation,
} from '../models/backend-error.model';

/**
 * Parse an HttpErrorResponse into a structured BackendError.
 */
export function parseBackendError(error: HttpErrorResponse): BackendError {
	if (error.status === 401 || error.status === 403) {
		return { kind: 'auth', status: error.status as 401 | 403 };
	}

	const body = error.error;

	if (!body || typeof body !== 'object' || !body.code) {
		return { kind: 'unknown' };
	}

	if (body.code === 'VALIDATION_FAILED' && Array.isArray(body.violations)) {
		return {
			kind: 'validation',
			violations: body.violations as ValidationViolation[],
		};
	}

	if (body.code === 'INTERNAL_ERROR' && body.errorId) {
		return {
			kind: 'internal',
			code: 'INTERNAL_ERROR',
			errorId: body.errorId,
		};
	}

	const eBody = body as BackendErrorResponse;

	return { kind: 'coded', code: eBody.code, params: eBody.params ?? {} };
}

/**
 * Translate a BackendError into a user-facing string.
 *
 * i18n key convention: errors.{CODE}
 * Params from the backend are passed directly to ngx-translate for interpolation.
 */
export function translateBackendError(
	translate: TranslateService,
	error: BackendError
): string {
	switch (error.kind) {
		case 'coded':
			return translate.instant(`errors.${error.code}`, error.params);
		case 'internal':
			return translate.instant('errors.INTERNAL_ERROR', {
				errorId: error.errorId,
			});
		case 'validation': {
			const fieldList = error.violations
				.map((v) => translate.instant(`errors.fields.${v.field}`))
				.join(', ');

			return translate.instant('errors.VALIDATION_FAILED', {
				fields: fieldList,
			});
		}
		case 'auth':
			return translate.instant('errors.UNAUTHORIZED');
		case 'unknown':
			return translate.instant('errors.UNKNOWN');
	}
}
