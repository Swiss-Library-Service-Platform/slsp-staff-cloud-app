import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
	confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
	selector: 'app-confirm-dialog',
	templateUrl: './confirm-dialog.component.html',
	styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
	constructor(
		public dialogRef: MatDialogRef<ConfirmDialogComponent, boolean>,
		@Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
	) {}

	public onCancel(): void {
		this.dialogRef.close(false);
	}

	public onConfirm(): void {
		this.dialogRef.close(true);
	}
}
