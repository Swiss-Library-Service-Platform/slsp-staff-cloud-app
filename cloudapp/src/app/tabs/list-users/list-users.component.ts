import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
import {
	BehaviorSubject,
	EMPTY,
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
	startWith,
	switchMap,
	take,
	tap,
} from 'rxjs/operators';

import { EduIdLink, StaffUserGroup } from '../../models/user.model';
import { LinkService, LinksSummary } from '../../services/link.service';
import { NavigationService } from '../../services/navigation.service';
import {
	ConfirmDialogComponent,
	ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
	isValidEduIdId,
	isValidStaffId,
} from '../../utils/account-validation';
import {
	parseBackendError,
	translateBackendError,
} from '../../utils/backend-error';

interface ListUsersViewModel {
	groups: StaffUserGroup[];
	total: LinksSummary | null;
	filtered: LinksSummary | null;
	loading: boolean;
	error: string | null;
	unlinkedCount: number;
	invalidCount: number;
}

@Component({
	selector: 'app-list-users',
	templateUrl: './list-users.component.html',
	styleUrls: ['./list-users.component.scss'],
})
export class ListUsersComponent implements OnInit {
	public searchControl = new FormControl('');
	public libraryCodeControl = new FormControl<string[]>([]);
	public libraryCodeSearch = new FormControl('');
	public showUnlinkedControl = new FormControl(false);
	public showInvalidControl = new FormControl(false);
	public availableLibraryCodes$!: Observable<string[]>;
	public filteredLibraryCodes$!: Observable<string[]>;
	public libraryCodesLoading = true;
	public vm$!: Observable<ListUsersViewModel>;
	public toggleOverrides = new Map<number, boolean>();
	public collapsedGroups = new Set<string>();
	public togglingLinks = new Set<number>();
	public unlinkingLinks = new Set<number>();

	private alertService = inject(AlertService);
	private destroyRef = inject(DestroyRef);
	private dialog = inject(MatDialog);
	private linkService = inject(LinkService);
	private navigationService = inject(NavigationService);
	private translateService = inject(TranslateService);

	private searchTerm$ = new BehaviorSubject<string>('');
	private selectedLibraryCodes$ = new BehaviorSubject<string[]>([]);
	private retry$ = new Subject<void>();

	public ngOnInit(): void {
		this.loadLibraryCodes();
		this.setupViewModel();
		this.setupSearchSync();
		this.setupLibraryCodeSync();
		this.setupNavigationListener();
	}

	public isInvalidStaffId(almaPrimaryId: string): boolean {
		return !isValidStaffId(almaPrimaryId);
	}

	public isInvalidEduIdId(eduIdPersonalId: string): boolean {
		return !isValidEduIdId(eduIdPersonalId);
	}

	public clearSearch(): void {
		this.searchControl.setValue('');
	}

	public getLibraryFilterLabel(): string {
		const selected = this.libraryCodeControl.value || [];

		if (selected.length === 0) {
			return this.translateService.instant('listUsers.allLibraries');
		}

		if (selected.length === 1) {
			return selected[0];
		}

		return this.translateService.instant('listUsers.librariesSelected', {
			count: selected.length,
		});
	}

	public clearLibraryCodes(): void {
		this.libraryCodeControl.setValue([]);
	}

	public onRetry(): void {
		this.retry$.next();
	}

	public onToggleChange(link: EduIdLink, enabled: boolean): void {
		this.toggleOverrides.set(link.linkId, enabled);

		const messageKey = enabled
			? 'listUsers.toggleEnableMessage'
			: 'listUsers.toggleDisableMessage';
		const dialogData: ConfirmDialogData = {
			title: this.translateService.instant(
				'listUsers.toggleConfirmTitle'
			),
			message: this.translateService.instant(messageKey, {
				eduIdPersonalId: link.eduIdPersonalId,
			}),
			confirmLabel: this.translateService.instant('dialog.confirm'),
			cancelLabel: this.translateService.instant('dialog.cancel'),
		};

		this.dialog
			.open(ConfirmDialogComponent, {
				data: dialogData,
				width: '400px',
				autoFocus: false,
			})
			.afterClosed()
			.pipe(
				switchMap((confirmed) => {
					if (!confirmed) {
						this.toggleOverrides.delete(link.linkId);

						return EMPTY;
					}

					this.togglingLinks.add(link.linkId);

					return this.linkService
						.toggleLink(link.linkId, enabled)
						.pipe(
							finalize(() =>
								this.togglingLinks.delete(link.linkId)
							)
						);
				})
			)
			.subscribe((result) => {
				if (result.status === 'success') {
					this.alertService.success(
						this.translateService.instant(
							'listUsers.toggleSuccess'
						)
					);
				} else {
					this.toggleOverrides.delete(link.linkId);
					this.alertService.error(
						translateBackendError(
							this.translateService,
							result.error
						)
					);
				}
			});
	}

