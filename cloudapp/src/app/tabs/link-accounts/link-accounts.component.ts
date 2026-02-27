import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatChipListboxChange } from '@angular/material/chips';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import {
	BehaviorSubject,
	Observable,
	Subject,
	combineLatest,
	concat,
	merge,
	of,
} from 'rxjs';
import {
	catchError,
	debounceTime,
	distinctUntilChanged,
	finalize,
	map,
	shareReplay,
	switchMap,
	take,
	tap,
} from 'rxjs/operators';

import { LinkSelection, LinkUser, UserType } from '../../models/user.model';
import { LinkService, LinkStatus } from '../../services/link.service';
import { NavigationService } from '../../services/navigation.service';
import { translateBackendError } from '../../utils/backend-error';
import { UserService } from '../../services/user.service';

type FilterType = 'all' | 'staff' | 'eduid';

/**
 * View model interface - single source of truth for template
 */
interface LinkAccountsViewModel {
	users: LinkUser[];
	loading: boolean;
	error: string | null;
	filterType: FilterType;
	selection: LinkSelection;
	canLink: boolean;
}

@Component({
	selector: 'app-link-accounts',
	templateUrl: './link-accounts.component.html',
	styleUrls: ['./link-accounts.component.scss'],
})
export class LinkAccountsComponent implements OnInit {
	// Form control for search input
	public searchControl = new FormControl('');

	// User interaction subjects (kept for two-way binding)
	public filterType$ = new BehaviorSubject<FilterType>('all');
	public selection$ = new BehaviorSubject<LinkSelection>({
		staff: null,
		eduid: null,
	});

	// Single view model observable for template
	public vm$!: Observable<LinkAccountsViewModel>;

	// Cached selection for isSelected() sync checks
	public selectionSnapshot: LinkSelection = { staff: null, eduid: null };

	// Loading state for link button
	public isLinking = false;

	// Private members
	private alertService = inject(AlertService);
	private destroyRef = inject(DestroyRef);
	private linkService = inject(LinkService);
	private navigationService = inject(NavigationService);
	private translateService = inject(TranslateService);
	private userService = inject(UserService);

	private searchTerm$ = new BehaviorSubject<string>('');
	private retry$ = new Subject<void>();

	public ngOnInit(): void {
		this.setupViewModel();
		this.setupSelectionCache();
		this.setupSearchSync();
	}

	/**
	 * Select a user - replaces same type, keeps other
	 */
	public selectUser(user: LinkUser): void {
		const current = this.selection$.value;

		if (user.userType === 'staff') {
			const newStaff =
				current.staff?.primaryId === user.primaryId ? null : user;

			this.selection$.next({ ...current, staff: newStaff });
		} else {
			const newEduid =
				current.eduid?.primaryId === user.primaryId ? null : user;

			this.selection$.next({ ...current, eduid: newEduid });
		}
	}

	/**
	 * Check if user is selected (for template styling)
	 */
	public isSelected(user: LinkUser): boolean {
		const sel = this.selectionSnapshot;

		return user.userType === 'staff'
			? sel.staff?.primaryId === user.primaryId
			: sel.eduid?.primaryId === user.primaryId;
	}

	/**
	 * Clear selection slot
	 */
	public clearSelection(type: UserType): void {
		const current = this.selection$.value;

		this.selection$.next({ ...current, [type]: null });
	}

	/**
	 * Handle filter chip change
	 */
	public onFilterChange(event: MatChipListboxChange): void {
		this.filterType$.next(event.value || 'all');
	}

	/**
	 * Clear search input
	 */
	public clearSearch(): void {
		this.searchControl.setValue('');
	}

	/**
	 * Retry failed request
	 */
	public onRetry(): void {
		this.retry$.next();
	}

	/**
	 * Link the selected staff user to the selected edu-ID account.
	 */
	public onLinkAccounts(): void {
		const selection = this.selection$.value;

		if (!selection.staff || !selection.eduid) {
			return;
		}

		this.isLinking = true;

		this.linkService
			.createLink(
				selection.staff.primaryId,
				selection.eduid.primaryId,
				selection.staff.firstName,
				selection.staff.lastName
			)
			.pipe(finalize(() => (this.isLinking = false)))
			.subscribe((result) => {
				if (result.status === 'success') {
					this.alertService.success(
						this.translateService.instant('link.success')
					);
					this.clearAllSelections();
					// linksChanged$ (fired by createLink) triggers the refresh
				} else {
					this.alertService.error(
						translateBackendError(
							this.translateService,
							result.error
						)
					);
				}
			});
	}

	/**
	 * Track user by primaryId for ngFor
	 */
	public trackByPrimaryId(_index: number, user: LinkUser): string {
		return user.primaryId;
	}

	/**
	 * Handle user click - only select if user can be linked.
	 */
	public onUserClick(user: LinkUser): void {
		if (this.canSelectUser(user)) {
			this.selectUser(user);
		}
	}

	/**
	 * Navigate to List Users tab with this user's ID as search.
	 */
	public onViewLinks(user: LinkUser, event: Event): void {
		event.stopPropagation();
		this.navigationService.goToListUsers(user.primaryId);
	}

	/**
	 * Check if a user can be selected for linking.
	 * Considers existing links AND compatibility with current selection.
	 */
	public canSelectUser(user: LinkUser): boolean {
		// Staff with existing links can't be selected
		if (user.userType === 'staff' && (user.linkCount ?? 0) > 0) {
			return false;
		}

		const sel = this.selectionSnapshot;

		// When edu-ID selected, check staff compatibility
		if (sel.eduid && !sel.staff && user.userType === 'staff') {
			if (this.isPersonalAccount(user.primaryId)) {
				return sel.eduid.emails?.includes(user.primaryId.toLowerCase()) ?? false;
			}
			return true; // institutional always OK
		}

		// When staff selected, check edu-ID compatibility
		if (sel.staff && !sel.eduid && user.userType === 'eduid') {
			if (this.isPersonalAccount(sel.staff.primaryId)) {
				return user.emails?.includes(sel.staff.primaryId.toLowerCase()) ?? false;
			}
			return true; // institutional staff → all edu-ID OK
		}

		return true;
	}

