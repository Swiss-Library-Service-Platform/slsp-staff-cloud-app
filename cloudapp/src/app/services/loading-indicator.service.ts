import { Injectable } from '@angular/core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class LoadingIndicatorService {
	public isLoading = new Subject<boolean>();
	public progress = new Subject<number>();
	public mode = new BehaviorSubject<ProgressSpinnerMode>('indeterminate');

	public show(): void {
		this.isLoading.next(true);
	}

	public hide(): void {
		this.isLoading.next(false);
	}

	public hasProgress(hasProgress: boolean): void {
		if (hasProgress !== null && hasProgress !== undefined) {
			if (hasProgress) {
				this.mode.next('determinate');
			} else {
				this.mode.next('indeterminate');
			}
		}
	}

	public setProgress(currentProgress: number): void {
		if (currentProgress !== null && currentProgress !== undefined) {
			this.progress.next(currentProgress);
		}
	}
}
