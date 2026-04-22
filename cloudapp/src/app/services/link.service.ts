import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { BackendError } from '../models/backend-error.model';
import { StaffUserGroup } from '../models/user.model';
import { parseBackendError } from '../utils/backend-error';
import { BackendHttpService } from './backend-http.service';

/**
 * Request to create a new staff-to-eduID link.
 */
export interface CreateLinkRequest {
	almaPrimaryId: string;
	eduIdPersonalId: string;
	startDate?: string | null;
	endDate?: string | null;
}

/**
 * Request to update an existing link (enable/disable, schedule dates).
 */
export interface UpdateLinkRequest {
	isEnabled?: boolean | null;
	startDate?: string | null;
	endDate?: string | null;
}

/**
 * Response from successful link creation or update.
 */
export interface LinkResponse {
	id: number;
	almaPrimaryId: string;
	slspUniqueId: string;
	eduIdPersonalId: string;
	isEnabled: boolean;
	startDate: string | null;
	endDate: string | null;
	isActive: boolean;
	givenName?: string;
	surname?: string;
	eduIdGivenName?: string;
	eduIdSurname?: string;
	izCode: string;
	createdAt: string;
}

/**
 * Result type for link operations.
 */
export type CreateLinkResult =
	| { status: 'success'; link: LinkResponse }
	| { status: 'error'; error: BackendError };

/**
 * Result type for toggle operations.
 */
export type ToggleLinkResult =
	| { status: 'success'; link: LinkResponse }
	| { status: 'error'; error: BackendError };

/**
 * Result type for delete operations.
 */
export type DeleteLinkResult =
	| { status: 'success' }
	| { status: 'error'; error: BackendError };

/**
 * Aggregate staff user and link counts.
 */
export interface LinksSummary {
	staffUsers: number;
	linkedUsers: number;
	links: number;
	enabledLinks: number;
	disabledLinks: number;
	activeLinks: number;
	invalidUsers: number;
	disabledUsers: number;
	outOfScheduleUsers: number;
}

/**
 * Response from GET /api/cloudapp/links — staff users grouped with their edu-ID links.
 */
export interface LinksListResponse {
	groups: StaffUserGroup[];
	total: LinksSummary;
	filtered: LinksSummary;
}

/**
 * Status of a single link.
 */
export interface LinkStatus {
	linkId: number;
	linkedTo: string;
	givenName?: string;
	surname?: string;
	isEnabled: boolean;
	startDate: string | null;
	endDate: string | null;
	isActive: boolean;
}

/**
 * Response from batch link status lookup.
 * Each key maps to an array of links (empty array = not linked).
 */
export interface LinkStatusResponse {
	statuses: Record<string, LinkStatus[]>;
}

/**
 * Filter parameters for the list endpoint.
 */
export interface LinksFilterParams {
	search?: string;
	libraryCodes?: string[];
	enabled?: 'all' | 'enabled' | 'disabled';
	schedule?: 'all' | 'active' | 'inactive';
	linked?: 'all' | 'linked' | 'unlinked';
	validity?: 'all' | 'valid' | 'invalid';
}

@Injectable({
	providedIn: 'root',
})
export class LinkService {
	/**
	 * Emits whenever link data has been mutated (create, delete, toggle).
	 * Subscribe to this to know when to refetch link-related data.
	 */
	public readonly linksChanged$ = new Subject<void>();

	private backend = inject(BackendHttpService);

	/**
	 * Fetch distinct library codes for the current IZ.
	 * Used to populate the library code filter dropdown.
	 */
	public getLibraryCodes(): Observable<string[]> {
		return this.backend.get<string[]>('/api/cloudapp/links/library-codes');
	}

