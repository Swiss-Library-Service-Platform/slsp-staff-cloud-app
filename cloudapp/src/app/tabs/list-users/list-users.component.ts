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
	EditScheduleDialogComponent,
	EditScheduleDialogData,
	EditScheduleDialogResult,
} from '../../shared/components/edit-schedule-dialog/edit-schedule-dialog.component';
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
}

type ViewPreset = 'all' | 'linked' | 'invalid' | 'unlinked' | 'outOfSchedule' | 'disabled';

const VIEW_PRESET_FILTERS: Record<
	ViewPreset,
	{
		linked: 'all' | 'linked' | 'unlinked';
		enabled: 'all' | 'enabled' | 'disabled';
		schedule: 'all' | 'active' | 'inactive';
		validity: 'all' | 'valid' | 'invalid';
	}
> = {
	all: { linked: 'all', enabled: 'all', schedule: 'all', validity: 'all' },
	linked: { linked: 'linked', enabled: 'all', schedule: 'all', validity: 'all' },
	invalid: { linked: 'all', enabled: 'all', schedule: 'all', validity: 'invalid' },
	unlinked: { linked: 'unlinked', enabled: 'all', schedule: 'all', validity: 'valid' },
	outOfSchedule: { linked: 'linked', enabled: 'all', schedule: 'inactive', validity: 'all' },
	disabled: { linked: 'linked', enabled: 'disabled', schedule: 'all', validity: 'all' },
};

@Component({
	selector: 'app-list-users',
	templateUrl: './list-users.component.html',
	styleUrls: ['./list-users.component.scss'],
})
export class ListUsersComponent implements OnInit {
	public searchControl = new FormControl('');
	public libraryCodeControl = new FormControl<string[]>([]);
	public libraryCodeSearch = new FormControl('');
	public viewControl = new FormControl<ViewPreset>('linked');
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
	private selectedView$ = new BehaviorSubject<ViewPreset>('linked');
	private retry$ = new Subject<void>();

