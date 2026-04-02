export type UserType = 'staff' | 'eduid';

export interface LinkUser {
	primaryId: string;
	fullName: string;
	firstName?: string;
	lastName?: string;
	userType: UserType;
	isLinked?: boolean;
	linkedTo?: string[];
	linkCount?: number;
	hasDisabledLinks?: boolean;
	emails?: string[];
}

export interface LinkSelection {
	staff: LinkUser | null;
	eduid: LinkUser | null;
}

export interface StaffLink {
	id: number;
	almaPrimaryId: string;
	givenName: string;
	surname: string;
	isEnabled: boolean;
	libraryCodes: string[];
	createdAt: string;
}

export interface EduIdGroup {
	eduIdPersonalId: string;
	eduIdGivenName?: string;
	eduIdSurname?: string;
	staffLinks: StaffLink[];
}
