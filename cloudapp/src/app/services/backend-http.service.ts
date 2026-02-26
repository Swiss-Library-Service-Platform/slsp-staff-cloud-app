import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CloudAppEventsService } from '@exlibris/exl-cloudapp-angular-lib';
import { Observable, of } from 'rxjs';
import { finalize, shareReplay, switchMap, tap } from 'rxjs/operators';

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
	private eventsService = inject(CloudAppEventsService);
	private http = inject(HttpClient);

	// TODO: Move to environment config for production
	private readonly baseUrl = 'http://localhost:8080';

	// Token cache — avoids serialized getAuthToken() bottleneck
	private cachedToken: string | null = null;
	private tokenExpiry = 0;
	private tokenInFlight$: Observable<string> | null = null;
	private readonly TOKEN_TTL = 30_000; // 30 seconds

	/**
	 * GET request to backend API.
	 */
	public get<T>(path: string): Observable<T> {
		return this.withAuth((token) =>
			this.http.get<T>(`${this.baseUrl}${path}`, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * POST request to backend API.
	 */
	public post<T>(path: string, body: unknown): Observable<T> {
		return this.withAuth((token) =>
			this.http.post<T>(`${this.baseUrl}${path}`, body, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * PUT request to backend API.
	 */
	public put<T>(path: string, body: unknown): Observable<T> {
		return this.withAuth((token) =>
			this.http.put<T>(`${this.baseUrl}${path}`, body, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * PATCH request to backend API.
	 */
	public patch<T>(path: string, body: unknown): Observable<T> {
		return this.withAuth((token) =>
			this.http.patch<T>(`${this.baseUrl}${path}`, body, {
				headers: { Authorization: `Bearer ${token}` },
			})
		);
	}

	/**
	 * DELETE request to backend API.
	 */
	public delete<T>(path: string): Observable<T> {
		return this.withAuth((token) =>
			this.http.delete<T>(`${this.baseUrl}${path}`, {
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
	 * Wraps an HTTP call with authentication token injection.
	 */
	private withAuth<T>(
		fn: (token: string) => Observable<T>
	): Observable<T> {
		return this.getToken().pipe(switchMap(fn));
	}
}
