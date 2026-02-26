import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabGroup } from '@angular/material/tabs';

import { NavigationService } from '../services/navigation.service';

@Component({
	selector: 'app-shell',
	templateUrl: './shell.component.html',
	styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit {
	@ViewChild(MatTabGroup) private tabGroup!: MatTabGroup;

	private destroyRef = inject(DestroyRef);
	private navigationService = inject(NavigationService);

	public ngOnInit(): void {
		this.navigationService.listUsersNavigation$
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => {
				this.tabGroup.selectedIndex = 1;
			});
	}
}
