import { Component, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface EditScheduleDialogData {
	staffId: string;
	eduIdName: string;
	startDate: string | null;
	endDate: string | null;
}

export interface EditScheduleDialogResult {
	startDate: string | null;
	endDate: string | null;
}

@Component({
	selector: 'app-edit-schedule-dialog',
	templateUrl: './edit-schedule-dialog.component.html',
	styleUrls: ['./edit-schedule-dialog.component.scss'],
})
export class EditScheduleDialogComponent {
	public dialogRef = inject<
		MatDialogRef<EditScheduleDialogComponent, EditScheduleDialogResult>
	>(MatDialogRef);
	public data = inject<EditScheduleDialogData>(MAT_DIALOG_DATA);

	public startDateControl = new FormControl<Date | null>(
		this.parseDate(this.data.startDate)
	);
	public endDateControl = new FormControl<Date | null>(
		this.parseDate(this.data.endDate)
	);

	public get isDateRangeValid(): boolean {
		const start = this.startDateControl.value;
		const end = this.endDateControl.value;

		if (start && end) {
			return start <= end;
		}

		return true;
	}

	public onCancel(): void {
		this.dialogRef.close();
	}

	public onSave(): void {
		this.dialogRef.close({
			startDate: this.toIsoDate(this.startDateControl.value),
			endDate: this.toIsoDate(this.endDateControl.value),
		});
	}

	public clearStartDate(): void {
		this.startDateControl.setValue(null);
	}

	public clearEndDate(): void {
		this.endDateControl.setValue(null);
	}

	private parseDate(isoDate: string | null): Date | null {
		if (!isoDate) return null;

		return new Date(isoDate + 'T00:00:00');
	}

	private toIsoDate(date: Date | null): string | null {
		if (!date) return null;

		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

		return `${year}-${month}-${day}`;
	}
}