	public ngOnInit(): void {
		this.loadLibraryCodes();
		this.setupViewModel();
		this.setupSearchSync();
		this.setupLibraryCodeSync();
		this.setupFilterSyncs();
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
						) +
							' ' +
							this.translateService.instant(
								'general.cacheNote'
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
						) +
							' ' +
							this.translateService.instant(
								'general.cacheNote'
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

	public getScheduleTooltip(link: EduIdLink): string {
		const today = new Date().toISOString().split('T')[0];

		if (link.startDate && link.endDate) {
			return this.translateService.instant('listUsers.scheduleRange', {
				start: this.formatDate(link.startDate),
				end: this.formatDate(link.endDate),
			});
		}

		if (link.startDate && !link.endDate) {
			if (link.startDate > today) {
				return this.translateService.instant(
					'listUsers.scheduleNotStarted',
					{ date: this.formatDate(link.startDate) }
				);
			}

			return this.translateService.instant('listUsers.scheduleNoEnd', {
				date: this.formatDate(link.startDate),
			});
		}

		if (!link.startDate && link.endDate) {
			if (link.endDate < today) {
				return this.translateService.instant(
					'listUsers.scheduleExpired',
					{ date: this.formatDate(link.endDate) }
				);
			}

			return this.translateService.instant('listUsers.scheduleNoStart', {
				date: this.formatDate(link.endDate),
			});
		}

		return this.translateService.instant('listUsers.noSchedule');
	}

	public getScheduleIcon(link: EduIdLink): string {
		if (!link.startDate && !link.endDate) {
			return 'event_available';
		}

		return link.isActive ? 'event_available' : 'event_busy';
	}

	public onEditSchedule(
		group: StaffUserGroup,
		link: EduIdLink
	): void {
		const eduIdName = [link.eduIdGivenName, link.eduIdSurname]
			.filter(Boolean)
			.join(' ');
		const dialogData: EditScheduleDialogData = {
			staffId: group.almaPrimaryId,
			eduIdName: eduIdName || link.eduIdPersonalId,
			startDate: link.startDate,
			endDate: link.endDate,
		};

		this.dialog
			.open(EditScheduleDialogComponent, {
				data: dialogData,
				width: '350px',
				autoFocus: false,
			})
			.afterClosed()
			.pipe(
				switchMap(
					(result: EditScheduleDialogResult | undefined) => {
						if (!result) return EMPTY;

						if (
							result.startDate === link.startDate &&
							result.endDate === link.endDate
						) {
							return EMPTY;
						}

						this.togglingLinks.add(link.linkId);

						return this.linkService
							.updateLink(link.linkId, {
								startDate: result.startDate,
								endDate: result.endDate,
							})
							.pipe(
								finalize(() =>
									this.togglingLinks.delete(link.linkId)
								)
							);
					}
				)
			)
			.subscribe((result) => {
				if (result.status === 'success') {
					this.alertService.success(
						this.translateService.instant(
							'listUsers.scheduleUpdated'
						) +
							' ' +
							this.translateService.instant(
								'general.cacheNote'
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

	public isFiltered(): boolean {
		return !!(
			this.searchControl.value ||
			(this.libraryCodeControl.value?.length ?? 0) > 0 ||
			this.viewControl.value !== 'all'
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

	private getCurrentFilterParams(): {
		search: string;
		libraryCodes: string[];
		enabled: 'all' | 'enabled' | 'disabled';
		schedule: 'all' | 'active' | 'inactive';
		linked: 'all' | 'linked' | 'unlinked';
		validity: 'all' | 'valid' | 'invalid';
	} {
		const preset =
			VIEW_PRESET_FILTERS[this.selectedView$.value] ??
			VIEW_PRESET_FILTERS.linked;

		return {
			search: this.searchTerm$.value,
			libraryCodes: this.selectedLibraryCodes$.value,
			...preset,
		};
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
		const view$ = this.selectedView$.pipe(distinctUntilChanged());
		const retry$ = this.retry$.pipe(
			map(() => ({ ...this.getCurrentFilterParams(), silent: false }))
		);
		const linksChanged$ = this.linkService.linksChanged$.pipe(
			map(() => ({ ...this.getCurrentFilterParams(), silent: true }))
		);
		const filterTrigger$ = merge(
			combineLatest([searchTerm$, libraryCodes$, view$]).pipe(
				map(([search, libraryCodes, view]) => {
					const preset = VIEW_PRESET_FILTERS[view];

					return {
						search,
						libraryCodes,
						...preset,
						silent: false,
					};
				})
			),
			retry$,
			linksChanged$
		).pipe(debounceTime(50));

		this.vm$ = filterTrigger$.pipe(
			switchMap(
				({ search, libraryCodes, enabled, schedule, linked, validity, silent }) => {
					if (!silent) {
						this.toggleOverrides.clear();
					}

					const loading$ = silent
						? EMPTY
						: of<ListUsersViewModel | null>(null);

					return concat(
						loading$,
						this.linkService
							.getLinks({
								search: search || undefined,
								libraryCodes: libraryCodes.length
									? libraryCodes
									: undefined,
								enabled,
								schedule,
								linked,
								validity,
							})
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
										filtered:
											null as LinksSummary | null,
										error: translateBackendError(
											this.translateService,
											parseBackendError(err)
										),
									})
								)
							)
					);
				}
			),
			map((result): ListUsersViewModel => {
				if (result === null) {
					return {
						groups: [],
						total: null,
						filtered: null,
						loading: true,
						error: null,
					};
				}

				if ('error' in result && result.error) {
					return {
						groups: [],
						total: null,
						filtered: null,
						loading: false,
						error: result.error as string,
					};
				}

				return {
					groups: result.groups,
					total: 'total' in result ? result.total ?? null : null,
					filtered:
						'filtered' in result
							? result.filtered ?? null
							: null,
					loading: false,
					error: null,
				};
			}),
			shareReplay(1)
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

	private setupFilterSyncs(): void {
		this.viewControl.valueChanges
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((value) =>
				this.selectedView$.next(value || 'linked')
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

	private formatDate(isoDate: string): string {
		const date = new Date(isoDate + 'T00:00:00');

		return date.toLocaleDateString(
			this.translateService.currentLang || 'en',
			{ year: 'numeric', month: 'short', day: 'numeric' }
		);
	}
}
