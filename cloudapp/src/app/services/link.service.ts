import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { BackendError } from '../models/backend-error.model';
import { EduIdGroup } from '../models/user.model';
import { parseBackendError } from '../utils/backend-error';
import { BackendHttpService } from './backend-http.service';

/**
 * Request to create a new staff-to-eduID link.
 */
export interface CreateLinkRequest {
	almaPrimaryId: string;
	eduIdPersonalId: string;
	givenName?: string;
	surname?: string;
}

/**
 * Response from successful link creation.
 */
export interface LinkResponse {
	id: number;
	almaPrimaryId: string;
	slspUniqueId: string;
	eduIdPersonalId: string;
	isEnabled: boolean;
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
 * Aggregate link counts.
 */
export interface LinksSummary {
	eduIdAccounts: number;
	staffLinks: number;
	enabledLinks: number;
	disabledLinks: number;
}

/**
 * Response from GET /api/cloudapp/links — groups with aggregate counts.
 */
export interface LinksListResponse {
	groups: EduIdGroup[];
	total: LinksSummary;
	filtered: LinksSummary;
}

/**
 * Status of a single link.
 */
export interface LinkStatus {
	linkId: number;
	linkedTo: string;
	isEnabled: boolean;
}

/**
 * Response from batch link status lookup.
 * Each key maps to an array of links (empty array = not linked).
 */
export interface LinkStatusResponse {
	statuses: Record<string, LinkStatus[]>;
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
	 * Fetch all links grouped by edu-ID, with optional search and library code filter.
	 * Returns groups along with total and filtered aggregate counts.
	 */
	public getLinks(
		search?: string,
		libraryCodes?: string[]
	): Observable<LinksListResponse> {
		const params = new URLSearchParams();

		if (search) params.set('search', search);

		if (libraryCodes?.length) {
			libraryCodes.forEach((code) => params.append('libraryCode', code));
		}

		const query = params.toString();

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
	 * @param givenName - Optional given name for the staff user
	 * @param surname - Optional surname for the staff user
	 */
	public createLink(
		staffPrimaryId: string,
		eduIdPersonalId: string,
		givenName?: string,
		surname?: string
	): Observable<CreateLinkResult> {
		const request: CreateLinkRequest = {
			almaPrimaryId: staffPrimaryId,
			eduIdPersonalId,
			givenName,
			surname,
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
	 * Toggle a link's enabled/disabled state.
	 *
	 * @param linkId - The link ID
	 * @param isEnabled - The desired enabled state
	 */
	public toggleLink(
		linkId: number,
		isEnabled: boolean
	): Observable<ToggleLinkResult> {
		return this.backend
			.patch<LinkResponse>(`/api/cloudapp/links/${linkId}`, { isEnabled })
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
