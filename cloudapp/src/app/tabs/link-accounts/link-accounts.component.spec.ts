import { CommonModule } from '@angular/common';
import { DestroyRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { fakeAsync, tick, TestBed } from '@angular/core/testing';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY, of, Subject } from 'rxjs';

import { LinkUser } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { LinkService } from '../../services/link.service';
import { NavigationService } from '../../services/navigation.service';
import { UserService } from '../../services/user.service';
import { LinkAccountsComponent } from './link-accounts.component';

describe('LinkAccountsComponent ATAM state', () => {
	let component: LinkAccountsComponent;
	let linkService: jasmine.SpyObj<LinkService>;
	const eduId: LinkUser = {
		primaryId: '123456789@eduid.ch',
		fullName: 'Test Person',
		userType: 'eduid',
		emails: ['temporary.person@example.ch'],
	};

	beforeEach(() => {
		linkService = jasmine.createSpyObj<LinkService>(
			'LinkService',
			['createLink', 'getLinkStatuses'],
			{ linksChanged$: new Subject<void>() },
		);
		linkService.createLink.and.returnValue(
			of({
				status: 'success',
				link: {} as never,
			}),
		);

		const authService = jasmine.createSpyObj<AuthService>('AuthService', [
			'isAtamEnabled',
		]);

		authService.isAtamEnabled.and.returnValue(of(true));

		const userService = jasmine.createSpyObj<UserService>(
			'UserService',
			['getCurrentEntitiesAsUsers', 'searchUsers'],
			{ entitiesChanged$: EMPTY },
		);

		userService.getCurrentEntitiesAsUsers.and.returnValue(of([]));
		userService.searchUsers.and.returnValue(of([]));

		TestBed.configureTestingModule({
			declarations: [LinkAccountsComponent],
			imports: [
				CommonModule,
				ReactiveFormsModule,
				MatCheckboxModule,
				MatTooltipModule,
				NoopAnimationsModule,
				TranslateModule.forRoot(),
			],
			schemas: [NO_ERRORS_SCHEMA],
			providers: [
				{ provide: AlertService, useValue: { success: jasmine.createSpy() } },
				{ provide: AuthService, useValue: authService },
				{
					provide: DestroyRef,
					useValue: { onDestroy: (): void => undefined },
				},
				{ provide: LinkService, useValue: linkService },
				{
					provide: NavigationService,
					useValue: { goToListUsers: (): void => undefined },
				},
				{ provide: UserService, useValue: userService },
			],
		});

		component = TestBed.runInInjectionContext(
			() => new LinkAccountsComponent(),
		);
	});

	const staff: LinkUser = {
		primaryId: 'temporary.person@example.ch',
		fullName: 'Test Person',
		userType: 'staff',
	};

	it('submits the selected personal account in ATAM mode instead of a stale manual email', () => {
		component.selection$.next({ staff, eduid: eduId });
		component.atamEmailControl.setValue('stale@example.ch');
		component.onAtamModeChange(true);

		expect(component.selection$.value.staff).toBe(staff);
		component.onLinkAccounts();

		expect(linkService.createLink).toHaveBeenCalledOnceWith(
			'temporary.person@example.ch',
			'123456789@eduid.ch',
			true,
			null,
			null,
		);
	});

	it('keeps the selected personal account when ATAM is unchecked and submits normally', () => {
		component.selection$.next({ staff, eduid: eduId });
		component.onAtamModeChange(true);
		component.onAtamModeChange(false);
		expect(component.selection$.value.staff).toBe(staff);
		component.onLinkAccounts();
		expect(linkService.createLink).toHaveBeenCalledOnceWith(
			'temporary.person@example.ch',
			'123456789@eduid.ch',
			false,
			null,
			null,
		);
	});

	it('rejects a selected ATAM account whose email does not match the edu-ID', () => {
		component.selection$.next({
			staff: { ...staff, primaryId: 'different@example.ch' },
			eduid: eduId,
		});
		component.onAtamModeChange(true);
		component.onLinkAccounts();
		expect(linkService.createLink).not.toHaveBeenCalled();
	});

	it('returns to empty manual ATAM entry when the selected staff account is cleared', () => {
		component.selection$.next({ staff, eduid: eduId });
		component.onAtamModeChange(true);
		component.clearSelection('staff');
		component.onLinkAccounts();
		expect(component.atamMode$.value).toBeTrue();
		expect(component.atamEmailControl.value).toBe('');
		expect(linkService.createLink).not.toHaveBeenCalled();
	});

	it('offers ATAM for a selected personal account and keeps its card when checked', fakeAsync(() => {
		const fixture = TestBed.createComponent(LinkAccountsComponent);

		fixture.componentInstance.selection$.next({ staff, eduid: eduId });
		fixture.detectChanges();
		tick(400);
		fixture.detectChanges();

		const checkbox: HTMLInputElement | null =
			fixture.nativeElement.querySelector('.atam-mode-checkbox input');

		expect(checkbox).not.toBeNull();
		checkbox?.click();
		tick();
		fixture.detectChanges();
		expect(fixture.componentInstance.atamMode$.value).toBeTrue();
		expect(
			fixture.nativeElement.querySelector('.selection-box.staff .selection-id')
				?.textContent,
		).toContain('temporary.person@example.ch');
		expect(
			fixture.nativeElement.querySelector('input[type="email"]'),
		).toBeNull();
		fixture.destroy();
	}));

	it('does not offer ATAM for a selected institutional account', fakeAsync(() => {
		const fixture = TestBed.createComponent(LinkAccountsComponent);

		fixture.componentInstance.selection$.next({
			staff: { ...staff, primaryId: 'NP_DESK' },
			eduid: eduId,
		});
		fixture.detectChanges();
		tick(400);
		fixture.detectChanges();
		expect(
			fixture.nativeElement.querySelector('.atam-mode-checkbox'),
		).toBeNull();
		fixture.destroy();
	}));

	it('uses a live valid email and clears it with the ATAM mode', () => {
		component.activateAtamEntry();
		component.atamEmailControl.setValue('temporary.person@example.ch');

		expect(component.atamMode$.value).toBeTrue();
		expect(component.atamEmailControl.valid).toBeTrue();

		component.clearAtamEntry();

		expect(component.atamMode$.value).toBeFalse();
		expect(component.atamEmailControl.value).toBe('');
	});

	it('toggles ATAM entry from the checkbox and clears its state when unchecked', () => {
		component.onAtamModeChange(true);
		component.atamEmailControl.setValue('temporary.person@example.ch');
		component.atamEmailControl.markAsTouched();

		expect(component.atamMode$.value).toBeTrue();

		component.onAtamModeChange(false);

		expect(component.atamMode$.value).toBeFalse();
		expect(component.atamEmailControl.value).toBe('');
		expect(component.atamEmailControl.touched).toBeFalse();
	});

	it('shows invalid state only after a non-empty invalid email is touched', () => {
		component.activateAtamEntry();
		component.atamEmailControl.setValue('not-an-email');

		expect(component.isAtamEmailInvalid).toBeFalse();

		component.atamEmailControl.markAsTouched();

		expect(component.isAtamEmailInvalid).toBeTrue();
	});

	it('replaces ATAM entry when an Alma staff user is selected', () => {
		component.activateAtamEntry();
		component.atamEmailControl.setValue('temporary.person@example.ch');

		component.selectUser({
			primaryId: 'normal.person@example.ch',
			fullName: 'Normal Person',
			userType: 'staff',
		});

		expect(component.atamMode$.value).toBeFalse();
		expect(component.atamEmailControl.value).toBe('');
		expect(component.selection$.value.staff?.primaryId).toBe(
			'normal.person@example.ch',
		);
	});

	it('keeps ATAM entry when a compatible edu-ID user is selected', () => {
		component.activateAtamEntry();
		component.atamEmailControl.setValue('temporary.person@example.ch');

		component.selectUser(eduId);

		expect(component.atamMode$.value).toBeTrue();
		expect(component.atamEmailControl.value).toBe(
			'temporary.person@example.ch',
		);
		expect(component.selection$.value.eduid).toBe(eduId);
	});

	it('does not submit an ATAM email absent from the selected edu-ID', () => {
		component.activateAtamEntry();
		component.atamEmailControl.setValue('different.person@example.ch');
		component.atamEmailControl.markAsTouched();
		component.selection$.next({ staff: null, eduid: eduId });

		component.onLinkAccounts();

		expect(component.isAtamEmailIncompatible).toBeTrue();
		expect(linkService.createLink).not.toHaveBeenCalled();
	});

	it('submits a trimmed ATAM email and resets after success', () => {
		component.activateAtamEntry();
		component.atamEmailControl.setValue('  temporary.person@example.ch  ');
		component.selection$.next({ staff: null, eduid: eduId });

		component.onLinkAccounts();

		expect(linkService.createLink).toHaveBeenCalledOnceWith(
			'temporary.person@example.ch',
			'123456789@eduid.ch',
			true,
			null,
			null,
		);
		expect(component.atamMode$.value).toBeFalse();
		expect(component.selection$.value.eduid).toBeNull();
	});
});