	/**
	 * Check if user is disabled due to incompatibility (not due to existing links).
	 */
	public isIncompatible(user: LinkUser): boolean {
		if (user.userType === 'staff' && (user.linkCount ?? 0) > 0) {
			return false;
		}
		return !this.canSelectUser(user);
	}

	/**
	 * Clear all selections (both staff and edu-ID).
	 */
	private clearAllSelections(): void {
		this.selection$.next({ staff: null, eduid: null });
	}

	/**
	 * Setup the view model observable.
	 * Uses concat() to emit loading state declaratively in the stream,
	 * avoiding side effects that cause ExpressionChangedAfterItHasBeenCheckedError.
	 * Uses shareReplay(1) WITHOUT refCount to prevent re-execution on subscribe/unsubscribe.
	 */
	private setupViewModel(): void {
		// 1. Search term trigger - immediate initial value, then debounced for typing
		const searchTerm$ = concat(
			this.searchTerm$.pipe(take(1)),
			this.searchTerm$.pipe(debounceTime(300))
		).pipe(distinctUntilChanged());
		// 2. Entity reload trigger - always fires, bypasses distinctUntilChanged
		//    Clears both input (UX) and searchTerm$ (state) before emitting
		const entityReload$ = this.userService.entitiesChanged$.pipe(
			tap(() => {
				this.searchControl.setValue('', { emitEvent: false });
				this.searchTerm$.next('');
			}),
			map(() => '')
		);
		// 3. Retry trigger - use current search term
		const retry$ = this.retry$.pipe(map(() => this.searchTerm$.value));
		// 4. Links changed trigger - re-fetch statuses when links mutated on other tabs
		const linksRefresh$ = this.linkService.linksChanged$.pipe(
			map(() => this.searchTerm$.value)
		);
		// 5. Combine all fetch triggers
		const fetchTrigger$ = merge(
			searchTerm$,
			entityReload$,
			retry$,
			linksRefresh$
		).pipe(debounceTime(50));
		// 5. Fetch state stream - emits loading THEN result via concat()
		const fetchState$ = fetchTrigger$.pipe(
			switchMap((term) => {
				const source$ = term
					? this.userService.searchUsers(term).pipe(map((r) => r.users))
					: this.userService.getCurrentEntitiesAsUsers();

				// concat: emit loading state first, then result or error
				return concat(
					of({
						users: [] as LinkUser[],
						loading: true,
						error: null as string | null,
					}),
					source$.pipe(
						// After getting users, fetch link status and enrich
						switchMap((users) => {
							if (users.length === 0) {
								return of(users);
							}

							const ids = users.map((u) => u.primaryId);

							return this.linkService.getLinkStatuses(ids).pipe(
								map((resp) =>
									this.enrichUsersWithLinkStatus(users, resp.statuses)
								),
								catchError((err) => {
									console.warn('Failed to fetch link statuses:', err);

									return of(users);
								})
							);
						}),
						map((users) => ({
							users,
							loading: false,
							error: null as string | null,
						})),
						catchError((err) =>
							of({
								users: [] as LinkUser[],
								loading: false,
								error: err.message || 'Failed to load users',
							})
						)
					)
				);
			}),
			shareReplay(1) // NO refCount - keeps subscription alive
		);

		// 6. Combine into single view model
		this.vm$ = combineLatest([
			fetchState$,
			this.filterType$,
			this.selection$,
		]).pipe(
			map(([fetchState, filterType, selection]) => {
				const filtered =
					filterType === 'all'
						? fetchState.users
						: fetchState.users.filter(
								(u: LinkUser) => u.userType === filterType
							);

				return {
					users: filtered,
					loading: fetchState.loading,
					error: fetchState.error,
					filterType,
					selection,
					canLink: selection.staff !== null && selection.eduid !== null,
				};
			}),
			distinctUntilChanged(
				(a, b) =>
					a.loading === b.loading &&
					a.error === b.error &&
					a.users === b.users &&
					a.filterType === b.filterType &&
					a.selection === b.selection
			)
		);
	}

	private setupSelectionCache(): void {
		this.selection$
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((sel) => {
				this.selectionSnapshot = sel;
			});
	}

	private setupSearchSync(): void {
		this.searchControl.valueChanges
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((value) => {
				this.searchTerm$.next(value || '');
			});
	}

	/**
	 * Check if a primary ID is a personal account (email format with dot in domain).
	 * Personal: john.doe@ethz.ch — Institutional: SERVICE_DESK@ETH
	 */
	private isPersonalAccount(primaryId: string): boolean {
		return /^[^@]+@[^@]+\.[^@]+$/.test(primaryId);
	}

	/**
	 * Enrich users with link status information.
	 */
	private enrichUsersWithLinkStatus(
		users: LinkUser[],
		statuses: Record<string, LinkStatus[]>
	): LinkUser[] {
		return users.map((user) => {
			const links = statuses[user.primaryId] ?? [];

			return {
				...user,
				isLinked: links.length > 0,
				linkedTo: links.map((l) => l.linkedTo),
				linkCount: links.length,
				hasDisabledLinks: links.some((l) => !l.isEnabled),
			};
		});
	}
}
