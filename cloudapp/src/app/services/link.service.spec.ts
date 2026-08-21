import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BackendHttpService } from './backend-http.service';
import { LinkResponse, LinkService } from './link.service';

describe('LinkService', () => {
	let backend: jasmine.SpyObj<BackendHttpService>;
	let service: LinkService;
	const response = {
		id: 1,
		almaPrimaryId: 'temporary.person@example.ch',
		eduIdPersonalId: '123456789@eduid.ch',
		isAtam: true,
		isEnabled: true,
		startDate: null,
		endDate: null,
		isActive: true,
		izCode: '41SLSP_HES',
		createdAt: '2026-08-21T12:00:00',
	} as LinkResponse;

	beforeEach(() => {
		backend = jasmine.createSpyObj<BackendHttpService>('BackendHttpService', [
			'post',
		]);
		backend.post.and.returnValue(of(response));

		TestBed.configureTestingModule({
			providers: [
				LinkService,
				{ provide: BackendHttpService, useValue: backend },
			],
		});

		service = TestBed.inject(LinkService);
	});

	it('sends the explicit ATAM flag when creating a link', () => {
		service
			.createLink(
				'temporary.person@example.ch',
				'123456789@eduid.ch',
				true,
				null,
				null,
			)
			.subscribe();

		expect(backend.post).toHaveBeenCalledOnceWith('/api/cloudapp/links', {
			almaPrimaryId: 'temporary.person@example.ch',
			eduIdPersonalId: '123456789@eduid.ch',
			atam: true,
			startDate: null,
			endDate: null,
		});
	});

	it('sends false for a normal Alma link', () => {
		service
			.createLink('normal.person@example.ch', '123456789@eduid.ch', false)
			.subscribe();

		expect(backend.post).toHaveBeenCalledOnceWith('/api/cloudapp/links', {
			almaPrimaryId: 'normal.person@example.ch',
			eduIdPersonalId: '123456789@eduid.ch',
			atam: false,
		});
	});
});
