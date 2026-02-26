import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MaterialModule } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateModule } from '@ngx-translate/core';

import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { LinkStatusTooltipComponent } from './components/link-status-tooltip/link-status-tooltip.component';
import { UserTypeChipComponent } from './components/user-type-chip/user-type-chip.component';

@NgModule({
	declarations: [
		ConfirmDialogComponent,
		LinkStatusTooltipComponent,
		UserTypeChipComponent,
	],
	imports: [CommonModule, MaterialModule, TranslateModule],
	exports: [
		ConfirmDialogComponent,
		LinkStatusTooltipComponent,
		UserTypeChipComponent,
		TranslateModule,
	],
})
export class SharedModule {}
