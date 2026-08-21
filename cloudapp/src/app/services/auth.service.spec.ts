import { TestBed } from '@angular/core/testing';
import { defer, forkJoin, of } from 'rxjs';

import { BackendHttpService } from './backend-http.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
	let backend: jasmine.SpyObj<BackendHttpService>;
	let service: AuthService;

	beforeEach(() => {
		backend = jasmine.createSpyObj<BackendHttpService>('BackendHttpService', [
			'get',
		]);

		TestBed.configureTestingModule({
			providers: [
				AuthService,
				{ provide: BackendHttpService, useValue: backend },
			],
		});

		service = TestBed.inject(AuthService);
	});

	it('shares the authorization request and exposes ATAM capability', (done) => {
		let subscriptions = 0;

		backend.get.and.returnValue(
			defer(() => {
				subscriptions += 1;

				return of({
					userName: 'admin',
					izCode: '41SLSP_HES',
					atamEnabled: true,
				});
			}),
		);

		forkJoin([
			service.checkAuth(),
			service.checkAuth(),
			service.isAtamEnabled(),
		]).subscribe(([first, second, atamEnabled]) => {
			expect(first.status).toBe('authorized');
			expect(second.status).toBe('authorized');
			expect(atamEnabled).toBeTrue();
			expect(subscriptions).toBe(1);
			expect(backend.get).toHaveBeenCalledOnceWith('/api/cloudapp/auth/me');
			done();
		});
	});
});