	public isEffectivelyEnabled(link: EduIdLink): boolean {
		const override = this.toggleOverrides.get(link.linkId);

		return override !== undefined ? override : link.isEnabled;
	}

	public toggleGroup(almaPrimaryId: string): void {
		if (this.collapsedGroups.has(almaPrimaryId)) {
			this.collapsedGroups.delete(almaPrimaryId);
		} else {
			this.collapsedGroups.add(almaPrimaryId);
		}
	}

	public isGroupCollapsed(almaPrimaryId: string): boolean {
		return this.collapsedGroups.has(almaPrimaryId);
	}

	public onUnlink(link: EduIdLink): void {
		const dialogData: ConfirmDialogData = {
			title: this.translateService.instant(
				'listUsers.unlinkConfirmTitle'
			),
			message: this.translateService.instant(
				'listUsers.unlinkConfirmMessage',
				{ eduIdPersonalId: link.eduIdPersonalId }
			),
			confirmLabel: this.translateService.instant('listUsers.unlink'),
			cancelLabel: this.translateService.instant('dialog.cancel'),
			confirmColor: 'warn',
		};

		this.dialog
			.open(ConfirmDialogComponent, {
				data: dialogData,
				width: '400px',
				autoFocus: false,
			})
			.afterClosed()
			.pipe(
				switchMap((confirmed) => {
					if (!confirmed) {
						return EMPTY;
					}

					this.unlinkingLinks.add(link.linkId);

					return this.linkService
						.deleteLink(link.linkId)
						.pipe(
							finalize(() =>
								this.unlinkingLinks.delete(link.linkId)
							)
						);
				})
			)
			.subscribe((result) => {
				if (result.status === 'success') {
					this.alertService.success(
						this.translateService.instant(
							'listUsers.unlinkSuccess'
						)
					);
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

	public isToggling(linkId: number): boolean {
		return this.togglingLinks.has(linkId);
	}

	public isUnlinking(linkId: number): boolean {
		return this.unlinkingLinks.has(linkId);
	}

	public isFiltered(): boolean {
		return !!(
			this.searchControl.value ||
			(this.libraryCodeControl.value?.length ?? 0) > 0
		);
	}

	public trackByIndex(index: number): number {
		return index;
	}

	public trackByStaffUser(_index: number, group: StaffUserGroup): string {
		return group.almaPrimaryId;
	}

	public trackByLinkId(_index: number, link: EduIdLink): number {
		return link.linkId;
	}

	private setupViewModel(): void {
		const searchTerm$ = concat(
			this.searchTerm$.pipe(take(1)),
			this.searchTerm$.pipe(debounceTime(300))
		).pipe(distinctUntilChanged());
		const libraryCodes$ = this.selectedLibraryCodes$.pipe(
			distinctUntilChanged(
				(a, b) => JSON.stringify(a) === JSON.stringify(b)
			)
		);
		const retry$ = this.retry$.pipe(
			map(() => ({
				search: this.searchTerm$.value,
				libraryCodes: this.selectedLibraryCodes$.value,
				silent: false,
			}))
		);
		const linksChanged$ = this.linkService.linksChanged$.pipe(
			map(() => ({
				search: this.searchTerm$.value,
				libraryCodes: this.selectedLibraryCodes$.value,
				silent: true,
			}))
		);
		const filterTrigger$ = merge(
			combineLatest([searchTerm$, libraryCodes$]).pipe(
				map(([search, libraryCodes]) => ({
					search,
					libraryCodes,
					silent: false,
				}))
			),
			retry$,
			linksChanged$
		).pipe(debounceTime(50));
		// API fetch stream (server-side filtering)
		const apiResult$ = filterTrigger$.pipe(
			switchMap(({ search, libraryCodes, silent }) => {
				if (!silent) {
					this.toggleOverrides.clear();
				}

				const loading$ = silent
					? EMPTY
					: of<ListUsersViewModel | null>(null);

				return concat(
					loading$,
					this.linkService
						.getLinks(
							search || undefined,
							libraryCodes.length
								? libraryCodes
								: undefined
						)
						.pipe(
							map((response) => {
								if (silent) {
									this.toggleOverrides.clear();
								}

								return response;
							}),
							catchError((err) =>
								of({
									groups: [] as StaffUserGroup[],
									total: null as LinksSummary | null,
									filtered: null as LinksSummary | null,
									error: translateBackendError(
										this.translateService,
										parseBackendError(err)
									),
								})
							)
						)
				);
			}),
			shareReplay(1)
		);
		// Client-side toggle states
		const showUnlinked$ = this.showUnlinkedControl.valueChanges.pipe(
			startWith(this.showUnlinkedControl.value)
		);
		const showInvalid$ = this.showInvalidControl.valueChanges.pipe(
			startWith(this.showInvalidControl.value)
		);

		// Combine API result with client-side toggles
		this.vm$ = combineLatest([
			apiResult$,
			showUnlinked$,
			showInvalid$,
		]).pipe(
			map(([result, showUnlinked, showInvalid]): ListUsersViewModel => {
				if (result === null) {
					return {
						groups: [],
						total: null,
						filtered: null,
						loading: true,
						error: null,
						unlinkedCount: 0,
						invalidCount: 0,
					};
				}

				if ('error' in result && result.error) {
					return {
						groups: [],
						total: null,
						filtered: null,
						loading: false,
						error: result.error as string,
						unlinkedCount: 0,
						invalidCount: 0,
					};
				}

				const allGroups = result.groups;
				// Compute counts from unfiltered groups
				const unlinkedCount = allGroups.filter(
					(g) => g.eduIdLinks.length === 0
				).length;
				const invalidCount = allGroups.filter((g) =>
					this.isInvalidStaffId(g.almaPrimaryId)
				).length;
				// Apply client-side filters
				let visibleGroups = allGroups;

				if (!showUnlinked) {
					visibleGroups = visibleGroups.filter(
						(g) => g.eduIdLinks.length > 0
					);
				}

				if (!showInvalid) {
					visibleGroups = visibleGroups.filter(
						(g) => !this.isInvalidStaffId(g.almaPrimaryId)
					);
				}

				return {
					groups: visibleGroups,
					total: 'total' in result ? result.total ?? null : null,
					filtered:
						'filtered' in result
							? result.filtered ?? null
							: null,
					loading: false,
					error: null,
					unlinkedCount,
					invalidCount,
				};
			})
		);
	}

	private setupSearchSync(): void {
		this.searchControl.valueChanges
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((value) => this.searchTerm$.next(value || ''));
	}

	private loadLibraryCodes(): void {
		this.availableLibraryCodes$ = this.linkService.getLibraryCodes().pipe(
			tap(() => (this.libraryCodesLoading = false)),
			catchError(() => {
				this.libraryCodesLoading = false;

				return of([]);
			}),
			shareReplay(1)
		);

		this.filteredLibraryCodes$ = combineLatest([
			this.availableLibraryCodes$,
			this.libraryCodeSearch.valueChanges.pipe(startWith('')),
		]).pipe(
			map(([codes, search]) => {
				if (!search) return codes;

				const lower = search.toLowerCase();

				return codes.filter((code) =>
					code.toLowerCase().includes(lower)
				);
			})
		);
	}

	private setupLibraryCodeSync(): void {
		this.libraryCodeControl.valueChanges
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((value) =>
				this.selectedLibraryCodes$.next(value || [])
			);
	}

	private setupNavigationListener(): void {
		this.navigationService.listUsersNavigation$
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((searchTerm) => {
				this.searchControl.setValue(searchTerm);
				this.libraryCodeControl.setValue([]);
			});
	}
}
