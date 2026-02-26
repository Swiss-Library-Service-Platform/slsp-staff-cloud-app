import { Component, Input } from '@angular/core';

import { UserType } from '../../../models/user.model';

@Component({
	selector: 'app-user-type-chip',
	templateUrl: './user-type-chip.component.html',
	styleUrls: ['./user-type-chip.component.scss'],
})
export class UserTypeChipComponent {
	@Input() public userType: UserType = 'staff';
}
