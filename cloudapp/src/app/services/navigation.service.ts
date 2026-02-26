import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class NavigationService {
	private navigateToListUsers$ = new Subject<string>();

	/** Emits a search term to navigate to List Users tab. */
	public get listUsersNavigation$(): Observable<string> {
		return this.navigateToListUsers$.asObservable();
	}

	/** Request navigation to List Users tab with a pre-filled search. */
	public goToListUsers(searchTerm: string): void {
		this.navigateToListUsers$.next(searchTerm);
	}
}
