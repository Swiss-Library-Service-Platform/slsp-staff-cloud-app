import {
	Component,
	HostBinding,
	HostListener,
	Input,
	OnDestroy,
} from '@angular/core';

@Component({
	selector: 'app-library-codes-tooltip',
	templateUrl: './library-codes-tooltip.component.html',
	styleUrls: ['./library-codes-tooltip.component.scss'],
})
export class LibraryCodesTooltipComponent implements OnDestroy {
	@Input() public libraryCodes: string[] = [];

	@HostBinding('class.tooltip-wrapper') public tooltipWrapper = true;

	public isVisible = false;

	private hideTimeout: ReturnType<typeof setTimeout> | null = null;

	@HostListener('mouseenter')
	public onMouseEnter(): void {
		this.cancelHide();
		this.isVisible = true;
	}

	@HostListener('mouseleave')
	public onMouseLeave(): void {
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