	/**
	 * Fetch all staff users grouped with their edu-ID links, with optional filters.
	 * Returns groups along with total and filtered aggregate counts.
	 */
	public getLinks(params: LinksFilterParams = {}): Observable<LinksListResponse> {
		const urlParams = new URLSearchParams();

		if (params.search) urlParams.set('search', params.search);

		if (params.libraryCodes?.length) {
			params.libraryCodes.forEach((code) => urlParams.append('libraryCode', code));
		}

		if (params.enabled && params.enabled !== 'all')
			urlParams.set('enabled', params.enabled);
		if (params.schedule && params.schedule !== 'all')
			urlParams.set('schedule', params.schedule);
		if (params.linked && params.linked !== 'all')
			urlParams.set('linked', params.linked);
		if (params.validity && params.validity !== 'all')
			urlParams.set('validity', params.validity);

		const query = urlParams.toString();

		return this.backend.get<LinksListResponse>(
			`/api/cloudapp/links${query ? '?' + query : ''}`
		);
	}

	/**
	 * Get link status for a batch of user IDs.
	 * Returns which users are already linked and to whom.
	 *
	 * @param primaryIds - Array of user primary IDs to check
	 */
	public getLinkStatuses(primaryIds: string[]): Observable<LinkStatusResponse> {
		if (primaryIds.length === 0) {
			return of({ statuses: {} });
		}

		return this.backend.post<LinkStatusResponse>('/api/cloudapp/links/status', {
			primaryIds,
		});
	}

	/**
	 * Create a new link between a staff user and an edu-ID account.
	 *
	 * @param staffPrimaryId - Alma staff user primary ID
	 * @param eduIdPersonalId - edu-ID personal identifier (e.g., 123456@eduid.ch)
	 * @param startDate - Optional start date (ISO format YYYY-MM-DD)
	 * @param endDate - Optional end date (ISO format YYYY-MM-DD)
	 */
	public createLink(
		staffPrimaryId: string,
		eduIdPersonalId: string,
		startDate?: string | null,
		endDate?: string | null
	): Observable<CreateLinkResult> {
		const request: CreateLinkRequest = {
			almaPrimaryId: staffPrimaryId,
			eduIdPersonalId,
			...(startDate !== undefined && { startDate }),
			...(endDate !== undefined && { endDate }),
		};

		return this.backend.post<LinkResponse>('/api/cloudapp/links', request).pipe(
			map(
				(link): CreateLinkResult => ({
					status: 'success',
					link,
				})
			),
			catchError(
				(error: HttpErrorResponse): Observable<CreateLinkResult> =>
					of({ status: 'error' as const, error: parseBackendError(error) })
			),
			tap((result) => {
				if (result.status === 'success') {
					this.linksChanged$.next();
				}
			})
		);
	}

	/**
	 * Update a link (enable/disable, change schedule dates).
	 *
	 * @param linkId - The link ID
	 * @param request - Fields to update (all optional, null clears a date)
	 */
	public updateLink(
		linkId: number,
		request: UpdateLinkRequest
	): Observable<ToggleLinkResult> {
		return this.backend
			.patch<LinkResponse>(`/api/cloudapp/links/${linkId}`, request)
			.pipe(
				map(
					(link): ToggleLinkResult => ({
						status: 'success',
						link,
					})
				),
				catchError(
					(error: HttpErrorResponse): Observable<ToggleLinkResult> =>
						of({
							status: 'error' as const,
							error: parseBackendError(error),
						})
				),
				tap((result) => {
					if (result.status === 'success') {
						this.linksChanged$.next();
					}
				})
			);
	}

	/**
	 * Toggle a link's enabled/disabled state.
	 * Convenience wrapper around updateLink.
	 */
	public toggleLink(
		linkId: number,
		isEnabled: boolean
	): Observable<ToggleLinkResult> {
		return this.updateLink(linkId, { isEnabled });
	}

	/**
	 * Permanently remove a link.
	 * If the staff user has no remaining links, the staff record is also deleted.
	 *
	 * @param linkId - The link ID to delete
	 */
	public deleteLink(linkId: number): Observable<DeleteLinkResult> {
		return this.backend.delete<void>(`/api/cloudapp/links/${linkId}`).pipe(
			map(
				(): DeleteLinkResult => ({
					status: 'success',
				})
			),
			catchError(
				(error: HttpErrorResponse): Observable<DeleteLinkResult> =>
					of({
						status: 'error' as const,
						error: parseBackendError(error),
					})
			),
			tap((result) => {
				if (result.status === 'success') {
					this.linksChanged$.next();
				}
			})
		);
	}
}
