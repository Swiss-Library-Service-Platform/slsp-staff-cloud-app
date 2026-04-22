import { ConnectedPosition } from '@angular/cdk/overlay';
import { Component, Input, OnDestroy } from '@angular/core';

@Component({
	selector: 'app-library-codes-tooltip',
	templateUrl: './library-codes-tooltip.component.html',
	styleUrls: ['./library-codes-tooltip.component.scss'],
})
export class LibraryCodesTooltipComponent implements OnDestroy {
	@Input() public libraryCodes: string[] = [];

	public isVisible = false;

	public positions: ConnectedPosition[] = [
		// Prefer left of trigger
		{
			originX: 'start',
			originY: 'center',
			overlayX: 'end',
			overlayY: 'center',
			offsetX: -6,
		},
		// Fallback: right of trigger
		{
			originX: 'end',
			originY: 'center',
			overlayX: 'start',
			overlayY: 'center',
			offsetX: 6,
		},
		// Fallback: above
		{
			originX: 'center',
			originY: 'top',
			overlayX: 'center',
			overlayY: 'bottom',
			offsetY: -6,
		},
		// Fallback: below
		{
			originX: 'center',
			originY: 'bottom',
			overlayX: 'center',
			overlayY: 'top',
			offsetY: 6,
		},
	];

	private hideTimeout: ReturnType<typeof setTimeout> | null = null;

	public onTriggerEnter(): void {
		this.cancelHide();
		this.isVisible = true;
	}

	public onTriggerLeave(): void {
		this.scheduleHide();
	}

	public onTooltipEnter(): void {
		this.cancelHide();
	}

	public onTooltipLeave(): void {
		this.scheduleHide();
	}

	public ngOnDestroy(): void {
		this.cancelHide();
	}

	private scheduleHide(): void {
		this.cancelHide();
		this.hideTimeout = setTimeout(() => {
			this.isVisible = false;
		}, 150);
	}

	private cancelHide(): void {
		if (this.hideTimeout) {
			clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}
}
