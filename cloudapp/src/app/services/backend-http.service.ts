import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CloudAppEventsService } from '@exlibris/exl-cloudapp-angular-lib';
import { combineLatest, Observable, of } from 'rxjs';
import { finalize, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';

/**
 * HTTP client wrapper for backend API calls.
 * Handles authentication token injection and base URL configuration.
 *
 * Feature services should inject this instead of HttpClient directly
 * when communicating with our backend.
 */
@Injectable({
	providedIn: 'root',
})
export class BackendHttpService {
	private static readonly PROD_URL = 'https://staff.swisscovery.network';
	private static readonly SANDBOX_URL = 'https://staff-test.swisscovery.network';
	private static readonly LOCAL_URL = 'http://localhost:8080';

	private eventsService = inject(CloudAppEventsService);
	private http = inject(HttpClient);

	private baseUrl: string | null = null;

	// Token cache — avoids serialized getAuthToken() bottleneck
	private cachedToken: string | null = null;
	private tokenExpiry = 0;
	private tokenInFlight$: Observable<string> | null = null;
	private readonly TOKEN_TTL = 30_000; // 30 seconds

	/**
	 * GET request to backend API.
	 */
	public get<T>(path: string): Observable<T> {
		return this.withAuth((token, baseUrl) =>
			this.http.get<T>(`${baseUrl}${path}`, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * POST request to backend API.
	 */
	public post<T>(path: string, body: unknown): Observable<T> {
		return this.withAuth((token, baseUrl) =>
			this.http.post<T>(`${baseUrl}${path}`, body, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * PUT request to backend API.
	 */
	public put<T>(path: string, body: unknown): Observable<T> {
		return this.withAuth((token, baseUrl) =>
			this.http.put<T>(`${baseUrl}${path}`, body, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * PATCH request to backend API.
	 */
	public patch<T>(path: string, body: unknown): Observable<T> {
		return this.withAuth((token, baseUrl) =>
			this.http.patch<T>(`${baseUrl}${path}`, body, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * DELETE request to backend API.
	 */
	public delete<T>(path: string): Observable<T> {
		return this.withAuth((token, baseUrl) =>
			this.http.delete<T>(`${baseUrl}${path}`, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * Get auth token with caching and concurrent request deduplication.
	 * The Alma SDK's getAuthToken() serializes calls — multiple concurrent
	 * requests queue up, adding seconds of wait time. This caches the token
	 * and deduplicates in-flight requests so all callers share one fetch.
	 */
	private getToken(): Observable<string> {
		if (this.cachedToken && performance.now() < this.tokenExpiry) {
			return of(this.cachedToken);
		}

		if (!this.tokenInFlight$) {
			this.tokenInFlight$ = this.eventsService.getAuthToken().pipe(
				tap((token) => {
					this.cachedToken = token;
					this.tokenExpiry = performance.now() + this.TOKEN_TTL;
				}),
				finalize(() => {
					this.tokenInFlight$ = null;
				}),
				shareReplay(1)
			);
		}

		return this.tokenInFlight$;
	}

	/**
	 * Resolves the backend base URL based on the Alma environment.
	 * Local dev (URL contains "localhost") → LOCAL_URL,
	 * Sandbox (URL contains "psb") → SANDBOX_URL,
	 * Production → PROD_URL. Result is cached after first call.
	 */
	private resolveBaseUrl(): Observable<string> {
		if (this.baseUrl) {
			return of(this.baseUrl);
		}

		return this.eventsService.getInitData().pipe(
			map((initData) => {
				const almaUrl: string = initData['urls']?.['alma'] || '';
				const isLocal = /localhost/.test(almaUrl);
				const isSandbox = /psb/.test(almaUrl);

				this.baseUrl = isLocal
					? BackendHttpService.LOCAL_URL
					: isSandbox
						? BackendHttpService.SANDBOX_URL
						: BackendHttpService.PROD_URL;


				// TODO: dont commit
				this.baseUrl = BackendHttpService.PROD_URL;

				return this.baseUrl;
			})
		);
	}

	/**
	 * Wraps an HTTP call with authentication token and base URL resolution.
	 */
	private withAuth<T>(
		fn: (token: string, baseUrl: string) => Observable<T>
	): Observable<T> {
		return combineLatest([this.getToken(), this.resolveBaseUrl()]).pipe(
			take(1),
			switchMap(([token, url]) => fn(token, url))
		);
	}
}
