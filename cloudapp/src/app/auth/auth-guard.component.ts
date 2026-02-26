import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AuthResult, AuthService } from '../services/auth.service';

@Component({
	selector: 'app-auth-guard',
	standalone: true,
	imports: [
		CommonModule,
		MatProgressSpinnerModule,
		MatIconModule,
		TranslateModule,
	],
	template: `
		@switch (state) {
			@case ('loading') {
				<div class="auth-container loading">
					<mat-spinner diameter="48"></mat-spinner>
					<p>{{ 'Auth.Loading' | translate }}</p>
				</div>
			}
			@case ('unauthorized') {
				<div class="auth-container error">
					<mat-icon class="error-icon">block</mat-icon>
					<h2>{{ 'Auth.UnauthorizedTitle' | translate }}</h2>
					<p>{{ 'Auth.UnauthorizedMessage' | translate }}</p>
				</div>
			}
			@case ('error') {
				<div class="auth-container error">
					<mat-icon class="error-icon">error_outline</mat-icon>
					<h2>{{ 'Auth.ErrorTitle' | translate }}</h2>
					<p>{{ 'Auth.ErrorMessage' | translate }}</p>
				</div>
			}
		}
	`,
	styles: `
		.auth-container {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			min-height: 300px;
			padding: 2rem;
			text-align: center;
		}

		.auth-container.loading {
			gap: 1rem;
			color: var(--slsp-purple);
		}

		.auth-container.error {
			gap: 0.5rem;
		}

		.error-icon {
			font-size: 64px;
			width: 64px;
			height: 64px;
			color: var(--slsp-purple);
		}

		h2 {
			margin: 0.5rem 0;
			color: var(--slsp-purple);
		}

		p {
			margin: 0;
			color: #666;
			white-space: pre-line;
		}
	`,
})
export class AuthGuardComponent implements OnInit {
	public state: 'loading' | 'authorized' | 'unauthorized' | 'error' = 'loading';

	private authService = inject(AuthService);

	public ngOnInit(): void {
		this.authService.checkAuth().subscribe((result: AuthResult) => {
			if (result.status === 'authorized') {
				this.state = 'authorized';
			} else if (result.status === 'unauthorized') {
				this.state = 'unauthorized';
			} else {
				this.state = 'error';
			}
		});
	}
}
