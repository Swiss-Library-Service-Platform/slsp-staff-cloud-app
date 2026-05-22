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
	contact_info?: {
		email?: Array<{
			email_address: string;
			preferred?: boolean;
		}>;
	};
}

interface UserSearchResponse {
	user?: AlmaUser[];
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
	 *
	 * Queries the ALL index (first_name, last_name, primary_id, identifiers, ...)
	 * and — when the term looks like an email — additionally the exact-match
	 * `email` index, since Alma's ALL index does not cover contact emails.
	 * Results from both indexes are merged and deduplicated by primary_id.
	 *
	 * `expand=full` returns complete user records, so no per-result detail call
	 * is needed for classification (user_group) or compatibility (contact_info).
	 */
	public searchUsers(term: string): Observable<LinkUser[]> {
		const trimmed = term.trim();

		if (!trimmed) {
			return of([]);
		}

		const all$ = this.searchByIndex('ALL', trimmed.replace(/\s+/g, '+'));
		// The `email` index is exact-match only, so a term without `@` can never
		// match it — skip that call entirely in that case.
		const email$ = trimmed.includes('@')
			? this.searchByIndex('email', trimmed)
			: of<AlmaUser[]>([]);

		return forkJoin([all$, email$]).pipe(
			map(([allUsers, emailUsers]) => {
				// Email matches first: an exact email hit is the most relevant.
				const seen = new Set<string>();
				const users: LinkUser[] = [];

				for (const almaUser of [...emailUsers, ...allUsers]) {
					if (seen.has(almaUser.primary_id)) {
						continue;
					}

					seen.add(almaUser.primary_id);

					const linkUser = this.mapToLinkUser(almaUser);

					if (linkUser) {
						users.push(linkUser);
					}
				}

				return users;
			})
		);
	}

	/**
	 * Issue a single Alma user search for one `index~value` expression.
	 * `expand=full` returns complete user records (user_group, contact_info, ...).
	 * Failures degrade to an empty list so a failing index does not break the
	 * other one.
	 */
	private searchByIndex(index: string, value: string): Observable<AlmaUser[]> {
		const url = `/users?q=${index}~${encodeURIComponent(value)}&limit=20&expand=full`;

		return this.restService.call(url).pipe(
			map((response: UserSearchResponse) => response.user ?? []),
			catchError(() => of<AlmaUser[]>([]))
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

		const emails = (user.contact_info?.email ?? [])
			.map((e) => e.email_address?.toLowerCase())
			.filter((e): e is string => !!e);

		return {
			primaryId: user.primary_id,
			fullName,
			firstName: user.first_name,
			lastName: user.last_name,
			userType,
			emails,
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
