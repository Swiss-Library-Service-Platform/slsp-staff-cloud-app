import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateService } from '@ngx-translate/core';
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
				{
					provide: TranslateService,
					useValue: { instant: (key: string): string => key },
				},
				{ provide: UserService, useValue: userService },
			],
		});

		component = TestBed.runInInjectionContext(
			() => new LinkAccountsComponent(),
		);
	});

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
