import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { BackendHttpService } from './backend-http.service';

export interface AuthInfo {
	userName: string;
	izCode: string;
	atamEnabled: boolean;
}

export type AuthResult =
	| { status: 'authorized'; info: AuthInfo }
	| { status: 'unauthorized'; reason: 'invalid_token' | 'forbidden' }
	| { status: 'error'; message: string };

@Injectable({
	providedIn: 'root',
})
export class AuthService {
	private backend = inject(BackendHttpService);
	private authResult$: Observable<AuthResult> | null = null;

	/**
	 * Check if the current user is authorized to use the app.
	 * Calls backend /api/cloudapp/auth/me with Alma JWT token.
	 *
	 * Returns:
	 * - { status: 'authorized', info } - User is allowed
	 * - { status: 'unauthorized', reason } - User not allowed (401/403)
	 * - { status: 'error', message } - Network/server error
	 */
	public checkAuth(): Observable<AuthResult> {
		if (!this.authResult$) {
			this.authResult$ = this.backend
				.get<AuthInfo>('/api/cloudapp/auth/me')
				.pipe(
					map(
						(info): AuthResult => ({
							status: 'authorized',
							info,
						}),
					),
					catchError((error: HttpErrorResponse): Observable<AuthResult> => {
						if (error.status === 401) {
							return of({ status: 'unauthorized', reason: 'invalid_token' });
						}

						if (error.status === 403) {
							return of({ status: 'unauthorized', reason: 'forbidden' });
						}

						return of({
							status: 'error',
							message: error.message || 'Unknown error',
						});
					}),
					shareReplay({ bufferSize: 1, refCount: false }),
				);
		}

		return this.authResult$;
	}

	/** Whether the authenticated user's institution supports ATAM links. */
	public isAtamEnabled(): Observable<boolean> {
		return this.checkAuth().pipe(
			map(
				(result) => result.status === 'authorized' && result.info.atamEnabled,
			),
		);
	}
}
