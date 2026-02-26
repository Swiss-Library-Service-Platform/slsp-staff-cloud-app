import { inject, Injectable } from '@angular/core';
import {
	CloudAppEventsService,
	CloudAppRestService,
	Entity,
} from '@exlibris/exl-cloudapp-angular-lib';
import { Observable, forkJoin, of } from 'rxjs';
import {
	catchError,
	distinctUntilChanged,
	map,
	shareReplay,
	skip,
	switchMap,
	take,
} from 'rxjs/operators';

import { LinkUser, UserType } from '../models/user.model';

interface AlmaUser {
	primary_id: string;
	first_name?: string;
	last_name?: string;
	full_name?: string;
	link?: string;
	user_group?: {
		value: string;
		desc: string;
	};
}

interface UserSearchResponse {
	user?: AlmaUser[];
	total_record_count?: number;
}

@Injectable({
	providedIn: 'root',
})
export class UserService {
	private eventsService = inject(CloudAppEventsService);
	private restService = inject(CloudAppRestService);

	private _entitiesChanged$?: Observable<Entity[]>;

	/**
	 * Emits when entities selection changes in Alma.
	 * Used to trigger data reload in components.
	 * Skips initial emission - component handles initial load separately.
	 */
	public get entitiesChanged$(): Observable<Entity[]> {
		if (!this._entitiesChanged$) {
			this._entitiesChanged$ = this.eventsService.entities$.pipe(
				distinctUntilChanged(
					(prev, curr) =>
						JSON.stringify(prev.map((e) => e.id)) ===
						JSON.stringify(curr.map((e) => e.id))
				),
				skip(1),
				shareReplay(1)
			);
		}

		return this._entitiesChanged$;
	}

	/**
	 * Get users from currently selected entities (snapshot).
	 * Takes current entities once with take(1), makes REST calls, completes.
	 * Safe from hot observable re-emission cancellation.
	 */
	public getCurrentEntitiesAsUsers(): Observable<LinkUser[]> {
		return this.eventsService.entities$.pipe(
			take(1),
			switchMap((entities: Entity[]) => {
				if (!entities || entities.length === 0) {
					return of([]);
				}

				const userEntities = entities.filter((e) => e.type === 'USER');

				if (userEntities.length === 0) {
					return of([]);
				}

				const userRequests = userEntities.map((entity) =>
					this.restService.call(entity.link).pipe(
						map((user: AlmaUser) => this.mapToLinkUser(user)),
						catchError(() => of(null))
					)
				);

				return forkJoin(userRequests).pipe(
					map((users) => users.filter((u): u is LinkUser => u !== null))
				);
			})
		);
	}

	/**
	 * Search users via REST API.
	 * Uses ALL field to search across first_name, last_name, primary_id, identifiers, etc.
	 * Fetches full user details for each result to get user_group for classification.
	 */
	public searchUsers(
		term: string,
		offset = 0,
		limit = 20
	): Observable<{ users: LinkUser[]; hasMore: boolean }> {
		const encodedTerm = encodeURIComponent(term);
		const url = `/users?q=ALL~${encodedTerm}&limit=${limit}&offset=${offset}`;

		return this.restService.call(url).pipe(
			catchError(() => of({ user: [], total_record_count: 0 } as UserSearchResponse)),
			switchMap((response: UserSearchResponse) => {
				const searchResults = response.user || [];
				const totalCount = response.total_record_count || 0;
				const hasMore = offset + searchResults.length < totalCount;

				if (searchResults.length === 0) {
					return of({ users: [], hasMore });
				}

				// Fetch full user details for each result (search returns minimal data)
				const resultsWithLink = searchResults.filter((r) => r.link);

				const userRequests = resultsWithLink.map((result) =>
					this.restService.call(result.link as string).pipe(
						map((user: AlmaUser) => this.mapToLinkUser(user)),
						catchError(() => of(null))
					)
				);

				return forkJoin(userRequests).pipe(
					map((users) => ({
						users: users.filter((u): u is LinkUser => u !== null),
						hasMore,
					}))
				);
			})
		);
	}

	/**
	 * Convert Alma user response to LinkUser model.
	 * Returns null if user is neither staff nor edu-ID.
	 */
	private mapToLinkUser(user: AlmaUser): LinkUser | null {
		const userType = this.classifyUserType(user);

		if (!userType) {
			return null;
		}

		const fullName =
			user.full_name ||
			[user.first_name, user.last_name].filter(Boolean).join(' ') ||
			user.primary_id;

		return {
			primaryId: user.primary_id,
			fullName,
			firstName: user.first_name,
			lastName: user.last_name,
			userType,
		};
	}

	/**
	 * Classify user type based on user_group and primary_id.
	 * Staff: user_group.value === '99'
	 * edu-ID: primary_id matches @eduid.ch or @*.eduid.ch
	 */
	private classifyUserType(user: AlmaUser): UserType | null {
		if (user.user_group?.value === '99') {
			return 'staff';
		}

		// Match @eduid.ch and @test.eduid.ch (or any subdomain)
		if (user.primary_id?.match(/@(.*\.)?eduid\.ch$/i)) {
			return 'eduid';
		}

		return null;
	}
}
