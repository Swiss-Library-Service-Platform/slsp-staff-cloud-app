import { Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BackendHttpService } from '../../../services/backend-http.service';

@Component({
	selector: 'app-sandbox-banner',
	templateUrl: './sandbox-banner.component.html',
	styleUrls: ['./sandbox-banner.component.scss'],
})
export class SandboxBannerComponent {
	public isSandbox$: Observable<boolean> = inject(BackendHttpService).isSandbox$();
}
