import {
	Component,
	ElementRef,
	HostBinding,
	HostListener,
	inject,
	Input,
} from '@angular/core';

import { LinkUser } from '../../../models/user.model';

@Component({
	selector: 'app-link-status-tooltip',
	templateUrl: './link-status-tooltip.component.html',
	styleUrls: ['./link-status-tooltip.component.scss'],
})
export class LinkStatusTooltipComponent {
	@Input() public user!: LinkUser;

	@HostBinding('class.tooltip-wrapper') public tooltipWrapper = true;

	public isVisible = false;
	public tooltipStyle: { top: string; left: string } = { top: '0', left: '0' };

	private elementRef = inject(ElementRef<HTMLElement>);

	@HostListener('mouseenter')
	public onMouseEnter(): void {
		this.calculatePosition();
		this.isVisible = true;
	}

	@HostListener('mouseleave')
	public onMouseLeave(): void {
		this.isVisible = false;
	}

	private calculatePosition(): void {
		const rect = this.elementRef.nativeElement.getBoundingClientRect();
		const tooltipWidth = 200;
		const arrowOffset = 8;

		this.tooltipStyle = {
			top: `${rect.top + rect.height / 2}px`,
			left: `${rect.left - tooltipWidth - arrowOffset}px`,
		};
	}
}
