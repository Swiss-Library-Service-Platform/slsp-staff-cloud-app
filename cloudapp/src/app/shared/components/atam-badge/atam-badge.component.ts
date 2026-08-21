import { Component, Input } from '@angular/core';

@Component({
	selector: 'app-atam-badge',
	templateUrl: './atam-badge.component.html',
	styleUrls: ['./atam-badge.component.scss'],
})
export class AtamBadgeComponent {
	@Input() public matchUserTypeWidth = false;
}
