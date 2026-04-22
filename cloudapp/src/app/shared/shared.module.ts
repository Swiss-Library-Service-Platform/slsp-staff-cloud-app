import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '@exlibris/exl-cloudapp-angular-lib';
import { TranslateModule } from '@ngx-translate/core';

import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { EditScheduleDialogComponent } from './components/edit-schedule-dialog/edit-schedule-dialog.component';
import { LibraryCodesTooltipComponent } from './components/library-codes-tooltip/library-codes-tooltip.component';
import { LinkStatusTooltipComponent } from './components/link-status-tooltip/link-status-tooltip.component';
import { UserTypeChipComponent } from './components/user-type-chip/user-type-chip.component';

@NgModule({
	declarations: [
		ConfirmDialogComponent,
		EditScheduleDialogComponent,
		LibraryCodesTooltipComponent,
		LinkStatusTooltipComponent,
		UserTypeChipComponent,
	],
	imports: [CommonModule, MaterialModule, ReactiveFormsModule, TranslateModule],
	exports: [
		ConfirmDialogComponent,
		EditScheduleDialogComponent,
		LibraryCodesTooltipComponent,
		LinkStatusTooltipComponent,
		UserTypeChipComponent,
		TranslateModule,
	],
})
export class SharedModule {}
