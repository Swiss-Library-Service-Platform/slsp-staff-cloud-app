import {
	AfterViewChecked,
	Component,
	ElementRef,
	HostBinding,
	HostListener,
	inject,
	Input,
	ViewChild,
} from '@angular/core';

import { LinkDetail, LinkUser } from '../../../models/user.model';

@Component({
	selector: 'app-link-status-tooltip',
	templateUrl: './link-status-tooltip.component.html',
	styleUrls: ['./link-status-tooltip.component.scss'],
})
export class LinkStatusTooltipComponent implements AfterViewChecked {
	@Input() public user!: LinkUser;

	@HostBinding('class.tooltip-wrapper') public tooltipWrapper = true;

	@ViewChild('tooltip') public tooltipEl?: ElementRef<HTMLElement>;

	public isVisible = false;
	public tooltipStyle: { top: string; left: string } = { top: '0', left: '0' };

	private elementRef = inject(ElementRef<HTMLElement>);
	private needsPositionUpdate = false;

	@HostListener('mouseenter')
	public onMouseEnter(): void {
		this.isVisible = true;
		this.needsPositionUpdate = true;
	}

	@HostListener('mouseleave')
	public onMouseLeave(): void {
		this.isVisible = false;
	}

	public ngAfterViewChecked(): void {
		if (this.needsPositionUpdate && this.tooltipEl) {
			this.needsPositionUpdate = false;
			this.calculatePosition();
		}
	}

	public getScheduleIcon(link: LinkDetail): string {
		if (!link.startDate && !link.endDate) {
			return 'event_available';
		}

		return link.isActive ? 'event_available' : 'event_busy';
	}

	public getScheduleClass(link: LinkDetail): string {
		if (!link.startDate && !link.endDate) {
			return 'no-schedule';
		}

		return link.isActive ? 'active' : 'inactive';
	}

	private calculatePosition(): void {
		const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
		const tooltipRect = this.tooltipEl!.nativeElement.getBoundingClientRect();
		const gap = 6;

		this.tooltipStyle = {
			top: `${hostRect.top + hostRect.height / 2}px`,
			left: `${hostRect.left - tooltipRect.width - gap}px`,
		};
	}
}
